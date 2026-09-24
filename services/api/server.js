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

const { recordActivity } = require('./activity.js');
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
  usernameFreeAt,
} = require('./auth.js');
const { isAvatarStyle } = require('./avatar.js');
const { keepLockedFields, lockedChangesOf } = require('./billing/entitlement.js');
const { canPersonalize, planSettings } = require('./billing/plans.js');
const { createPlanRequests } = require('./billing/requests.js');
const { createBilling } = require('./billing/service.js');
const { adminPort, apiToken, dataDir, mailSyncMs } = require('./config.js');
const { dataKey } = require('./crypt.js');
const { createLimiter } = require('./ratelimit.js');
const { mergeCollection, publicAccount, visibleTables } = require('./scope.js');
const { createSessions } = require('./sessions.js');
const { createFitService } = require('./fit/service.js');
const { languageOf } = require('./fit/lang.js');
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
const { deleteUpload, readUpload, saveUpload, uploadExists } = require('./uploads.js');
const { viewTickets } = require('./viewTickets.js');

const PORT = Number(process.env.PORT ?? 8090);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_BODY_BYTES = 10 * 1024 * 1024;
const TOO_LARGE = Symbol('too_large');

/**
 * Sitzungen: beim Anmelden bekommt ein Konto ein Geheimnis, das jede Anfrage
 * traegt (`X-Better-Session`, oder `?session=` fuer Bilder, Anhaenge und
 * Audio, die ein Browser als Adresse laedt). Damit sieht ein Konto nur noch
 * seine eigenen Daten (`scope.js`) und handelt nur fuer sich. Im Netz — mit
 * `BETTER_API_TOKEN` — ist die Sitzung Pflicht; lokal darf die Entwicklung
 * ohne, dann sieht sie wie bisher alles (`BETTER_REQUIRE_SESSION=1` erzwingt).
 */
const SESSIONS_REQUIRED = apiToken() !== null || process.env.BETTER_REQUIRE_SESSION === '1';
const SESSION_HEADER = 'x-better-session';
const sessions = createSessions({ dataDir: dataDir(), key: dataKey() });

/** Bremsen gegen Raten: je E-Mail und je Adresse beim Anmelden, je Adresse beim Registrieren. */
const loginByEmail = createLimiter({ limit: 10, windowMs: 15 * 60_000 });
const loginByAddress = createLimiter({ limit: 30, windowMs: 15 * 60_000 });
const signupByAddress = createLimiter({ limit: 10, windowMs: 60 * 60_000 });

/** Was auch ohne Sitzung geht: leben, anmelden, registrieren, ein Ticket einloesen, Anbieter raten. */
function isOpenRoute(method, pathname) {
  if (pathname === '/v1/health' || pathname === '/v1/revision') return true;
  if (method === 'POST' && (pathname === '/v1/accounts' || pathname === '/v1/sessions'))
    return true;
  if (method === 'POST' && pathname === REDEEM_PATH) return true;
  if (method === 'GET' && pathname.startsWith('/v1/accounts/by-username/')) return true;
  return method === 'GET' && pathname === '/v1/mail/providers';
}

/** Die Adresse des Anrufers — hinter einem Proxy nur mit `BETTER_TRUST_PROXY=1` aus dessen Kopfzeile. */
function clientIp(req) {
  if (process.env.BETTER_TRUST_PROXY === '1') {
    const forwarded = req.headers['x-forwarded-for'];
    const first = String(Array.isArray(forwarded) ? forwarded[0] : (forwarded ?? ''))
      .split(',')[0]
      .trim();
    if (first) return first;
  }
  return req.socket?.remoteAddress ?? 'unbekannt';
}

function sessionTokenOf(req, url) {
  const header = req.headers[SESSION_HEADER];
  if (typeof header === 'string' && header.length > 0) return header;
  return url.searchParams.get('session');
}

/** Der Besitzer einer Zeile — fuer Routen, die eine Id tragen. */
async function ownerOfRow(name, id) {
  const row = rowsOf(await load(), name).find((entry) => entry.id === id);
  return typeof row?.accountId === 'string' ? row.accountId : null;
}

const tooMany = (gate) => ({
  status: 429,
  body: { error: 'too_many_attempts', retryAfterMs: gate.retryAfterMs },
});

/** Nur fuer Tests, die viele Konten anlegen: `BETTER_RATE_LIMIT_OFF=1` schaltet die Bremsen ab. */
const limitsOff = process.env.BETTER_RATE_LIMIT_OFF === '1';
const gateOf = (limiter, key) =>
  limitsOff ? { allowed: true, retryAfterMs: 0 } : limiter.hit(key);

/** Ein Konto darf in so vielen Haushalten sein — dieselbe Zahl wie `MAX_HOUSEHOLDS` in der App. */
const MAX_HOUSEHOLDS = 3;
const normaliseInviteCode = (input) =>
  String(input ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s/g, '');

/**
 * Per Code in einen Haushalt: das prueft der Dienst, denn mit Sitzung sieht
 * eine App fremde Haushalte nicht mehr — auch nicht den, dem sie beitreten
 * will. Eine offene Einladung wird dabei zur Mitgliedschaft.
 */
async function joinHousehold(body) {
  const accountId = typeof body.accountId === 'string' ? body.accountId : '';
  const code = normaliseInviteCode(body.code);
  if (!accountId || code.length === 0) return { status: 400, body: { error: 'bad_request' } };
  const db = await load();
  if (!rowsOf(db, 'accounts').some((row) => row.id === accountId)) {
    return { status: 404, body: { error: 'not_found' } };
  }
  const household = rowsOf(db, 'households').find((row) => row.inviteCode === code);
  if (!household) return { status: 404, body: { error: 'code_unknown' } };

  const members = rowsOf(db, 'householdMembers');
  const mine = members.filter((row) => row.accountId === accountId);
  const existing = mine.find((row) => row.householdId === household.id);
  if (existing && existing.status !== 'pending') {
    return { status: 409, body: { error: 'already_member' } };
  }
  const accepted = mine.filter((row) => row.status !== 'pending').length;
  if (accepted >= MAX_HOUSEHOLDS) return { status: 409, body: { error: 'limit' } };

  const joinedAt = new Date().toISOString();
  db.tables.householdMembers = existing
    ? members.map((row) =>
        row.id === existing.id ? { ...row, status: 'accepted', joinedAt } : row,
      )
    : [
        ...members,
        {
          id: `hm_${crypto.randomBytes(8).toString('hex')}`,
          householdId: household.id,
          accountId,
          role: 'member',
          status: 'accepted',
          invitedBy: accountId,
          joinedAt,
        },
      ];
  db.tables.accounts = rowsOf(db, 'accounts').map((row) =>
    row.id === accountId ? { ...row, householdId: household.id } : row,
  );
  await save();
  return { status: 200, body: { household } };
}

/** Was nur der Dienst kennt und niemals herausgibt. */
const SECRET_FIELDS = ['passwordHash', 'passwordSalt'];

/**
 * Was nur der Admin aendert: die Apps lesen es, schreiben es aber nie.
 * `paidApps` setzt spaeter ein Kaufbeleg aus dem Store — bis dahin der Admin.
 */
const ADMIN_FIELDS = ['disabled', 'blockedApps', 'paidApps', 'planCancels', 'planTerms'];

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
  'photoUploadId',
];

/**
 * Der Benutzername aendert sich nur ueber `PATCH` — dort wird er geprueft, und
 * dort zaehlt der Monat. Was eine App per `PUT` mitschickt, zaehlt nicht.
 */
const USERNAME_FIELDS = ['username', 'usernameChangedAt'];

/** Ein Profilbild ist ein Bild aus `/v1/uploads` — oder keines. */
const PHOTO_ID = /^upl_[a-f0-9]{24}$/;

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
  // Ohne Abo bleibt das Aussehen Standard: hell/dunkel, Name und Sprache gehen
  // weiter, Farben, Hintergrund und der Assistent nicht. Derselbe Wert nochmal ist keine Aenderung.
  const locked = lockedChangesOf(row, changes, PROFILE_FIELDS);
  if (locked.length > 0 && !canPersonalize(row, planSettings())) {
    return { status: 403, body: { error: 'plan_required', fields: locked } };
  }

  // Das Profilbild muss es geben — sonst zeigte jede App ein leeres Rund.
  const photo = changes.photoUploadId;
  if (photo !== undefined && photo !== null) {
    if (typeof photo !== 'string' || !PHOTO_ID.test(photo) || !(await uploadExists(photo))) {
      return { status: 400, body: { error: 'photo_invalid' } };
    }
  }

  // Der Benutzername gilt fuer alle Apps und muss einmalig bleiben — beim
  // Aendern genauso wie beim Anlegen. Die Maske fragt vorher, das hier gilt.
  // Neu gibt es ihn einmal im Monat; derselbe Name nochmal ist keine Aenderung.
  let patch = changes;
  let renamedAt = null;
  if (changes.username !== undefined) {
    const wanted = normaliseUsername(changes.username);
    if (!USERNAME_PATTERN.test(wanted)) {
      return { status: 400, body: { error: 'username_invalid' } };
    }
    if (db.tables.accounts.some((entry) => entry.id !== id && entry.username === wanted)) {
      return { status: 409, body: { error: 'username_taken' } };
    }
    if (wanted !== row.username) {
      const freeAt = usernameFreeAt(row);
      if (freeAt)
        return { status: 409, body: { error: 'username_cooldown', nextChangeAt: freeAt } };
      renamedAt = new Date().toISOString();
    }
    patch = { ...changes, username: wanted };
  }

  const picked = Object.fromEntries(
    PROFILE_FIELDS.filter((field) => patch[field] !== undefined).map((field) => [
      field,
      patch[field],
    ]),
  );
  const next = { ...row, ...picked, ...(renamedAt ? { usernameChangedAt: renamedAt } : {}) };
  db.tables.accounts = db.tables.accounts.map((entry) => (entry.id === id ? next : entry));
  await save();
  return { status: 200, body: { account: withoutSecrets(next) } };
}

// ------------------------------------------------------------------ Sammlungen

/**
 * Alles, was diese App lesen darf — ohne Salt und Hash. Mit Sitzung nur die
 * Zeilen dieses Kontos samt Haushalt und Freigaben (`visibleTables`); ohne
 * Sitzung (nur lokal moeglich) wie bisher alles.
 */
async function snapshot(session) {
  const db = await load();
  const source = session ? visibleTables(db.tables, session.accountId) : db.tables;
  const tables = {};
  for (const name of Object.keys(source)) {
    tables[name] = name === 'accounts' ? source.accounts.map(withoutSecrets) : source[name];
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
 * nicht. Ohne Abo bleiben auch Farben, Hintergrund und der Assistent, wie sie
 * gespeichert sind (`billing/entitlement.js`). Mitteilungen, Mail und
 * Abo-Anfragen gehoeren dem Dienst und lassen sich so gar nicht ersetzen.
 */
async function replaceCollection(name, rows, session) {
  if (!isCollectionName(name)) return { status: 400, body: { error: 'unknown_collection' } };
  if (SERVER_OWNED.has(name)) return { status: 403, body: { error: 'server_owned' } };
  if (!Array.isArray(rows)) return { status: 400, body: { error: 'bad_request' } };

  const db = await load();
  // Was der Admin mit einem Konto geloescht hat, bringt ein alter Stand nicht zurueck.
  // Und mit Sitzung ersetzt die App nur, was sie sehen darf — der Rest bleibt (`mergeCollection`).
  const cleaned = withoutDeleted(db, name, rows);
  const incomingRows = session
    ? mergeCollection(db.tables, name, session.accountId, cleaned)
    : cleaned;
  if (name === 'accounts') {
    const stored = new Map(rowsOf(db, name).map((row) => [row.id, row]));
    const settings = planSettings();
    db.tables.accounts = incomingRows.map((row) => {
      const known = stored.get(row?.id);
      const incoming = { ...row };
      for (const field of ADMIN_FIELDS) delete incoming[field];
      // Ein bekanntes Konto behaelt seinen Benutzernamen — den aendert nur PATCH.
      if (known) for (const field of USERNAME_FIELDS) delete incoming[field];
      const kept = {};
      for (const field of [...SECRET_FIELDS, ...ADMIN_FIELDS, ...USERNAME_FIELDS]) {
        if (known?.[field] !== undefined) kept[field] = known[field];
      }
      return keepLockedFields({ ...incoming, ...kept }, known, settings);
    });
  } else {
    db.tables[name] = incomingRows;
  }

  await save();
  return { status: 200, body: { revision: db.revision } };
}

// ------------------------------------------------------------------ HTTP

const CORS = {
  // Die Apps laufen im Browser auf eigenen Ports.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Better-View, X-Better-Session, Authorization',
};

/** Offen bleibt nur, ob der Dienst lebt — so sieht ein Tester, ob die Adresse stimmt. */
const OPEN_PATHS = new Set(['/v1/health']);

/** Gleich lang und gleich, in konstanter Zeit — kein Raten Zeichen fuer Zeichen. */
function sameSecret(given, expected) {
  if (typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Traegt die Anfrage das Geheimnis? Ohne `BETTER_API_TOKEN` ist der Dienst
 * offen (Entwicklung). Mit: `Authorization: Bearer …` — oder `?token=` fuer
 * alles, was ein Browser als Adresse laedt (Bilder, Anhaenge, Audio).
 */
function refusedWithoutToken(req, url) {
  const expected = apiToken();
  if (!expected || OPEN_PATHS.has(url.pathname)) return false;
  const header = req.headers.authorization;
  const bearer =
    typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  return !sameSecret(bearer ?? url.searchParams.get('token'), expected);
}

/** Im Nur-Lesen-Modus — per Kopfzeile oder als Sitzung aus dem Admin — ist alles ausser Lesen und dem Einloesen verboten. */
function refusedInView(req, pathname, session) {
  if (req.headers[VIEW_HEADER] !== '1' && session?.view !== true) return false;
  if (READ_METHODS.has(req.method)) return false;
  return !(req.method === 'POST' && pathname === REDEEM_PATH);
}

/** Ein Ticket aus dem Admin einloesen -> das Konto, genau einmal. */
async function redeemView(body) {
  const redeemed = viewTickets.redeem(body?.ticket);
  if (!redeemed) return { status: 404, body: { error: 'not_found' } };
  const row = (await load()).tables.accounts.find((entry) => entry.id === redeemed.accountId);
  if (!row) return { status: 404, body: { error: 'not_found' } };
  // Die Sitzung dazu darf nie schreiben — auch ohne die Kopfzeile.
  const session = await sessions.issue(row.id, { view: true });
  return { status: 200, body: { account: withoutSecrets(row), app: redeemed.app, session } };
}

function send(res, status, body, extraHeaders = {}) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    // Nichts raten, nichts zwischenspeichern: Antworten sind persoenlich.
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
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

// Abo-Anfragen: die App fragt an, der Admin schaltet frei (bis es den Store gibt).
const planRequests = createPlanRequests({ dataDir: dataDir() });

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

// KI ueber Safe Swiss Cloud oder gratis ueber Groq. `BETTER_AI_TEST_URL` gilt nur fuer 127.0.0.1 (Tests).
const ai = createAiService({
  dataDir: dataDir(),
  baseUrl: process.env.BETTER_AI_TEST_URL,
  billing,
});

/** `accountId` und `app` aus der Adresse — geprueft wird im Dienst. */
const speakerQuery = (url) => ({
  accountId: url.searchParams.get('accountId') ?? undefined,
  app: url.searchParams.get('app') ?? undefined,
});

/** `body: true` liest JSON; `raw: true` schreibt die Antwort selbst. */
/** Titel der eigenen Termine an einem Tag — Better Fit prueft damit, wohin ein Training passt. */
async function calendarTitles(accountId, day) {
  const db = await load();
  return rowsOf(db, 'events')
    .filter(
      (row) =>
        row.accountId === accountId &&
        typeof row.startsAt === 'string' &&
        row.startsAt.slice(0, 10) === day,
    )
    .map((row) => String(row.title ?? '').slice(0, 60));
}

// Better Fit: eigener Datenbestand (fit.json), eigene Routen. Das Konto kommt
// ausschliesslich aus der Sitzung, die `server` schon aufgeloest hat.
const fit = createFitService({ dataDir: dataDir(), ai, calendar: calendarTitles });
const fitLimiter = createLimiter({ limit: fit.config.rateLimitPerMinute, windowMs: 60_000 });
const fitIpLimiter = createLimiter({
  limit: fit.config.rateLimitPerMinute * 3,
  windowMs: 60_000,
});

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
  {
    method: 'GET',
    path: /^\/v1\/db$/,
    handler: async ({ session }) => ok(200, await snapshot(session)),
  },
  {
    method: 'PUT',
    path: /^\/v1\/db\/([^/]+)$/,
    body: true,
    handler: ({ params: [name], body, session }) => replaceCollection(name, body.rows, session),
  },
  {
    method: 'POST',
    path: /^\/v1\/accounts$/,
    body: true,
    handler: async ({ body, req }) => {
      const gate = gateOf(signupByAddress, clientIp(req));
      if (!gate.allowed) return tooMany(gate);
      const result = await register(body.email, body.password, body.username);
      if (!result.error) {
        return ok(201, { ...result, session: await sessions.issue(result.account.id) });
      }
      // Ein vergebener Name ist kein Formfehler, sondern eine Kollision.
      return ok(result.error === 'username_taken' ? 409 : 400, result);
    },
  },
  {
    method: 'POST',
    path: /^\/v1\/sessions$/,
    body: true,
    handler: async ({ body, req }) => {
      const email = normaliseEmail(String(body.email ?? ''));
      const byAddress = gateOf(loginByAddress, clientIp(req));
      const byEmail = gateOf(loginByEmail, email);
      if (!byAddress.allowed) return tooMany(byAddress);
      if (!byEmail.allowed) return tooMany(byEmail);
      const result = await authenticate(body.email, body.password);
      if (!result.error) {
        loginByEmail.reset(email);
        return ok(200, { ...result, session: await sessions.issue(result.account.id) });
      }
      return ok(result.error === 'account_disabled' ? 403 : 401, result);
    },
  },
  {
    // Abmelden: die Sitzung gilt danach nirgends mehr.
    method: 'DELETE',
    path: /^\/v1\/sessions$/,
    handler: async ({ token }) => {
      if (token) await sessions.revoke(token);
      return ok(200, { ok: true });
    },
  },
  {
    // Fuer Einladungen: nur, was von einem Konto oeffentlich ist.
    method: 'GET',
    path: /^\/v1\/accounts\/by-username\/([^/]+)$/,
    handler: async ({ params: [name] }) => {
      const row = (await load()).tables.accounts.find((entry) => entry.username === name);
      return row ? ok(200, { account: publicAccount(row) }) : ok(404, { error: 'not_found' });
    },
  },
  {
    method: 'GET',
    path: /^\/v1\/accounts\/([^/]+)$/,
    owner: async ([id]) => id,
    handler: async ({ params: [id] }) => {
      const row = (await load()).tables.accounts.find((entry) => entry.id === id);
      return row ? ok(200, { account: withoutSecrets(row) }) : ok(404, { error: 'not_found' });
    },
  },
  {
    method: 'PATCH',
    path: /^\/v1\/accounts\/([^/]+)$/,
    body: true,
    owner: async ([id]) => id,
    handler: ({ params: [id], body }) => patchProfile(id, body),
  },

  // Haushalt
  {
    method: 'POST',
    path: /^\/v1\/households\/join$/,
    body: true,
    handler: ({ body }) => joinHousehold(body),
  },

  // Mitteilungen — anlegen darf man auch fuer andere (Einladungen), lesen und loeschen nur eigene.
  {
    method: 'POST',
    path: /^\/v1\/notifications$/,
    body: true,
    foreignAccountOk: true,
    handler: ({ body }) => createNotification(body),
  },
  {
    method: 'POST',
    path: /^\/v1\/notifications\/remove-by-ref$/,
    body: true,
    foreignAccountOk: true,
    handler: ({ body }) => removeNotificationsByRef(body),
  },
  {
    method: 'POST',
    path: /^\/v1\/notifications\/([^/]+)\/read$/,
    owner: ([id]) => ownerOfRow('notifications', id),
    handler: ({ params: [id] }) => markNotificationRead(id),
  },
  {
    method: 'DELETE',
    path: /^\/v1\/notifications\/([^/]+)$/,
    owner: ([id]) => ownerOfRow('notifications', id),
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
  {
    method: 'POST',
    path: /^\/v1\/view\/redeem$/,
    body: true,
    handler: ({ body }) => redeemView(body),
  },

  // Abo
  {
    method: 'GET',
    path: /^\/v1\/plans$/,
    handler: ({ url }) => planRequests.status(speakerQuery(url)),
  },
  {
    method: 'POST',
    path: /^\/v1\/plans\/requests$/,
    body: true,
    handler: ({ body }) => planRequests.request(body),
  },
  {
    method: 'POST',
    path: /^\/v1\/plans\/cancel$/,
    body: true,
    handler: ({ body }) => planRequests.cancel(body),
  },
  {
    method: 'POST',
    path: /^\/v1\/plans\/resume$/,
    body: true,
    handler: ({ body }) => planRequests.resume(body),
  },

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
    owner: ([id]) => ownerOfRow('mailAccounts', id),
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
    owner: ([id]) => ownerOfRow('mailMessages', id),
    handler: ({ params: [id], body }) => mail.markSeen(id, body),
  },
  {
    method: 'POST',
    path: /^\/v1\/mail\/messages\/([^/]+)\/delete$/,
    owner: ([id]) => ownerOfRow('mailMessages', id),
    handler: ({ params: [id] }) => mail.deleteMessage(id),
  },
  {
    method: 'GET',
    path: /^\/v1\/mail\/messages\/([^/]+)\/body$/,
    owner: ([id]) => ownerOfRow('mailMessages', id),
    handler: ({ params: [id], url }) =>
      mail.messageBody(id, url.searchParams.get('images') === '1'),
  },
  {
    method: 'GET',
    path: /^\/v1\/mail\/messages\/([^/]+)\/attachments\/([^/]+)$/,
    raw: true,
    owner: ([id]) => ownerOfRow('mailMessages', id),
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

  // Better Fit. `fit: true` heisst: ohne Sitzung gibt es die Route nicht,
  // und der Handler bekommt `auth` statt `session` — so bleiben die
  // Fit-Routen unveraendert und lesen nur `auth.accountId`.
  ...fit.routes.map((route) => ({ ...route, fit: true })),
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
  // Zuerst das Geheimnis der App, dann die Sitzung des Kontos, dann Nur-ansehen — alles vor jeder Route.
  if (refusedWithoutToken(req, url)) return send(res, 401, { error: 'unauthorized' });
  try {
    const token = sessionTokenOf(req, url);
    const session = token ? await sessions.lookup(token) : null;
    if (token && !session) return send(res, 401, { error: 'session_invalid' });
    if (!session && SESSIONS_REQUIRED && !isOpenRoute(req.method, url.pathname)) {
      return send(res, 401, { error: 'session_required' });
    }
    if (refusedInView(req, url.pathname, session)) return send(res, 403, { error: 'read_only' });

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

    // Wer eine Sitzung hat, handelt nur fuer sich: kein fremdes Konto, keine fremde Zeile.
    if (session) {
      const claimed = body.accountId ?? url.searchParams.get('accountId');
      if (!route.foreignAccountOk && typeof claimed === 'string' && claimed !== session.accountId) {
        return send(res, 403, { error: 'forbidden' });
      }
      if (route.owner) {
        const owner = await route.owner(params);
        if (owner === null) return send(res, 404, { error: 'not_found' });
        if (owner !== session.accountId) return send(res, 403, { error: 'forbidden' });
      }
    }

    if (route.fit) {
      // Ohne Sitzung keine persoenlichen Daten — unabhaengig davon, ob der
      // Dienst Sitzungen global verlangt.
      if (!session) return send(res, 401, { error: 'auth_required' });
      // Gesperrt oder geloescht gilt bei Better Fit **sofort**, auch mit einer
      // gueltigen Sitzung: hier liegen die persoenlichsten Daten. Der Dienst
      // sonst prueft `disabled` nur beim Anmelden.
      const owner = (await load()).tables.accounts.find(
        (entry) => entry.id === session.accountId,
      );
      if (!owner) return send(res, 401, { error: 'auth_required' });
      if (owner.disabled === true) return send(res, 403, { error: 'account_disabled' });
      const byIp = gateOf(fitIpLimiter, req.socket.remoteAddress ?? 'unknown');
      if (!byIp.allowed) return send(res, 429, tooMany(byIp).body);
      const byAccount = gateOf(fitLimiter, session.accountId);
      if (!byAccount.allowed) return send(res, 429, tooMany(byAccount).body);
      const auth = { accountId: session.accountId, readOnly: session.view === true };
      const idempotencyKey =
        typeof req.headers['idempotency-key'] === 'string'
          ? req.headers['idempotency-key']
          : null;
      // Inhalte (Lebensmittel, Rezepte, Uebungen) in der Sprache des Kontos.
      const language = languageOf(req.headers['accept-language']);
      if (route.raw) return await route.handler({ res, params, url, auth });
      const done = await route.handler({
        params,
        url,
        body,
        auth,
        req,
        idempotencyKey,
        language,
      });
      return send(res, done.status, done.body);
    }

    if (route.raw) return await route.handler({ res, params, url, req, session, token });
    const result = await route.handler({ params, url, body, req, session, token });
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
      sessions,
      // Loeschen nimmt auch Better Fit mit; dazu die Kosten fuer den Admin.
      fit: {
        removeAccount: (id) => fit.removeAccount(id),
        stats: (month) => fit.stats(month),
      },
    });
  }
  mail.startScheduler(mailSyncMs());
  // Mails, die vor einem Neustart noch warteten, gehen jetzt hinaus.
  mail.resumeOutbox().catch((error) => {
    process.stderr.write(`[mail] Postausgang: ${error?.name ?? 'Error'}\n`);
  });
});
