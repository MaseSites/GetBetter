/**
 * Entwuerfe im Entwurfsordner des Postfachs (Rolle `drafts`).
 *
 * Gesichert wird per APPEND mit `\Draft`. Wer einen Entwurf weiterschreibt,
 * schickt dessen `draftId` mit: erst wird die neue Fassung abgelegt, dann die
 * alte per UID geloescht und expunged — faellt dazwischen die Verbindung, gibt
 * es hoechstens eine Fassung zu viel, nie eine zu wenig.
 *
 * Eine `draftId` ist entweder ein Griff des Dienstes (`dft_…`, gemerkt in
 * `<datenordner>/mail-drafts.json` mit Ordner, UID und Message-ID) oder die Id
 * einer `mailMessages`-Zeile im Entwurfsordner — so laesst sich auch ein Entwurf
 * weiterschreiben, den der Abgleich gefunden hat.
 */
const path = require('node:path');

const { createQueue, readJson, writeJsonAtomic } = require('../files.js');
const { load, newId, rowsOf, save } = require('../store.js');
const { MailError } = require('./connection.js');
const { resolveFolder } = require('./folders.js');
const { sequenceSet, withImap } = require('./imap.js');

const MAX_HANDLES = 500;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const DRAFT_FLAGS = ['\\Draft', '\\Seen'];

const without = (entries, key) =>
  Object.fromEntries(Object.entries(entries).filter(([name]) => name !== key));

/** Ohne Griffe, die auf die eben geloeschte Fassung zeigten. */
function pointingElsewhere(entries, place, removed) {
  if (!place || !removed) return entries;
  return Object.fromEntries(
    Object.entries(entries).filter(
      ([, entry]) =>
        !(
          entry?.mailAccountId === place.mailAccountId &&
          entry?.folder === removed.folder &&
          entry?.uid === removed.uid
        ),
    ),
  );
}

/** Nur die neuesten Griffe bleiben — wer abbricht, ohne zu loeschen, soll nichts anhaeufen. */
function newest(entries) {
  const sorted = Object.entries(entries).sort((a, b) =>
    String(b[1]?.savedAt ?? '').localeCompare(String(a[1]?.savedAt ?? '')),
  );
  return Object.fromEntries(sorted.slice(0, MAX_HANDLES));
}

function createDrafts({ dataDir, vault, sync, onRemoved = async () => {} }) {
  const file = path.join(dataDir, 'mail-drafts.json');
  const enqueue = createQueue();
  let loaded = null;
  let handles = null;

  async function all() {
    loaded = loaded ?? readJson(file, {}).catch(() => ({}));
    const initial = await loaded;
    if (handles === null) handles = initial;
    return handles;
  }

  const update = (change) =>
    enqueue(async () => {
      const next = change(await all());
      handles = next;
      await writeJsonAtomic(file, next);
    });

  async function connectionFor(mailAccountId) {
    const account = rowsOf(await load(), 'mailAccounts').find((row) => row.id === mailAccountId);
    if (!account) throw new MailError('not_found');
    const password = await vault.get(account.id).catch(() => null);
    if (password === null) throw new MailError('auth_failed');
    return sync.imapOptions(account, password);
  }

  /** Wo ein Entwurf liegt — ueber seinen Griff oder seine Zeile. `accountId` schraenkt ein. */
  async function placeOf(draftId, accountId) {
    if (typeof draftId !== 'string' || !ID_PATTERN.test(draftId)) return null;
    const entries = await all();
    const handle = Object.hasOwn(entries, draftId) ? entries[draftId] : null;
    if (handle && (accountId === undefined || handle.accountId === accountId)) {
      return { ...handle, draftId, rowId: null };
    }
    const row = rowsOf(await load(), 'mailMessages').find(
      (entry) =>
        entry.id === draftId &&
        entry.folderRole === 'drafts' &&
        (accountId === undefined || entry.accountId === accountId),
    );
    if (!row) return null;
    const state = await sync.stateOf(row.mailAccountId);
    return {
      draftId: null,
      rowId: row.id,
      accountId: row.accountId,
      mailAccountId: row.mailAccountId,
      folder: row.folder,
      uid: row.uid,
      uidValidity: state?.folders?.[row.folder]?.uidValidity ?? null,
      messageId: row.messageId ?? null,
    };
  }

  async function uidByMessageId(client, messageId) {
    if (typeof messageId !== 'string' || messageId.length === 0) return null;
    const found = await client.uidSearchHeader('Message-ID', messageId).catch(() => []);
    return found.length > 0 ? Math.max(...found) : null;
  }

  /** Die UID der eben abgelegten Fassung: aus APPENDUID, sonst per Suche nach der Message-ID. */
  async function locate(client, folder, result, messageId) {
    const code = /^APPENDUID (\d+) (\d+)$/i.exec(String(result?.code ?? '').trim());
    if (code) return { uidValidity: Number(code[1]), uid: Number(code[2]) };
    const box = await client.select(folder);
    return { uidValidity: box.uidValidity, uid: await uidByMessageId(client, messageId) };
  }

  /** Loescht eine Fassung endgueltig. Zurueck: `{ folder, uid }` oder `false`. */
  async function expunge(client, place) {
    const box = await client.select(place.folder);
    const sameBox =
      place.uidValidity === null ||
      box.uidValidity === null ||
      place.uidValidity === box.uidValidity;
    const uid = (sameBox ? place.uid : null) ?? (await uidByMessageId(client, place.messageId));
    if (!uid) return false;
    await client.expungeUids(sequenceSet([uid]));
    return { folder: place.folder, uid };
  }

  async function expungeElsewhere(place) {
    let removed = false;
    await withImap(await connectionFor(place.mailAccountId), async (client) => {
      removed = await expunge(client, place);
    });
    return removed;
  }

  /** Nimmt die Zeile der geloeschten Fassung aus der Datenbank, damit sie nicht doppelt steht. */
  async function dropRow(place, removed) {
    sync.markDeleted(place.mailAccountId, removed.folder, removed.uid);
    const db = await load();
    const messages = rowsOf(db, 'mailMessages');
    const gone = messages
      .filter(
        (row) =>
          row.id === place.rowId ||
          (row.mailAccountId === place.mailAccountId &&
            row.folder === removed.folder &&
            row.uid === removed.uid),
      )
      .map((row) => row.id);
    if (gone.length === 0) return;
    const ids = new Set(gone);
    db.tables.mailMessages = messages.filter((row) => !ids.has(row.id));
    await save();
    await onRemoved(gone);
  }

  /**
   * Legt `raw` als Entwurf in `account` ab und ersetzt den Entwurf `draftId`.
   * Zurueck kommt die `draftId` der neuen Fassung — bei einem Griff dieselbe.
   */
  async function saveDraft({ account, raw, messageId, draftId = null }) {
    const previous = draftId ? await placeOf(draftId, account.accountId) : null;
    const options = await connectionFor(account.id);
    let place = null;
    let removed = false;
    await withImap(options, async (client) => {
      const folder = await resolveFolder(client, account.folders, 'drafts');
      if (!folder) throw new MailError('folder_missing');
      const result = await client.append(folder, DRAFT_FLAGS, raw);
      place = { folder, ...(await locate(client, folder, result, messageId)) };
      if (previous && previous.mailAccountId === account.id) {
        removed = await expunge(client, previous).catch(() => false);
      }
    });
    if (previous && previous.mailAccountId !== account.id) {
      // Das Postfach gewechselt: die alte Fassung liegt anderswo.
      removed = await expungeElsewhere(previous).catch(() => false);
    }
    if (previous && !removed) {
      process.stderr.write('[mail] alte Fassung eines Entwurfs blieb liegen\n');
    }
    if (previous && removed) await dropRow(previous, removed);

    const id = previous?.draftId ?? newId('dft');
    await update((current) =>
      newest({
        ...pointingElsewhere(without(current, id), previous, removed),
        [id]: {
          accountId: account.accountId,
          mailAccountId: account.id,
          folder: place.folder,
          uid: place.uid,
          uidValidity: place.uidValidity,
          messageId,
          savedAt: new Date().toISOString(),
        },
      }),
    );
    return id;
  }

  /** Loescht einen Entwurf endgueltig. `not_found`, wenn es ihn nicht (mehr) gibt. */
  async function removeDraft(draftId) {
    const place = await placeOf(draftId);
    if (!place) throw new MailError('not_found');
    const removed = await expungeElsewhere(place);
    if (removed) await dropRow(place, removed);
    await update((current) => pointingElsewhere(without(current, place.draftId), place, removed));
    if (!removed && !place.draftId) throw new MailError('not_found');
  }

  async function forgetMailbox(mailAccountId) {
    await update((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([, entry]) => entry?.mailAccountId !== mailAccountId),
      ),
    );
  }

  return { saveDraft, removeDraft, forgetMailbox };
}

module.exports = { createDrafts };
