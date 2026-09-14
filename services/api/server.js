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

const { diffCollection, recordActivity } = require('./activity.js');
const { startAdminServer } = require('./admin/server.js');
const { createAiService } = require('./ai/service.js');
const {
  MIN_PASSWORD_LENGTH,
  USERNAME_PATTERN,
  hashPassword,
  matches,
  normaliseEmail,
  normaliseUsername,
  usernameFor,
} = require('./auth.js');
const { isAvatarStyle } = require('./avatar.js');
const { createBilling } = require('./billing/service.js');
const { adminPort, dataDir, mailSyncMs } = require('./config.js');
const { createMailService } = require('./mail/service.js');
const { createSpeechService } = require('./speech/service.js');
const {
  createNotification,
  deleteNotification,
  markNotificationRead,
  removeNotificationsByRef,
} = require('./notifications.js');
const {
  SERVER_OWNED,
  forgetDeleted,
  isCollectionName,
  load,
  rowsOf,
  save,
  withoutDeleted,
} = require('./store.js');
const { deleteUpload, readUpload, saveUpload } = require('./uploads.js');
const { viewTickets } = require('./viewTickets.js');

const PORT = Number(process.env.PORT ?? 8090);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_BODY_BYTES = 10 * 1024 * 1024;
const TOO_LARGE = Symbol('too_large');

/** Was nur der Dienst kennt und niemals herausgibt. */
const SECRET_FIELDS = ['passwordHash', 'passwordSalt'];

/**
 * Was nur der Admin aendert: die Apps lesen es, schreiben es aber nie.
 * `paidApps` setzt spaeter ein Kaufbeleg aus dem Store — bis dahin der Admin.
 */
const ADMIN_FIELDS = ['disabled', 'blockedApps', 'paidApps'];

/**
 * „App ansehen“ im Admin: eine App im Nur-Lesen-Modus schickt diese Kopfzeile
 * mit. Dann geht nur Lesen — und das Einloesen des Tickets selbst.
 */
const VIEW_HEADER = 'x-better-view';
const READ_METHODS = new Set(['GET', 'HEAD']);
const REDEEM_PATH = '/v1/view/redeem';

/** Felder eines Profils, die jede App aendern darf. */
const PROFILE_FIELDS = [
  'firstName',
  'language',
  'username',
  'themeMode',
  'accentKey',
  'themePreset',
  'assistantName',
  'assistantAvatar',
  'backdrop',
];

/** Die neuen Felder werden geprueft: Text mit Hoechstlaenge. */
const PROFILE_TEXT_LIMITS = { assistantName: 60, backdrop: 200 };

const mail = createMailService({ dataDir: dataDir() });

// ------------------------------------------------------------------ Konten

/** Dieselbe Regel wie in den Apps: die Kennung kommt aus der E-Mail. */
function accountIdFor(email) {
  const digest = crypto.createHash('sha256').update(normaliseEmail(email)).digest('hex');
  return `acc_${digest.slice(0, 24)}`;
}

function withoutSecrets(row) {
  const copy = { ...row };
  for (const field of SECRET_FIELDS) delete copy[field];
  return copy;
}

/** Ein Ereignis fuer den Admin. Scheitert das Schreiben, laeuft die Anfrage trotzdem. */
async function track(entry) {
  try {
    await recordActivity(dataDir(), entry);
  } catch (error) {
    process.stderr.write(`[api] Aktivitaet: ${error?.name ?? 'Error'}\n`);
  }
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
  forgetDeleted(db, row.id);
  await save();
  await track({ accountId: row.id, kind: 'account.created', detail: {} });
  return { account: withoutSecrets(row) };
}

/** Eine unbekannte Adresse hinterlaesst keine Spur — nur Konten, die es gibt. */
async function authenticate(email, password) {
  const db = await load();
  const row = db.tables.accounts.find((entry) => entry.email === normaliseEmail(email));
  if (!row) return { error: 'not_found' };
  if (!row.passwordHash || !row.passwordSalt) return { error: 'not_found' };

  const attempt = await hashPassword(String(password ?? ''), row.passwordSalt);
  if (!matches(attempt, row.passwordHash)) {
    await track({ accountId: row.id, kind: 'session.failed', detail: {} });
    return { error: 'wrong_password' };
  }
  // Gesperrt entscheidet der Admin: dann reicht auch das richtige Passwort nicht.
  if (row.disabled === true) {
    await track({ accountId: row.id, kind: 'session.blocked', detail: {} });
    return { error: 'account_disabled' };
  }

  await track({ accountId: row.id, kind: 'session.created', detail: {} });
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
  // Der Avatar ist ein Objekt mit genau vier bekannten Feldern — sonst nichts.
  if (changes.assistantAvatar !== undefined && !isAvatarStyle(changes.assistantAvatar)) {
    return { status: 400, body: { error: 'avatar_invalid' } };
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
  await track({ accountId: id, kind: 'profile.updated', detail: { fields: Object.keys(picked) } });
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
 * und koennten sie sonst versehentlich loeschen. Ebenso `disabled` und
 * `blockedApps` — die setzt nur der Admin; was eine App dort mitschickt, zaehlt
 * nicht. Mitteilungen und Mail gehoeren dem Dienst und lassen sich so gar nicht
 * ersetzen.
 */
async function replaceCollection(name, rows) {
  if (!isCollectionName(name)) return { status: 400, body: { error: 'unknown_collection' } };
  if (SERVER_OWNED.has(name)) return { status: 403, body: { error: 'server_owned' } };
  if (!Array.isArray(rows)) return { status: 400, body: { error: 'bad_request' } };

  const db = await load();
  const previous = rowsOf(db, name);
  // Was der Admin mit einem Konto geloescht hat, bringt ein alter Stand nicht zurueck.
  const incomingRows = withoutDeleted(db, name, rows);
  if (name === 'accounts') {
    const stored = new Map(previous.map((row) => [row.id, row]));
    db.tables.accounts = incomingRows.map((row) => {
      const known = stored.get(row?.id);
      const incoming = { ...row };
      for (const field of ADMIN_FIELDS) delete incoming[field];
      const kept = {};
      for (const field of [...SECRET_FIELDS, ...ADMIN_FIELDS]) {
        if (known?.[field] !== undefined) kept[field] = known[field];
      }
      return { ...incoming, ...kept };
    });
  } else {
    db.tables[name] = incomingRows;
  }

  await save();
  await recordChanges(name, previous, db.tables[name]);
  return { status: 200, body: { revision: db.revision } };
}

/** Je Konto, dessen Zeilen sich geaendert haben, ein Ereignis mit den Zahlen — nie Inhalte. */
async function recordChanges(name, before, after) {
  try {
    const options = name === 'accounts' ? { owner: (row) => row.id, omit: SECRET_FIELDS } : {};
    for (const change of diffCollection(before, after, options)) {
      if (change.accountId === null) continue;
      const { added, updated, removed } = change;
      await track({
        accountId: change.accountId,
        kind: 'collection.changed',
        detail: { collection: name, added, updated, removed },
      });
    }
  } catch (error) {
    process.stderr.write(`[api] Aenderungen von ${name}: ${error?.name ?? 'Error'}\n`);
  }
}

// ------------------------------------------------------------------ HTTP

const CORS = {
  // Die Apps laufen im Browser auf eigenen Ports.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Better-View',
};

/** Im Nur-Lesen-Modus ist alles ausser Lesen und dem Einloesen verboten. */
function refusedInView(req, pathname) {
  if (req.headers[VIEW_HEADER] !== '1') return false;
  if (READ_METHODS.has(req.method)) return false;
  return !(req.method === 'POST' && pathname === REDEEM_PATH);
}

/** Ein Ticket aus dem Admin einloesen -> das Konto, genau einmal. */
async function redeemView(body) {
  const redeemed = viewTickets.redeem(body?.ticket);
  if (!redeemed) return { status: 404, body: { error: 'not_found' } };
  const row = (await load()).tables.accounts.find((entry) => entry.id === redeemed.accountId);
  if (!row) return { status: 404, body: { error: 'not_found' } };
  return { status: 200, body: { account: withoutSecrets(row), app: redeemed.app } };
}

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

// Abo und Kontingent: ein Kassenbuch fuer KI und Stimmen zusammen.
const billing = createBilling({ dataDir: dataDir() });

// Echt klingende Stimmen. `BETTER_ELEVENLABS_URL` gilt nur fuer 127.0.0.1 (Tests).
const speech = createSpeechService({
  dataDir: dataDir(),
  cors: CORS,
  baseUrl: process.env.BETTER_ELEVENLABS_URL,
  model: process.env.BETTER_SPEECH_MODEL,
  cacheFiles: process.env.BETTER_SPEECH_CACHE_FILES,
  cacheMb: process.env.BETTER_SPEECH_CACHE_MB,
  billing,
});

// KI ueber Safe Swiss Cloud. `BETTER_AI_TEST_URL` gilt nur fuer 127.0.0.1 (Tests).
const ai = createAiService({ dataDir: dataDir(), baseUrl: process.env.BETTER_AI_TEST_URL, billing });

/** `accountId` und `app` aus der Adresse — geprueft wird im Dienst. */
const speakerQuery = (url) => ({
  accountId: url.searchParams.get('accountId') ?? undefined,
  app: url.searchParams.get('app') ?? undefined,
});

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
      if (!result.error) return ok(200, result);
      return ok(result.error === 'account_disabled' ? 403 : 401, result);
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

  // Nur ansehen (Admin)
  { method: 'POST', path: /^\/v1\/view\/redeem$/, body: true, handler: ({ body }) => redeemView(body) },

  // Stimmen
  {
    method: 'GET',
    path: /^\/v1\/speech\/status$/,
    handler: ({ url }) => speech.status(speakerQuery(url)),
  },
  {
    method: 'GET',
    path: /^\/v1\/speech\/voices$/,
    handler: ({ url }) => speech.voices(url.searchParams.get('language')),
  },
  {
    method: 'POST',
    path: /^\/v1\/speech$/,
    body: true,
    handler: ({ body }) => speech.prepare(body),
  },
  {
    method: 'POST',
    path: /^\/v1\/speech\/sample$/,
    body: true,
    handler: ({ body }) => speech.prepareSample(body),
  },
  {
    method: 'GET',
    path: /^\/v1\/speech\/([a-f0-9]{32})\.mp3$/,
    raw: true,
    handler: ({ res, params: [id], url }) => speech.serve(res, id, url.searchParams.get('play')),
  },

  // KI
  { method: 'GET', path: /^\/v1\/ai\/status$/, handler: () => ai.status() },
  { method: 'GET', path: /^\/v1\/ai\/budget$/, handler: ({ url }) => ai.budget(speakerQuery(url)) },
  { method: 'POST', path: /^\/v1\/ai\/reply$/, body: true, handler: ({ body }) => ai.reply(body) },

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
    path: /^\/v1\/mail\/messages\/actions$/,
    body: true,
    handler: ({ body }) => mail.messageActions(body),
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
    method: 'GET',
    path: /^\/v1\/mail\/messages\/([^/]+)\/body$/,
    handler: ({ params: [id], url }) =>
      mail.messageBody(id, url.searchParams.get('images') === '1'),
  },
  {
    method: 'GET',
    path: /^\/v1\/mail\/messages\/([^/]+)\/attachments\/([^/]+)$/,
    raw: true,
    handler: ({ res, params: [id, index] }) => mail.serveAttachment(res, id, index, CORS),
  },
  {
    method: 'POST',
    path: /^\/v1\/mail\/send$/,
    body: true,
    handler: ({ body }) => mail.send(body),
  },
  {
    method: 'POST',
    path: /^\/v1\/mail\/send\/([^/]+)\/cancel$/,
    handler: ({ params: [id] }) => mail.cancelSend(id),
  },
  {
    method: 'GET',
    path: /^\/v1\/mail\/send\/([^/]+)$/,
    handler: ({ params: [id] }) => mail.sendStatus(id),
  },
  {
    method: 'POST',
    path: /^\/v1\/mail\/drafts$/,
    body: true,
    handler: ({ body }) => mail.saveDraft(body),
  },
  {
    method: 'DELETE',
    path: /^\/v1\/mail\/drafts\/([^/]+)$/,
    handler: ({ params: [id] }) => mail.deleteDraft(id),
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
  // Nur ansehen: noch vor jeder Route, damit keine einzige etwas aendert.
  if (refusedInView(req, url.pathname)) return send(res, 403, { error: 'read_only' });
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
  // Der Admin lauscht nur auf 127.0.0.1; `BETTER_ADMIN_PORT=0` schaltet ihn ab.
  const admin = adminPort();
  if (admin !== null) {
    // `mail` braucht der Admin beim Loeschen eines Kontos: Postfaecher samt Tresor.
    startAdminServer({
      port: admin,
      dataDir: dataDir(),
      aiStatus: () => ai.status(),
      speechStatus: () => speech.status(),
      mail,
    });
  }
  mail.startScheduler(mailSyncMs());
  // Mails, die vor einem Neustart noch warteten, gehen jetzt hinaus.
  mail.resumeOutbox().catch((error) => {
    process.stderr.write(`[mail] Postausgang: ${error?.name ?? 'Error'}\n`);
  });
});
