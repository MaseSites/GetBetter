'use strict';

/**
 * Sitzungen und Sichtbarkeit von aussen: zwei Konten, ein gemeinsamer
 * Haushalt — jedes sieht nur Seines, keiner schreibt dem anderen etwas unter,
 * das Geheimnis eines anderen zaehlt nicht. Dazu die Bremse gegen Raten, die
 * verschluesselte Platte und der Dienst „im Netz“, der ohne Sitzung nichts hergibt.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { after, before, describe, test } = require('node:test');

const SERVER = path.join(__dirname, '..', 'server.js');
const PASSWORD = 'passwort123';
const DATA_KEY = crypto.randomBytes(32).toString('hex');

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitFor(check, timeoutMs = 5000) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    if (await check().catch(() => false)) return;
    if (Date.now() > until) throw new Error('Zeitlimit beim Warten');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** Startet einen Dienst im Temp-Ordner; `env` legt Stellschrauben drauf. */
async function startService(dataDir, env = {}) {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env,
      PORT: String(port),
      BETTER_DATA_DIR: dataDir,
      BETTER_MAIL_SYNC_MS: '0',
      BETTER_ADMIN_PORT: '0',
      BETTER_API_TOKEN: '',
      BETTER_REQUIRE_SESSION: '',
      BETTER_DATA_KEY: '',
      BETTER_RATE_LIMIT_OFF: '',
      ...env,
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  await waitFor(async () => (await fetch(`${base}/v1/health`)).ok, 8000).catch((error) => {
    // Sonst haelt der halb gestartete Dienst den Testlauf am Leben.
    child.kill();
    throw new Error(`${error.message}\n${stderr}`);
  });
  return { base, child, stderr: () => stderr };
}

const callAt = (base) => async (method, route, body, session) => {
  const response = await fetch(`${base}${route}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(session ? { 'X-Better-Session': session } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
};

describe('Sitzungen: jedes Konto sieht nur Seines', () => {
  let dataDir;
  let service;
  let call;
  let anna;
  let ben;
  let dan;

  const signUp = async (email, username) => {
    const created = await call('POST', '/v1/accounts', { email, password: PASSWORD, username });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    assert.match(created.data.session, /^[0-9a-f]{48}$/u);
    return { id: created.data.account.id, session: created.data.session, email };
  };

  before(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'better-sessions-'));
    service = await startService(dataDir, { BETTER_RATE_LIMIT_OFF: '1' });
    call = callAt(service.base);
    anna = await signUp('anna@test.ch', 'anna');
    ben = await signUp('ben@test.ch', 'ben');
    dan = await signUp('dan@test.ch', 'dan');

    // Ben legt einen Haushalt an und laedt Anna ein; Anna sagt zu.
    const put = (name, rows, session) => call('PUT', `/v1/db/${name}`, { rows }, session);
    assert.equal(
      (
        await put(
          'households',
          [{ id: 'h1', name: 'Zuhause', inviteCode: 'ABCDEF', createdBy: ben.id, createdAt: 'x' }],
          ben.session,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await put(
          'householdMembers',
          [
            {
              id: 'm-ben',
              householdId: 'h1',
              accountId: ben.id,
              role: 'admin',
              status: 'accepted',
            },
            {
              id: 'm-anna',
              householdId: 'h1',
              accountId: anna.id,
              role: 'member',
              status: 'pending',
              invitedBy: ben.id,
            },
          ],
          ben.session,
        )
      ).status,
      200,
    );
    // Jeder legt sich Aufgaben und einen Einkauf an.
    assert.equal(
      (
        await put(
          'tasks',
          [{ id: 't-anna', accountId: anna.id, title: 'Annas', done: false, dueAt: null }],
          anna.session,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await put(
          'tasks',
          [{ id: 't-dan', accountId: dan.id, title: 'Dans', done: false, dueAt: null }],
          dan.session,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await put(
          'shoppingItems',
          [{ id: 's-house', accountId: ben.id, householdId: 'h1', name: 'Milch' }],
          ben.session,
        )
      ).status,
      200,
    );
  });

  after(async () => {
    service?.child.kill();
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  test('Anmelden gibt eine Sitzung; ein falsches Geheimnis ist keine', async () => {
    const login = await call('POST', '/v1/sessions', { email: anna.email, password: PASSWORD });
    assert.equal(login.status, 200);
    assert.match(login.data.session, /^[0-9a-f]{48}$/u);
    const bogus = await call('GET', '/v1/db', undefined, 'a'.repeat(48));
    assert.equal(bogus.status, 401);
    assert.deepEqual(bogus.data, { error: 'session_invalid' });
  });

  test('GET /v1/db: eigene Zeilen, der Haushalt, die Leute darin — Fremde nur oeffentlich', async () => {
    const seen = (await call('GET', '/v1/db', undefined, anna.session)).data.tables;
    assert.deepEqual(
      seen.tasks.map((row) => row.id),
      ['t-anna'],
    );
    assert.deepEqual(
      seen.shoppingItems.map((row) => row.id),
      ['s-house'],
    );
    assert.deepEqual(
      seen.households.map((row) => row.id),
      ['h1'],
    );
    assert.deepEqual(seen.accounts.map((row) => row.id).sort(), [anna.id, ben.id].sort());
    const benRow = seen.accounts.find((row) => row.id === ben.id);
    assert.equal(benRow.email, undefined);
    assert.equal(benRow.username, 'ben');
    assert.equal(seen.accounts.find((row) => row.id === anna.id).email, anna.email);
    // Dan sieht weder Haushalt noch Anna.
    const dans = (await call('GET', '/v1/db', undefined, dan.session)).data.tables;
    assert.deepEqual(
      dans.tasks.map((row) => row.id),
      ['t-dan'],
    );
    assert.deepEqual(dans.households, []);
    assert.deepEqual(
      dans.accounts.map((row) => row.id),
      [dan.id],
    );
    // Ohne Sitzung (nur lokal): alles, wie frueher.
    const all = (await call('GET', '/v1/db')).data.tables;
    assert.equal(all.tasks.length, 2);
  });

  test('PUT: Fremdes bleibt, Untergeschobenes faellt weg, das eigene Konto ist nicht kaperbar', async () => {
    const hijack = await call(
      'PUT',
      '/v1/db/tasks',
      {
        rows: [
          { id: 't-anna', accountId: anna.id, title: 'geaendert', done: false, dueAt: null },
          { id: 't-dan', accountId: dan.id, title: 'gekapert', done: true, dueAt: null },
        ],
      },
      anna.session,
    );
    assert.equal(hijack.status, 200);
    const all = (await call('GET', '/v1/db')).data.tables;
    assert.equal(all.tasks.find((row) => row.id === 't-dan').title, 'Dans');
    assert.equal(all.tasks.find((row) => row.id === 't-anna').title, 'geaendert');

    const rename = await call(
      'PUT',
      '/v1/db/accounts',
      {
        rows: [
          {
            id: dan.id,
            email: dan.email,
            username: 'dan',
            firstName: 'Gehackt',
            language: 'de',
            createdAt: 'x',
          },
        ],
      },
      anna.session,
    );
    assert.equal(rename.status, 200);
    const accounts = (await call('GET', '/v1/db')).data.tables.accounts;
    assert.equal(accounts.find((row) => row.id === dan.id).firstName, '');
    assert.ok(accounts.some((row) => row.id === anna.id));
  });

  test('fuer ein anderes Konto handeln geht nicht: fremdes accountId, fremdes Profil, fremde Mitteilung', async () => {
    const upload = await call(
      'POST',
      '/v1/uploads',
      { accountId: dan.id, dataUrl: 'data:image/png;base64,AA==' },
      anna.session,
    );
    assert.equal(upload.status, 403);
    const profile = await call('PATCH', `/v1/accounts/${dan.id}`, { firstName: 'X' }, anna.session);
    assert.equal(profile.status, 403);
    const read = await call('GET', `/v1/accounts/${dan.id}`, undefined, anna.session);
    assert.equal(read.status, 403);
    const own = await call('GET', `/v1/accounts/${anna.id}`, undefined, anna.session);
    assert.equal(own.status, 200);

    // Eine Mitteilung fuer Dan darf Anna anlegen (Einladungen) — lesen und loeschen nur Dan.
    const note = await call(
      'POST',
      '/v1/notifications',
      { accountId: dan.id, kind: 'system', title: 'Hallo', app: 'getbetter' },
      anna.session,
    );
    assert.equal(note.status, 201, JSON.stringify(note.data));
    const id = note.data.notification?.id ?? note.data.id;
    assert.equal(
      (await call('POST', `/v1/notifications/${id}/read`, undefined, anna.session)).status,
      403,
    );
    assert.equal(
      (await call('POST', `/v1/notifications/${id}/read`, undefined, dan.session)).status,
      200,
    );
  });

  test('per Code in den Haushalt: der Dienst prueft, die App sieht den Haushalt danach', async () => {
    assert.equal(
      (
        await call(
          'POST',
          '/v1/households/join',
          { accountId: dan.id, code: 'xxxxxx' },
          dan.session,
        )
      ).data.error,
      'code_unknown',
    );
    const joined = await call(
      'POST',
      '/v1/households/join',
      { accountId: dan.id, code: ' abcdef ' },
      dan.session,
    );
    assert.equal(joined.status, 200, JSON.stringify(joined.data));
    assert.equal(joined.data.household.id, 'h1');
    const seen = (await call('GET', '/v1/db', undefined, dan.session)).data.tables;
    assert.deepEqual(
      seen.households.map((row) => row.id),
      ['h1'],
    );
    assert.ok(seen.shoppingItems.some((row) => row.id === 's-house'));
    assert.equal(
      (
        await call(
          'POST',
          '/v1/households/join',
          { accountId: dan.id, code: 'ABCDEF' },
          dan.session,
        )
      ).data.error,
      'already_member',
    );
    // Nicht fuer jemand anderen beitreten.
    assert.equal(
      (
        await call(
          'POST',
          '/v1/households/join',
          { accountId: anna.id, code: 'ABCDEF' },
          dan.session,
        )
      ).status,
      403,
    );
  });

  test('Abmelden: die Sitzung gilt danach nicht mehr', async () => {
    const login = await call('POST', '/v1/sessions', { email: ben.email, password: PASSWORD });
    const session = login.data.session;
    assert.equal((await call('GET', '/v1/db', undefined, session)).status, 200);
    assert.equal((await call('DELETE', '/v1/sessions', undefined, session)).status, 200);
    assert.equal((await call('GET', '/v1/db', undefined, session)).status, 401);
    // Die andere Sitzung von Ben lebt weiter.
    assert.equal((await call('GET', '/v1/db', undefined, ben.session)).status, 200);
  });
});

describe('Der Dienst im Netz', () => {
  let dataDir;

  before(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'better-locked-'));
  });

  after(async () => {
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  test('ohne Sitzung nur leben, anmelden, registrieren — und die Bremse greift', async () => {
    const service = await startService(dataDir, { BETTER_REQUIRE_SESSION: '1' });
    const call = callAt(service.base);
    try {
      assert.equal((await call('GET', '/v1/health')).status, 200);
      const refused = await call('GET', '/v1/db');
      assert.equal(refused.status, 401);
      assert.deepEqual(refused.data, { error: 'session_required' });

      const created = await call('POST', '/v1/accounts', {
        email: 'eva@test.ch',
        password: PASSWORD,
      });
      assert.equal(created.status, 201);
      assert.equal((await call('GET', '/v1/db', undefined, created.data.session)).status, 200);

      // Zehn falsche Passwoerter, dann ist Schluss — auch fuer das richtige.
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const wrong = await call('POST', '/v1/sessions', {
          email: 'eva@test.ch',
          password: 'falsch-falsch',
        });
        assert.equal(wrong.status, 401);
      }
      const braked = await call('POST', '/v1/sessions', {
        email: 'eva@test.ch',
        password: PASSWORD,
      });
      assert.equal(braked.status, 429);
      assert.equal(braked.data.error, 'too_many_attempts');
      assert.ok(braked.data.retryAfterMs > 0);
    } finally {
      service.child.kill();
    }
  });

  test('mit BETTER_DATA_KEY liegt nichts im Klartext — und nach dem Neustart ist alles noch da', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'better-sealed-'));
    const first = await startService(dir, { BETTER_DATA_KEY: DATA_KEY });
    try {
      const call = callAt(first.base);
      const created = await call('POST', '/v1/accounts', {
        email: 'sealed@test.ch',
        password: PASSWORD,
        username: 'sealed',
      });
      assert.equal(created.status, 201);
      await call(
        'PUT',
        '/v1/db/notes',
        {
          rows: [
            { id: 'n1', accountId: created.data.account.id, title: 'Streng geheim', body: '' },
          ],
        },
        created.data.session,
      );
    } finally {
      first.child.kill();
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    const db = await fs.readFile(path.join(dir, 'db.json'), 'utf8');
    assert.ok(db.startsWith('{"sealed":1'));
    assert.ok(!db.includes('sealed@test.ch') && !db.includes('Streng geheim'));
    const sessionsFile = await fs.readFile(path.join(dir, 'sessions.json'), 'utf8');
    assert.ok(sessionsFile.startsWith('{"sealed":1'));

    const second = await startService(dir, { BETTER_DATA_KEY: DATA_KEY });
    try {
      const call = callAt(second.base);
      const login = await call('POST', '/v1/sessions', {
        email: 'sealed@test.ch',
        password: PASSWORD,
      });
      assert.equal(login.status, 200);
      const seen = (await call('GET', '/v1/db', undefined, login.data.session)).data.tables;
      assert.equal(seen.notes[0]?.title, 'Streng geheim');
    } finally {
      second.child.kill();
    }

    // Mit falschem Schluessel startet er nicht — statt leer weiterzumachen.
    const wrongKey = crypto.randomBytes(32).toString('hex');
    await assert.rejects(startService(dir, { BETTER_DATA_KEY: wrongKey }), /Zeitlimit|auth/u);
    await fs.rm(dir, { recursive: true, force: true });
  });
});
