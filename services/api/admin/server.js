/**
 * Der Admin: eine Seite und eine kleine JSON-Schnittstelle, nur auf 127.0.0.1.
 *
 * Es gibt keine Anmeldung — wer an diesen Rechner kommt, kann ihn benutzen.
 * Darum lauscht er nie im Netz, und jede Anfrage muss sich als Seite dieses
 * Admins ausweisen: `Host` genau `127.0.0.1:<port>` oder `localhost:<port>`
 * (gegen DNS-Rebinding), jede Anfrage ausser GET dazu mit `Origin` von hier und
 * `Content-Type: application/json` (gegen fremde Seiten im Browser). Keine
 * CORS-Kopfzeilen.
 *
 * Er laeuft im Prozess des Dienstes und schreibt ueber `store.js` — die Apps
 * sehen jede Aenderung mit der naechsten Revision.
 */
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');

const { recordActivity } = require('../activity.js');
const { createPlanRequests, settleRequests } = require('../billing/requests.js');
const {
  MIN_PASSWORD_LENGTH,
  USERNAME_PATTERN,
  hashPassword,
  normaliseEmail,
  normaliseUsername,
} = require('../auth.js');
const { load, rememberDeleted, rowsOf, save } = require('../store.js');
const { deleteUpload } = require('../uploads.js');
const { viewTickets } = require('../viewTickets.js');
const { APPS, appOrigin, isAppId } = require('./catalog.js');
const { applyPlan, backupOf, countsOf, planAccountDeletion } = require('./deletion.js');
const { accountDetail, accountView, activityEntries, costs, listAccounts, overview } = require('./queries.js');

const BIND_HOST = '127.0.0.1';
const MAX_BODY_BYTES = 100 * 1024;
const TOO_LARGE = Symbol('too_large');
const DEFAULT_ACTIVITY_LIMIT = 100;
const MAX_ACTIVITY_LIMIT = 500;
const MAX_FIRST_NAME = 100;
const MAX_PASSWORD_LENGTH = 1024;
const LANGUAGES = ['de', 'en', 'fr', 'it'];
const PATCH_FIELDS = ['firstName', 'username', 'language', 'disabled', 'blockedApps', 'paidApps'];
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
};

/** „App ansehen“ darf genau die fuenf Apps auf localhost einbetten, sonst nichts. */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self'",
  "script-src 'self'",
  "connect-src 'self'",
  `frame-src ${APPS.map((app) => appOrigin(app.id)).join(' ')}`,
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

/**
 * Ausgeliefert werden `/` (index.html) und jede `.js`/`.css` direkt in
 * `public/` mit einem schlichten Namen — keine Unterordner, keine Punkte davor,
 * keine Grossbuchstaben. Module-Skripte brauchen `text/javascript`.
 */
const INDEX_FILE = 'index.html';
const ASSET_PATH = /^\/([a-z0-9][a-z0-9-]*\.(js|css))$/;
const CONTENT_TYPES = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
};

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const reply = (status, body) => ({ status, body });
const listOf = (value) => (Array.isArray(value) ? value : []);

// ------------------------------------------------------------------ HTTP

function sendJson(res, status, body, extraHeaders = {}) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    ...extraHeaders,
  });
  res.end(text);
}

function sendText(res, status, text, extraHeaders = {}) {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    ...extraHeaders,
  });
  res.end(text);
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      resolve(TOO_LARGE);
      return;
    }
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
        finish(raw.length > 0 ? JSON.parse(raw) : null);
      } catch {
        finish(null);
      }
    });
    req.on('error', () => finish(null));
  });
}

/** Nur die eigene Adresse — `evil.example` mit 127.0.0.1 dahinter kommt nicht durch. */
function hostAllowed(req, port) {
  return req.headers.host === `${BIND_HOST}:${port}` || req.headers.host === `localhost:${port}`;
}

/** Ausser GET nur von der eigenen Seite und nur als JSON. */
function writeAllowed(req, port) {
  const origin = req.headers.origin;
  const sameOrigin = origin === `http://${BIND_HOST}:${port}` || origin === `http://localhost:${port}`;
  const type = String(req.headers['content-type'] ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  return sameOrigin && type === 'application/json';
}

/** `/` -> index.html, `/name.js|css` -> die Datei in `public/`; alles andere null. */
function staticFileOf(pathname, publicDir) {
  if (pathname === '/') return { name: INDEX_FILE, type: CONTENT_TYPES.html, index: true };
  const match = ASSET_PATH.exec(pathname);
  if (!match) return null;
  const root = path.resolve(publicDir);
  const file = path.resolve(root, path.basename(match[1]));
  // Doppelt haelt besser: der Name kann nach dem Muster nicht klettern, die Pruefung bleibt trotzdem.
  if (path.dirname(file) !== root) return null;
  return { name: path.basename(file), type: CONTENT_TYPES[match[2]], index: false };
}

async function serveStatic(res, publicDir, entry) {
  const headers = { ...SECURITY_HEADERS, 'Content-Security-Policy': CONTENT_SECURITY_POLICY };
  let bytes;
  try {
    bytes = await fs.readFile(path.join(path.resolve(publicDir), entry.name));
  } catch {
    if (entry.index) {
      return sendText(res, 503, 'Der Admin ist noch nicht gebaut: admin/public fehlt.\n', headers);
    }
    return sendJson(res, 404, { error: 'unknown_route' }, headers);
  }
  res.writeHead(200, { ...headers, 'Content-Type': entry.type, 'Content-Length': bytes.length });
  return res.end(bytes);
}

async function track(dataDir, entry) {
  try {
    await recordActivity(dataDir, entry);
  } catch (error) {
    process.stderr.write(`[admin] Aktivitaet: ${error?.name ?? 'Error'}\n`);
  }
}

// ------------------------------------------------------------------ Aendern

/** Eindeutige, bekannte App-Ids — fuer `blockedApps` und `paidApps`. */
const isAppList = (value) =>
  Array.isArray(value) && value.every(isAppId) && new Set(value).size === value.length;

/** Prueft den Koerper von PATCH — `{ patch }` oder `{ error }`, noch ohne Datenbank. */
function readPatch(body) {
  if (!isPlainObject(body)) return { error: 'bad_request' };
  if (Object.keys(body).some((key) => !PATCH_FIELDS.includes(key))) return { error: 'bad_request' };
  const { firstName, username, language, disabled, blockedApps, paidApps } = body;
  if (firstName !== undefined && (typeof firstName !== 'string' || firstName.length > MAX_FIRST_NAME)) {
    return { error: 'bad_request' };
  }
  if (language !== undefined && !LANGUAGES.includes(language)) return { error: 'bad_request' };
  if (disabled !== undefined && typeof disabled !== 'boolean') return { error: 'bad_request' };
  if (blockedApps !== undefined && !isAppList(blockedApps)) return { error: 'bad_request' };
  if (paidApps !== undefined && !isAppList(paidApps)) return { error: 'bad_request' };
  if (username !== undefined && typeof username !== 'string') return { error: 'bad_request' };
  const wanted = username === undefined ? undefined : normaliseUsername(username);
  if (wanted !== undefined && !USERNAME_PATTERN.test(wanted)) return { error: 'username_invalid' };

  const lists = {
    blockedApps: blockedApps === undefined ? undefined : [...blockedApps],
    paidApps: paidApps === undefined ? undefined : [...paidApps],
  };
  const patch = Object.fromEntries(
    Object.entries({ firstName, username: wanted, language, disabled, ...lists }).filter(
      ([, value]) => value !== undefined,
    ),
  );
  return { patch };
}

async function patchAccount(dataDir, id, body) {
  const { patch, error } = readPatch(body);
  if (error) return reply(400, { error });

  const db = await load();
  const row = rowsOf(db, 'accounts').find((entry) => entry.id === id);
  if (!row) return reply(404, { error: 'not_found' });
  if (
    patch.username !== undefined &&
    rowsOf(db, 'accounts').some((entry) => entry.id !== id && entry.username === patch.username)
  ) {
    return reply(409, { error: 'username_taken' });
  }

  const fields = Object.keys(patch);
  if (fields.length === 0) return reply(200, { account: await accountView(dataDir, row) });

  // Wieder eingeschaltet heisst auch: eine Kuendigung von vorher gilt nicht mehr.
  const stillCancelled = Object.fromEntries(
    Object.entries(row.planCancels ?? {}).filter(
      ([app, day]) => typeof day === 'string' && !listOf(patch.paidApps).includes(app),
    ),
  );
  const next = { ...row, ...patch, planCancels: stillCancelled };
  db.tables.accounts = rowsOf(db, 'accounts').map((entry) => (entry.id === id ? next : entry));
  // Das Abo direkt eingeschaltet: offene Anfragen fuer diese Apps sind damit freigeschaltet.
  const added = listOf(patch.paidApps).filter((app) => !listOf(row.paidApps).includes(app));
  const settled = settleRequests(db.tables, id, added, new Date().toISOString());
  if (settled.settled.length > 0) {
    db.tables.planRequests = settled.planRequests;
    db.tables.notifications = settled.notifications;
  }
  await save();
  await track(dataDir, { accountId: id, kind: 'admin.updated', detail: { fields } });
  for (const request of settled.settled) {
    await track(dataDir, { accountId: id, kind: 'admin.planApproved', detail: { app: request.app } });
  }
  return reply(200, { account: await accountView(dataDir, next) });
}

/**
 * Eine Abo-Anfrage freischalten oder ablehnen (`billing/requests.js`). Die
 * Antwort traegt das Konto, wie der Admin es zeigt — mit den neuen `paidApps`.
 */
async function decidePlanRequest({ dataDir, plans }, id, decision, body) {
  if (Object.keys(body).length > 0) return reply(400, { error: 'bad_request' });
  const result = await plans.decide(id, decision);
  if (result.status !== 200) return reply(result.status, result.body);
  return reply(200, { ...result.body, account: await accountView(dataDir, result.account) });
}

async function setPassword(dataDir, id, body) {
  if (!isPlainObject(body) || typeof body.password !== 'string') {
    return reply(400, { error: 'bad_request' });
  }
  if (body.password.length < MIN_PASSWORD_LENGTH) return reply(400, { error: 'password_too_short' });
  if (body.password.length > MAX_PASSWORD_LENGTH) return reply(400, { error: 'bad_request' });

  const db = await load();
  if (!rowsOf(db, 'accounts').some((entry) => entry.id === id)) {
    return reply(404, { error: 'not_found' });
  }
  const salt = crypto.randomUUID();
  const hash = await hashPassword(body.password, salt);
  // Erst nach dem Rechnen ersetzen: waehrenddessen kann eine andere Anfrage geschrieben haben.
  db.tables.accounts = rowsOf(db, 'accounts').map((entry) =>
    entry.id === id ? { ...entry, passwordSalt: salt, passwordHash: hash } : entry,
  );
  await save();
  await track(dataDir, { accountId: id, kind: 'admin.password', detail: {} });
  return reply(200, { ok: true });
}

// ------------------------------------------------------------------ Ansehen

/**
 * „App ansehen“: ein Einmal-Ticket (60 s) fuer dieses Konto in dieser App. Die
 * App loest es beim Dienst ein und zeigt das Konto nur zum Lesen. Jedes
 * (Neu-)Laden des Fensters holt ein neues Ticket.
 */
async function startView({ dataDir, tickets }, id, body) {
  if (Object.keys(body).some((key) => key !== 'app') || !isAppId(body.app)) {
    return reply(400, { error: 'bad_request' });
  }
  const db = await load();
  if (!rowsOf(db, 'accounts').some((entry) => entry.id === id)) return reply(404, { error: 'not_found' });
  const { ticket, expiresAt } = tickets.issue(id, body.app);
  await track(dataDir, { accountId: id, kind: 'admin.viewed', detail: { app: body.app } });
  return reply(200, {
    url: `${appOrigin(body.app)}/?view=${ticket}`,
    expiresAt: new Date(expiresAt).toISOString(),
  });
}

// ------------------------------------------------------------------ Loeschen

const BACKUP_DIR = 'deleted-accounts';
const MAX_BACKUP_ID = 100;
/** Diese Sammlungen raeumt der Mail-Dienst selbst — mit Tresor, Cache und Postausgang. */
const MAIL_COLLECTIONS = ['mailAccounts', 'mailMessages'];

/** `<datenordner>/deleted-accounts/<konto>-<zeit>.json`; die Id wird fuer den Namen entschaerft. */
async function writeBackup(dataDir, backup) {
  const directory = path.resolve(dataDir, BACKUP_DIR);
  const safeId = String(backup.accountId).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, MAX_BACKUP_ID);
  const file = path.join(directory, `${safeId}-${backup.deletedAt.replace(/[:.]/g, '-')}.json`);
  if (path.dirname(file) !== directory) throw new Error('backup_outside_data_dir');
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(backup, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
}

function withoutCollections(plan, names) {
  const remove = Object.fromEntries(Object.entries(plan.remove).filter(([name]) => !names.includes(name)));
  return { ...plan, remove };
}

/** Ein fehlendes Bild ist kein Fehler (`deleteUpload` sagt dann 404); alles andere nur ins Protokoll. */
async function removeUploads(ids) {
  for (const id of ids) {
    try {
      await deleteUpload(id);
    } catch (error) {
      process.stderr.write(`[admin] Bild loeschen: ${error?.name ?? 'Error'}\n`);
    }
  }
}

/**
 * Loescht ein Konto nach den Regeln in `deletion.js`. `confirm` muss die E-Mail
 * des Kontos sein, Gross und klein egal. Erst die Sicherung, dann der Plan mit
 * einem `save()`, dann die Postfaecher ueber den Mail-Dienst und die Bilder.
 */
async function deleteAccount({ dataDir, mail }, id, body) {
  const db = await load();
  const row = rowsOf(db, 'accounts').find((entry) => entry.id === id);
  if (!row) return reply(404, { error: 'not_found' });
  const confirmed =
    typeof body.confirm === 'string' &&
    typeof row.email === 'string' &&
    row.email.trim().length > 0 &&
    normaliseEmail(body.confirm) === normaliseEmail(row.email);
  if (!confirmed) return reply(400, { error: 'confirm_mismatch' });

  const plan = planAccountDeletion(db.tables, id);
  // Scheitert die Sicherung, bleibt alles, wie es war.
  await writeBackup(dataDir, backupOf(db.tables, plan, new Date().toISOString()));

  const mailService = typeof mail?.removeAccount === 'function' ? mail : null;
  const local = mailService ? withoutCollections(plan, MAIL_COLLECTIONS) : plan;
  for (const [name, rows] of Object.entries(applyPlan(db.tables, local))) db.tables[name] = rows;
  // Eine App mit altem Stand schriebe die Zeilen sonst beim naechsten PUT zurueck.
  rememberDeleted(db, id, plan.remove);
  await save();
  for (const mailboxId of mailService ? (plan.remove.mailAccounts ?? []) : []) {
    await mailService.removeAccount(mailboxId);
  }
  await removeUploads(plan.uploadIds);
  await track(dataDir, { accountId: id, kind: 'admin.deleted', detail: { username: row.username ?? null } });
  return reply(200, { ok: true, removed: countsOf(plan) });
}

// ------------------------------------------------------------------ Lesen

function readActivityQuery(url) {
  const params = url.searchParams;
  const accountId = params.get('accountId') || undefined;
  const kind = params.get('kind') || undefined;
  const rawBefore = params.get('before') || undefined;
  if (rawBefore !== undefined && !Number.isFinite(new Date(rawBefore).getTime())) return null;
  const rawLimit = params.get('limit');
  const parsed = rawLimit === null || rawLimit === '' ? DEFAULT_ACTIVITY_LIMIT : Number(rawLimit);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return {
    accountId,
    kind,
    before: rawBefore === undefined ? undefined : new Date(rawBefore).toISOString(),
    limit: Math.min(parsed, MAX_ACTIVITY_LIMIT),
  };
}

function routesFor({ dataDir, aiStatus, speechStatus, mail, tickets, plans }) {
  return [
    {
      method: 'POST',
      path: /^\/api\/plan-requests\/([^/]+)\/(approve|decline)$/,
      body: true,
      handler: ({ params: [id, decision], body }) => decidePlanRequest({ dataDir, plans }, id, decision, body),
    },
    {
      method: 'POST',
      path: /^\/api\/accounts\/([^/]+)\/view$/,
      body: true,
      handler: ({ params: [id], body }) => startView({ dataDir, tickets }, id, body),
    },
    {
      method: 'GET',
      path: /^\/api\/overview$/,
      handler: async () => reply(200, await overview(dataDir, { aiStatus, speechStatus })),
    },
    {
      method: 'GET',
      path: /^\/api\/accounts$/,
      handler: async () => reply(200, await listAccounts(dataDir)),
    },
    {
      method: 'GET',
      path: /^\/api\/accounts\/([^/]+)$/,
      handler: async ({ params: [id] }) => {
        const detail = await accountDetail(dataDir, id);
        return detail ? reply(200, detail) : reply(404, { error: 'not_found' });
      },
    },
    {
      method: 'PATCH',
      path: /^\/api\/accounts\/([^/]+)$/,
      body: true,
      handler: ({ params: [id], body }) => patchAccount(dataDir, id, body),
    },
    {
      method: 'POST',
      path: /^\/api\/accounts\/([^/]+)\/password$/,
      body: true,
      handler: ({ params: [id], body }) => setPassword(dataDir, id, body),
    },
    {
      method: 'DELETE',
      path: /^\/api\/accounts\/([^/]+)$/,
      body: true,
      handler: ({ params: [id], body }) => deleteAccount({ dataDir, mail }, id, body),
    },
    {
      method: 'GET',
      path: /^\/api\/activity$/,
      handler: async ({ url }) => {
        const query = readActivityQuery(url);
        if (!query) return reply(400, { error: 'bad_request' });
        return reply(200, { entries: await activityEntries(dataDir, query) });
      },
    },
    {
      method: 'GET',
      path: /^\/api\/costs$/,
      handler: async ({ url }) => {
        const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
        if (!MONTH_PATTERN.test(month)) return reply(400, { error: 'bad_request' });
        return reply(200, await costs(dataDir, { month, aiStatus, speechStatus }));
      },
    },
  ];
}

function decodeParam(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function writeLog(text) {
  process.stdout.write(text);
}

/**
 * `startAdminServer({ port, dataDir, aiStatus, speechStatus?, mail?, tickets?, publicDir?, log? })` —
 * lauscht nur auf 127.0.0.1 und gibt den `http.Server` zurueck. `aiStatus` ist
 * `ai.status` des Dienstes, `speechStatus` `speech.status`, `mail` sein
 * Mail-Dienst (fuer `removeAccount` beim Loeschen; fehlt er, fallen nur die
 * Zeilen weg). `tickets` ist das Buch fuer „App ansehen“ (Standard: das des
 * Prozesses, das auch der Dienst liest). `publicDir` und `log` nur fuer Tests.
 */
function startAdminServer({
  port,
  dataDir,
  aiStatus,
  speechStatus,
  mail,
  tickets = viewTickets,
  publicDir = path.join(__dirname, 'public'),
  log = writeLog,
}) {
  const plans = createPlanRequests({ dataDir });
  const routes = routesFor({ dataDir, aiStatus, speechStatus, mail, tickets, plans });

  const server = http.createServer(async (req, res) => {
    const boundPort = server.address()?.port ?? port;
    if (!hostAllowed(req, boundPort)) return sendJson(res, 403, { error: 'forbidden' });
    if (req.method !== 'GET' && !writeAllowed(req, boundPort)) {
      return sendJson(res, 403, { error: 'forbidden' });
    }

    const url = new URL(req.url ?? '/', `http://${BIND_HOST}:${boundPort}`);
    try {
      const staticFile = req.method === 'GET' ? staticFileOf(url.pathname, publicDir) : null;
      if (staticFile) return await serveStatic(res, publicDir, staticFile);
      const route = routes.find((entry) => entry.method === req.method && entry.path.test(url.pathname));
      if (!route) return sendJson(res, 404, { error: 'unknown_route' });
      const params = route.path.exec(url.pathname).slice(1).map(decodeParam);

      let body;
      if (route.body) {
        body = await readJsonBody(req);
        if (body === TOO_LARGE) return sendJson(res, 413, { error: 'too_large' }, { Connection: 'close' });
        if (!isPlainObject(body)) return sendJson(res, 400, { error: 'bad_request' });
      }
      const result = await route.handler({ params, url, body });
      return sendJson(res, result.status, result.body);
    } catch (error) {
      process.stderr.write(`[admin] ${req.method} ${url.pathname}: ${error?.name ?? 'Error'}\n`);
      if (res.headersSent) return res.destroy();
      return sendJson(res, 500, { error: 'server_error' });
    }
  });

  // Ein belegter Port legt den Admin still, nie die Datenbank.
  server.on('error', (error) => {
    const reason = error?.code === 'EADDRINUSE' ? `Port ${port} ist belegt` : (error?.name ?? 'Error');
    process.stderr.write(`[admin] startet nicht: ${reason}\n`);
  });
  server.listen(port, BIND_HOST, () => {
    log(`Admin laeuft auf http://${BIND_HOST}:${server.address().port}\n`);
  });
  return server;
}

module.exports = { CONTENT_SECURITY_POLICY, MAX_BODY_BYTES, startAdminServer };
