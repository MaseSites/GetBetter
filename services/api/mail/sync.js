/**
 * Der Abgleich je Postfach (nur INBOX).
 *
 * - Erster Lauf: die letzten 50 Nachrichten, ohne Mitteilungen.
 * - Danach: neue UIDs ueber der gemerkten, Flags der vorhandenen auffrischen,
 *   was auf dem Server fehlt, entfernen.
 * - Wechselt UIDVALIDITY, wird neu aufgebaut.
 * - Hoechstens 100 Nachrichten je Postfach; Mitteilungen nur fuer neue,
 *   ungelesene nach dem Verbinden, hoechstens 20 je Lauf.
 *
 * Der Zustand (UIDVALIDITY, letzte UID) steht in `<datenordner>/mail-state.json`.
 * Erst wird alles vom Server geholt, dann in einem Zug ohne `await` in die
 * Tabellen geschrieben — so kommt keine gleichzeitige Anfrage dazwischen.
 */
const { createQueue, readJson, writeJsonAtomic } = require('../files.js');
const { buildNotification } = require('../notifications.js');
const { load, newId, rowsOf, save } = require('../store.js');
const { MailError } = require('./connection.js');
const { sequenceSet, withImap } = require('./imap.js');
const { parseMessage } = require('./mime.js');
const { VaultError } = require('./vault.js');

const FOLDER = 'INBOX';
const FIRST_SYNC = 50;
const MAX_KEEP = 100;
const MAX_NOTIFICATIONS = 20;
const FETCH_BATCH = 20;
const ARRIVAL_SLACK_MS = 10 * 60 * 1000;
const TOUCH_MEMORY_MS = 10 * 60 * 1000;
const BODY_ITEMS = '(UID FLAGS INTERNALDATE BODY.PEEK[]<0.200000>)';
const PUBLIC_ERRORS = new Set(['auth_failed', 'unreachable', 'tls_failed', 'timeout']);

const hasSeen = (flags) => (flags ?? []).some((flag) => flag.toLowerCase() === '\\seen');

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
            internalDate: entry.internalDate,
          },
        ];
      } catch {
        return [];
      }
    });
}

async function collect(client, state, knownUids) {
  const box = await client.select(FOLDER);
  const uidValidity = box.uidValidity ?? 0;
  const rebuild = !state || state.uidValidity !== uidValidity;

  if (rebuild) {
    const first = Math.max(1, box.exists - FIRST_SYNC + 1);
    const sets = [];
    for (let from = first; from <= box.exists; from += FETCH_BATCH) {
      sets.push(`${from}:${Math.min(box.exists, from + FETCH_BATCH - 1)}`);
    }
    const messages = readMessages(await fetchInBatches(client, sets, false));
    const lastUid = Math.max(0, (box.uidNext ?? 1) - 1, ...messages.map((m) => m.uid));
    return {
      rebuild,
      flags: new Map(),
      checked: new Set(),
      messages,
      state: { uidValidity, lastUid },
    };
  }

  const flags = new Map();
  if (knownUids.length > 0) {
    const current = await client.fetch(sequenceSet(knownUids), '(UID FLAGS)', { uid: true });
    for (const entry of current) if (entry.uid && entry.flags) flags.set(entry.uid, entry.flags);
  }

  let lastUid = state.lastUid;
  let messages = [];
  if (box.uidNext === null || box.uidNext > lastUid + 1) {
    const found = await client.uidSearch(`UID ${lastUid + 1}:*`);
    const fresh = found.filter((uid) => uid > lastUid).sort((a, b) => a - b);
    const wanted = fresh.slice(-MAX_KEEP);
    const sets = [];
    for (let i = 0; i < wanted.length; i += FETCH_BATCH) {
      sets.push(sequenceSet(wanted.slice(i, i + FETCH_BATCH)));
    }
    messages = readMessages(await fetchInBatches(client, sets, true));
    lastUid = fresh.length > 0 ? Math.max(lastUid, fresh[fresh.length - 1]) : lastUid;
  }
  return { rebuild, flags, checked: new Set(knownUids), messages, state: { uidValidity, lastUid } };
}

// ------------------------------------------------------------------ In die Tabellen

function toRow(account, message, rebuild) {
  const connectedAt = Date.parse(account.connectedAt) || 0;
  const internal = Date.parse(message.internalDate ?? '');
  // Alte Mails, die jemand zurueck in den Posteingang schiebt, sind keine Neuigkeit.
  const recent = Number.isNaN(internal) || internal >= connectedAt - ARRIVAL_SLACK_MS;
  return {
    id: newId('mm'),
    accountId: account.accountId,
    mailAccountId: account.id,
    folder: FOLDER,
    uid: message.uid,
    messageId: message.messageId,
    from: message.from,
    to: message.to,
    cc: message.cc,
    subject: message.subject,
    date: message.date,
    snippet: message.snippet,
    text: message.text,
    seen: message.seen,
    arrivedAfterConnect: !rebuild && recent,
  };
}

/**
 * Rechnet den neuen Stand eines Postfachs aus — ohne etwas zu schreiben.
 * `isTouched(rowId)`: lokal geaendert, seit der Abgleich lief. `isDeleted(uid)`:
 * in dieser Zeit geloescht — solche Nachrichten kommen nicht zurueck.
 */
function plan(account, mine, remote, { isTouched = () => false, isDeleted = () => false } = {}) {
  const removed = new Set();
  const seenNow = new Set();
  const updated = new Set();
  const refreshed = (remote.rebuild ? [] : mine).flatMap((row) => {
    if (row.folder !== FOLDER || !remote.checked.has(row.uid)) return [row];
    const flags = remote.flags.get(row.uid);
    if (!flags) {
      removed.add(row.id);
      return [];
    }
    const seen = hasSeen(flags);
    if (seen === row.seen || isTouched(row.id)) return [row];
    if (seen) seenNow.add(row.id);
    updated.add(row.id);
    return [{ ...row, seen }];
  });
  if (remote.rebuild) for (const row of mine) removed.add(row.id);

  const knownUids = new Set(refreshed.map((row) => row.uid));
  const arrivals = remote.messages
    .filter((message) => !knownUids.has(message.uid) && !isDeleted(message.uid))
    .map((message) => toRow(account, message, remote.rebuild));
  const ordered = [...refreshed, ...arrivals].sort((a, b) => b.uid - a.uid);
  const rows = ordered.slice(0, MAX_KEEP);
  for (const row of ordered.slice(MAX_KEEP)) removed.add(row.id);
  const kept = new Set(rows.map((row) => row.id));
  const added = arrivals.filter((row) => kept.has(row.id));
  const changed = removed.size > 0 || added.length > 0 || updated.size > 0;
  return { rows, removed, seenNow, added, changed };
}

function nextNotifications(notifications, account, result, now) {
  const refersTo = (row, ids) => row.kind === 'mail' && ids.has(row.ref?.mailMessageId);
  const existing = notifications
    .filter((row) => !refersTo(row, result.removed))
    .map((row) =>
      refersTo(row, result.seenNow) && !row.readAt ? { ...row, readAt: now.toISOString() } : row,
    );
  const announced = result.added
    .filter((row) => row.arrivedAfterConnect && !row.seen)
    .sort((a, b) => b.uid - a.uid)
    .slice(0, MAX_NOTIFICATIONS)
    .map((row) =>
      buildNotification(
        {
          accountId: row.accountId,
          kind: 'mail',
          title: (row.from.name || row.from.address).slice(0, 300),
          body: row.subject.slice(0, 300),
          ref: { mailMessageId: row.id, mailAccountId: account.id },
          app: 'getbetter',
        },
        now,
      ),
    );
  return [...existing, ...announced];
}

// ------------------------------------------------------------------ Ablauf

function createMailSync({ vault, stateFile }) {
  const states = createStateStore(stateFile);
  const inFlight = new Map();
  const recent = new Map();
  let scheduled = null;

  /** Merkt, dass eine Zeile gerade lokal geaendert wurde — ein laufender Abgleich laesst sie in Ruhe. */
  const touch = (messageId) => recent.set(`row:${messageId}`, Date.now());
  /** Merkt eine eben geloeschte UID — ein Abgleich, der sie vorher geholt hat, legt sie nicht neu an. */
  const markDeleted = (mailAccountId, uid) => recent.set(`uid:${mailAccountId}:${uid}`, Date.now());
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

  async function apply(id, remote, startedAt, manual) {
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
      isDeleted: (uid) => since(`uid:${id}:${uid}`, startedAt),
    });
    db.tables.mailMessages = [
      ...messages.filter((row) => row.mailAccountId !== id),
      ...result.rows,
    ];
    db.tables.notifications = nextNotifications(rowsOf(db, 'notifications'), account, result, now);
    db.tables.mailAccounts = accounts.map((row) =>
      row.id === id ? { ...row, lastSyncAt: now.toISOString(), lastError: null } : row,
    );
    // Ohne Aenderung keine neue Revision, sonst laden alle Apps alle zwei Minuten alles neu.
    if (result.changed || account.lastError !== null || manual) await save();
    return { mailAccountId: id, newMessages: result.added.length, error: null };
  }

  async function run(id, manual) {
    const startedAt = Date.now();
    const account = rowsOf(await load(), 'mailAccounts').find((row) => row.id === id);
    if (!account) return { mailAccountId: id, newMessages: 0, error: null };
    try {
      const password = await vault.get(id);
      if (password === null) throw new MailError('auth_failed');
      const state = await states.get(id);
      const knownUids = rowsOf(await load(), 'mailMessages')
        .filter((row) => row.mailAccountId === id && row.folder === FOLDER)
        .map((row) => row.uid);
      const remote = await withImap(imapOptions(account, password), (client) =>
        collect(client, state, knownUids),
      );
      const outcome = await apply(id, remote, startedAt, manual);
      // Wer das Postfach inzwischen getrennt hat, will auch keinen Zustand mehr.
      if (rowsOf(await load(), 'mailAccounts').some((row) => row.id === id)) {
        await states.set(id, { folder: FOLDER, ...remote.state });
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

  /** Gleicht ein Postfach ab; laeuft schon einer, wartet man auf dessen Ergebnis. */
  function syncMailAccount(id, { manual = false } = {}) {
    const running = inFlight.get(id);
    if (running) return running;
    const next = run(id, manual).finally(() => inFlight.delete(id));
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

module.exports = { createMailSync, plan, FOLDER, MAX_KEEP };
