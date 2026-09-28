/**
 * Was vor dem Verkauf stimmen muss: keine Beispielwerte im Live-Betrieb, jede
 * bezahlte Analyse gegen das Kontingent des Kontos, Gesundheitsdaten
 * verschluesselt, gesperrte App gilt auch fuer Better Fit, und die Produktion
 * startet nicht halb eingerichtet.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { after, before, describe, test } = require('node:test');

const { FIXTURES } = require('../fit/vision/fixtures.js');
const { freePort, startFitServer } = require('./fitHarness.js');

const IMAGE =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function fakeGemini() {
  const seen = [];
  const server = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      seen.push(req.url);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(FIXTURES.low_confidence) }] } }],
          // 1300 × 1.50 + 600 × 7.50 USD je Million, mal 0.92: knapp 0.006 CHF
          usageMetadata: { promptTokenCount: 1300, candidatesTokenCount: 400, thoughtsTokenCount: 200 },
        }),
      );
    });
  });
  return { server, seen };
}

describe('Better Fit live ohne Schluessel', () => {
  let server;
  before(async () => {
    server = await startFitServer({ MEAL_ANALYSIS_MODE: 'live', GEMINI_API_KEY: '' });
  });
  after(() => server.stop());

  test('keine Beispielwerte, sondern ehrlich nicht eingerichtet', async () => {
    const user = await server.signUp('ohneschluessel');
    const started = await server.call('POST', '/v1/fit/meal-analysis/start', {
      token: user.token,
      body: { image: IMAGE, mockFixture: 'lasagne' },
    });
    assert.equal(started.status, 503);
    assert.equal(started.body.error, 'not_configured');
    assert.equal(started.body.analysis, undefined);
  });
});

describe('Better Fit: Kontingent je Konto', () => {
  let server;
  let gemini;
  let adminPort;
  const admin = async (method, route, body) => {
    const response = await fetch(`http://127.0.0.1:${adminPort}${route}`, {
      method,
      headers: { Origin: `http://127.0.0.1:${adminPort}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };

  before(async () => {
    gemini = fakeGemini();
    await new Promise((resolve) => gemini.server.listen(0, '127.0.0.1', resolve));
    adminPort = await freePort();
    server = await startFitServer({
      MEAL_ANALYSIS_MODE: 'live',
      GEMINI_API_KEY: 'test-schluessel',
      FIT_GEMINI_TEST_URL: `http://127.0.0.1:${gemini.server.address().port}`,
      BETTER_ADMIN_PORT: String(adminPort),
      // Gratis reicht fuer genau eine Analyse (Reserve 0.02 CHF je Aufruf).
      BETTER_TRIAL_BUDGET_CHF: '0.025',
      FIT_AI_RESERVE_CHF: '0.02',
    });
  });
  after(async () => {
    await server.stop();
    gemini.server.close();
  });

  test('ohne Abo ist das Gratis-Kontingent die Grenze, mit Abo geht es weiter', async () => {
    const user = await server.signUp('kontingent');
    const start = () =>
      server.call('POST', '/v1/fit/meal-analysis/start', { token: user.token, body: { image: IMAGE } });

    assert.equal((await start()).status, 201);
    // Coach und Stimme schoepfen aus demselben Topf: sie sehen, was das Foto kostete.
    const budget = await fetch(
      `${server.base}/v1/ai/budget?accountId=${encodeURIComponent(user.account.id)}&app=bettergym`,
      { headers: { 'X-Better-Session': user.token } },
    ).then((response) => response.json());
    assert.ok(budget.spentChf > 0.005, JSON.stringify(budget));
    const refused = await start();
    assert.equal(refused.status, 402);
    assert.equal(refused.body.error, 'plan_budget_free');
    assert.equal(refused.body.plan, 'trial');
    assert.equal(typeof refused.body.priceChf, 'number');
    assert.equal(gemini.seen.length, 1, 'abgelehnt heisst: kein bezahlter Aufruf');

    // Ein anderes Konto hat sein eigenes Kontingent — niemand leert es fuer alle.
    const other = await server.signUp('nachbar');
    const theirs = await server.call('POST', '/v1/fit/meal-analysis/start', {
      token: other.token,
      body: { image: IMAGE },
    });
    assert.equal(theirs.status, 201);

    const paid = await admin('PATCH', `/api/accounts/${user.account.id}`, { paidApps: ['bettergym'] });
    assert.equal(paid.status, 200);
    assert.equal((await start()).status, 201);
  });

  test('wem der Admin BetterGym weggenommen hat, der kommt nicht in Better Fit', async () => {
    const user = await server.signUp('gesperrt');
    assert.equal((await server.call('GET', '/v1/fit/day', { token: user.token })).status, 200);
    await admin('PATCH', `/api/accounts/${user.account.id}`, { blockedApps: ['bettergym'] });
    const refused = await server.call('GET', '/v1/fit/day', { token: user.token });
    assert.equal(refused.status, 403);
    assert.equal(refused.body.error, 'app_blocked');
  });
});

describe('Better Fit: verschluesselt auf der Platte', () => {
  const key = crypto.randomBytes(32).toString('hex');
  let dir;
  before(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'better-fit-sealed-'));
  });
  after(() => fs.rm(dir, { recursive: true, force: true }));

  test('fit.json liegt versiegelt da und laesst sich nur mit dem Schluessel lesen', async () => {
    const first = await startFitServer({ BETTER_DATA_DIR: dir, BETTER_DATA_KEY: key });
    const user = await first.signUp('versiegelt');
    const saved = await first.call('POST', '/v1/fit/weights', {
      token: user.token,
      body: { weightKg: 71.4, day: '2026-09-20' },
    });
    assert.equal(saved.status < 300, true, JSON.stringify(saved.body));
    await first.stop();

    const text = await fs.readFile(path.join(dir, 'fit.json'), 'utf8');
    assert.ok(text.startsWith('{"sealed":1'));
    assert.equal(text.includes('71.4'), false);
    assert.equal(text.includes(user.account.id), false);

    const again = await startFitServer({ BETTER_DATA_DIR: dir, BETTER_DATA_KEY: key });
    const login = await again.call('POST', '/v1/sessions', {
      body: { email: user.email, password: 'passwort-123' },
    });
    const weights = await again.call('GET', '/v1/fit/weights', { token: login.body.session });
    assert.equal(weights.status, 200);
    assert.ok(JSON.stringify(weights.body).includes('71.4'));
    await again.stop();
  });
});

describe('Better Fit in der Produktion', () => {
  test('startet nicht im Mock-Modus', async () => {
    await assert.rejects(
      startFitServer({ NODE_ENV: 'production' }),
      /Start abgebrochen/,
    );
  });

  test('mit FIT_ALLOW_MOCK=1 startet eine Vorfuehrung trotzdem', async () => {
    const server = await startFitServer({ NODE_ENV: 'production', FIT_ALLOW_MOCK: '1' });
    await server.stop();
  });
});

describe('Konto selbst loeschen', () => {
  let server;
  before(async () => {
    server = await startFitServer();
  });
  after(() => server.stop());

  test('nur mit dem Passwort, nur das eigene, und danach ist alles weg', async () => {
    const anna = await server.signUp('selbstloeschen');
    const ben = await server.signUp('fremd');
    await server.call('POST', '/v1/fit/weights', { token: anna.token, body: { weightKg: 64.2 } });
    const route = `/v1/accounts/${anna.account.id}`;

    const foreign = await server.call('DELETE', route, { token: ben.token, body: { password: 'passwort-123' } });
    assert.equal(foreign.status, 403);
    const wrong = await server.call('DELETE', route, { token: anna.token, body: { password: 'falsch-falsch' } });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.error, 'wrong_password');

    const done = await server.call('DELETE', route, { token: anna.token, body: { password: 'passwort-123' } });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    // Die Sitzung ist weg, anmelden geht nicht mehr, Better Fit hat nichts mehr.
    assert.equal((await server.call('GET', '/v1/fit/day', { token: anna.token })).status, 401);
    const login = await server.call('POST', '/v1/sessions', { body: { email: anna.email, password: 'passwort-123' } });
    assert.equal(login.status, 401);
    const stored = await fs.readFile(path.join(server.dir, 'fit.json'), 'utf8');
    assert.equal(stored.includes(anna.account.id), false);
    // Keine Sicherung: selbst geloescht heisst geloescht.
    await assert.rejects(fs.readdir(path.join(server.dir, 'deleted-accounts')));
    // Das andere Konto bleibt.
    assert.equal((await server.call('GET', '/v1/fit/day', { token: ben.token })).status, 200);
  });
});
