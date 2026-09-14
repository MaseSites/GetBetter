/**
 * Was der Admin ueber die Apps wissen muss: Ids, Namen, welche Funktionen jede
 * App fuehrt und in welcher Sammlung deren Zeilen liegen.
 *
 * `APP_MODULES` spiegelt `packages/core/src/app/identity.ts` — der Dienst
 * kann kein TypeScript laden. `catalog.test.js` liest die Datei und schlaegt
 * an, sobald eine Funktion hier fehlt.
 */
const { ownerOf } = require('../activity.js');

const APPS = [
  { id: 'getbetter', name: 'GetBetter', port: 8081 },
  { id: 'betterfamily', name: 'BetterFamily', port: 8082 },
  { id: 'bettergym', name: 'BetterGym', port: 8083 },
  { id: 'betterai', name: 'BetterAi', port: 8084 },
  { id: 'bettermoney', name: 'BetterMoney', port: 8085 },
];

const APP_IDS = APPS.map((app) => app.id);

/** Wo die App im Browser laeuft (`npm run all`) — fuer „App ansehen“. */
const appOrigin = (appId) => {
  const app = APPS.find((entry) => entry.id === appId);
  return app ? `http://localhost:${app.port}` : null;
};

const hasBirthday = (row) => typeof row.birthday === 'string' && row.birthday.length > 0;
const isFamilyEvent = (row) => row.calendar === 'family';

/**
 * Je App ihre Funktionen in der Reihenfolge von `APP_MODULES`. `collection`
 * null heisst: die Funktion speichert nichts. `matches` grenzt Zeilen ein,
 * `owner` sagt, wem eine Zeile zaehlt (sonst `accountId`/`ownerId`/`createdBy`).
 */
const MODULES = {
  getbetter: [
    { id: 'calendar', name: 'Termine', collection: 'events', matches: (row) => !isFamilyEvent(row) },
    { id: 'tasks', name: 'Aufgaben', collection: 'tasks' },
    { id: 'notes', name: 'Notizen', collection: 'notes' },
    { id: 'alarm', name: 'Wecker', collection: 'alarms' },
    { id: 'weather', name: 'Wetter', collection: null },
    { id: 'documents', name: 'Dokumente', collection: 'documents' },
    { id: 'habits', name: 'Gewohnheiten', collection: 'habits' },
    { id: 'travel', name: 'Reisen', collection: 'trips' },
    { id: 'contacts', name: 'Kontakte', collection: 'contacts' },
    { id: 'birthdays', name: 'Geburtstage', collection: 'contacts', matches: hasBirthday },
    { id: 'mail', name: 'E-Mails', collection: 'mailMessages' },
  ],
  betterfamily: [
    { id: 'calendar', name: 'Termine', collection: 'events', matches: isFamilyEvent },
    { id: 'shopping', name: 'Einkauf', collection: 'shoppingItems' },
    // Ein Aemtli gehoert dem Haushalt; einem Konto zaehlt es, wenn es ihm zugeteilt ist.
    { id: 'chores', name: 'Ämtli', collection: 'chores', owner: (row) => row.assignedTo ?? null },
    { id: 'recipes', name: 'Rezepte', collection: 'recipes' },
    { id: 'plants', name: 'Pflanzen', collection: 'plants' },
    { id: 'pets', name: 'Haustiere', collection: 'pets' },
    { id: 'vehicles', name: 'Fahrzeuge', collection: 'vehicles' },
  ],
  bettergym: [
    { id: 'fitness', name: 'Training', collection: 'workouts' },
    { id: 'meals', name: 'Menüplan', collection: 'meals' },
    { id: 'sleep', name: 'Schlaf', collection: 'sleeps' },
    { id: 'water', name: 'Trinken', collection: 'drinks' },
    { id: 'meds', name: 'Medikamente', collection: 'meds' },
    { id: 'vitals', name: 'Werte', collection: 'vitals' },
    { id: 'mind', name: 'Kopf frei', collection: 'moods' },
  ],
  betterai: [{ id: 'ai', name: 'Gespräche', collection: 'chats' }],
  bettermoney: [
    { id: 'budget', name: 'Budget', collection: 'expenses' },
    { id: 'bills', name: 'Rechnungen', collection: 'bills' },
    { id: 'subscriptions', name: 'Abos', collection: 'subscriptions' },
    { id: 'savings', name: 'Sparziele', collection: 'savingsGoals' },
  ],
};

const APP_MODULES = Object.fromEntries(
  APP_IDS.map((id) => [id, MODULES[id].map((module) => module.id)]),
);

/** Alle Funktionen flach: `[{ app, id, name, collection, matches?, owner? }]`. */
const MODULE_LIST = APP_IDS.flatMap((app) => MODULES[app].map((module) => ({ app, ...module })));

/** Jede Sammlung, die eine Funktion fuellt, einmal. */
const MODULE_COLLECTIONS = [
  ...new Set(MODULE_LIST.map((module) => module.collection).filter(Boolean)),
];

const isAppId = (value) => typeof value === 'string' && APP_IDS.includes(value);

/** Wie viele Zeilen einer Funktion gehoeren — ohne `accountId` alle. */
function countItems(module, rows, accountId) {
  if (!module.collection) return 0;
  const owner = module.owner ?? ownerOf;
  return rows.filter((row) => {
    if (typeof row !== 'object' || row === null) return false;
    if (module.matches && !module.matches(row)) return false;
    return accountId === undefined || owner(row) === accountId;
  }).length;
}

module.exports = {
  APPS,
  APP_IDS,
  APP_MODULES,
  appOrigin,
  MODULES,
  MODULE_COLLECTIONS,
  MODULE_LIST,
  countItems,
  isAppId,
};
