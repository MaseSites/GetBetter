/**
 * Better Fit und der Admin: Auswertung nur als Zahlen, Sperre gilt sofort
 * (auch mit gueltigem Token), Loeschen nimmt Fit-Daten, Fotos und Tokens mit.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { after, before, describe, test } = require('node:test');

const { freePort, startFitServer } = require('./fitHarness.js');

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('Better Fit im Admin', () => {
  let server;
  let adminPort;
  let user;

  const admin = async (method, route, body) => {
    const response = await fetch(`http://127.0.0.1:${adminPort}${route}`, {
      method,
      headers: { Origin: `http://127.0.0.1:${adminPort}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };

  before(async () => {
    adminPort = await freePort();
    server = await startFitServer({ BETTER_ADMIN_PORT: String(adminPort) });
    user = await server.signUp('admin');
    await server.call('POST', '/v1/fit/meals', { token: user.token, body: { slot: 'lunch', items: [{ foodId: 'mock:banana', grams: 120 }] } });
    // Lasagne: rot, das Foto wartet auf ein zweites.
    const started = await server.call('POST', '/v1/fit/meal-analysis/start', { token: user.token, body: { image: PNG, mockFixture: 'lasagne' } });
    assert.equal(started.status, 201);
  });
  after(() => server.stop());

  test('Auswertung: Zahlen, keine Konto-Ids und keine Inhalte', async () => {
    const stats = await admin('GET', '/api/fit');
    assert.equal(stats.status, 200);
    assert.equal(stats.body.analyses.total, 1);
    assert.equal(stats.body.analyses.byLevel.red, 1);
    assert.equal(stats.body.activeUsers, 1);
    assert.equal(stats.body.budget.state, 'ok');
    const text = JSON.stringify(stats.body);
    assert.equal(text.includes(user.account.id), false);
    assert.equal(text.includes('Lasagne'), false);
  });

  test('gesperrt heisst sofort gesperrt, auch mit gueltigem Token', async () => {
    const locked = await admin('PATCH', `/api/accounts/${user.account.id}`, { disabled: true });
    assert.equal(locked.status, 200);
    const refused = await server.call('GET', '/v1/fit/day', { token: user.token });
    assert.equal(refused.status, 403);
    assert.equal(refused.body.error, 'account_disabled');
    await admin('PATCH', `/api/accounts/${user.account.id}`, { disabled: false });
    assert.equal((await server.call('GET', '/v1/fit/day', { token: user.token })).status, 200);
  });

  test('Loeschen nimmt Fit-Daten, wartende Fotos und alle Tokens mit', async () => {
    const tempBefore = await fs.readdir(path.join(server.dir, 'fit-tmp'));
    assert.equal(tempBefore.length, 1);
    const deleted = await admin('DELETE', `/api/accounts/${user.account.id}`, { confirm: user.email });
    assert.equal(deleted.status, 200);
    assert.deepEqual(await fs.readdir(path.join(server.dir, 'fit-tmp')), []);
    const stored = await fs.readFile(path.join(server.dir, 'fit.json'), 'utf8');
    assert.equal(stored.includes(user.account.id), false, 'keine Zeile des Kontos mehr in fit.json');
    assert.equal((await server.call('GET', '/v1/fit/day', { token: user.token })).status, 401);
  });
});
