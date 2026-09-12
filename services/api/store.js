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

const DATA_FILE = path.join(dataDir(), 'db.json');

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
  'notes',
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
 * Diese drei schreibt nur der Dienst. Eine App, die sie per PUT ersetzte,
 * wuerde ueberschreiben, was der Mail-Abgleich gerade angelegt hat.
 */
const SERVER_OWNED = new Set(['notifications', 'mailAccounts', 'mailMessages']);

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
  return { revision: 0, tables };
}

async function load() {
  if (data) return data;
  try {
    const parsed = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
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
    data = next;
  } catch {
    data = emptyDatabase();
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
      await fs.writeFile(DATA_FILE, snapshot, 'utf8');
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

module.exports = {
  COLLECTIONS,
  SERVER_OWNED,
  isCollectionName,
  load,
  save,
  rowsOf,
  newId,
};
