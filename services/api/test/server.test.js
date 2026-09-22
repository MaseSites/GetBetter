/**
 * Startet server.js als eigenen Prozess — mit Datenordner im Temp-Verzeichnis,
 * ohne Abgleich-Takt und mit nachgebauten Mail-Servern — und prueft die
 * Schnittstellen von aussen. services/api/data bleibt unberuehrt.
 */
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { after, before, describe, test } = require('node:test');

const { hashPassword } = require('../auth.js');
const { parseMessage } = require('../mail/mime.js');
const { encodeQuotedPrintable } = require('../mail/smtp.js');
const { createFakeImap, createFakeSmtp } = require('./fakes.js');

const SERVER = path.join(__dirname, '..', 'server.js');
const MAIL_PASSWORD = 'Mail-Passwort-ÄÖÜ';
/** Ein Konto, das der Admin gesperrt hat — liegt schon vor dem Start in der Datenbank. */
const LOCKED = { id: 'acc_locked', email: 'gesperrt@test.ch', password: 'passwort-gesperrt' };
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** Gross genug, dass der Anhang in mehreren Stuecken durch den Dienst fliesst. */
const PDF_BYTES = Buffer.from(Array.from({ length: 70_000 }, (_, index) => (index * 31 + 7) % 256));
const base64Lines = (bytes) =>
  bytes
    .toString('base64')
    .match(/.{1,76}/g)
    .join('\r\n');
const RICH_HTML =
  '<p onclick="steal()">Hallo <b>HTML</b></p><img src="cid:logo@x">' +
  '<img src="https://track.example/p.gif"><script>alert(1)</script>';

/** Text und HTML, ein eingebettetes Bild, ein PDF und ein HTML-Anhang. */
const RICH_RAW = [
  'From: Eva <eva@example.ch>',
  'To: user@example.ch',
  'Subject: Newsletter',
  'Message-ID: <rich1@example.ch>',
  'Date: Fri, 11 Sep 2026 09:00:00 +0200',
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed; boundary="mix"',
  '',
  '--mix',
  'Content-Type: multipart/alternative; boundary="alt"',
  '',
  '--alt',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Hallo Text',
  '--alt',
  'Content-Type: text/html; charset=utf-8',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  encodeQuotedPrintable(RICH_HTML),
  '--alt--',
  '--mix',
  'Content-Type: image/png; name="logo.png"',
  'Content-ID: <logo@x>',
  'Content-Disposition: inline; filename="logo.png"',
  'Content-Transfer-Encoding: base64',
  '',
  base64Lines(PNG),
  '--mix',
  'Content-Type: application/pdf; name="Rechnung.pdf"',
  'Content-Disposition: attachment; filename="Rechnung.pdf"',
  'Content-Transfer-Encoding: base64',
  '',
  base64Lines(PDF_BYTES),
  '--mix',
  'Content-Type: text/html; name="evil.html"',
  'Content-Disposition: attachment; filename="evil.html"',
  '',
  '<script>alert(1)</script>',
  '--mix--',
  '',
].join('\r\n');

/** Die BODYSTRUCTURE dazu; der PDF-Name versucht, aus dem Ordner zu klettern. */
const RICH_STRUCTURE =
  '(((' +
  '"TEXT" "PLAIN" ("CHARSET" "utf-8") NIL NIL "7BIT" 10 1)' +
  '("TEXT" "HTML" ("CHARSET" "utf-8") NIL NIL "QUOTED-PRINTABLE" 200 1) "ALTERNATIVE")' +
  '("IMAGE" "PNG" ("NAME" "logo.png") "<logo@x>" NIL "BASE64" 96 NIL' +
  ' ("inline" ("FILENAME" "logo.png")) NIL NIL)' +
  '("APPLICATION" "PDF" ("NAME" "Rechnung.pdf") NIL NIL "BASE64" 94000 NIL' +
  ' ("attachment" ("FILENAME" "..\\\\Rech\\"nung.pdf")) NIL NIL)' +
  '("TEXT" "HTML" ("NAME" "evil.html") NIL NIL "7BIT" 25 1 NIL' +
  ' ("attachment" ("FILENAME" "evil.html")) NIL NIL) "MIXED")';

const MAIL_ACCOUNT_KEYS = [
  'accountId',
  'connectedAt',
  'displayName',
  'email',
  'folders',
  'id',
  'imapHost',
  'imapPort',
  'imapSecure',
  'lastError',
  'lastSyncAt',
  'provider',
  'smtpHost',
  'smtpPort',
  'smtpSecure',
  'username',
];
const MAIL_MESSAGE_KEYS = [
  'accountId',
  'answered',
  'arrivedAfterConnect',
  'attachments',
  'bcc',
  'cc',
  'date',
  'flagged',
  'folder',
  'folderRole',
  'from',
  'id',
  'inReplyTo',
  'mailAccountId',
  'messageId',
  'references',
  'seen',
  'snippet',
  'subject',
  'text',
  'threadId',
  'to',
  'uid',
];
const NOTIFICATION_KEYS = [
  'accountId',
  'app',
  'body',
  'createdAt',
  'id',
  'kind',
  'readAt',
  'ref',
  'title',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
  });
}

async function freePort() {
  return freePortAfter(18089 + (process.pid % 700));
}

async function freePortAfter(taken) {
  for (let port = taken + 1; port < 19900; port += 1) {
    if (await isFree(port)) return port;
  }
  throw new Error('kein freier Port');
}

async function waitFor(check, timeoutMs = 5000) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > until) throw new Error('Zeitlimit beim Warten');
    await sleep(50);
  }
}

const mailRaw = ({ from, subject, text, id }) =>
  [
    `From: ${from}`,
    'To: user@example.ch',
    `Subject: ${subject}`,
    `Message-ID: <${id}@example.ch>`,
    'Date: Thu, 10 Sep 2026 09:00:00 +0200',
    '',
    text,
    '',
  ].join('\r\n');

describe('service endpoints', () => {
  let child;
  let base;
  let adminPort;
  let dataDir;
  let imap;
  let smtp;
  let imapPort;
  let smtpPort;
  let accountA;
  let accountB;

  const call = async (method, route, body, headers = {}) => {
    const response = await fetch(`${base}${route}`, {
      method,
      ...(body === undefined
        ? { headers }
        : { headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }),
    });
    const type = response.headers.get('content-type') ?? '';
    const data = type.includes('json')
      ? await response.json()
      : Buffer.from(await response.arrayBuffer());
    return { status: response.status, data, headers: response.headers };
  };
  /** Der Admin im selben Prozess — mit der Origin, die er verlangt. */
  const adminCall = async (method, route, body) => {
    const origin = `http://127.0.0.1:${adminPort}`;
    const response = await fetch(`${origin}${route}`, {
      method,
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  };
  const tables = async () => (await call('GET', '/v1/db')).data.tables;
  const activityText = () => fs.readFile(path.join(dataDir, 'activity.jsonl'), 'utf8');
  const activityLines = async () =>
    (await activityText())
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
  /** Ein Konto mit Abo (BetterGym) — nur so lassen sich Farben und der Assistent aendern. */
  let paidAccount = null;
  const paidAccountOf = async () => {
    if (paidAccount) return paidAccount;
    const created = (await call('POST', '/v1/accounts', { email: 'cleo@test.ch', password: 'passwort123' }))
      .data.account;
    const granted = await adminCall('PATCH', `/api/accounts/${created.id}`, { paidApps: ['bettergym'] });
    assert.equal(granted.status, 200);
    paidAccount = created;
    return created;
  };

  before(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'better-api-'));
    const lockedSalt = 'salz-gesperrt';
    const locked = {
      id: LOCKED.id,
      email: LOCKED.email,
      username: 'gesperrt',
      firstName: '',
      language: 'de',
      onboarded: false,
      selectedAreas: [],
      householdId: null,
      passwordSalt: lockedSalt,
      passwordHash: await hashPassword(LOCKED.password, lockedSalt),
      disabled: true,
      blockedApps: ['bettergym'],
      createdAt: '2026-09-01T00:00:00.000Z',
    };
    await fs.writeFile(
      path.join(dataDir, 'db.json'),
      JSON.stringify({ revision: 0, tables: { accounts: [locked] } }),
    );
    imap = createFakeImap({ username: 'user@example.ch', password: MAIL_PASSWORD });
    smtp = createFakeSmtp({ username: 'user@example.ch', password: MAIL_PASSWORD });
    imapPort = await imap.listen();
    smtpPort = await smtp.listen();

    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    // Der Admin laeuft im selben Prozess: „App ansehen“ stellt dort Tickets aus, der Dienst loest sie ein.
    adminPort = await freePortAfter(port);
    child = spawn(process.execPath, [SERVER], {
      env: {
        ...process.env,
        PORT: String(port),
        BETTER_DATA_DIR: dataDir,
        BETTER_MAIL_SYNC_MS: '0',
        BETTER_MAIL_ALLOW_PLAIN: '1',
        BETTER_ADMIN_PORT: String(adminPort),
        BETTER_TRIAL_BUDGET_CHF: '',
        BETTER_PRICE_GETBETTER_CHF: '',
        // Die KI bleibt unkonfiguriert, auch wenn der Rechner einen Schluessel kennt.
        SAFESWISSCLOUD_API_KEY: '',
        SAFESWISSCLOUD_API_URL: '',
        GROQ_API_KEY: '',
        BETTER_AI_PROVIDER: '',
        BETTER_AI_GROQ_MODEL: '',
        BETTER_AI_TEST_URL: '',
        BETTER_AI_MODEL_CHEAP: '',
        BETTER_AI_MODEL_CHAT: '',
        BETTER_AI_MODEL_REASONING: '',
        BETTER_AI_MODEL_VISION: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.resume();
    child.stderr.resume();
    await waitFor(async () => {
      try {
        return (await fetch(`${base}/v1/health`)).ok;
      } catch {
        return false;
      }
    });

    accountA = (
      await call('POST', '/v1/accounts', { email: 'anna@test.ch', password: 'passwort123' })
    ).data.account;
    accountB = (
      await call('POST', '/v1/accounts', { email: 'ben@test.ch', password: 'passwort123' })
    ).data.account;
  });

  after(async () => {
    child?.kill();
    await imap?.close();
    await smtp?.close();
    await sleep(200);
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  test('allows DELETE in CORS and refuses PUT on server-owned collections', async () => {
    const options = await fetch(`${base}/v1/db`, { method: 'OPTIONS' });
    assert.match(options.headers.get('access-control-allow-methods') ?? '', /DELETE/);

    for (const name of ['notifications', 'mailAccounts', 'mailMessages']) {
      const result = await call('PUT', `/v1/db/${name}`, { rows: [] });
      assert.equal(result.status, 403, name);
      assert.deepEqual(result.data, { error: 'server_owned' });
    }
    const tasks = await call('PUT', '/v1/db/tasks', { rows: [{ id: 't1', title: 'x' }] });
    assert.equal(tasks.status, 200);
    assert.deepEqual((await tables()).tasks, [{ id: 't1', title: 'x' }]);
  });

  test('stores assistantName and backdrop on the profile (with an abo)', async () => {
    const cleo = await paidAccountOf();
    const patched = await call('PATCH', `/v1/accounts/${cleo.id}`, {
      assistantName: 'Luma',
      backdrop: 'upload:upl_0123',
      firstName: 'Cleo',
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.data.account.assistantName, 'Luma');
    assert.equal(patched.data.account.backdrop, 'upload:upl_0123');
    assert.equal(patched.data.account.passwordHash, undefined);

    const read = await call('GET', `/v1/accounts/${cleo.id}`);
    assert.equal(read.data.account.firstName, 'Cleo');
    assert.equal(read.data.account.assistantName, 'Luma');

    assert.equal(
      (await call('PATCH', `/v1/accounts/${cleo.id}`, { assistantName: 5 })).status,
      400,
    );
    assert.equal((await call('PATCH', '/v1/accounts/acc_fehlt', { firstName: 'x' })).status, 404);
  });

  test('stores a valid assistantAvatar and refuses anything else', async () => {
    const cleo = await paidAccountOf();
    const owl = { kind: 'owl', color: 'sun', eyes: 'sparkle', accessory: 'glasses' };
    const saved = await call('PATCH', `/v1/accounts/${cleo.id}`, { assistantAvatar: owl });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.data.account.assistantAvatar, owl);
    assert.deepEqual((await call('GET', `/v1/accounts/${cleo.id}`)).data.account.assistantAvatar, owl);

    const refused = [
      'owl',
      null,
      [],
      { kind: 'owl', color: 'sun', eyes: 'sparkle' },
      { ...owl, kind: 'dragon' },
      { ...owl, color: '#FF0000' },
      { ...owl, eyes: 'laser' },
      { ...owl, accessory: 'crown' },
      // Die Eule traegt keine Antenne.
      { ...owl, accessory: 'antenna' },
      { ...owl, extra: 'x' },
    ];
    for (const assistantAvatar of refused) {
      const result = await call('PATCH', `/v1/accounts/${cleo.id}`, {
        assistantAvatar,
        firstName: 'Nicht gespeichert',
      });
      assert.equal(result.status, 400, JSON.stringify(assistantAvatar));
      assert.deepEqual(result.data, { error: 'avatar_invalid' });
    }
    // Abgewiesen heisst: auch nichts anderes aus derselben Anfrage wurde geschrieben.
    const read = (await call('GET', `/v1/accounts/${cleo.id}`)).data.account;
    assert.deepEqual(read.assistantAvatar, owl);
    assert.notEqual(read.firstName, 'Nicht gespeichert');
  });

  test('creates, reads, removes notifications', async () => {
    const before = (await call('GET', '/v1/revision')).data.revision;
    const created = await call('POST', '/v1/notifications', {
      accountId: accountA.id,
      kind: 'calendarShare',
      title: 'Ben',
      body: 'Familie',
      ref: { shareId: 's1' },
      app: 'getbetter',
    });
    assert.equal(created.status, 201);
    const { notification } = created.data;
    assert.deepEqual(Object.keys(notification).sort(), NOTIFICATION_KEYS);
    assert.equal(notification.readAt, null);
    assert.ok((await call('GET', '/v1/revision')).data.revision > before);

    const invalid = [
      { accountId: accountA.id, kind: 'spam', title: 'x', body: '', ref: {}, app: 'getbetter' },
      {
        accountId: accountA.id,
        kind: 'system',
        title: 'x',
        body: '',
        ref: { n: 1 },
        app: 'getbetter',
      },
      { accountId: accountA.id, kind: 'system', title: 'x', body: '', ref: {}, app: '' },
    ];
    for (const body of invalid)
      assert.equal((await call('POST', '/v1/notifications', body)).status, 400);
    const unknown = await call('POST', '/v1/notifications', {
      ...invalid[0],
      kind: 'system',
      accountId: 'acc_x',
    });
    assert.equal(unknown.status, 404);

    const read = await call('POST', `/v1/notifications/${notification.id}/read`);
    assert.equal(read.status, 200);
    assert.ok(read.data.notification.readAt);

    const make = (accountId, value) =>
      call('POST', '/v1/notifications', {
        accountId,
        kind: 'householdInvite',
        title: 'Haus',
        body: '',
        ref: { membershipId: value },
        app: 'betterfamily',
      });
    await make(accountA.id, 'm1');
    await make(accountB.id, 'm1');
    await make(accountB.id, 'm2');
    const onlyB = await call('POST', '/v1/notifications/remove-by-ref', {
      accountId: accountB.id,
      kind: 'householdInvite',
      key: 'membershipId',
      value: 'm1',
    });
    assert.deepEqual(onlyB.data, { removed: 1 });
    const everyone = await call('POST', '/v1/notifications/remove-by-ref', {
      kind: 'householdInvite',
      key: 'membershipId',
      value: 'm1',
    });
    assert.deepEqual(everyone.data, { removed: 1 });
    assert.equal(
      (await call('POST', '/v1/notifications/remove-by-ref', { kind: 'x', key: 'a', value: 'b' }))
        .status,
      400,
    );

    assert.deepEqual((await call('DELETE', `/v1/notifications/${notification.id}`)).data, {
      ok: true,
    });
    assert.equal((await call('DELETE', `/v1/notifications/${notification.id}`)).status, 404);
    const left = (await tables()).notifications;
    assert.deepEqual(
      left.map((row) => [row.accountId, row.ref.membershipId]),
      [[accountB.id, 'm2']],
    );
  });

  test('uploads, serves and deletes images', async () => {
    const dataUrl = `data:image/png;base64,${PNG.toString('base64')}`;
    const created = await call('POST', '/v1/uploads', { accountId: accountA.id, dataUrl });
    assert.equal(created.status, 201);
    assert.match(created.data.id, /^upl_[a-f0-9]{24}$/);
    assert.equal(created.data.url, `/v1/uploads/${created.data.id}`);
    await fs.access(path.join(dataDir, 'uploads', `${created.data.id}.png`));

    const served = await call('GET', created.data.url);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get('content-type'), 'image/png');
    assert.equal(served.headers.get('access-control-allow-origin'), '*');
    assert.match(served.headers.get('cache-control') ?? '', /max-age/);
    assert.deepEqual(served.data, PNG);

    const gif = await call('POST', '/v1/uploads', {
      accountId: accountA.id,
      dataUrl: 'data:image/gif;base64,R0lGODlh',
    });
    assert.deepEqual([gif.status, gif.data.error], [400, 'unsupported_type']);
    const disguised = await call('POST', '/v1/uploads', {
      accountId: accountA.id,
      dataUrl: `data:image/jpeg;base64,${PNG.toString('base64')}`,
    });
    assert.equal(disguised.data.error, 'unsupported_type');
    const huge = Buffer.concat([PNG.subarray(0, 8), Buffer.alloc(5 * 1024 * 1024)]);
    const tooLarge = await call('POST', '/v1/uploads', {
      accountId: accountA.id,
      dataUrl: `data:image/png;base64,${huge.toString('base64')}`,
    });
    assert.deepEqual([tooLarge.status, tooLarge.data.error], [413, 'too_large']);
    assert.equal((await call('POST', '/v1/uploads', { dataUrl })).status, 400);
    assert.equal((await call('GET', '/v1/uploads/..%2F..%2Fdb.json')).status, 404);

    assert.deepEqual((await call('DELETE', created.data.url)).data, { ok: true });
    assert.equal((await call('GET', created.data.url)).status, 404);
  });

  test('AI: status without configuration, 400 on bad bodies, 503 without key', async () => {
    const status = await call('GET', '/v1/ai/status');
    assert.equal(status.status, 200);
    assert.deepEqual(status.data, {
      provider: 'safeswisscloud',
      configured: false,
      models: {
        cheap_model: 'gemma4-31b',
        chat_model: 'gpt-oss-120b',
        reasoning_model: 'deepseek-v4-flash',
        vision_model: 'gemma4-31b',
      },
      lastError: null,
    });

    const valid = {
      accountId: accountA.id,
      app: 'getbetter',
      messages: [{ role: 'user', text: 'Trag Milch ein' }],
    };
    for (const body of [{}, { ...valid, app: 'nope' }, { ...valid, messages: [] }]) {
      const result = await call('POST', '/v1/ai/reply', body);
      assert.deepEqual([result.status, result.data], [400, { error: 'bad_request' }]);
    }
    const unknown = await call('POST', '/v1/ai/reply', { ...valid, accountId: 'acc_fehlt' });
    assert.deepEqual([unknown.status, unknown.data], [404, { error: 'account_not_found' }]);

    const unconfigured = await call('POST', '/v1/ai/reply', valid);
    assert.deepEqual([unconfigured.status, unconfigured.data], [503, { error: 'not_configured' }]);

    const usage = await fs.readFile(path.join(dataDir, 'ai-usage.jsonl'), 'utf8');
    assert.equal(usage.trim().split('\n').length, 5);
    assert.equal(usage.includes('Milch'), false);
  });

  test('refuses a disabled account at login and records it without secrets', async () => {
    const wrong = await call('POST', '/v1/sessions', {
      email: LOCKED.email,
      password: 'falsch-falsch',
    });
    assert.deepEqual([wrong.status, wrong.data], [401, { error: 'wrong_password' }]);
    const blocked = await call('POST', '/v1/sessions', {
      email: LOCKED.email,
      password: LOCKED.password,
    });
    assert.deepEqual([blocked.status, blocked.data], [403, { error: 'account_disabled' }]);
    const unknown = await call('POST', '/v1/sessions', {
      email: 'niemand@test.ch',
      password: LOCKED.password,
    });
    assert.equal(unknown.status, 401);

    const kinds = (await activityLines())
      .filter((line) => line.accountId === LOCKED.id)
      .map((line) => line.kind);
    assert.deepEqual(kinds.slice(-2), ['session.failed', 'session.blocked']);
    const raw = await activityText();
    for (const secret of ['niemand@test.ch', LOCKED.password, 'falsch-falsch', 'passwordHash']) {
      assert.equal(raw.includes(secret), false, secret);
    }

    // Die Apps lesen die Sperre, heben sie ueber ihr Profil aber nicht auf.
    const patched = await call('PATCH', `/v1/accounts/${LOCKED.id}`, {
      disabled: false,
      blockedApps: [],
      firstName: 'Gesperrt',
    });
    assert.equal(patched.status, 200);
    assert.deepEqual(
      [patched.data.account.disabled, patched.data.account.blockedApps],
      [true, ['bettergym']],
    );
    const read = (await call('GET', `/v1/accounts/${LOCKED.id}`)).data.account;
    assert.deepEqual(
      [read.firstName, read.disabled, read.blockedApps, read.passwordHash],
      ['Gesperrt', true, ['bettergym'], undefined],
    );
    // Das Profil zu aendern steht nicht im Verlauf.
    const last = (await activityLines()).at(-1);
    assert.deepEqual([last.accountId, last.kind], [LOCKED.id, 'session.blocked']);
  });

  test('PUT /v1/db/accounts keeps disabled and blockedApps as the admin set them', async () => {
    const original = (await tables()).accounts;
    const locked = original.find((row) => row.id === LOCKED.id);
    assert.deepEqual([locked.disabled, locked.blockedApps], [true, ['bettergym']]);
    const start = (await activityLines()).length;

    const tampered = [
      ...original.map((row) => {
        if (row.id === LOCKED.id) return { ...row, disabled: false, blockedApps: [] };
        if (row.id === accountA.id) return { ...row, disabled: true, blockedApps: ['getbetter'] };
        return row;
      }),
      { id: 'acc_neu', email: 'neu@test.ch', username: 'neu', disabled: true, blockedApps: ['betterai'] },
    ];
    assert.equal((await call('PUT', '/v1/db/accounts', { rows: tampered })).status, 200);

    const stored = (await tables()).accounts;
    const rowOf = (id) => stored.find((row) => row.id === id);
    assert.deepEqual([rowOf(LOCKED.id).disabled, rowOf(LOCKED.id).blockedApps], [true, ['bettergym']]);
    assert.deepEqual([rowOf(accountA.id).disabled, rowOf(accountA.id).blockedApps], [undefined, undefined]);
    assert.equal(Object.hasOwn(rowOf('acc_neu'), 'disabled'), false);
    assert.equal(Object.hasOwn(rowOf('acc_neu'), 'blockedApps'), false);

    // Ein PUT steht nicht im Verlauf, auch nicht fuer ein neues Konto.
    assert.equal((await activityLines()).length, start);

    // Passwoerter bleiben ebenso: Anna meldet sich an, das gesperrte Konto weiterhin nicht.
    const anna = await call('POST', '/v1/sessions', { email: 'anna@test.ch', password: 'passwort123' });
    assert.equal(anna.status, 200);
    const again = await call('POST', '/v1/sessions', {
      email: LOCKED.email,
      password: LOCKED.password,
    });
    assert.equal(again.status, 403);

    assert.equal((await call('PUT', '/v1/db/accounts', { rows: original })).status, 200);
    assert.equal((await tables()).accounts.some((row) => row.id === 'acc_neu'), false);
  });

  test('paidApps is admin-only: PUT and PATCH from an app never set or clear it', async () => {
    const original = (await tables()).accounts;
    const tampered = original.map((row) => {
      if (row.id === accountA.id) return { ...row, paidApps: ['betterai', 'bettergym'] };
      return row;
    });
    assert.equal((await call('PUT', '/v1/db/accounts', { rows: tampered })).status, 200);
    assert.equal(Object.hasOwn((await tables()).accounts.find((row) => row.id === accountA.id), 'paidApps'), false);

    const patched = await call('PATCH', `/v1/accounts/${accountA.id}`, { paidApps: ['betterai'], firstName: 'Anna' });
    assert.equal(patched.status, 200);
    assert.equal(patched.data.account.paidApps, undefined);

    // Der Admin setzt es — danach behalten PUT und PATCH, was er gesetzt hat.
    const admin = await adminCall('PATCH', `/api/accounts/${accountA.id}`, { paidApps: ['betterai'] });
    assert.deepEqual([admin.status, admin.data.account.paidApps], [200, ['betterai']]);
    const current = (await tables()).accounts;
    const cleared = current.map((row) => (row.id === accountA.id ? { ...row, paidApps: [] } : row));
    assert.equal((await call('PUT', '/v1/db/accounts', { rows: cleared })).status, 200);
    await call('PATCH', `/v1/accounts/${accountA.id}`, { paidApps: [] });
    assert.deepEqual((await call('GET', `/v1/accounts/${accountA.id}`)).data.account.paidApps, ['betterai']);

    const budget = await call('GET', `/v1/ai/budget?accountId=${accountA.id}&app=betterai`);
    assert.equal(budget.status, 200);
    assert.deepEqual(
      [budget.data.plan, budget.data.budgetChf, budget.data.spentChf, budget.data.remainingShare, budget.data.priceChf],
      ['paid', 4.717853, 0, 1, 8],
    );
    assert.match(budget.data.resetsOn, /^\d{4}-\d{2}-01$/);
    const trial = await call('GET', `/v1/ai/budget?accountId=${accountA.id}&app=getbetter`);
    assert.deepEqual([trial.data.plan, trial.data.budgetChf], ['trial', 0.1]);
    assert.equal((await call('GET', '/v1/ai/budget?accountId=acc_fehlt&app=getbetter')).status, 404);
    assert.equal((await call('GET', `/v1/ai/budget?accountId=${accountA.id}&app=nope`)).status, 400);

    const speech = await call('GET', `/v1/speech/status?accountId=${accountA.id}&app=getbetter`);
    assert.deepEqual([speech.data.allowed, speech.data.plan, speech.data.reason], [false, 'trial', 'plan_required']);
  });

  test('App ansehen: ticket from the admin, redeemed once, then read-only', async () => {
    const view = await adminCall('POST', `/api/accounts/${accountB.id}/view`, { app: 'bettergym' });
    assert.equal(view.status, 200);
    const url = new URL(view.data.url);
    assert.equal(url.origin, 'http://localhost:8083');
    const ticket = url.searchParams.get('view');
    assert.match(ticket, /^[a-f0-9]{64}$/);

    const options = await fetch(`${base}/v1/db`, { method: 'OPTIONS' });
    assert.match(options.headers.get('access-control-allow-headers') ?? '', /X-Better-View/i);

    const viewing = { 'X-Better-View': '1' };
    const redeemed = await call('POST', '/v1/view/redeem', { ticket }, viewing);
    assert.equal(redeemed.status, 200);
    assert.deepEqual([redeemed.data.account.id, redeemed.data.app], [accountB.id, 'bettergym']);
    assert.equal(redeemed.data.account.passwordHash, undefined);
    assert.equal(redeemed.data.account.passwordSalt, undefined);
    const again = await call('POST', '/v1/view/redeem', { ticket });
    assert.deepEqual([again.status, again.data], [404, { error: 'not_found' }]);
    assert.equal((await call('POST', '/v1/view/redeem', { ticket: 'kaputt' })).status, 404);

    const revision = (await call('GET', '/v1/revision')).data.revision;
    const writes = [
      ['PUT', '/v1/db/tasks', { rows: [] }],
      ['PATCH', `/v1/accounts/${accountB.id}`, { firstName: 'Nie' }],
      ['POST', '/v1/notifications', { accountId: accountB.id, kind: 'system', title: 'x', body: '', ref: {}, app: 'getbetter' }],
      ['POST', '/v1/notifications/n_x/read', {}],
      ['DELETE', '/v1/notifications/n_x', undefined],
      ['POST', '/v1/uploads', { accountId: accountB.id, dataUrl: 'data:image/png;base64,AA==' }],
      ['POST', '/v1/ai/reply', { accountId: accountB.id, app: 'getbetter', messages: [{ role: 'user', text: 'x' }] }],
      ['POST', '/v1/speech', { text: 'x', voice: 'VoiceGerman001', language: 'de' }],
      ['POST', '/v1/speech/sample', { voice: 'VoiceGerman001', language: 'de' }],
      ['POST', '/v1/mail/messages/mm_x/seen', { seen: true }],
      ['POST', '/v1/mail/send', { mailAccountId: 'mac_x', to: ['a@b.ch'], subject: '', text: '' }],
      ['POST', '/v1/mail/drafts', {}],
      ['POST', '/v1/accounts', { email: 'view@test.ch', password: 'passwort123' }],
    ];
    for (const [method, route, body] of writes) {
      const refused = await call(method, route, body, viewing);
      assert.deepEqual([refused.status, refused.data], [403, { error: 'read_only' }], `${method} ${route}`);
    }
    assert.equal((await call('GET', '/v1/revision', undefined, viewing)).data.revision, revision);
    assert.equal((await call('GET', '/v1/db', undefined, viewing)).status, 200);
    assert.equal((await call('GET', `/v1/accounts/${accountB.id}`, undefined, viewing)).status, 200);

    const unknownApp = await adminCall('POST', `/api/accounts/${accountB.id}/view`, { app: 'betterx' });
    assert.equal(unknownApp.status, 400);
    const unknownAccount = await adminCall('POST', '/api/accounts/acc_fehlt/view', { app: 'getbetter' });
    assert.equal(unknownAccount.status, 404);
    const lines = (await activityLines()).filter((line) => line.kind === 'admin.viewed');
    assert.deepEqual(lines.map((line) => [line.accountId, line.detail]), [[accountB.id, { app: 'bettergym' }]]);
  });

  test('a PUT from an app leaves no trace in the activity log', async () => {
    const original = (await tables()).tasks;
    const before = await activityText();
    const ownRow = { id: 'ta1', accountId: accountA.id, title: 'Geheimer Titel' };
    const first = [...original, ownRow, { id: 'tb1', accountId: accountB.id, title: 'Ben' }];
    const second = [...original, { ...ownRow, title: 'Geheimer Titel 2' }];
    assert.equal((await call('PUT', '/v1/db/tasks', { rows: first })).status, 200);
    assert.equal((await call('PUT', '/v1/db/tasks', { rows: second })).status, 200);
    assert.equal((await call('PATCH', `/v1/accounts/${accountA.id}`, { firstName: 'Anna' })).status, 200);

    // Was die Nutzer eintragen oder am Profil aendern, schreibt der Dienst nicht mehr mit.
    assert.equal(await activityText(), before);
    assert.equal((await activityText()).includes('Geheimer Titel'), false);

    assert.equal((await call('PUT', '/v1/db/tasks', { rows: original })).status, 200);
  });

  describe('mail', () => {
    let mailAccount;
    const imapSettings = () => ({
      imapHost: '127.0.0.1',
      imapPort,
      imapSecure: false,
      smtpHost: '127.0.0.1',
      smtpPort,
      smtpSecure: false,
    });

    test('suggests provider settings', async () => {
      const gmx = await call('GET', '/v1/mail/providers?email=hans%40gmx.ch');
      assert.equal(gmx.status, 200);
      assert.equal(gmx.data.provider, 'gmx');
      assert.equal(gmx.data.note, 'enable_imap');
      assert.equal((await call('GET', '/v1/mail/providers?email=kaputt')).status, 400);
    });

    test('rejects Outlook, wrong passwords and bad input', async () => {
      const outlook = await call('POST', '/v1/mail/accounts', {
        accountId: accountA.id,
        email: 'a@hotmail.com',
        password: 'x',
      });
      assert.deepEqual(outlook.data, { error: 'oauth_required' });

      const wrong = await call('POST', '/v1/mail/accounts', {
        accountId: accountA.id,
        email: 'user@gmail.com',
        username: 'user@example.ch',
        password: 'falsch',
        ...imapSettings(),
      });
      assert.deepEqual(
        [wrong.status, wrong.data],
        [400, { error: 'auth_failed', note: 'app_password' }],
      );

      const badPort = await call('POST', '/v1/mail/accounts', {
        accountId: accountA.id,
        email: 'user@example.ch',
        password: MAIL_PASSWORD,
        ...imapSettings(),
        imapPort: 70000,
      });
      assert.deepEqual(badPort.data, { error: 'bad_request' });
      const badHost = await call('POST', '/v1/mail/accounts', {
        accountId: accountA.id,
        email: 'user@example.ch',
        password: MAIL_PASSWORD,
        ...imapSettings(),
        imapHost: 'mail server.ch',
      });
      assert.deepEqual(badHost.data, { error: 'bad_request' });
    });

    test('connects, runs the first sync without notifications and keeps the password secret', async () => {
      imap.addMessage(
        'INBOX',
        mailRaw({ from: 'Alt <alt@example.ch>', subject: 'Alt eins', text: 'eins', id: 'a1' }),
        {
          flags: ['\\Seen'],
        },
      );
      imap.addMessage(
        'INBOX',
        mailRaw({ from: 'Alt <alt@example.ch>', subject: 'Alt zwei', text: 'zwei', id: 'a2' }),
      );

      const created = await call('POST', '/v1/mail/accounts', {
        accountId: accountA.id,
        email: 'User@Example.ch',
        displayName: 'Anna',
        password: MAIL_PASSWORD,
        ...imapSettings(),
      });
      assert.equal(created.status, 201);
      mailAccount = created.data.mailAccount;
      assert.deepEqual(Object.keys(mailAccount).sort(), MAIL_ACCOUNT_KEYS);
      assert.equal(mailAccount.email, 'user@example.ch');
      assert.equal(mailAccount.provider, 'custom');
      assert.equal(mailAccount.username, 'user@example.ch');

      const duplicate = await call('POST', '/v1/mail/accounts', {
        accountId: accountA.id,
        email: 'user@example.ch',
        password: MAIL_PASSWORD,
        ...imapSettings(),
      });
      assert.deepEqual(duplicate.data, { error: 'already_connected' });

      const synced = await waitFor(async () => {
        const current = await tables();
        return current.mailMessages.length === 2 && current.mailAccounts[0].lastSyncAt
          ? current
          : null;
      });
      for (const row of synced.mailMessages) {
        assert.deepEqual(Object.keys(row).sort(), MAIL_MESSAGE_KEYS);
        assert.equal(row.arrivedAfterConnect, false);
        assert.equal(row.accountId, accountA.id);
      }
      const first = synced.mailMessages.find((row) => row.uid === 1);
      assert.equal(first.subject, 'Alt eins');
      assert.equal(first.seen, true);
      assert.deepEqual(first.from, { name: 'Alt', address: 'alt@example.ch' });
      assert.equal(synced.notifications.filter((row) => row.kind === 'mail').length, 0);

      const files = await Promise.all(
        ['db.json', 'mail-vault.json', 'mail-state.json'].map((name) =>
          fs.readFile(path.join(dataDir, name), 'utf8'),
        ),
      );
      for (const content of files) assert.ok(!content.includes(MAIL_PASSWORD));
      assert.ok(!JSON.stringify(synced).includes(MAIL_PASSWORD));
      assert.equal((await fs.readFile(path.join(dataDir, 'mail.key'))).length, 32);
    });

    test('announces new mail, refreshes flags and drops deleted mail', async () => {
      imap.addMessage(
        'INBOX',
        mailRaw({
          from: '"Cara Neu" <cara@example.ch>',
          subject: 'Neu da',
          text: 'Hallo',
          id: 'n1',
        }),
      );
      imap.state.boxes.INBOX = imap.state.boxes.INBOX.filter((m) => m.uid !== 1).map((m) =>
        m.uid === 2 ? { ...m, flags: ['\\Seen'] } : m,
      );

      const result = await call('POST', '/v1/mail/sync', { accountId: accountA.id });
      assert.deepEqual(result.data, { newMessages: 1, errors: [] });

      const current = await tables();
      assert.deepEqual(current.mailMessages.map((row) => row.uid).sort(), [2, 3]);
      assert.equal(current.mailMessages.find((row) => row.uid === 2).seen, true);
      const fresh = current.mailMessages.find((row) => row.uid === 3);
      assert.equal(fresh.arrivedAfterConnect, true);
      assert.equal(fresh.messageId, '<n1@example.ch>');
      assert.match(fresh.threadId, /^th_[a-f0-9]{24}$/);
      const [notification] = current.notifications.filter((row) => row.kind === 'mail');
      assert.deepEqual(
        {
          title: notification.title,
          body: notification.body,
          ref: notification.ref,
          app: notification.app,
        },
        {
          title: 'Cara Neu',
          body: 'Neu da',
          ref: { mailMessageId: fresh.id, mailAccountId: mailAccount.id, threadId: fresh.threadId },
          app: 'getbetter',
        },
      );
      assert.equal(notification.accountId, accountA.id);
      assert.equal(notification.readAt, null);
    });

    test('marks mail as seen on the server and reads its notification', async () => {
      const fresh = (await tables()).mailMessages.find((row) => row.uid === 3);
      assert.deepEqual(
        (await call('POST', `/v1/mail/messages/${fresh.id}/seen`, { seen: true })).data,
        { ok: true },
      );
      assert.ok(imap.state.boxes.INBOX.find((m) => m.uid === 3).flags.includes('\\Seen'));
      const current = await tables();
      assert.equal(current.mailMessages.find((row) => row.id === fresh.id).seen, true);
      assert.ok(current.notifications.find((row) => row.ref.mailMessageId === fresh.id).readAt);
      assert.equal((await call('POST', `/v1/mail/messages/${fresh.id}/seen`, {})).status, 400);
      assert.equal(
        (await call('POST', '/v1/mail/messages/mm_fehlt/seen', { seen: true })).status,
        404,
      );
    });

    test('sends replies and files a copy in Sent', async () => {
      const parent = (await tables()).mailMessages.find((row) => row.uid === 3);
      const sent = await call('POST', '/v1/mail/send', {
        mailAccountId: mailAccount.id,
        to: ['Cara <cara@example.ch>'],
        cc: [],
        subject: 'Re: Neu da',
        text: 'Danke!\n.punkt',
        inReplyTo: parent.id,
      });
      assert.deepEqual(sent.data, { ok: true });
      const [delivered] = smtp.state.messages;
      assert.deepEqual(delivered.recipients, ['cara@example.ch']);
      assert.match(delivered.message, /\r\nIn-Reply-To: <n1@example\.ch>\r\n/);
      assert.match(delivered.message, /\r\nReferences: <n1@example\.ch>\r\n/);
      assert.match(delivered.message, /^From: Anna <user@example\.ch>\r\n/);
      assert.ok(delivered.stuffed.includes('\r\n..punkt'));
      await waitFor(() => imap.state.boxes.Sent.length === 1);

      const unknown = await call('POST', '/v1/mail/send', {
        mailAccountId: 'mac_x',
        to: ['a@b.ch'],
        subject: '',
        text: '',
      });
      assert.deepEqual(unknown.data, { error: 'not_found' });
      const badTo = await call('POST', '/v1/mail/send', {
        mailAccountId: mailAccount.id,
        to: ['kein-mail'],
        subject: '',
        text: '',
      });
      assert.deepEqual(badTo.data, { error: 'bad_request' });
      const missingParent = await call('POST', '/v1/mail/send', {
        mailAccountId: mailAccount.id,
        to: ['a@b.ch'],
        subject: '',
        text: '',
        inReplyTo: 'mm_fehlt',
      });
      assert.deepEqual(missingParent.data, { error: 'not_found' });
    });

    test('moves deleted mail to the trash', async () => {
      const target = (await tables()).mailMessages.find((row) => row.uid === 3);
      assert.deepEqual((await call('POST', `/v1/mail/messages/${target.id}/delete`)).data, {
        ok: true,
      });
      assert.ok(!imap.state.boxes.INBOX.some((m) => m.uid === 3));
      assert.equal(imap.state.boxes.Trash.length, 1);
      const current = await tables();
      assert.ok(!current.mailMessages.some((row) => row.id === target.id));
      assert.ok(!current.notifications.some((row) => row.ref.mailMessageId === target.id));
    });

    test('learns which folders the mailbox keeps', async () => {
      assert.deepEqual((await tables()).mailAccounts[0].folders, [
        { role: 'inbox', name: 'INBOX' },
        { role: 'sent', name: 'Sent' },
        { role: 'drafts', name: 'Drafts' },
        { role: 'junk', name: 'Junk' },
        { role: 'trash', name: 'Trash' },
        { role: 'archive', name: 'Archive' },
      ]);
    });

    test('syncs every folder, reads attachments and moves mail into the junk folder', async () => {
      const withPdf =
        '(("TEXT" "PLAIN" ("CHARSET" "utf-8") NIL NIL "7BIT" 20 2)' +
        '("APPLICATION" "PDF" ("NAME" "Rechnung.pdf") NIL NIL "BASE64" 1000 NIL' +
        ' ("attachment" ("FILENAME" "Rechnung.pdf")) NIL NIL) "MIXED")';
      imap.addMessage(
        'INBOX',
        mailRaw({
          from: 'Dora <dora@example.ch>',
          subject: 'Mit Anhang',
          text: 'Beilage',
          id: 'd1',
        }),
        { structure: withPdf },
      );
      imap.addMessage(
        'Junk',
        mailRaw({ from: 'Werbung <spam@example.ch>', subject: 'Gewinn', text: 'Klick', id: 'j1' }),
      );

      await call('POST', '/v1/mail/sync', { accountId: accountA.id });
      const synced = await tables();
      const byRole = (rows, role) => rows.filter((row) => row.folderRole === role);
      assert.equal(byRole(synced.mailMessages, 'sent').length, 1);
      assert.equal(byRole(synced.mailMessages, 'trash').length, 1);
      assert.equal(byRole(synced.mailMessages, 'junk').length, 1);
      const attached = synced.mailMessages.find((row) => row.subject === 'Mit Anhang');
      assert.equal(attached.folderRole, 'inbox');
      assert.deepEqual(attached.attachments, [
        {
          filename: 'Rechnung.pdf',
          mime: 'application/pdf',
          size: 750,
          part: '2',
          contentId: null,
        },
      ]);

      const moved = await call('POST', '/v1/mail/messages/actions', {
        ids: [attached.id],
        action: 'move',
        role: 'junk',
      });
      assert.deepEqual(moved.data, { ok: true, changed: 1 });
      assert.ok(!imap.state.boxes.INBOX.some((m) => m.body.includes('Mit Anhang')));
      assert.equal(imap.state.boxes.Junk.length, 2);

      const after = await tables();
      assert.ok(!after.mailMessages.some((row) => row.id === attached.id));
      const inJunk = after.mailMessages.find((row) => row.subject === 'Mit Anhang');
      assert.equal(inJunk.folderRole, 'junk');
      assert.deepEqual(inJunk.attachments, attached.attachments);
      // Verschieben ist kein Eintreffen: dafuer gibt es keine Mitteilung.
      assert.ok(!after.notifications.some((row) => row.ref.mailMessageId === inJunk.id));
    });

    test('flags mail, works on several at once and refuses nonsense', async () => {
      const inbox = (await tables()).mailMessages.filter((row) => row.folderRole === 'inbox');
      assert.ok(inbox.length > 0);
      const ids = inbox.map((row) => row.id);

      const flagged = await call('POST', '/v1/mail/messages/actions', {
        ids: [ids[0]],
        action: 'flag',
      });
      assert.deepEqual(flagged.data, { ok: true, changed: 1 });
      assert.ok(imap.state.boxes.INBOX.some((m) => m.flags.includes('\\Flagged')));
      assert.equal((await tables()).mailMessages.find((row) => row.id === ids[0]).flagged, true);

      const unread = await call('POST', '/v1/mail/messages/actions', { ids, action: 'unseen' });
      assert.deepEqual(unread.data, { ok: true, changed: ids.length });
      const current = await tables();
      assert.ok(
        ids.every((id) => current.mailMessages.find((row) => row.id === id).seen === false),
      );

      assert.equal(
        (await call('POST', '/v1/mail/messages/actions', { ids: [], action: 'seen' })).status,
        400,
      );
      assert.equal(
        (await call('POST', '/v1/mail/messages/actions', { ids: [ids[0]], action: 'move' })).status,
        400,
      );
      assert.equal(
        (await call('POST', '/v1/mail/messages/actions', { ids: ['mm_fehlt'], action: 'seen' }))
          .status,
        404,
      );
    });

    test('groups the own reply from Sent with the mail it answers', async () => {
      await call('POST', '/v1/mail/sync', { accountId: accountA.id });
      const rows = (await tables()).mailMessages;
      const reply = rows.find(
        (row) => row.folderRole === 'sent' && row.inReplyTo === '<n1@example.ch>',
      );
      const answered = rows.find(
        (row) => row.messageId === '<n1@example.ch>' && row.folderRole !== 'sent',
      );
      assert.ok(reply && answered);
      assert.deepEqual(reply.references, ['<n1@example.ch>']);
      assert.match(reply.threadId, /^th_[a-f0-9]{24}$/);
      assert.equal(reply.threadId, answered.threadId);
      assert.notEqual(rows.find((row) => row.subject === 'Gewinn').threadId, answered.threadId);
    });

    test('serves a sanitised HTML body on demand and keeps it out of db.json', async () => {
      imap.addMessage('INBOX', RICH_RAW, { structure: RICH_STRUCTURE });
      await call('POST', '/v1/mail/sync', { accountId: accountA.id });
      const rich = (await tables()).mailMessages.find(
        (row) => row.messageId === '<rich1@example.ch>',
      );
      assert.equal(rich.text, 'Hallo Text');
      assert.deepEqual(
        rich.attachments.map((entry) => [entry.part, entry.mime, entry.contentId]),
        [
          ['2', 'image/png', 'logo@x'],
          ['3', 'application/pdf', null],
          ['4', 'text/html', null],
        ],
      );
      assert.ok(!JSON.stringify(await tables()).includes('track.example'));

      const fetches = () =>
        imap.state.lines.filter((line) => line.includes('BODY.PEEK[1.2]')).length;
      const blocked = await call('GET', `/v1/mail/messages/${rich.id}/body`);
      assert.equal(blocked.status, 200);
      assert.deepEqual(Object.keys(blocked.data).sort(), [
        'html',
        'inlineAttachments',
        'remoteImages',
        'text',
      ]);
      assert.equal(blocked.data.text, 'Hallo Text');
      assert.equal(blocked.data.remoteImages, 1);
      assert.deepEqual(blocked.data.inlineAttachments, [0]);
      assert.ok(blocked.data.html.startsWith('<p>Hallo <b>HTML</b></p>'));
      assert.ok(
        blocked.data.html.includes(`<img src="/v1/mail/messages/${rich.id}/attachments/0">`),
      );
      assert.match(blocked.data.html, /data-remote-image="1"/);
      assert.doesNotMatch(blocked.data.html, /script|onclick|track\.example/);
      assert.equal(fetches(), 1);
      await fs.access(path.join(dataDir, 'mail-cache', `${rich.id}.json`));

      const allowed = await call('GET', `/v1/mail/messages/${rich.id}/body?images=1`);
      assert.match(allowed.data.html, /<img src="https:\/\/track\.example\/p\.gif">/);
      assert.equal(allowed.data.remoteImages, 1);
      assert.equal(fetches(), 1, 'the second request is served from the cache');

      assert.deepEqual((await call('GET', '/v1/mail/messages/mm_fehlt/body')).data, {
        error: 'not_found',
      });
      assert.equal((await call('GET', '/v1/mail/messages/..%2F..%2Fdb/body')).status, 404);
    });

    test('streams attachments with safe headers and refuses unknown ones', async () => {
      const rich = (await tables()).mailMessages.find(
        (row) => row.messageId === '<rich1@example.ch>',
      );
      const base = `/v1/mail/messages/${rich.id}/attachments`;

      const pdf = await call('GET', `${base}/1`);
      assert.equal(pdf.status, 200);
      assert.equal(pdf.headers.get('content-type'), 'application/pdf');
      assert.equal(
        pdf.headers.get('content-disposition'),
        `inline; filename="_Rech_nung.pdf"; filename*=UTF-8''_Rech_nung.pdf`,
      );
      assert.equal(pdf.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(pdf.headers.get('access-control-allow-origin'), '*');
      assert.deepEqual(pdf.data, PDF_BYTES);

      const logo = await call('GET', `${base}/0`);
      assert.equal(logo.headers.get('content-type'), 'image/png');
      assert.match(logo.headers.get('content-security-policy') ?? '', /sandbox/);
      assert.deepEqual(logo.data, PNG);

      const page = await call('GET', `${base}/2`);
      assert.equal(page.headers.get('content-type'), 'application/octet-stream');
      assert.match(
        page.headers.get('content-disposition') ?? '',
        /^attachment; filename="evil\.html"/,
      );
      assert.equal(page.data.toString(), '<script>alert(1)</script>');

      for (const route of [
        `${base}/9`,
        `${base}/abc`,
        '/v1/mail/messages/mm_fehlt/attachments/0',
      ]) {
        const missing = await call('GET', route);
        assert.deepEqual([missing.status, missing.data], [404, { error: 'not_found' }], route);
      }
    });

    test('forwards a message with its text quoted', async () => {
      const original = (await tables()).mailMessages.find(
        (row) => row.messageId === '<rich1@example.ch>',
      );
      const before = smtp.state.messages.length;
      const sent = await call('POST', '/v1/mail/send', {
        mailAccountId: mailAccount.id,
        to: ['ben@example.ch'],
        subject: '',
        text: 'Schau mal',
        forwardOf: original.id,
      });
      assert.deepEqual(sent.data, { ok: true });
      const parsed = parseMessage(Buffer.from(smtp.state.messages[before].message));
      assert.equal(parsed.subject, 'Fwd: Newsletter');
      assert.match(
        parsed.text,
        /^Schau mal\n\n---------- Forwarded message ----------\nFrom: Eva <eva@example\.ch>\n/,
      );
      assert.match(parsed.text, /\n> Hallo Text$/);
      assert.equal(parsed.inReplyTo, null);

      const both = await call('POST', '/v1/mail/send', {
        mailAccountId: mailAccount.id,
        to: ['ben@example.ch'],
        subject: 'x',
        text: 'x',
        forwardOf: original.id,
        inReplyTo: original.id,
      });
      assert.deepEqual(both.data, { error: 'bad_request' });
    });

    test('saves drafts into the drafts folder, replaces and deletes them', async () => {
      const draft = {
        accountId: accountA.id,
        mailAccountId: mailAccount.id,
        to: ['cara@example.ch'],
        cc: [],
        bcc: ['geheim@example.ch'],
        subject: 'Offerte',
        text: 'Erste Fassung',
      };
      const first = await call('POST', '/v1/mail/drafts', draft);
      assert.equal(first.status, 200);
      assert.match(first.data.draftId, /^dft_/);
      assert.equal(imap.state.boxes.Drafts.length, 1);
      assert.ok(imap.state.boxes.Drafts[0].flags.includes('\\Draft'));
      assert.match(imap.state.boxes.Drafts[0].body.toString(), /\r\nBcc: geheim@example\.ch\r\n/);

      const second = await call('POST', '/v1/mail/drafts', {
        ...draft,
        text: 'Zweite Fassung',
        draftId: first.data.draftId,
      });
      assert.deepEqual(second.data, { draftId: first.data.draftId });
      assert.equal(imap.state.boxes.Drafts.length, 1);
      assert.match(imap.state.boxes.Drafts[0].body.toString(), /Zweite Fassung/);

      await call('POST', '/v1/mail/sync', { accountId: accountA.id });
      const row = (await tables()).mailMessages.find((entry) => entry.folderRole === 'drafts');
      assert.deepEqual(row.bcc, [{ name: '', address: 'geheim@example.ch' }]);

      // Ein Entwurf, den der Abgleich gefunden hat, laesst sich ueber seine Zeile weiterschreiben.
      const third = await call('POST', '/v1/mail/drafts', {
        ...draft,
        text: 'Dritte Fassung',
        draftId: row.id,
      });
      assert.match(third.data.draftId, /^dft_/);
      assert.notEqual(third.data.draftId, first.data.draftId);
      assert.equal(imap.state.boxes.Drafts.length, 1);
      assert.ok(!(await tables()).mailMessages.some((entry) => entry.id === row.id));

      assert.deepEqual((await call('DELETE', `/v1/mail/drafts/${third.data.draftId}`)).data, {
        ok: true,
      });
      assert.equal(imap.state.boxes.Drafts.length, 0);
      assert.equal((await call('DELETE', `/v1/mail/drafts/${third.data.draftId}`)).status, 404);
      assert.equal((await call('DELETE', `/v1/mail/drafts/${first.data.draftId}`)).status, 404);

      assert.equal(
        (await call('POST', '/v1/mail/drafts', { ...draft, to: ['kaputt'] })).status,
        400,
      );
      const foreign = await call('POST', '/v1/mail/drafts', {
        accountId: accountB.id,
        mailAccountId: mailAccount.id,
      });
      assert.deepEqual([foreign.status, foreign.data], [404, { error: 'not_found' }]);
    });

    test('holds a delayed send, lets it be cancelled and says when it is too late', async () => {
      const before = smtp.state.messages.length;
      const mail = {
        mailAccountId: mailAccount.id,
        to: ['cara@example.ch'],
        bcc: ['still@example.ch'],
        subject: 'Spaeter',
        text: 'Mit Verzoegerung',
      };
      const held = await call('POST', '/v1/mail/send', { ...mail, delayMs: 5000 });
      assert.equal(held.status, 202);
      assert.match(held.data.sendId, /^snd_/);
      assert.ok(Date.parse(held.data.sendAt) > Date.now() + 3000);
      assert.equal((await call('GET', `/v1/mail/send/${held.data.sendId}`)).data.state, 'pending');
      const stored = await fs.readFile(path.join(dataDir, 'mail-outbox.json'), 'utf8');
      assert.ok(stored.includes(held.data.sendId) && !stored.includes(MAIL_PASSWORD));
      assert.deepEqual((await call('POST', `/v1/mail/send/${held.data.sendId}/cancel`)).data, {
        cancelled: true,
      });
      assert.deepEqual(JSON.parse(await fs.readFile(path.join(dataDir, 'mail-outbox.json'))), {});

      const quick = await call('POST', '/v1/mail/send', { ...mail, delayMs: 100 });
      assert.equal(quick.status, 202);
      await waitFor(() => smtp.state.messages.length === before + 1);
      const delivered = smtp.state.messages[before];
      assert.deepEqual(delivered.recipients, ['cara@example.ch', 'still@example.ch']);
      assert.doesNotMatch(delivered.message, /^Bcc:/m);
      await waitFor(async () => {
        const status = await call('GET', `/v1/mail/send/${quick.data.sendId}`);
        return status.data.state === 'sent';
      });
      const late = await call('POST', `/v1/mail/send/${quick.data.sendId}/cancel`);
      assert.deepEqual([late.status, late.data], [409, { error: 'already_sent' }]);
      // Die eigene Kopie unter „Gesendet“ weiss noch, wer Bcc bekam.
      await waitFor(() =>
        imap.state.boxes.Sent.some((m) => m.body.toString().includes('Bcc: still@example.ch')),
      );

      assert.equal((await call('POST', '/v1/mail/send/snd_unbekannt/cancel')).status, 404);
      assert.equal((await call('GET', '/v1/mail/send/snd_unbekannt')).status, 404);
      assert.equal((await call('POST', '/v1/mail/send', { ...mail, delayMs: 20_001 })).status, 400);
      assert.equal((await call('POST', '/v1/mail/send', { ...mail, delayMs: 1.5 })).status, 400);
      assert.equal(smtp.state.messages.length, before + 1, 'the cancelled mail never left');
    });

    test('records sync errors and removes everything on disconnect', async () => {
      await imap.close();
      const result = await call('POST', '/v1/mail/sync', { accountId: accountA.id });
      assert.deepEqual(result.data, {
        newMessages: 0,
        errors: [{ mailAccountId: mailAccount.id, error: 'unreachable' }],
      });
      assert.equal((await tables()).mailAccounts[0].lastError, 'unreachable');

      assert.deepEqual((await call('DELETE', `/v1/mail/accounts/${mailAccount.id}`)).data, {
        ok: true,
      });
      const current = await tables();
      assert.equal(current.mailAccounts.length, 0);
      assert.equal(current.mailMessages.length, 0);
      assert.equal(current.notifications.filter((row) => row.kind === 'mail').length, 0);
      const vault = JSON.parse(await fs.readFile(path.join(dataDir, 'mail-vault.json'), 'utf8'));
      assert.deepEqual(vault.entries, {});
      const cached = await fs.readdir(path.join(dataDir, 'mail-cache'));
      assert.deepEqual(
        cached.filter((name) => name.endsWith('.json')),
        [],
      );
      assert.equal((await call('DELETE', `/v1/mail/accounts/${mailAccount.id}`)).status, 404);
    });
  });

  test('plans: status and one abo request per app, approved in the admin', async () => {
    const dora = (await call('POST', '/v1/accounts', { email: 'dora@test.ch', password: 'passwort123' })).data
      .account;
    const statusOf = (app) => call('GET', `/v1/plans?accountId=${dora.id}&app=${app}`);
    const fresh = await statusOf('getbetter');
    assert.equal(fresh.status, 200);
    assert.deepEqual(fresh.data, {
      app: 'getbetter',
      priceChf: 1,
      yearPriceChf: 10,
      term: 'month',
      plan: 'trial',
      canPersonalize: false,
      request: null,
      cancelsOn: null,
      pricedApps: ['getbetter', 'betterfamily', 'bettergym', 'betterai'],
    });
    assert.equal((await statusOf('bettermoney')).data.priceChf, null);
    for (const query of ['', `accountId=${dora.id}`, `accountId=${dora.id}&app=nope`, 'accountId=a%20b&app=getbetter']) {
      const refused = await call('GET', `/v1/plans?${query}`);
      assert.deepEqual([refused.status, refused.data], [400, { error: 'bad_request' }], query);
    }
    const unknown = await call('GET', '/v1/plans?accountId=acc_fehlt&app=getbetter');
    assert.deepEqual([unknown.status, unknown.data], [404, { error: 'account_not_found' }]);

    const start = (await activityLines()).length;
    const created = await call('POST', '/v1/plans/requests', { accountId: dora.id, app: 'getbetter' });
    assert.equal(created.status, 201);
    const { request } = created.data;
    assert.deepEqual(Object.keys(request).sort(), ['app', 'createdAt', 'decidedAt', 'id', 'status', 'term']);
    assert.deepEqual([request.app, request.status, request.decidedAt], ['getbetter', 'pending', null]);
    assert.match(request.id, /^plr_/);
    // Nochmal angefragt: dieselbe Anfrage, keine zweite.
    const again = await call('POST', '/v1/plans/requests', { accountId: dora.id, app: 'getbetter' });
    assert.deepEqual([again.status, again.data.request.id], [200, request.id]);
    assert.equal((await tables()).planRequests.filter((row) => row.accountId === dora.id).length, 1);
    assert.equal((await statusOf('getbetter')).data.request, 'pending');
    assert.equal((await statusOf('betterai')).data.request, null);
    assert.deepEqual(
      (await activityLines()).slice(start).map((line) => [line.accountId, line.kind, line.detail]),
      [[dora.id, 'plan.requested', { app: 'getbetter', term: 'month' }]],
    );

    const refusals = [
      [{ accountId: dora.id, app: 'bettermoney' }, 400, 'plan_unavailable'],
      [{ accountId: dora.id, app: 'betterx' }, 400, 'bad_request'],
      [{ accountId: dora.id }, 400, 'bad_request'],
      [{ accountId: dora.id, app: 'betterai', status: 'approved' }, 400, 'bad_request'],
      [{ accountId: 'acc_fehlt', app: 'getbetter' }, 404, 'account_not_found'],
    ];
    for (const [body, status, error] of refusals) {
      const refused = await call('POST', '/v1/plans/requests', body);
      assert.deepEqual([refused.status, refused.data], [status, { error }], JSON.stringify(body));
    }
    // Die Sammlung gehoert dem Dienst, und wer nur ansieht, fragt nichts an.
    const owned = await call('PUT', '/v1/db/planRequests', { rows: [] });
    assert.deepEqual([owned.status, owned.data], [403, { error: 'server_owned' }]);
    const viewing = await call(
      'POST',
      '/v1/plans/requests',
      { accountId: dora.id, app: 'betterai' },
      { 'X-Better-View': '1' },
    );
    assert.deepEqual([viewing.status, viewing.data], [403, { error: 'read_only' }]);

    // Der Admin schaltet frei: Abo aktiv, das Aussehen in allen Apps frei, eine Mitteilung.
    const approved = await adminCall('POST', `/api/plan-requests/${request.id}/approve`, {});
    assert.deepEqual(
      [approved.status, approved.data.request.status, approved.data.account.paidApps],
      [200, 'approved', ['getbetter']],
    );
    const paid = await statusOf('getbetter');
    assert.deepEqual([paid.data.plan, paid.data.canPersonalize, paid.data.request], ['paid', true, null]);
    assert.deepEqual([(await statusOf('betterai')).data.plan, (await statusOf('betterai')).data.canPersonalize], ['trial', true]);
    const notice = (await tables()).notifications.find((row) => row.accountId === dora.id);
    assert.deepEqual([notice.kind, notice.title, notice.ref], ['planApproved', 'GetBetter', { app: 'getbetter', requestId: request.id }]);
    const already = await call('POST', '/v1/plans/requests', { accountId: dora.id, app: 'getbetter' });
    assert.deepEqual([already.status, already.data], [409, { error: 'already_paid' }]);
    assert.equal((await call('PATCH', `/v1/accounts/${dora.id}`, { accentKey: 'blue' })).status, 200);

    // Das Jahresabo: angefragt mit Laufzeit, freigeschaltet mit Laufzeit.
    const gym = await call('POST', '/v1/plans/requests', {
      accountId: dora.id,
      app: 'bettergym',
      term: 'year',
    });
    assert.deepEqual([gym.status, gym.data.request.term], [201, 'year']);
    const badTerm = await call('POST', '/v1/plans/requests', {
      accountId: dora.id,
      app: 'betterai',
      term: 'woche',
    });
    assert.deepEqual([badTerm.status, badTerm.data], [400, { error: 'bad_request' }]);
    assert.equal(
      (await adminCall('POST', `/api/plan-requests/${gym.data.request.id}/approve`, {})).status,
      200,
    );
    const yearly = await statusOf('bettergym');
    assert.deepEqual([yearly.data.plan, yearly.data.term, yearly.data.yearPriceChf], ['paid', 'year', 50]);
    const budget = await call('GET', `/v1/ai/budget?accountId=${dora.id}&app=bettergym`);
    // Zehn Monatspreise fuers Jahr: je Monat bleibt weniger, also auch ein kleineres Budget.
    assert.ok(budget.data.budgetChf < 2.95 && budget.data.budgetChf > 2.4, String(budget.data.budgetChf));

    // Kuendigen gilt auf Monatsende: bis dahin laeuft alles weiter.
    const cancelled = await call('POST', '/v1/plans/cancel', { accountId: dora.id, app: 'getbetter' });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.data.cancelsOn.length, 10);
    assert.ok(cancelled.data.cancelsOn.endsWith('-01'), cancelled.data.cancelsOn);
    const stillPaid = await statusOf('getbetter');
    assert.deepEqual([stillPaid.data.plan, stillPaid.data.cancelsOn], ['paid', cancelled.data.cancelsOn]);
    // Nochmal gekuendigt bleibt derselbe Stichtag.
    const twice = await call('POST', '/v1/plans/cancel', { accountId: dora.id, app: 'getbetter' });
    assert.equal(twice.data.cancelsOn, cancelled.data.cancelsOn);

    // Eine App kann weder Abo noch Kuendigung selbst setzen.
    const faked = await call('PUT', '/v1/db/accounts', {
      rows: (await tables()).accounts.map((row) =>
        row.id === dora.id ? { ...row, paidApps: [], planCancels: { getbetter: '2000-01-01' } } : row,
      ),
    });
    assert.equal(faked.status, 200);
    const kept = (await tables()).accounts.find((row) => row.id === dora.id);
    assert.deepEqual(
      [kept.paidApps, kept.planCancels],
      [['getbetter', 'bettergym'], { getbetter: cancelled.data.cancelsOn }],
    );

    // Zurueckgenommen: wieder ein gewoehnliches Abo.
    const resumed = await call('POST', '/v1/plans/resume', { accountId: dora.id, app: 'getbetter' });
    assert.deepEqual([resumed.status, resumed.data.cancelsOn], [200, null]);
    assert.equal((await statusOf('getbetter')).data.cancelsOn, null);
    // Ohne Abo gibt es nichts zu kuendigen, und wer nur ansieht, kuendigt gar nichts.
    const notPaid = await call('POST', '/v1/plans/cancel', { accountId: dora.id, app: 'betterai' });
    assert.deepEqual([notPaid.status, notPaid.data], [409, { error: 'not_paid' }]);
    const viewingCancel = await call(
      'POST',
      '/v1/plans/cancel',
      { accountId: dora.id, app: 'getbetter' },
      { 'X-Better-View': '1' },
    );
    assert.deepEqual([viewingCancel.status, viewingCancel.data], [403, { error: 'read_only' }]);
  });

  test('without an abo only light/dark stays free: PATCH refuses the rest, PUT keeps what is stored', async () => {
    const emil = (await call('POST', '/v1/accounts', { email: 'emil@test.ch', password: 'passwort123' })).data
      .account;
    const owl = { kind: 'owl', color: 'sun', eyes: 'sparkle', accessory: 'glasses' };
    const patch = (body) => call('PATCH', `/v1/accounts/${emil.id}`, body);

    const free = await patch({ themeMode: 'dark', firstName: 'Emil', language: 'fr' });
    assert.equal(free.status, 200);
    for (const [field, value] of [
      ['accentKey', 'blue'],
      ['themePreset', 'mono'],
      ['backdrop', 'forest'],
      ['assistantName', 'Bo'],
      ['assistantAvatar', owl],
    ]) {
      const refused = await patch({ [field]: value, firstName: 'Nicht gespeichert' });
      assert.deepEqual([refused.status, refused.data], [403, { error: 'plan_required', fields: [field] }], field);
    }
    let read = (await call('GET', `/v1/accounts/${emil.id}`)).data.account;
    assert.deepEqual([read.firstName, read.themeMode, read.language, read.accentKey], ['Emil', 'dark', 'fr', undefined]);

    // Ein Abo irgendeiner App mit Preis schaltet alles frei.
    assert.equal((await adminCall('PATCH', `/api/accounts/${emil.id}`, { paidApps: ['betterfamily'] })).status, 200);
    const styled = await patch({
      accentKey: 'blue',
      themePreset: 'mono',
      backdrop: 'forest',
      assistantName: 'Bo',
      assistantAvatar: owl,
    });
    assert.equal(styled.status, 200);

    // Nur noch BetterMoney (ohne Preis): Gespeichertes bleibt, aendern geht nicht mehr.
    assert.equal((await adminCall('PATCH', `/api/accounts/${emil.id}`, { paidApps: ['bettermoney'] })).status, 200);
    // Derselbe Wert nochmal ist keine Aenderung.
    assert.equal((await patch({ accentKey: 'blue', assistantAvatar: { ...owl }, firstName: 'Emil' })).status, 200);
    assert.equal((await patch({ accentKey: 'rose' })).status, 403);
    read = (await call('GET', `/v1/accounts/${emil.id}`)).data.account;
    assert.deepEqual(
      [read.accentKey, read.themePreset, read.backdrop, read.assistantName],
      ['blue', 'mono', 'forest', 'Bo'],
    );

    // PUT: was eine App ohne Abo schickt, zaehlt nicht — auch keine Stimme; hell/dunkel schon.
    const original = (await tables()).accounts;
    const tampered = [
      ...original.map((row) => {
        if (row.id !== emil.id) return row;
        const changed = {
          ...row,
          accentKey: 'rose',
          themePreset: 'colorful',
          assistantName: 'Fremd',
          assistantVoice: 'eleven:abc',
          themeMode: 'light',
        };
        delete changed.backdrop;
        return changed;
      }),
      { id: 'acc_frisch', email: 'frisch@test.ch', username: 'frisch', accentKey: 'rose', assistantVoice: 'eleven:abc' },
    ];
    assert.equal((await call('PUT', '/v1/db/accounts', { rows: tampered })).status, 200);
    const stored = (await tables()).accounts;
    const kept = stored.find((row) => row.id === emil.id);
    assert.deepEqual(
      [kept.accentKey, kept.themePreset, kept.backdrop, kept.assistantName, kept.themeMode, Object.hasOwn(kept, 'assistantVoice')],
      ['blue', 'mono', 'forest', 'Bo', 'light', false],
    );
    assert.deepEqual(kept.assistantAvatar, owl);
    const frisch = stored.find((row) => row.id === 'acc_frisch');
    assert.deepEqual([Object.hasOwn(frisch, 'accentKey'), Object.hasOwn(frisch, 'assistantVoice')], [false, false]);

    // Mit Abo schreibt auch PUT wieder, was die App schickt.
    assert.equal((await adminCall('PATCH', `/api/accounts/${emil.id}`, { paidApps: ['getbetter'] })).status, 200);
    const withVoice = (await tables()).accounts
      .filter((row) => row.id !== 'acc_frisch')
      .map((row) => (row.id === emil.id ? { ...row, assistantVoice: 'eleven:abc', accentKey: 'rose' } : row));
    assert.equal((await call('PUT', '/v1/db/accounts', { rows: withVoice })).status, 200);
    const unlocked = (await tables()).accounts.find((row) => row.id === emil.id);
    assert.deepEqual([unlocked.assistantVoice, unlocked.accentKey], ['eleven:abc', 'rose']);
  });
});
