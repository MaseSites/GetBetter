/**
 * Die Datenbank aller Better-Apps.
 *
 * Hier liegen die Profile **und** die Daten: Termine, Listen, Haushalte,
 * Aemtli. Alle fuenf Apps sprechen mit demselben Dienst, deshalb sieht
 * BetterFamily, was GetBetter schreibt, und umgekehrt.
 *
 * Bewusst klein gehalten: Node ohne Fremdbibliotheken, alles in einer
 * JSON-Datei daneben. Das ist ein Dienst fuer die Entwicklung — was ihm
 * fehlt, steht in der README des Ordners.
 */
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const PORT = Number(process.env.PORT ?? 8090);
const DATA_FILE = path.join(__dirname, 'data', 'db.json');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD_LENGTH = 8;

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
];

/** Was nur der Dienst kennt und niemals herausgibt. */
const SECRET_FIELDS = ['passwordHash', 'passwordSalt'];

/** Felder eines Profils, die jede App aendern darf. */
const PROFILE_FIELDS = [
  'firstName',
  'language',
  'username',
  'themeMode',
  'accentKey',
  'themePreset',
];

// ------------------------------------------------------------------ Speicher

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

// ------------------------------------------------------------------ Passwoerter

function hashPassword(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key.toString('hex'));
    });
  });
}

function matches(a, b) {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// ------------------------------------------------------------------ Konten

function normaliseEmail(email) {
  return String(email ?? '')
    .trim()
    .toLowerCase();
}

/** Dieselbe Regel wie in den Apps: die Kennung kommt aus der E-Mail. */
function accountIdFor(email) {
  const digest = crypto.createHash('sha256').update(normaliseEmail(email)).digest('hex');
  return `acc_${digest.slice(0, 24)}`;
}

async function usernameFor(email) {
  const db = await load();
  const base = (normaliseEmail(email).split('@')[0] ?? 'nutzer').replace(/[^a-z0-9._-]/g, '');
  const stem = base.length > 0 ? base : 'nutzer';
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix === 0 ? stem : `${stem}${suffix}`;
    if (!db.tables.accounts.some((row) => row.username === candidate)) return candidate;
  }
  return `nutzer${Date.now()}`;
}

function withoutSecrets(row) {
  const copy = { ...row };
  for (const field of SECRET_FIELDS) delete copy[field];
  return copy;
}

async function register(email, password) {
  const address = normaliseEmail(email);
  if (!EMAIL_PATTERN.test(address)) return { error: 'email_invalid' };
  if (String(password ?? '').length < MIN_PASSWORD_LENGTH) return { error: 'password_too_short' };

  const db = await load();
  if (db.tables.accounts.some((row) => row.email === address)) return { error: 'email_taken' };

  const salt = crypto.randomUUID();
  const row = {
    id: accountIdFor(address),
    email: address,
    username: await usernameFor(address),
    firstName: '',
    language: 'de',
    onboarded: false,
    selectedAreas: [],
    favouriteModuleIds: [],
    householdId: null,
    passwordSalt: salt,
    passwordHash: await hashPassword(password, salt),
    createdAt: new Date().toISOString(),
  };
  db.tables.accounts.push(row);
  await save();
  return { account: withoutSecrets(row) };
}

async function authenticate(email, password) {
  const db = await load();
  const row = db.tables.accounts.find((entry) => entry.email === normaliseEmail(email));
  if (!row) return { error: 'not_found' };
  if (!row.passwordHash || !row.passwordSalt) return { error: 'not_found' };

  const attempt = await hashPassword(String(password ?? ''), row.passwordSalt);
  if (!matches(attempt, row.passwordHash)) return { error: 'wrong_password' };

  return { account: withoutSecrets(row) };
}

async function patchProfile(id, changes) {
  const db = await load();
  const row = db.tables.accounts.find((entry) => entry.id === id);
  if (!row) return { error: 'not_found' };

  for (const field of PROFILE_FIELDS) {
    if (changes[field] !== undefined) row[field] = changes[field];
  }
  await save();
  return { account: withoutSecrets(row) };
}

// ------------------------------------------------------------------ Sammlungen

/** Alles, was die Apps lesen duerfen — ohne Salt und Hash. */
async function snapshot() {
  const db = await load();
  const tables = {};
  for (const name of COLLECTIONS) {
    tables[name] = name === 'accounts' ? db.tables.accounts.map(withoutSecrets) : db.tables[name];
  }
  return { revision: db.revision, tables };
}

/**
 * Eine ganze Sammlung ersetzen. Die Apps halten ihre Zeilen im Speicher und
 * schreiben nach jeder Aenderung die betroffene Sammlung zurueck — dasselbe
 * Vorgehen wie frueher auf dem Geraet, nur eben gemeinsam.
 *
 * Bei den Konten bleibt die Passwortpruefung stehen: die Apps kennen sie nicht
 * und koennten sie sonst versehentlich loeschen.
 */
async function replaceCollection(name, rows) {
  if (!COLLECTIONS.includes(name)) return { error: 'unknown_collection' };
  if (!Array.isArray(rows)) return { error: 'bad_request' };

  const db = await load();

  if (name === 'accounts') {
    const secrets = new Map(db.tables.accounts.map((row) => [row.id, row]));
    db.tables.accounts = rows.map((row) => {
      const known = secrets.get(row.id);
      const kept = {};
      for (const field of SECRET_FIELDS) {
        if (known?.[field] !== undefined) kept[field] = known[field];
      }
      return { ...row, ...kept };
    });
  } else {
    db.tables[name] = rows;
  }

  await save();
  return { revision: db.revision };
}

// ------------------------------------------------------------------ HTTP

function send(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    // Die Apps laufen im Browser auf eigenen Ports.
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      // Genug fuer eine Sammlung, aber keine Einladung zum Volllaufen.
      if (raw.length > 8_000_000) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(raw.length > 0 ? JSON.parse(raw) : {});
      } catch {
        resolve(null);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});

  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const parts = url.pathname.split('/').filter(Boolean);

  try {
    if (req.method === 'GET' && url.pathname === '/v1/health') {
      const db = await load();
      return send(res, 200, {
        ok: true,
        revision: db.revision,
        accounts: db.tables.accounts.length,
      });
    }

    if (req.method === 'GET' && url.pathname === '/v1/revision') {
      const db = await load();
      return send(res, 200, { revision: db.revision });
    }

    if (req.method === 'GET' && url.pathname === '/v1/db') {
      return send(res, 200, await snapshot());
    }

    if (req.method === 'PUT' && parts[0] === 'v1' && parts[1] === 'db' && parts[2]) {
      const body = await readBody(req);
      if (!body) return send(res, 400, { error: 'bad_request' });
      const result = await replaceCollection(parts[2], body.rows);
      return send(res, result.error ? 400 : 200, result);
    }

    if (req.method === 'POST' && url.pathname === '/v1/accounts') {
      const body = await readBody(req);
      if (!body) return send(res, 400, { error: 'bad_request' });
      const result = await register(body.email, body.password);
      return send(res, result.error ? 400 : 201, result);
    }

    if (req.method === 'POST' && url.pathname === '/v1/sessions') {
      const body = await readBody(req);
      if (!body) return send(res, 400, { error: 'bad_request' });
      const result = await authenticate(body.email, body.password);
      return send(res, result.error ? 401 : 200, result);
    }

    if (req.method === 'GET' && parts[0] === 'v1' && parts[1] === 'accounts' && parts[2]) {
      const db = await load();
      const row =
        parts[2] === 'by-username'
          ? db.tables.accounts.find((entry) => entry.username === parts[3])
          : db.tables.accounts.find((entry) => entry.id === parts[2]);
      if (!row) return send(res, 404, { error: 'not_found' });
      return send(res, 200, { account: withoutSecrets(row) });
    }

    if (req.method === 'PATCH' && parts[0] === 'v1' && parts[1] === 'accounts' && parts[2]) {
      const body = await readBody(req);
      if (!body) return send(res, 400, { error: 'bad_request' });
      const result = await patchProfile(parts[2], body);
      return send(res, result.error ? 404 : 200, result);
    }

    return send(res, 404, { error: 'unknown_route' });
  } catch {
    return send(res, 500, { error: 'server_error' });
  }
});

server.listen(PORT, () => {
  process.stdout.write(`Datenbank laeuft auf http://localhost:${PORT}\n`);
});
