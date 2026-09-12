/**
 * Die Datenbank aller Better-Apps.
 *
 * Hier liegen die Profile **und** die Daten: Termine, Listen, Haushalte,
 * Aemtli. Alle fuenf Apps sprechen mit demselben Dienst, deshalb sieht
 * BetterFamily, was GetBetter schreibt, und umgekehrt. Dazu kommen
 * Mitteilungen, eigene Bilder und die E-Mail-Postfaecher.
 *
 * Bewusst klein gehalten: Node ohne Fremdbibliotheken, alles in einer
 * JSON-Datei im Datenordner. Das ist ein Dienst fuer die Entwicklung — was
 * ihm fehlt, steht in der README des Ordners.
 */
const http = require('node:http');
const crypto = require('node:crypto');

const { dataDir, mailSyncMs } = require('./config.js');
const { createMailService } = require('./mail/service.js');
const {
  createNotification,
  deleteNotification,
  markNotificationRead,
  removeNotificationsByRef,
} = require('./notifications.js');
const { SERVER_OWNED, isCollectionName, load, rowsOf, save } = require('./store.js');
const { deleteUpload, readUpload, saveUpload } = require('./uploads.js');

const PORT = Number(process.env.PORT ?? 8090);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Dieselbe Regel wie in den Apps (`packages/core/src/auth/accounts.ts`). */
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,23}$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_BODY_BYTES = 10 * 1024 * 1024;
const TOO_LARGE = Symbol('too_large');

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
  'assistantName',
  'backdrop',
];

/** Die neuen Felder werden geprueft: Text mit Hoechstlaenge. */
const PROFILE_TEXT_LIMITS = { assistantName: 60, backdrop: 200 };

const mail = createMailService({ dataDir: dataDir() });

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

function normaliseUsername(input) {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/^@/, '');
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

/**
 * Ein Konto anlegen. Wird ein Benutzername mitgeschickt, gilt er — geprueft
 * auf Form und darauf, dass ihn noch niemand hat. Ohne einen leitet der Dienst
 * wie bisher selbst einen aus der Adresse ab.
 */
async function register(email, password, username) {
  const address = normaliseEmail(email);
  if (!EMAIL_PATTERN.test(address)) return { error: 'email_invalid' };
  if (String(password ?? '').length < MIN_PASSWORD_LENGTH) return { error: 'password_too_short' };

  const wanted = username === undefined || username === null ? null : normaliseUsername(username);
  if (wanted !== null && !USERNAME_PATTERN.test(wanted)) return { error: 'username_invalid' };

  const db = await load();
  if (db.tables.accounts.some((row) => row.email === address)) return { error: 'email_taken' };
  if (wanted !== null && db.tables.accounts.some((row) => row.username === wanted)) {
    return { error: 'username_taken' };
  }

  const salt = crypto.randomUUID();
  const row = {
    id: accountIdFor(address),
    email: address,
    username: wanted ?? (await usernameFor(address)),
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
  db.tables.accounts = [...db.tables.accounts, row];
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
  if (!row) return { status: 404, body: { error: 'not_found' } };

  for (const [field, max] of Object.entries(PROFILE_TEXT_LIMITS)) {
    const value = changes[field];
    if (value !== undefined && (typeof value !== 'string' || value.length > max)) {
      return { status: 400, body: { error: 'bad_request' } };
    }
  }

  // Der Benutzername gilt fuer alle Apps und muss einmalig bleiben — beim
  // Aendern genauso wie beim Anlegen. Die Maske fragt vorher, das hier gilt.
  let patch = changes;
  if (changes.username !== undefined) {
    const wanted = normaliseUsername(changes.username);
    if (!USERNAME_PATTERN.test(wanted)) {
      return { status: 400, body: { error: 'username_invalid' } };
    }
    if (db.tables.accounts.some((entry) => entry.id !== id && entry.username === wanted)) {
      return { status: 409, body: { error: 'username_taken' } };
    }
    patch = { ...changes, username: wanted };
  }

  const picked = Object.fromEntries(
    PROFILE_FIELDS.filter((field) => patch[field] !== undefined).map((field) => [
      field,
      patch[field],
    ]),
  );
  const next = { ...row, ...picked };
  db.tables.accounts = db.tables.accounts.map((entry) => (entry.id === id ? next : entry));
  await save();
  return { status: 200, body: { account: withoutSecrets(next) } };
}

// ------------------------------------------------------------------ Sammlungen

/** Alles, was die Apps lesen duerfen — ohne Salt und Hash. */
async function snapshot() {
  const db = await load();
  const tables = {};
  for (const name of Object.keys(db.tables)) {
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
 * und koennten sie sonst versehentlich loeschen. Mitteilungen und Mail gehoeren
 * dem Dienst und lassen sich so gar nicht ersetzen.
 */
async function replaceCollection(name, rows) {
  if (!isCollectionName(name)) return { status: 400, body: { error: 'unknown_collection' } };
  if (SERVER_OWNED.has(name)) return { status: 403, body: { error: 'server_owned' } };
  if (!Array.isArray(rows)) return { status: 400, body: { error: 'bad_request' } };

  const db = await load();
  if (name === 'accounts') {
    const secrets = new Map(rowsOf(db, 'accounts').map((row) => [row.id, row]));
    db.tables.accounts = rows.map((row) => {
      const known = secrets.get(row?.id);
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
  return { status: 200, body: { revision: db.revision } };
}

// ------------------------------------------------------------------ HTTP

const CORS = {
  // Die Apps laufen im Browser auf eigenen Ports.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function send(res, status, body, extraHeaders = {}) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    ...CORS,
    ...extraHeaders,
  });
  res.end(text);
}

/** Liest JSON bis 10 MB (ein Bild von 5 MB ist als base64 gut 6.7 MB). */
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      resolve(value);
    };
    req.on('data', (chunk) => {
      if (done) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) finish(TOO_LARGE);
      else chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        finish(raw.length > 0 ? JSON.parse(raw) : {});
      } catch {
        finish(null);
      }
    });
    req.on('error', () => finish(null));
  });
}

async function serveUpload({ res, params: [id] }) {
  const upload = await readUpload(id);
  if (!upload) return send(res, 404, { error: 'not_found' });
  res.writeHead(200, {
    'Content-Type': upload.type,
    'Content-Length': upload.bytes.length,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    ...CORS,
  });
  res.end(upload.bytes);
}

const ok = (status, body) => ({ status, body });

/** `body: true` liest JSON; `raw: true` schreibt die Antwort selbst. */
const ROUTES = [
  {
    method: 'GET',
    path: /^\/v1\/health$/,
    handler: async () => {
      const db = await load();
      return ok(200, { ok: true, revision: db.revision, accounts: db.tables.accounts.length });
    },
  },
  {
    method: 'GET',
    path: /^\/v1\/revision$/,
    handler: async () => ok(200, { revision: (await load()).revision }),
  },
  { method: 'GET', path: /^\/v1\/db$/, handler: async () => ok(200, await snapshot()) },
  {
    method: 'PUT',
    path: /^\/v1\/db\/([^/]+)$/,
    body: true,
    handler: ({ params: [name], body }) => replaceCollection(name, body.rows),
  },
  {
    method: 'POST',
    path: /^\/v1\/accounts$/,
    body: true,
    handler: async ({ body }) => {
      const result = await register(body.email, body.password, body.username);
      if (!result.error) return ok(201, result);
      // Ein vergebener Name ist kein Formfehler, sondern eine Kollision.
      return ok(result.error === 'username_taken' ? 409 : 400, result);
    },
  },
  {
    method: 'POST',
    path: /^\/v1\/sessions$/,
    body: true,
    handler: async ({ body }) => {
      const result = await authenticate(body.email, body.password);
      return ok(result.error ? 401 : 200, result);
    },
  },
  {
    method: 'GET',
    path: /^\/v1\/accounts\/by-username\/([^/]+)$/,
    handler: async ({ params: [name] }) => {
      const row = (await load()).tables.accounts.find((entry) => entry.username === name);
      return row ? ok(200, { account: withoutSecrets(row) }) : ok(404, { error: 'not_found' });
    },
  },
  {
    method: 'GET',
    path: /^\/v1\/accounts\/([^/]+)$/,
    handler: async ({ params: [id] }) => {
      const row = (await load()).tables.accounts.find((entry) => entry.id === id);
      return row ? ok(200, { account: withoutSecrets(row) }) : ok(404, { error: 'not_found' });
    },
  },
  {
    method: 'PATCH',
    path: /^\/v1\/accounts\/([^/]+)$/,
    body: true,
    handler: ({ params: [id], body }) => patchProfile(id, body),
  },

  // Mitteilungen
  {
    method: 'POST',
    path: /^\/v1\/notifications$/,
    body: true,
    handler: ({ body }) => createNotification(body),
  },
  {
    method: 'POST',
    path: /^\/v1\/notifications\/remove-by-ref$/,
    body: true,
    handler: ({ body }) => removeNotificationsByRef(body),
  },
  {
    method: 'POST',
    path: /^\/v1\/notifications\/([^/]+)\/read$/,
    handler: ({ params: [id] }) => markNotificationRead(id),
  },
  {
    method: 'DELETE',
    path: /^\/v1\/notifications\/([^/]+)$/,
    handler: ({ params: [id] }) => deleteNotification(id),
  },

  // Bilder
  { method: 'POST', path: /^\/v1\/uploads$/, body: true, handler: ({ body }) => saveUpload(body) },
  { method: 'GET', path: /^\/v1\/uploads\/([^/]+)$/, raw: true, handler: serveUpload },
  {
    method: 'DELETE',
    path: /^\/v1\/uploads\/([^/]+)$/,
    handler: ({ params: [id] }) => deleteUpload(id),
  },

  // E-Mail
  {
    method: 'GET',
    path: /^\/v1\/mail\/providers$/,
    handler: async ({ url }) => mail.providers(url.searchParams.get('email')),
  },
  {
    method: 'POST',
    path: /^\/v1\/mail\/accounts$/,
    body: true,
    handler: ({ body }) => mail.connectAccount(body),
  },
  {
    method: 'DELETE',
    path: /^\/v1\/mail\/accounts\/([^/]+)$/,
    handler: ({ params: [id] }) => mail.removeAccount(id),
  },
  {
    method: 'POST',
    path: /^\/v1\/mail\/sync$/,
    body: true,
    handler: ({ body }) => mail.syncAccount(body),
  },
  {
    method: 'POST',
    path: /^\/v1\/mail\/messages\/([^/]+)\/seen$/,
    body: true,
    handler: ({ params: [id], body }) => mail.markSeen(id, body),
  },
  {
    method: 'POST',
    path: /^\/v1\/mail\/messages\/([^/]+)\/delete$/,
    handler: ({ params: [id] }) => mail.deleteMessage(id),
  },
  {
    method: 'POST',
    path: /^\/v1\/mail\/send$/,
    body: true,
    handler: ({ body }) => mail.send(body),
  },
];

function decodeParam(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});

  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  try {
    const route = ROUTES.find(
      (entry) => entry.method === req.method && entry.path.test(url.pathname),
    );
    if (!route) return send(res, 404, { error: 'unknown_route' });
    const params = route.path.exec(url.pathname).slice(1).map(decodeParam);

    let body = {};
    if (route.body) {
      body = await readBody(req);
      if (body === TOO_LARGE)
        return send(res, 413, { error: 'too_large' }, { Connection: 'close' });
      if (body === null || typeof body !== 'object')
        return send(res, 400, { error: 'bad_request' });
    }
    if (route.raw) return await route.handler({ res, params, url });
    const result = await route.handler({ params, url, body });
    return send(res, result.status, result.body);
  } catch (error) {
    process.stderr.write(`[api] ${req.method} ${url.pathname}: ${error?.name ?? 'Error'}\n`);
    if (res.headersSent) return res.destroy();
    return send(res, 500, { error: 'server_error' });
  }
});

// Haengt noch eine aeltere Datenbank am Port, bleibt sonst stillschweigend die
// alte Fassung im Netz — und die Apps bekommen auf alles Neue `unknown_route`.
server.on('error', (error) => {
  if (error.code !== 'EADDRINUSE') throw error;
  process.stderr.write(
    `Port ${PORT} ist belegt: es laeuft schon eine Datenbank. Die alte beenden, dann neu starten.\n`,
  );
  process.exit(1);
});

server.listen(PORT, () => {
  process.stdout.write(`Datenbank laeuft auf http://localhost:${PORT}\n`);
  mail.startScheduler(mailSyncMs());
});
