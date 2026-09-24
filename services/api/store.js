/**
 * Der Speicher: alle Sammlungen in einer JSON-Datei im Datenordner.
 *
 * Gelesen wird einmal, danach lebt alles im Speicher. Wer etwas aendert,
 * ersetzt die Zeilen und ruft `save()` — das erhoeht die Revision, und die
 * Apps laden beim naechsten Nachfragen neu.
 */
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const { dataDir } = require('./config.js');
const { dataKey, forDisk, unseal } = require('./crypt.js');

const DATA_FILE = path.join(dataDir(), 'db.json');
/** Mit `BETTER_DATA_KEY` liegt die Datei verschluesselt (AES-256-GCM), sonst als Klartext. */
const KEY = dataKey();

/** Die Sammlungen. Dieselbe Liste wie `COLLECTION_NAMES` im Kern der Apps. */
const COLLECTIONS = [
  'accounts',
  'households',
  'householdMembers',
  'calendars',
  'calendarMembers',
  'calendarShares',
  'appAccess',
  'events',
  'tasks',
  'projects',
  'notes',
  'noteFolders',
  'shoppingItems',
  'chores',
  'alarms',
  'workouts',
  'meals',
  'drinks',
  'expenses',
  'budgets',
  'bills',
  'subscriptions',
  'savingsGoals',
  'documents',
  'habits',
  'habitTicks',
  'trips',
  'packingItems',
  'contacts',
  'notifications',
  'mailAccounts',
  'mailMessages',
];

/**
 * Diese schreibt nur der Dienst. Eine App, die sie per PUT ersetzte, wuerde
 * ueberschreiben, was der Mail-Abgleich gerade angelegt hat — oder sich selbst
 * eine Abo-Anfrage als freigeschaltet eintragen.
 */
const SERVER_OWNED = new Set(['notifications', 'mailAccounts', 'mailMessages', 'planRequests']);

/**
 * Neue Sammlungen duerfen die Apps selbst anlegen — sonst muesste der Dienst
 * bei jeder neuen Funktion neu gestartet werden. Nur der Name muss sauber sein.
 */
function isCollectionName(name) {
  return typeof name === 'string' && /^[a-z][A-Za-z0-9]{1,40}$/.test(name);
}

let data = null;
let writing = null;

function emptyDatabase() {
  const tables = {};
  for (const name of COLLECTIONS) tables[name] = [];
  return { revision: 0, tables, deleted: {} };
}

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `{ konto: { sammlung: [id] } }` aus der Datei — was nicht passt, faellt weg. */
function readDeleted(value) {
  if (!isPlainObject(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, byCollection]) => isPlainObject(byCollection))
      .map(([accountId, byCollection]) => [
        accountId,
        Object.fromEntries(
          Object.entries(byCollection)
            .filter(([, ids]) => Array.isArray(ids))
            .map(([name, ids]) => [name, ids.filter((id) => typeof id === 'string')]),
        ),
      ]),
  );
}

async function load() {
  if (data) return data;
  let raw = null;
  try {
    raw = await fs.readFile(DATA_FILE, 'utf8');
  } catch (error) {
    // Keine Datei: leer anfangen. Alles andere soll man sehen, nicht ueberschreiben.
    if (error?.code !== 'ENOENT') throw error;
  }
  if (raw === null) {
    data = emptyDatabase();
    return data;
  }
  // Unlesbar (kaputt, falscher oder fehlender Schluessel) heisst: nicht starten —
  // ein leerer Stand wuerde beim naechsten Speichern alles ueberschreiben.
  {
    const parsed = JSON.parse(unseal(KEY, raw));
    const next = emptyDatabase();
    next.revision = Number(parsed.revision ?? 0);
    for (const name of COLLECTIONS) {
      if (Array.isArray(parsed.tables?.[name])) next.tables[name] = parsed.tables[name];
      // Die erste Fassung kannte nur Konten und legte sie flach ab.
      else if (name === 'accounts' && Array.isArray(parsed.accounts)) {
        next.tables.accounts = parsed.accounts;
      }
    }
    // Sammlungen, die eine App spaeter angelegt hat, bleiben erhalten.
    for (const [name, rows] of Object.entries(parsed.tables ?? {})) {
      if (!(name in next.tables) && isCollectionName(name) && Array.isArray(rows)) {
        next.tables[name] = rows;
      }
    }
    next.deleted = readDeleted(parsed.deleted);
    data = next;
  }
  return data;
}

/** Schreibt der Reihe nach, damit sich zwei Anfragen nicht ins Gehege kommen. */
async function save() {
  data.revision += 1;
  const snapshot = JSON.stringify(data, null, 2);
  writing = (writing ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
      // Erst daneben schreiben, dann umbenennen: ein Absturz laesst nichts halb stehen.
      const temp = `${DATA_FILE}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      await fs.writeFile(temp, forDisk(KEY, snapshot), { encoding: 'utf8', mode: 0o600 });
      await fs.rename(temp, DATA_FILE);
    });
  await writing;
}

/** Die Zeilen einer Sammlung, nie `undefined`. */
function rowsOf(db, name) {
  return Array.isArray(db.tables[name]) ? db.tables[name] : [];
}

/** Dieselbe Form wie `newId` in den Apps, nur mit sicherem Zufall. */
function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(6).toString('hex')}`;
}

/**
 * Was beim Loeschen eines Kontos wegfiel (`{ sammlung: [id] }`). Die Apps sehen
 * es nie; `withoutDeleted` haelt es beim PUT draussen.
 */
function rememberDeleted(db, accountId, remove) {
  const byCollection = Object.fromEntries(
    Object.entries(remove).map(([name, ids]) => [name, [...ids]]),
  );
  db.deleted = { ...(db.deleted ?? {}), [accountId]: byCollection };
}

/**
 * Konten-Ids kommen aus der E-Mail: wer sich mit derselben Adresse neu
 * registriert, bekommt dieselbe Id — dann gilt das Alte nicht mehr.
 */
function forgetDeleted(db, accountId) {
  if (!db.deleted?.[accountId]) return;
  db.deleted = Object.fromEntries(Object.entries(db.deleted).filter(([id]) => id !== accountId));
}

/** Die Zeilen ohne jene, die mit einem geloeschten Konto weggefallen sind. */
function withoutDeleted(db, name, rows) {
  const gone = new Set(
    Object.values(db.deleted ?? {}).flatMap((byCollection) => byCollection[name] ?? []),
  );
  if (gone.size === 0) return rows;
  return rows.filter((row) => !(isPlainObject(row) && gone.has(row.id)));
}

module.exports = {
  COLLECTIONS,
  SERVER_OWNED,
  isCollectionName,
  load,
  save,
  rowsOf,
  newId,
  rememberDeleted,
  forgetDeleted,
  withoutDeleted,
};
