'use strict';

/**
 * Der Zugriffsschutz: mit `BETTER_API_TOKEN` antwortet der Dienst nur noch
 * dem, der das Geheimnis mitschickt — als Kopfzeile oder als `?token=`.
 * Offen bleibt `/v1/health`, damit ein Tester sieht, ob die Adresse stimmt.
 */
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const SERVER = path.join(__dirname, '..', 'server.js');
const TOKEN = 'ein-langes-geheimnis-fuer-den-test';

let child = null;
let dataDir = '';
let base = '';

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

before(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'better-token-'));
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env,
      PORT: String(port),
      BETTER_DATA_DIR: dataDir,
      BETTER_MAIL_SYNC_MS: '0',
      BETTER_ADMIN_PORT: '0',
      BETTER_API_TOKEN: TOKEN,
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  await waitFor(async () => (await fetch(`${base}/v1/health`)).ok);
});

after(async () => {
  if (child) child.kill();
  await fs.rm(dataDir, { recursive: true, force: true });
});

test('ohne Geheimnis: nur /v1/health, alles andere 401', async () => {
  assert.equal((await fetch(`${base}/v1/health`)).status, 200);
  const refused = await fetch(`${base}/v1/db`);
  assert.equal(refused.status, 401);
  assert.deepEqual(await refused.json(), { error: 'unauthorized' });
  // Auch Schreiben scheitert am Geheimnis, nicht erst an der Route.
  const write = await fetch(`${base}/v1/db/notes`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows: [] }),
  });
  assert.equal(write.status, 401);
});

test('mit Geheimnis als Kopfzeile oder als ?token= geht es — Daten brauchen dann noch die Sitzung', async () => {
  const header = await fetch(`${base}/v1/revision`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  assert.equal(header.status, 200);
  const query = await fetch(`${base}/v1/revision?token=${encodeURIComponent(TOKEN)}`);
  assert.equal(query.status, 200);
  // Mit Geheimnis der App ist der Dienst „im Netz“: Daten gibt es nur mit Sitzung eines Kontos.
  const data = await fetch(`${base}/v1/db`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  assert.equal(data.status, 401);
  assert.deepEqual(await data.json(), { error: 'session_required' });
});

test('ein falsches oder halbes Geheimnis zaehlt nicht', async () => {
  const wrong = await fetch(`${base}/v1/db`, { headers: { Authorization: 'Bearer falsch' } });
  assert.equal(wrong.status, 401);
  const partial = await fetch(`${base}/v1/db?token=${encodeURIComponent(TOKEN.slice(0, -1))}`);
  assert.equal(partial.status, 401);
});

test('die CORS-Vorabfrage bleibt offen und erlaubt Authorization', async () => {
  const preflight = await fetch(`${base}/v1/db`, { method: 'OPTIONS' });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-headers') ?? '', /Authorization/u);
});
