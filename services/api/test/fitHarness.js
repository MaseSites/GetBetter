/**
 * Startet server.js fuer die Fit-Tests: eigener Datenordner im Temp, kein
 * Mail-Takt, kein Admin, keine `.env.local`, Mock-Modus. Gibt `call()` und
 * `signUp()` zurueck.
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const SERVER = path.join(__dirname, '..', 'server.js');

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

async function startFitServer(extraEnv = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'better-fit-'));
  const port = await freePort();
  const child = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env,
      PORT: String(port),
      BETTER_DATA_DIR: dir,
      BETTER_MAIL_SYNC_MS: '0',
      BETTER_ADMIN_PORT: '0',
      BETTER_SKIP_ENV_FILE: '1',
      MEAL_ANALYSIS_MODE: 'mock',
      GEMINI_API_KEY: '',
      USDA_FDC_API_KEY: '',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Dienst startet nicht: ${stderr}`)), 15000);
    child.stdout.on('data', (chunk) => {
      if (String(chunk).includes('Datenbank laeuft')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once('exit', (code) => reject(new Error(`Dienst beendet (${code}): ${stderr}`)));
  });

  const base = `http://127.0.0.1:${port}`;
  async function call(method, route, { token, body, headers = {} } = {}) {
    const response = await fetch(`${base}${route}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  let counter = 0;
  async function signUp(name = 'nutzer') {
    counter += 1;
    const email = `${name}${counter}@fit.test`;
    const result = await call('POST', '/v1/accounts', { body: { email, password: 'passwort-123' } });
    if (result.status !== 201) throw new Error(`Registrieren: ${JSON.stringify(result.body)}`);
    return { token: result.body.token, account: result.body.account, email };
  }

  async function stop() {
    child.kill();
    await fs.rm(dir, { recursive: true, force: true });
  }

  return { call, signUp, stop, dir, base, stderr: () => stderr };
}

module.exports = { startFitServer, freePort };
