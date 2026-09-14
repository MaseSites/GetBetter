/**
 * Protokolle als JSON-Zeilen: anhaengen, drehen, lesen — fuer `ai-usage.jsonl`
 * und `speech-usage.jsonl`.
 *
 * Jede Datei hat eine Vorgaengerin (`names.rotated`): waechst sie ueber die
 * Grenze, wird sie dazu, und die vorige faellt weg. Je Datei schreibt immer nur
 * einer — sonst verschraenken sich Zeilen beim Drehen. Beim Lesen fallen kaputte
 * Zeilen und Zeilen ohne `at` weg.
 */
const fs = require('node:fs/promises');
const path = require('node:path');

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const queues = new Map();

async function sizeOf(file) {
  try {
    return (await fs.stat(file)).size;
  } catch {
    return 0;
  }
}

async function append(dataDir, names, text, maxBytes) {
  const file = path.join(dataDir, names.file);
  await fs.mkdir(dataDir, { recursive: true });
  const size = await sizeOf(file);
  if (size > 0 && size + Buffer.byteLength(text) > maxBytes) {
    await fs.rename(file, path.join(dataDir, names.rotated));
  }
  await fs.appendFile(file, text, 'utf8');
}

/** Haengt `line` als eine JSON-Zeile an `names.file` an. `maxBytes` nur fuer Tests. */
async function appendJsonLine(dataDir, names, line, { maxBytes = MAX_FILE_BYTES } = {}) {
  const text = `${JSON.stringify(line)}\n`;
  const key = path.join(dataDir, names.file);
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(() => append(dataDir, names, text, maxBytes));
  queues.set(key, next);
  try {
    await next;
  } finally {
    if (queues.get(key) === next) queues.delete(key);
  }
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
      return entry && typeof entry === 'object' && typeof entry.at === 'string' ? [entry] : [];
    } catch {
      return [];
    }
  });
}

/** Ein Zeitpunkt als Millisekunden, oder null. */
function timeOf(value) {
  if (value === undefined || value === null) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

/**
 * Alle Zeilen, aelteste zuerst (die gedrehte Datei vor der aktuellen).
 * `from` gilt einschliesslich, `to` ausschliesslich; ungueltige Grenzen gelten nicht.
 */
async function readJsonLines(dataDir, names, { from, to } = {}) {
  const start = timeOf(from);
  const end = timeOf(to);
  const entries = [
    ...(await linesOf(path.join(dataDir, names.rotated))),
    ...(await linesOf(path.join(dataDir, names.file))),
  ];
  return entries.filter((entry) => {
    const at = timeOf(entry.at);
    if (at === null) return false;
    if (start !== null && at < start) return false;
    return end === null || at < end;
  });
}

module.exports = { MAX_FILE_BYTES, appendJsonLine, readJsonLines, timeOf };
