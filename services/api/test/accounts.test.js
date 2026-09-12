/**
 * Registrieren mit eigenem Benutzernamen. Startet server.js als eigenen
 * Prozess mit Datenordner im Temp-Verzeichnis — services/api/data bleibt
 * unberuehrt, echte Konten werden nie angefasst.
 */
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { after, before, describe, test } = require('node:test');

const SERVER = path.join(__dirname, '..', 'server.js');
const PASSWORD = 'passwort123';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
  });
}

async function freePort() {
  for (let port = 17090 + (process.pid % 700); port < 17900; port += 1) {
    if (await isFree(port)) return port;
  }
  throw new Error('kein freier Port');
}

async function waitFor(check, timeoutMs = 5000) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    if (await check()) return true;
    if (Date.now() > until) throw new Error('Zeitlimit beim Warten');
    await sleep(50);
  }
}

describe('registering with a username', () => {
  let child;
  let base;
  let dataDir;

  const call = async (method, route, body) => {
    const response = await fetch(`${base}${route}`, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
    return { status: response.status, data: await response.json() };
  };
  const signUp = (email, username) =>
    call('POST', '/v1/accounts', {
      email,
      password: PASSWORD,
      ...(username === undefined ? {} : { username }),
    });

  before(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'better-accounts-'));
    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, [SERVER], {
      env: {
        ...process.env,
        PORT: String(port),
        BETTER_DATA_DIR: dataDir,
        BETTER_MAIL_SYNC_MS: '0',
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
  });

  after(async () => {
    child?.kill();
    await sleep(200);
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  test('derives a username from the address when none is sent', async () => {
    const created = await signUp('lea.keller@test.ch');
    assert.equal(created.status, 201);
    assert.equal(created.data.account.username, 'lea.keller');
    assert.equal(created.data.account.passwordHash, undefined);
  });

  test('keeps a wanted username, lowercased and without the at sign', async () => {
    const created = await signUp('nina@test.ch', '@NinaB');
    assert.equal(created.status, 201);
    assert.equal(created.data.account.username, 'ninab');

    const found = await call('GET', '/v1/accounts/by-username/ninab');
    assert.equal(found.status, 200);
    assert.equal(found.data.account.email, 'nina@test.ch');
  });

  test('answers 409 when the username is taken', async () => {
    const taken = await signUp('jonas@test.ch', 'NinaB');
    assert.equal(taken.status, 409);
    assert.deepEqual(taken.data, { error: 'username_taken' });

    // Auch der abgeleitete Name eines anderen Kontos ist belegt.
    const derived = await signUp('tom@test.ch', 'lea.keller');
    assert.deepEqual([derived.status, derived.data], [409, { error: 'username_taken' }]);

    // Das Konto darf danach nicht angelegt worden sein.
    assert.equal(
      (await call('POST', '/v1/sessions', { email: 'tom@test.ch', password: PASSWORD })).status,
      401,
    );
  });

  test('answers 400 when the username has the wrong shape', async () => {
    const wrong = ['', 'ab', '_lea', 'lea müller', 'lea@keller', 'l'.repeat(25)];
    for (const username of wrong) {
      const result = await signUp('neu@test.ch', username);
      assert.deepEqual(
        [result.status, result.data],
        [400, { error: 'username_invalid' }],
        username,
      );
    }
  });

  test('checks the address and the password before the username', async () => {
    const badMail = await signUp('kaputt', 'frei.name');
    assert.deepEqual(badMail.data, { error: 'email_invalid' });

    const shortPassword = await call('POST', '/v1/accounts', {
      email: 'kurz@test.ch',
      password: 'kurz',
      username: 'frei.name',
    });
    assert.deepEqual(shortPassword.data, { error: 'password_too_short' });

    const twice = await signUp('nina@test.ch', 'ganz-anders');
    assert.deepEqual([twice.status, twice.data], [400, { error: 'email_taken' }]);
  });

  test('guards the username when it is changed later', async () => {
    const created = await signUp('mia@test.ch', 'mia.b');
    const id = created.data.account.id;

    const taken = await call('PATCH', `/v1/accounts/${id}`, { username: 'ninab' });
    assert.deepEqual([taken.status, taken.data], [409, { error: 'username_taken' }]);

    const wrong = await call('PATCH', `/v1/accounts/${id}`, { username: 'mia müller' });
    assert.deepEqual([wrong.status, wrong.data], [400, { error: 'username_invalid' }]);

    // Der eigene Name bleibt erlaubt, normalisiert wie beim Anlegen.
    const own = await call('PATCH', `/v1/accounts/${id}`, { username: '@Mia.B' });
    assert.deepEqual([own.status, own.data.account.username], [200, 'mia.b']);

    const renamed = await call('PATCH', `/v1/accounts/${id}`, { username: 'mia-neu' });
    assert.equal(renamed.data.account.username, 'mia-neu');
  });

  test('signs in with the fresh account', async () => {
    const session = await call('POST', '/v1/sessions', {
      email: 'nina@test.ch',
      password: PASSWORD,
    });
    assert.equal(session.status, 200);
    assert.equal(session.data.account.username, 'ninab');
  });
});
