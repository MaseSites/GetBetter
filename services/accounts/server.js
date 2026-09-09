/**
 * Der Kontodienst der Better-Apps.
 *
 * Alle fuenf Apps melden sich hier an, statt jede fuer sich ein Konto zu
 * fuehren. Damit gilt dieselbe Anmeldung ueberall, und die Apps muessen sich
 * das Konto nicht mehr gegenseitig zuschieben.
 *
 * Bewusst klein gehalten: Node ohne Fremdbibliotheken, die Daten liegen als
 * JSON-Datei daneben. Das ist ein Entwicklungsdienst, kein Betriebssystem —
 * was fehlt, steht in der README des Ordners.
 */
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const PORT = Number(process.env.PORT ?? 8090);
const DATA_FILE = path.join(__dirname, 'data', 'accounts.json');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD_LENGTH = 8;

/** Felder, die eine App aendern darf. Alles andere bleibt, wie es ist. */
const EDITABLE = ['firstName', 'language', 'username', 'themeMode', 'accentKey', 'themePreset'];

// ------------------------------------------------------------------ Speicher

let cache = null;

async function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
  } catch {
    cache = { accounts: [] };
  }
  return cache;
}

async function save() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

// ------------------------------------------------------------------ Passwoerter

/**
 * scrypt mit eigenem Salt je Konto. Deutlich mehr als das, was vorher lokal
 * lief — der Dienst sieht das Passwort im Klartext nur fuer diesen Moment.
 */
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
  const data = await load();
  const base = (normaliseEmail(email).split('@')[0] ?? 'nutzer').replace(/[^a-z0-9._-]/g, '');
  const stem = base.length > 0 ? base : 'nutzer';
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix === 0 ? stem : `${stem}${suffix}`;
    if (!data.accounts.some((row) => row.username === candidate)) return candidate;
  }
  return `nutzer${Date.now()}`;
}

/** Was die Apps zu sehen bekommen — ohne Salt und Hash. */
function publicAccount(row) {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    firstName: row.firstName,
    language: row.language,
    themeMode: row.themeMode,
    accentKey: row.accentKey,
    themePreset: row.themePreset,
    createdAt: row.createdAt,
  };
}

async function register(email, password) {
  const address = normaliseEmail(email);
  if (!EMAIL_PATTERN.test(address)) return { error: 'email_invalid' };
  if (String(password ?? '').length < MIN_PASSWORD_LENGTH) return { error: 'password_too_short' };

  const data = await load();
  if (data.accounts.some((row) => row.email === address)) return { error: 'email_taken' };

  const salt = crypto.randomUUID();
  const row = {
    id: accountIdFor(address),
    email: address,
    username: await usernameFor(address),
    firstName: '',
    language: 'de',
    passwordSalt: salt,
    passwordHash: await hashPassword(password, salt),
    createdAt: new Date().toISOString(),
  };
  data.accounts.push(row);
  await save();
  return { account: publicAccount(row) };
}

async function authenticate(email, password) {
  const data = await load();
  const row = data.accounts.find((entry) => entry.email === normaliseEmail(email));
  if (!row) return { error: 'not_found' };

  const attempt = await hashPassword(String(password ?? ''), row.passwordSalt);
  if (!matches(attempt, row.passwordHash)) return { error: 'wrong_password' };

  return { account: publicAccount(row) };
}

async function patch(id, changes) {
  const data = await load();
  const row = data.accounts.find((entry) => entry.id === id);
  if (!row) return { error: 'not_found' };

  for (const field of EDITABLE) {
    if (changes[field] !== undefined) row[field] = changes[field];
  }
  await save();
  return { account: publicAccount(row) };
}

// ------------------------------------------------------------------ HTTP

function send(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    // Die Apps laufen im Browser auf eigenen Ports.
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      // Ein Anmeldeversuch braucht keine Megabytes.
      if (raw.length > 16_384) req.destroy();
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
      return send(res, 200, { ok: true, accounts: (await load()).accounts.length });
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
      const data = await load();
      const row =
        parts[2] === 'by-username'
          ? data.accounts.find((entry) => entry.username === parts[3])
          : data.accounts.find((entry) => entry.id === parts[2]);
      if (!row) return send(res, 404, { error: 'not_found' });
      return send(res, 200, { account: publicAccount(row) });
    }

    if (req.method === 'PATCH' && parts[0] === 'v1' && parts[1] === 'accounts' && parts[2]) {
      const body = await readBody(req);
      if (!body) return send(res, 400, { error: 'bad_request' });
      const result = await patch(parts[2], body);
      return send(res, result.error ? 404 : 200, result);
    }

    return send(res, 404, { error: 'unknown_route' });
  } catch {
    return send(res, 500, { error: 'server_error' });
  }
});

server.listen(PORT, () => {
  process.stdout.write(`Kontodienst laeuft auf http://localhost:${PORT}\n`);
});
