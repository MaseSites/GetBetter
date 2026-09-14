/**
 * Was mit den Konten geschieht, fuer den Admin: jede Zeile in
 * `<datenordner>/activity.jsonl` ist ein Ereignis. Nur anhaengen, nie aendern.
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

/** Je Datenordner schreibt immer nur einer — sonst verschraenken sich Zeilen beim Drehen. */
const queues = new Map();

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Nur die bekannten Felder; ein zu grosses `detail` wird zu `{ truncated: true }`. */
function lineOf(entry) {
  if (!isPlainObject(entry) || typeof entry.kind !== 'string' || !KIND_PATTERN.test(entry.kind)) {
    return null;
  }
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
 * wenn `kind` fehlt). `maxBytes` nur fuer Tests.
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
        typeof entry.kind === 'string';
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
 * `limit` fehlt = alle. Kaputte Zeilen fallen weg.
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

/** JSON mit sortierten Schluesseln — dieselbe Zeile in anderer Reihenfolge ist unveraendert. */
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isPlainObject(value)) {
    const keys = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function byId(rows, omit) {
  const map = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!isPlainObject(row) || typeof row.id !== 'string') continue;
    const compared = omit.length === 0 ? row : { ...row };
    for (const field of omit) delete compared[field];
    map.set(row.id, { row, json: stableJson(compared) });
  }
  return map;
}

/**
 * Was sich zwischen zwei Fassungen einer Sammlung geaendert hat, je Besitzer:
 * `[{ accountId, added, updated, removed }]`. Verglichen wird ueber die Id;
 * Zeilen ohne Id zaehlen nicht. `accountId` ist null, wo eine Zeile keinen
 * Besitzer nennt. `owner` und `omit` (Felder, die nicht zaehlen) sind optional.
 */
function diffCollection(beforeRows, afterRows, { owner = ownerOf, omit = [] } = {}) {
  const before = byId(beforeRows, omit);
  const after = byId(afterRows, omit);
  const counts = new Map();
  const bump = (row, field) => {
    const key = owner(row);
    const current = counts.get(key) ?? { accountId: key, added: 0, updated: 0, removed: 0 };
    counts.set(key, { ...current, [field]: current[field] + 1 });
  };
  for (const [id, next] of after) {
    const previous = before.get(id);
    if (!previous) bump(next.row, 'added');
    else if (previous.json !== next.json) bump(next.row, 'updated');
  }
  for (const [id, previous] of before) {
    if (!after.has(id)) bump(previous.row, 'removed');
  }
  return [...counts.values()].filter(
    (entry) => entry.added + entry.updated + entry.removed > 0,
  );
}

module.exports = {
  ACTIVITY_FILE,
  MAX_FILE_BYTES,
  ROTATED_FILE,
  diffCollection,
  kindMatches,
  ownerOf,
  readActivity,
  recordActivity,
};
