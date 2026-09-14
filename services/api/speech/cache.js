/**
 * Der Zwischenspeicher der Stimmen: fertiges Audio in `<datenordner>/speech-cache/`.
 *
 * Der Schluessel ist ein Hash aus Modell, Stimme, Sprache und dem Satz — der
 * Satz dafuer vereinheitlicht (`keyTextOf`): Leerraum, typografische
 * Anfuehrungszeichen, Apostrophe und Striche. Gesprochen wird trotzdem, was
 * ankam; Gross/klein und Satzzeichen bleiben, sie aendern die Betonung.
 *
 * Oft gesagte Saetze bleiben: `index.json` merkt sich je Datei `hits` (wie oft
 * sie aus dem Speicher kam), `lastPlayedAt`, `characters`, `bytes` und
 * `purpose`. Wird es zu voll — Anzahl oder Megabytes —, fallen zuerst die mit
 * den wenigsten Hits, bei Gleichstand die am laengsten nicht gespielten; nie
 * der eben erzeugte Satz. Proben (`purpose: 'sample'`) liegen in `samples/`
 * und fallen nie weg. Fehlt der Index oder ist er kaputt, entsteht er neu aus
 * den Dateien (hits 0, lastPlayedAt = Aenderungszeit). Geschrieben wird er
 * nacheinander und atomar (erst eine Kopie, dann umbenennen). Nie ein Text.
 */
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const CACHE_DIR = 'speech-cache';
const SAMPLES_DIR = 'samples';
const INDEX_FILE = 'index.json';
const INDEX_VERSION = 1;
const DEFAULT_MAX_FILES = 2000;
const DEFAULT_MAX_MB = 200;
const BYTES_PER_MB = 1024 * 1024;
const TOP_LIMIT = 10;
const ID_PATTERN = /^[a-f0-9]{32}$/;
const AUDIO_NAME = /^[a-f0-9]{32}\.mp3$/;
const AUDIO_SUFFIX = '.mp3';
/** Proben zuerst: liegt dieselbe Id doppelt, gilt die Probe. */
const PURPOSES = ['sample', 'speech'];

const SINGLE_QUOTES = /[‘’‚‛′]/g;
const DOUBLE_QUOTES = /[“”„‟″«»]/g;
const DASHES = /[‐-―−]/g;

const queues = new Map();

/** Der Satz, wie er in den Schluessel geht. Gesprochen wird das Original. */
function keyTextOf(text) {
  return String(text)
    .normalize('NFC')
    .replace(SINGLE_QUOTES, "'")
    .replace(DOUBLE_QUOTES, '"')
    .replace(DASHES, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Die Id einer Datei. Proben tragen ein eigenes Zeichen und treffen nie einen gewoehnlichen Satz. */
function cacheIdOf({ model, voice, language, text, purpose = 'speech' }) {
  const parts = [model, voice, language, ...(purpose === 'sample' ? ['sample'] : []), keyTextOf(text)];
  return crypto.createHash('sha256').update(parts.join(' ')).digest('hex').slice(0, 32);
}

/** Ganze positive Zahl, auch als Text aus der Umgebung — sonst `fallback`. */
function limitOf(value, fallback) {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

/** `{ maxFiles, maxBytes }` aus Anzahl und Megabytes (`maxBytes` genau, nur fuer Tests). */
function limitsOf({ maxFiles, maxMb, maxBytes } = {}) {
  return {
    maxFiles: limitOf(maxFiles, DEFAULT_MAX_FILES),
    maxBytes: limitOf(maxBytes, limitOf(maxMb, DEFAULT_MAX_MB) * BYTES_PER_MB),
  };
}

const isCount = (value) => Number.isInteger(value) && value >= 0;
const timeValue = (value) => (typeof value === 'string' ? Date.parse(value) || 0 : 0);
const folderOf = (dir, purpose) => (purpose === 'sample' ? path.join(dir, SAMPLES_DIR) : dir);

function entryOf(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!PURPOSES.includes(raw.purpose) || !isCount(raw.hits) || !isCount(raw.bytes)) return null;
  return {
    hits: raw.hits,
    lastPlayedAt: timeValue(raw.lastPlayedAt) > 0 ? raw.lastPlayedAt : null,
    characters: isCount(raw.characters) ? raw.characters : null,
    bytes: raw.bytes,
    purpose: raw.purpose,
  };
}

/** Der gespeicherte Index — oder null, wenn er fehlt oder nicht lesbar ist. */
async function readIndexFile(dir) {
  let raw;
  try {
    raw = JSON.parse(await fs.readFile(path.join(dir, INDEX_FILE), 'utf8'));
  } catch {
    return null;
  }
  const valid =
    raw &&
    typeof raw === 'object' &&
    raw.version === INDEX_VERSION &&
    raw.entries &&
    typeof raw.entries === 'object' &&
    !Array.isArray(raw.entries);
  if (!valid) return null;
  const entries = {};
  for (const [id, value] of Object.entries(raw.entries)) {
    const entry = ID_PATTERN.test(id) ? entryOf(value) : null;
    if (entry) entries[id] = entry;
  }
  return { version: INDEX_VERSION, entries };
}

async function audioNamesIn(folder) {
  try {
    const items = await fs.readdir(folder, { withFileTypes: true });
    return items.filter((item) => item.isFile() && AUDIO_NAME.test(item.name)).map((item) => item.name);
  } catch {
    return [];
  }
}

/**
 * Index und Dateien zusammen: eine Datei ohne Eintrag kommt mit hits 0 und
 * ihrer Aenderungszeit dazu, ein Eintrag ohne Datei faellt weg.
 */
async function reconcile(dir, index) {
  const entries = {};
  for (const purpose of PURPOSES) {
    const folder = folderOf(dir, purpose);
    for (const name of await audioNamesIn(folder)) {
      const id = name.slice(0, -AUDIO_SUFFIX.length);
      if (entries[id]) continue;
      const known = index?.entries[id];
      if (known && known.purpose === purpose) {
        entries[id] = known;
        continue;
      }
      try {
        const stat = await fs.stat(path.join(folder, name));
        entries[id] = {
          hits: 0,
          lastPlayedAt: new Date(stat.mtimeMs).toISOString(),
          characters: null,
          bytes: stat.size,
          purpose,
        };
      } catch {
        // Eben weggefallen.
      }
    }
  }
  return { version: INDEX_VERSION, entries };
}

/**
 * Windows verweigert das Ersetzen, solange jemand die Datei offen hat — der
 * Admin beim Lesen, der Virenscanner bei einer frischen Datei. Darum bis zu zwei
 * Sekunden lang nochmal, mit wachsender Pause.
 */
const BUSY_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);
const RENAME_RETRY_MS = 2000;
const RENAME_STEP_MS = 10;
const RENAME_MAX_PAUSE_MS = 100;

async function renameWithRetry(from, to) {
  const deadline = Date.now() + RENAME_RETRY_MS;
  for (let attempt = 1; ; attempt += 1) {
    try {
      await fs.rename(from, to);
      return;
    } catch (error) {
      if (!BUSY_CODES.has(error?.code) || Date.now() >= deadline) throw error;
      const pause = Math.min(RENAME_STEP_MS * attempt, RENAME_MAX_PAUSE_MS);
      await new Promise((resolve) => setTimeout(resolve, pause));
    }
  }
}

async function writeIndex(dir, index) {
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, INDEX_FILE);
  const partial = `${target}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  await fs.writeFile(partial, JSON.stringify(index), 'utf8');
  try {
    await renameWithRetry(partial, target);
  } catch (error) {
    await fs.rm(partial, { force: true });
    throw error;
  }
}

/** Wenigste Hits zuerst, bei Gleichstand der am laengsten nicht gespielte. */
const byEviction = ([, a], [, b]) => a.hits - b.hits || timeValue(a.lastPlayedAt) - timeValue(b.lastPlayedAt);

function createSpeechCache({ dataDir, maxFiles, maxMb, maxBytes, now = Date.now }) {
  const dir = path.join(dataDir, CACHE_DIR);
  const limits = limitsOf({ maxFiles, maxMb, maxBytes });
  const stamp = () => new Date(now()).toISOString();
  const fileOf = (id, purpose) => path.join(folderOf(dir, purpose), `${id}${AUDIO_SUFFIX}`);

  /** Nacheinander: lesen (oder aus den Dateien bauen), aendern, atomar schreiben. */
  function mutate(change) {
    const previous = queues.get(dir) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        const index = await reconcile(dir, await readIndexFile(dir));
        const updated = await change(index);
        await writeIndex(dir, updated);
        return updated;
      });
    queues.set(dir, next);
    const settle = () => {
      if (queues.get(dir) === next) queues.delete(dir);
    };
    next.then(settle, settle);
    return next;
  }

  async function evict(index, keep) {
    const candidates = Object.entries(index.entries)
      .filter(([, entry]) => entry.purpose === 'speech')
      .sort(byEviction);
    let files = candidates.length;
    let bytes = candidates.reduce((total, [, entry]) => total + entry.bytes, 0);
    const removed = new Set();
    for (const [id, entry] of candidates) {
      if (files <= limits.maxFiles && bytes <= limits.maxBytes) break;
      if (id === keep) continue;
      try {
        await fs.rm(fileOf(id, 'speech'), { force: true });
      } catch {
        continue;
      }
      removed.add(id);
      files -= 1;
      bytes -= entry.bytes;
    }
    if (removed.size === 0) return index;
    const entries = Object.fromEntries(Object.entries(index.entries).filter(([id]) => !removed.has(id)));
    return { ...index, entries };
  }

  /** Das Audio zu einer Id — Proben zuerst — oder null. */
  async function read(id) {
    for (const purpose of PURPOSES) {
      try {
        return { bytes: await fs.readFile(fileOf(id, purpose)), purpose };
      } catch {
        // Liegt nicht dort.
      }
    }
    return null;
  }

  /** Ob es zu einer Id schon Audio gibt — ohne es zu lesen. */
  async function has(id) {
    for (const purpose of PURPOSES) {
      try {
        await fs.access(fileOf(id, purpose));
        return true;
      } catch {
        // Liegt nicht dort.
      }
    }
    return false;
  }

  /** Ein Satz kam aus dem Speicher: ein Hit mehr, jetzt gespielt. */
  function hit(id, { characters } = {}) {
    return mutate((index) => {
      const known = index.entries[id];
      if (!known) return index;
      const entry = {
        ...known,
        hits: known.hits + 1,
        lastPlayedAt: stamp(),
        characters: known.characters ?? (isCount(characters) ? characters : null),
      };
      return { ...index, entries: { ...index.entries, [id]: entry } };
    });
  }

  /** Eben erzeugt: aufnehmen, dann aufraeumen — nie diesen Satz, nie eine Probe. */
  function store(id, { purpose, characters, bytes }) {
    const kind = purpose === 'sample' ? 'sample' : 'speech';
    return mutate((index) => {
      const known = index.entries[id];
      const entry = {
        hits: known && known.purpose === kind ? known.hits : 0,
        lastPlayedAt: stamp(),
        characters: isCount(characters) ? characters : null,
        bytes: isCount(bytes) ? bytes : (known?.bytes ?? 0),
        purpose: kind,
      };
      return evict({ ...index, entries: { ...index.entries, [id]: entry } }, id);
    });
  }

  return { dir, limits, fileOf, read, has, hit, store };
}

/**
 * Fuer den Admin, nur lesen: Anzahl, Proben, Bytes, Wiedergaben aus dem
 * Speicher und die zehn meistgespielten — nur Zweck, Zeichen, Hits, Bytes und
 * wann zuletzt, nie ein Satz und nie eine Id.
 */
async function readCacheStats(dataDir, options = {}) {
  const dir = path.join(dataDir, CACHE_DIR);
  const index = await reconcile(dir, await readIndexFile(dir));
  const list = Object.values(index.entries);
  const top = list
    .filter((entry) => entry.hits > 0)
    .sort((a, b) => b.hits - a.hits || timeValue(b.lastPlayedAt) - timeValue(a.lastPlayedAt))
    .slice(0, TOP_LIMIT)
    .map(({ purpose, characters, hits, bytes, lastPlayedAt }) => ({
      purpose,
      characters,
      hits,
      bytes,
      lastPlayedAt,
    }));
  return {
    entries: list.length,
    samples: list.filter((entry) => entry.purpose === 'sample').length,
    bytes: list.reduce((total, entry) => total + entry.bytes, 0),
    replays: list.reduce((total, entry) => total + entry.hits, 0),
    ...limitsOf(options),
    top,
  };
}

module.exports = {
  CACHE_DIR,
  DEFAULT_MAX_FILES,
  DEFAULT_MAX_MB,
  INDEX_FILE,
  SAMPLES_DIR,
  cacheIdOf,
  createSpeechCache,
  keyTextOf,
  limitsOf,
  readCacheStats,
};
