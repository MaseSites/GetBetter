/**
 * Was mit den Konten geschieht, fuer den Admin: jede Zeile in
 * `<datenordner>/activity.jsonl` ist ein Ereignis. Nur anhaengen, nie aendern.
 *
 * Nur, was zaehlt: Konto angelegt, Anmelden (geglueckt, falsch, gesperrt),
 * Abo und alles, was der Admin tut. Was die Nutzer in den Apps eintragen oder
 * am Profil aendern, steht hier nicht.
 *
 * Zeile: `{ at, accountId, kind, detail }`. `detail` traegt nur Namen und
 * Zahlen — nie ein Passwort, einen Nachrichtentext, den Inhalt einer Notiz,
 * eine Mail oder eine Adresse, die kein Konto hat. Waechst die Datei ueber
 * 5 MB, wird sie zu `activity.1.jsonl` (die vorige faellt weg).
 */
const fs = require('node:fs/promises');
const path = require('node:path');

const ACTIVITY_FILE = 'activity.jsonl';
const ROTATED_FILE = 'activity.1.jsonl';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_DETAIL_CHARS = 4000;
const MAX_ID_LENGTH = 100;
const KIND_PATTERN = /^[a-z][a-zA-Z]*(\.[a-z][a-zA-Z]*)*$/;
/**
 * Frueher im Verlauf, heute nicht mehr: jede Aenderung einer Sammlung, des
 * Profils und jede KI-Antwort (die steht unter Kosten). Solche Zeilen werden
 * nicht mehr geschrieben; alte bleiben in der Datei, fallen beim Lesen aber weg.
 */
const IGNORED_KINDS = new Set(['collection.changed', 'profile.updated', 'ai.reply']);

/** Je Datenordner schreibt immer nur einer — sonst verschraenken sich Zeilen beim Drehen. */
const queues = new Map();

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Nur die bekannten Felder; ein zu grosses `detail` wird zu `{ truncated: true }`. */
function lineOf(entry) {
  if (!isPlainObject(entry) || typeof entry.kind !== 'string' || !KIND_PATTERN.test(entry.kind)) {
    return null;
  }
  if (IGNORED_KINDS.has(entry.kind)) return null;
  const accountId =
    typeof entry.accountId === 'string' &&
    entry.accountId.length > 0 &&
    entry.accountId.length <= MAX_ID_LENGTH
      ? entry.accountId
      : null;
  const detail = isPlainObject(entry.detail) ? entry.detail : {};
  const fits = JSON.stringify(detail).length <= MAX_DETAIL_CHARS;
  return {
    at: typeof entry.at === 'string' ? entry.at : new Date().toISOString(),
    accountId,
    kind: entry.kind,
    detail: fits ? detail : { truncated: true },
  };
}

async function sizeOf(file) {
  try {
    return (await fs.stat(file)).size;
  } catch {
    return 0;
  }
}

async function append(dataDir, text, maxBytes) {
  const file = path.join(dataDir, ACTIVITY_FILE);
  await fs.mkdir(dataDir, { recursive: true });
  const size = await sizeOf(file);
  if (size > 0 && size + Buffer.byteLength(text) > maxBytes) {
    await fs.rename(file, path.join(dataDir, ROTATED_FILE));
  }
  await fs.appendFile(file, text, 'utf8');
}

/**
 * Haengt ein Ereignis an und gibt die geschriebene Zeile zurueck (oder null,
 * wenn `kind` fehlt oder nicht mehr protokolliert wird). `maxBytes` nur fuer Tests.
 */
async function recordActivity(dataDir, entry, { maxBytes = MAX_FILE_BYTES } = {}) {
  const line = lineOf(entry);
  if (!line) return null;
  const text = `${JSON.stringify(line)}\n`;
  const previous = queues.get(dataDir) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(() => append(dataDir, text, maxBytes));
  queues.set(dataDir, next);
  try {
    await next;
  } finally {
    if (queues.get(dataDir) === next) queues.delete(dataDir);
  }
  return line;
}

async function linesOf(file) {
  let raw;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch {
    return [];
  }
  return raw.split('\n').flatMap((text) => {
    if (text.trim().length === 0) return [];
    try {
      const entry = JSON.parse(text);
      const valid =
        isPlainObject(entry) &&
        typeof entry.at === 'string' &&
        Number.isFinite(new Date(entry.at).getTime()) &&
        typeof entry.kind === 'string' &&
        !IGNORED_KINDS.has(entry.kind);
      return valid ? [entry] : [];
    } catch {
      return [];
    }
  });
}

/** `session` passt auf `session.created`, `session.failed` …; `session.created` nur auf sich. */
const kindMatches = (entryKind, wanted) =>
  entryKind === wanted || entryKind.startsWith(`${wanted}.`);

/**
 * Ereignisse, neueste zuerst, aus beiden Dateien. `before` gilt ausschliesslich,
 * `limit` fehlt = alle. Kaputte Zeilen und `IGNORED_KINDS` fallen weg.
 */
async function readActivity(dataDir, { accountId, kind, before, limit } = {}) {
  const end = before === undefined || before === null ? null : new Date(before).getTime();
  const entries = [
    ...(await linesOf(path.join(dataDir, ROTATED_FILE))),
    ...(await linesOf(path.join(dataDir, ACTIVITY_FILE))),
  ];
  const filtered = entries.filter((entry) => {
    const at = new Date(entry.at).getTime();
    if (end !== null && Number.isFinite(end) && at >= end) return false;
    if (accountId !== undefined && entry.accountId !== accountId) return false;
    return kind === undefined || kindMatches(entry.kind, kind);
  });
  // Spaeter geschrieben heisst weiter hinten: umdrehen, dann stabil nach Zeit.
  const newest = filtered
    .reverse()
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return Number.isInteger(limit) && limit >= 0 ? newest.slice(0, limit) : newest;
}

/** Wem eine Zeile gehoert: `accountId`, sonst `ownerId`, sonst `createdBy`. */
function ownerOf(row) {
  const owner = row.accountId ?? row.ownerId ?? row.createdBy;
  return typeof owner === 'string' && owner.length > 0 ? owner : null;
}

module.exports = {
  ACTIVITY_FILE,
  IGNORED_KINDS,
  MAX_FILE_BYTES,
  ROTATED_FILE,
  kindMatches,
  ownerOf,
  readActivity,
  recordActivity,
};
