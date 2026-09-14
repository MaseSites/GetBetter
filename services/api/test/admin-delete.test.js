/**
 * Konto im Admin loeschen, von aussen: server.js laeuft als eigener Prozess mit
 * Admin und Datenordner im Temp-Verzeichnis — services/api/data bleibt
 * unberuehrt. Danach geht keine Anmeldung mehr.
 */
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { after, before, describe, test } = require('node:test');

const SERVER = path.join(__dirname, '..', 'server.js');
const PASSWORD = 'passwort123';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Einen freien Port vom System leihen. */
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

async function waitFor(check, timeoutMs = 10000) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    if (await check()) return true;
    if (Date.now() > until) throw new Error('Zeitlimit beim Warten');
    await sleep(50);
  }
}

describe('deleting an account in the admin', () => {
  let child;
  let base;
  let adminPort;
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

  /** Rohes HTTP: Host und Origin muessen genau die des Admins sein. */
  const admin = (method, route, body) =>
    new Promise((resolve, reject) => {
      const text = body === undefined ? undefined : JSON.stringify(body);
      const req = http.request(
        {
          host: '127.0.0.1',
          port: adminPort,
          method,
          path: route,
          agent: false,
          headers: {
            Host: `127.0.0.1:${adminPort}`,
            Origin: `http://127.0.0.1:${adminPort}`,
            'Content-Type': 'application/json',
            ...(text === undefined ? {} : { 'Content-Length': Buffer.byteLength(text) }),
          },
        },
        (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            resolve({ status: res.statusCode, data: raw ? JSON.parse(raw) : null });
          });
        },
      );
      req.on('error', reject);
      if (text !== undefined) req.write(text);
      req.end();
    });

  before(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'better-admin-delete-'));
    const port = await freePort();
    adminPort = await freePort();
    while (adminPort === port) adminPort = await freePort();
    base = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, [SERVER], {
      env: {
        ...process.env,
        PORT: String(port),
        BETTER_DATA_DIR: dataDir,
        BETTER_MAIL_SYNC_MS: '0',
        BETTER_ADMIN_PORT: String(adminPort),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.resume();
    child.stderr.resume();
    await waitFor(async () => {
      try {
        return (await fetch(`${base}/v1/health`)).ok && (await admin('GET', '/api/overview')).status === 200;
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

  test('a deleted account can no longer sign in, and its rows are gone', async () => {
    const created = await call('POST', '/v1/accounts', {
      email: 'weg@test.ch',
      password: PASSWORD,
      username: 'weg',
    });
    assert.equal(created.status, 201);
    const { id } = created.data.account;
    const signIn = () => call('POST', '/v1/sessions', { email: 'weg@test.ch', password: PASSWORD });
    assert.equal((await signIn()).status, 200);
    const stored = await call('PUT', '/v1/db/tasks', {
      rows: [
        { id: 't_weg', accountId: id, householdId: null, title: 'Weg damit' },
        { id: 't_bleibt', accountId: 'acc_andere', householdId: null, title: 'Bleibt' },
      ],
    });
    assert.equal(stored.status, 200);

    const mismatch = await admin('DELETE', `/api/accounts/${id}`, { confirm: 'jemand@test.ch' });
    assert.deepEqual([mismatch.status, mismatch.data], [400, { error: 'confirm_mismatch' }]);

    const deleted = await admin('DELETE', `/api/accounts/${id}`, { confirm: 'WEG@test.ch' });
    assert.deepEqual([deleted.status, deleted.data], [200, { ok: true, removed: { accounts: 1, tasks: 1 } }]);

    const refused = await signIn();
    assert.deepEqual([refused.status, refused.data], [401, { error: 'not_found' }]);
    assert.equal((await call('GET', `/v1/accounts/${id}`)).status, 404);
    const snapshot = (await call('GET', '/v1/db')).data;
    assert.deepEqual(snapshot.tables.tasks.map((row) => row.id), ['t_bleibt']);
    assert.equal((await fs.readdir(path.join(dataDir, 'deleted-accounts'))).length, 1);
  });
});
