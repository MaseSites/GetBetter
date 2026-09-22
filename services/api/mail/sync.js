/**
 * Der Abgleich je Postfach — ueber alle Ordner, die es fuehrt.
 *
 * Welche Ordner das sind, sagt der Server selbst (`folders.js`): Posteingang,
 * Gesendet, Entwuerfe, Spam, Papierkorb, Archiv. Je Ordner gilt dasselbe
 * Vorgehen wie frueher fuer INBOX allein:
 *
 * - Erster Lauf: die letzten Nachrichten, ohne Mitteilungen.
 * - Danach: neue UIDs ueber der gemerkten, Flags der vorhandenen auffrischen,
 *   was auf dem Server fehlt, entfernen.
 * - Wechselt UIDVALIDITY, wird der Ordner neu aufgebaut.
 * - Behalten wird nur das Neueste: im Posteingang mehr als in den anderen.
 *
 * Mitteilungen gibt es nur fuer neue, ungelesene im **Posteingang** — Spam
 * meldet sich nicht — und hoechstens 20 je Lauf.
 *
 * Der Zustand (je Ordner UIDVALIDITY und letzte UID) steht in
 * `<datenordner>/mail-state.json`. Erst wird alles vom Server geholt, dann in
 * einem Zug ohne `await` in die Tabellen geschrieben — so kommt keine
 * gleichzeitige Anfrage dazwischen.
 */
const { createQueue, readJson, writeJsonAtomic } = require('../files.js');
const { buildNotification } = require('../notifications.js');
const { load, newId, rowsOf, save } = require('../store.js');
const { MailError } = require('./connection.js');
const { discoverFolders } = require('./folders.js');
const { sequenceSet, withImap } = require('./imap.js');
const { parseMessage, threadFieldsOf } = require('./mime.js');
const { attachmentsOf } = require('./structure.js');
const { assignThreads } = require('./threads.js');
const { VaultError } = require('./vault.js');

const INBOX = 'inbox';
/** Wie viele beim ersten Lauf geholt werden. */
const FIRST_SYNC = { inbox: 50, other: 25 };
/** Wie viele je Ordner bleiben. Der Posteingang traegt den Alltag, die anderen das Archiv. */
const KEEP = { inbox: 100, other: 40 };
const MAX_NOTIFICATIONS = 20;
const FETCH_BATCH = 20;
const ARRIVAL_SLACK_MS = 10 * 60 * 1000;
const TOUCH_MEMORY_MS = 10 * 60 * 1000;
const BODY_ITEMS = '(UID FLAGS INTERNALDATE BODYSTRUCTURE BODY.PEEK[]<0.200000>)';
/** Was Zeilen einer aelteren Fassung fehlt: Kopfzeilen fuer Unterhaltungen und Teilnummern. */
const BACKFILL_ITEMS = '(UID BODYSTRUCTURE BODY.PEEK[HEADER.FIELDS (BCC IN-REPLY-TO REFERENCES)])';
const PUBLIC_ERRORS = new Set(['auth_failed', 'unreachable', 'tls_failed', 'timeout']);

const firstSyncFor = (role) => (role === INBOX ? FIRST_SYNC.inbox : FIRST_SYNC.other);
const keepFor = (role) => (role === INBOX ? KEEP.inbox : KEEP.other);

const hasFlag = (flags, wanted) => (flags ?? []).some((flag) => flag.toLowerCase() === wanted);
const hasSeen = (flags) => hasFlag(flags, '\\seen');

/** Ein `NO` oder `BAD` auf einen Befehl — der Server mag diesen einen Ordner nicht. */
const isRefusal = (error) =>
  error instanceof MailError && error.code === 'protocol' && error.status;

function errorKey(error) {
  if (error instanceof VaultError) return 'auth_failed';
  if (error instanceof MailError) return PUBLIC_ERRORS.has(error.code) ? error.code : 'unreachable';
  process.stderr.write(`[mail] unerwarteter Fehler: ${error?.name ?? 'Error'}\n`);
  return 'unreachable';
}

function imapOptions(account, password) {
  return {
    host: account.imapHost,
    port: account.imapPort,
    secure: account.imapSecure,
    username: account.username,
    password,
  };
}

function createStateStore(file) {
  const enqueue = createQueue();
  let cache = null;
  const all = async () => {
    cache = cache ?? (await readJson(file, {}));
    return cache;
  };
  const write = (change) =>
    enqueue(async () => {
      cache = change(await all());
      await writeJsonAtomic(file, cache);
    });
  return {
    async get(id) {
      return (await all())[id] ?? null;
    },
    set: (id, value) => write((current) => ({ ...current, [id]: value })),
    remove: (id) =>
      write((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== id))),
  };
}

// ------------------------------------------------------------------ Vom Server holen

async function fetchInBatches(client, sets, uid) {
  let fetched = [];
  for (const set of sets) fetched = [...fetched, ...(await client.fetch(set, BODY_ITEMS, { uid }))];
  return fetched;
}

function readMessages(fetched) {
  return fetched
    .filter((entry) => entry.uid && entry.body)
    .flatMap((entry) => {
      try {
        const parsed = parseMessage(entry.body, { internalDate: entry.internalDate });
        return [
          {
            ...parsed,
            uid: entry.uid,
            seen: hasSeen(entry.flags),
            flagged: hasFlag(entry.flags, '\\flagged'),
            answered: hasFlag(entry.flags, '\\answered'),
            attachments: attachmentsOf(entry.structure),
            internalDate: entry.internalDate,
          },
        ];
      } catch {
        return [];
      }
    });
}

function batches(numbers) {
  const sets = [];
  for (let index = 0; index < numbers.length; index += FETCH_BATCH) {
    sets.push(sequenceSet(numbers.slice(index, index + FETCH_BATCH)));
  }
  return sets;
}

/** Eine Zeile aus einer aelteren Fassung des Dienstes, der Felder fehlen. */
function needsBackfill(row) {
  return (
    !Array.isArray(row.references) ||
    !Array.isArray(row.bcc) ||
    (Array.isArray(row.attachments) && row.attachments.some((entry) => entry?.part === undefined))
  );
}

/**
 * Holt fuer aeltere Zeilen nach, was ihnen fehlt — nur Kopfzeilen und
 * BODYSTRUCTURE, nie den Text. Lehnt der Server ab, bleibt es beim naechsten Mal.
 */
async function backfill(client, uids) {
  const patches = new Map();
  try {
    for (const set of batches(uids)) {
      for (const entry of await client.fetch(set, BACKFILL_ITEMS, { uid: true })) {
        if (!entry.uid || !entry.body) continue;
        patches.set(entry.uid, {
          ...threadFieldsOf(entry.body),
          ...(entry.structure ? { attachments: attachmentsOf(entry.structure) } : {}),
        });
      }
    }
  } catch (error) {
    if (!isRefusal(error)) throw error;
  }
  return patches;
}

/**
 * Einen Ordner holen: entweder ganz neu oder nur, was seit dem letzten Mal dazukam.
 * `known.uids`: die UIDs, die schon Zeilen haben; `known.stale`: welche davon nachzutragen sind.
 */
async function collectFolder(client, folder, previous, known) {
  const box = await client.select(folder.name);
  const uidValidity = box.uidValidity ?? 0;
  const rebuild = !previous || previous.uidValidity !== uidValidity;

  if (rebuild) {
    const first = Math.max(1, box.exists - firstSyncFor(folder.role) + 1);
    const sets = [];
    for (let from = first; from <= box.exists; from += FETCH_BATCH) {
      sets.push(`${from}:${Math.min(box.exists, from + FETCH_BATCH - 1)}`);
    }
    const messages = readMessages(await fetchInBatches(client, sets, false));
    const lastUid = Math.max(0, (box.uidNext ?? 1) - 1, ...messages.map((entry) => entry.uid));
    return {
      box: {
        role: folder.role,
        rebuild,
        flags: new Map(),
        checked: new Set(),
        messages,
        patches: new Map(),
      },
      state: { uidValidity, lastUid },
    };
  }

  const knownUids = known.uids;
  const flags = new Map();
  if (knownUids.length > 0) {
    const current = await client.fetch(sequenceSet(knownUids), '(UID FLAGS)', { uid: true });
    for (const entry of current) if (entry.uid && entry.flags) flags.set(entry.uid, entry.flags);
  }
  const stale = known.stale.filter((uid) => flags.has(uid));
  const patches = stale.length > 0 ? await backfill(client, stale) : new Map();

  let lastUid = previous.lastUid;
  let messages = [];
  if (box.uidNext === null || box.uidNext > lastUid + 1) {
    const found = await client.uidSearch(`UID ${lastUid + 1}:*`);
    const fresh = found.filter((uid) => uid > lastUid).sort((a, b) => a - b);
    const wanted = fresh.slice(-keepFor(folder.role));
    messages = readMessages(await fetchInBatches(client, batches(wanted), true));
    lastUid = fresh.length > 0 ? Math.max(lastUid, fresh[fresh.length - 1]) : lastUid;
  }
  return {
    box: { role: folder.role, rebuild, flags, checked: new Set(knownUids), messages, patches },
    state: { uidValidity, lastUid },
  };
}

/**
 * Alle Ordner eines Postfachs. Weigert sich der Server bei einem — etwa weil
 * er ihn eben geloescht hat —, bleibt dieser Ordner stehen, wie er war; alles
 * andere wird trotzdem abgeglichen.
 */
async function collect(client, previous, known) {
  const folders = discoverFolders(await client.list());
  const boxes = new Map();
  const skipped = new Set();
  const state = {};
  for (const folder of folders) {
    try {
      const result = await collectFolder(client, folder, previous?.folders?.[folder.name] ?? null, {
        uids: known.uids.get(folder.name) ?? [],
        stale: known.stale.get(folder.name) ?? [],
      });
      boxes.set(folder.name, result.box);
      state[folder.name] = result.state;
    } catch (error) {
      if (!isRefusal(error)) throw error;
      skipped.add(folder.name);
      const kept = previous?.folders?.[folder.name];
      if (kept) state[folder.name] = kept;
    }
  }
  return { folders, boxes, skipped, state: { folders: state } };
}

// ------------------------------------------------------------------ In die Tabellen

function toRow(account, folderName, role, message, rebuild) {
  const connectedAt = Date.parse(account.connectedAt) || 0;
  const internal = Date.parse(message.internalDate ?? '');
  // Alte Mails, die jemand zurueck in den Posteingang schiebt, sind keine Neuigkeit.
  const recent = Number.isNaN(internal) || internal >= connectedAt - ARRIVAL_SLACK_MS;
  return {
    id: newId('mm'),
    accountId: account.accountId,
    mailAccountId: account.id,
    folder: folderName,
    folderRole: role,
    uid: message.uid,
    messageId: message.messageId,
    inReplyTo: message.inReplyTo ?? null,
    references: message.references ?? [],
    // Setzt `assignThreads`, sobald alle Zeilen des Kontos beisammen sind.
    threadId: null,
    from: message.from,
    to: message.to,
    cc: message.cc,
    bcc: message.bcc ?? [],
    subject: message.subject,
    date: message.date,
    snippet: message.snippet,
    text: message.text,
    seen: message.seen,
    flagged: message.flagged,
    answered: message.answered,
    attachments: message.attachments,
    arrivedAfterConnect: !rebuild && recent,
  };
}

/** Was sich an einer bestehenden Zeile geaendert hat, wenn der Server neue Flags meldet. */
function withFlags(row, flags) {
  const next = {
    seen: hasSeen(flags),
    flagged: hasFlag(flags, '\\flagged'),
    answered: hasFlag(flags, '\\answered'),
  };
  const same =
    next.seen === row.seen && next.flagged === row.flagged && next.answered === row.answered;
  return same ? null : { ...row, ...next };
}

/** Der neue Stand eines einzelnen Ordners. */
function planFolder(account, mine, folderName, box, { isTouched, isDeleted }, into) {
  const refreshed = (box.rebuild ? [] : mine).flatMap((row) => {
    if (!box.checked.has(row.uid)) return [row];
    const flags = box.flags.get(row.uid);
    if (!flags) {
      into.removed.add(row.id);
      return [];
    }
    // Nachgetragene Kopfzeilen vertragen sich mit lokal eben geaenderten Flags.
    const patch = box.patches?.get(row.uid) ?? null;
    const next = isTouched(row.id) ? null : withFlags(row, flags);
    if (!next && !patch) return [row];
    if (next && next.seen && !row.seen) into.seenNow.add(row.id);
    into.updated.add(row.id);
    return [{ ...(next ?? row), ...(patch ?? {}) }];
  });
  if (box.rebuild) for (const row of mine) into.removed.add(row.id);

  const knownUids = new Set(refreshed.map((row) => row.uid));
  const arrivals = box.messages
    .filter((message) => !knownUids.has(message.uid) && !isDeleted(folderName, message.uid))
    .map((message) => toRow(account, folderName, box.role, message, box.rebuild));
  const ordered = [...refreshed, ...arrivals].sort((a, b) => b.uid - a.uid);
  const rows = ordered.slice(0, keepFor(box.role));
  for (const row of ordered.slice(keepFor(box.role))) into.removed.add(row.id);
  const kept = new Set(rows.map((row) => row.id));
  into.rows = [...into.rows, ...rows];
  into.added = [...into.added, ...arrivals.filter((row) => kept.has(row.id))];
}

/**
 * Rechnet den neuen Stand eines Postfachs aus — ohne etwas zu schreiben.
 * `isTouched(rowId)`: lokal geaendert, seit der Abgleich lief.
 * `isDeleted(ordner, uid)`: in dieser Zeit geloescht oder verschoben — solche
 * Nachrichten kommen nicht zurueck.
 */
function plan(account, mine, remote, { isTouched = () => false, isDeleted = () => false } = {}) {
  const into = { rows: [], added: [], removed: new Set(), seenNow: new Set(), updated: new Set() };

  const byFolder = new Map();
  for (const row of mine) byFolder.set(row.folder, [...(byFolder.get(row.folder) ?? []), row]);

  // Ein Ordner, den es nicht mehr gibt, nimmt seine Zeilen mit; einer, den der
  // Server gerade nicht hergab, bleibt unveraendert stehen.
  for (const [name, list] of byFolder) {
    if (remote.boxes.has(name)) continue;
    if (remote.skipped.has(name)) into.rows = [...into.rows, ...list];
    else for (const row of list) into.removed.add(row.id);
  }

  for (const [name, box] of remote.boxes) {
    planFolder(account, byFolder.get(name) ?? [], name, box, { isTouched, isDeleted }, into);
  }

  const changed = into.removed.size > 0 || into.added.length > 0 || into.updated.size > 0;
  return {
    rows: into.rows,
    removed: into.removed,
    seenNow: into.seenNow,
    added: into.added,
    changed,
  };
}

function nextNotifications(notifications, account, result, now, announce, threadOf = () => null) {
  const refersTo = (row, ids) => row.kind === 'mail' && ids.has(row.ref?.mailMessageId);
  const existing = notifications
    .filter((row) => !refersTo(row, result.removed))
    .map((row) =>
      refersTo(row, result.seenNow) && !row.readAt ? { ...row, readAt: now.toISOString() } : row,
    );
  if (!announce) return existing;
  const announced = result.added
    .filter((row) => row.folderRole === INBOX && row.arrivedAfterConnect && !row.seen)
    .sort((a, b) => b.uid - a.uid)
    .slice(0, MAX_NOTIFICATIONS)
    .map((row) =>
      buildNotification(
        {
          accountId: row.accountId,
          kind: 'mail',
          title: (row.from.name || row.from.address).slice(0, 300),
          body: row.subject.slice(0, 300),
          ref: {
            mailMessageId: row.id,
            mailAccountId: account.id,
            // Damit die Glocke je Unterhaltung buendeln kann.
            ...(threadOf(row.id) ? { threadId: threadOf(row.id) } : {}),
          },
          app: 'getbetter',
        },
        now,
      ),
    );
  return [...existing, ...announced];
}

const sameFolders = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// ------------------------------------------------------------------ Ablauf

function createMailSync({ vault, stateFile }) {
  const states = createStateStore(stateFile);
  const inFlight = new Map();
  const recent = new Map();
  let scheduled = null;

  /** Merkt, dass eine Zeile gerade lokal geaendert wurde — ein laufender Abgleich laesst sie in Ruhe. */
  const touch = (messageId) => recent.set(`row:${messageId}`, Date.now());
  /** Merkt eine eben geloeschte oder verschobene UID — ein Abgleich legt sie nicht neu an. */
  const markDeleted = (mailAccountId, folder, uid) =>
    recent.set(`uid:${mailAccountId}:${folder}:${uid}`, Date.now());
  const since = (key, startedAt) => (recent.get(key) ?? 0) >= startedAt;

  async function recordError(id, code) {
    const db = await load();
    const accounts = rowsOf(db, 'mailAccounts');
    const account = accounts.find((row) => row.id === id);
    if (!account || account.lastError === code) return;
    db.tables.mailAccounts = accounts.map((row) =>
      row.id === id ? { ...row, lastError: code } : row,
    );
    await save();
  }

  async function apply(id, remote, startedAt, { manual, quiet }) {
    const db = await load();
    const accounts = rowsOf(db, 'mailAccounts');
    const account = accounts.find((row) => row.id === id);
    // Waehrend des Abrufs entfernt: nichts zurueckschreiben.
    if (!account) return { mailAccountId: id, newMessages: 0, error: null };

    const now = new Date();
    const messages = rowsOf(db, 'mailMessages');
    const mine = messages.filter((row) => row.mailAccountId === id);
    const result = plan(account, mine, remote, {
      isTouched: (rowId) => since(`row:${rowId}`, startedAt),
      isDeleted: (folder, uid) => since(`uid:${id}:${folder}:${uid}`, startedAt),
    });
    // Unterhaltungen ueber alle Postfaecher des Kontos: die eigene Antwort kann aus einem anderen kommen.
    const ownAddresses = new Set(
      accounts
        .filter((row) => row.accountId === account.accountId)
        .map((row) => String(row.email ?? '').toLowerCase()),
    );
    const threaded = assignThreads(
      [...messages.filter((row) => row.mailAccountId !== id), ...result.rows],
      { accountId: account.accountId, ownAddresses },
    );
    db.tables.mailMessages = threaded.rows;
    const threads = new Map(threaded.rows.map((row) => [row.id, row.threadId]));
    db.tables.notifications = nextNotifications(
      rowsOf(db, 'notifications'),
      account,
      result,
      now,
      !quiet,
      (rowId) => threads.get(rowId) ?? null,
    );
    const foldersChanged = !sameFolders(account.folders, remote.folders);
    db.tables.mailAccounts = accounts.map((row) =>
      row.id === id
        ? { ...row, folders: remote.folders, lastSyncAt: now.toISOString(), lastError: null }
        : row,
    );
    const changed = result.changed || threaded.changed > 0 || foldersChanged;
    // Ohne Aenderung keine neue Revision, sonst laden alle Apps alle zehn Sekunden alles neu.
    if (changed || account.lastError !== null || manual) await save();
    return { mailAccountId: id, newMessages: result.added.length, error: null };
  }

  /** Welche UIDs das Postfach je Ordner schon kennt — und bei welchen etwas nachzutragen ist. */
  async function knownUids(id) {
    const uids = new Map();
    const stale = new Map();
    for (const row of rowsOf(await load(), 'mailMessages')) {
      if (row.mailAccountId !== id) continue;
      uids.set(row.folder, [...(uids.get(row.folder) ?? []), row.uid]);
      if (needsBackfill(row)) stale.set(row.folder, [...(stale.get(row.folder) ?? []), row.uid]);
    }
    return { uids, stale };
  }

  async function run(id, options) {
    const startedAt = Date.now();
    const account = rowsOf(await load(), 'mailAccounts').find((row) => row.id === id);
    if (!account) return { mailAccountId: id, newMessages: 0, error: null };
    try {
      const password = await vault.get(id);
      if (password === null) throw new MailError('auth_failed');
      const previous = await states.get(id);
      const known = await knownUids(id);
      const remote = await withImap(imapOptions(account, password), (client) =>
        collect(client, previous, known),
      );
      const outcome = await apply(id, remote, startedAt, options);
      // Wer das Postfach inzwischen getrennt hat, will auch keinen Zustand mehr.
      if (rowsOf(await load(), 'mailAccounts').some((row) => row.id === id)) {
        await states.set(id, remote.state);
      }
      return outcome;
    } catch (error) {
      const code = errorKey(error);
      await recordError(id, code);
      return { mailAccountId: id, newMessages: 0, error: code };
    } finally {
      const cutoff = Date.now() - TOUCH_MEMORY_MS;
      for (const [key, at] of recent) if (at < cutoff) recent.delete(key);
    }
  }

  /**
   * Gleicht ein Postfach ab; laeuft schon einer, wartet man auf dessen Ergebnis.
   * `quiet`: keine Mitteilungen — nach einem Verschieben ist nichts neu angekommen.
   */
  function syncMailAccount(id, { manual = false, quiet = false } = {}) {
    const running = inFlight.get(id);
    if (running) return running;
    const next = run(id, { manual, quiet }).finally(() => inFlight.delete(id));
    inFlight.set(id, next);
    return next;
  }

  async function syncAccountsOf(accountId) {
    const ids = rowsOf(await load(), 'mailAccounts')
      .filter((row) => row.accountId === accountId)
      .map((row) => row.id);
    const results = await Promise.all(ids.map((id) => syncMailAccount(id, { manual: true })));
    return {
      newMessages: results.reduce((sum, result) => sum + result.newMessages, 0),
      errors: results
        .filter((result) => result.error)
        .map((result) => ({ mailAccountId: result.mailAccountId, error: result.error })),
    };
  }

  async function syncAll() {
    const ids = rowsOf(await load(), 'mailAccounts').map((row) => row.id);
    for (const id of ids) await syncMailAccount(id);
  }

  function startScheduler(intervalMs) {
    if (!(intervalMs > 0)) return null;
    const timer = setInterval(() => {
      if (scheduled) return;
      scheduled = syncAll()
        .catch((error) => errorKey(error))
        .finally(() => {
          scheduled = null;
        });
    }, intervalMs);
    timer.unref();
    return timer;
  }

  return {
    syncMailAccount,
    syncAccountsOf,
    startScheduler,
    touch,
    markDeleted,
    stateOf: (id) => states.get(id),
    forget: (id) => states.remove(id),
    imapOptions,
    errorKey,
  };
}

module.exports = { createMailSync, plan, keepFor, needsBackfill, KEEP };
