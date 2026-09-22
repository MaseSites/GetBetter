/**
 * Sicherheit, Kosten und Robustheit von Better Fit von aussen (Paket A):
 * Tageslimit nach Erstellungstag, zweites Bild zaehlt, parallele Starts
 * ueberziehen nicht, Idempotenz ohne Doppeltes, einheitliche Fehlercodes,
 * abgelaufene Analyse, Spanne nach Korrektur.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { after, before, describe, test } = require('node:test');

const { startFitServer } = require('./fitHarness.js');

// Ein kleines PNG (Kopf, IHDR, IDAT, IEND) — der Mock sieht sich den Inhalt nicht an.
function png(seed) {
  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'ascii');
    return Buffer.concat([head, data, Buffer.alloc(4)]);
  };
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', Buffer.alloc(13)),
    chunk('IDAT', Buffer.alloc(8, seed)),
    chunk('IEND', Buffer.alloc(0)),
  ]).toString('base64');
}
const IMAGE = png(7);

describe('Better Fit: Grenzen, Idempotenz und Fehlercodes', () => {
  let server;
  before(async () => {
    server = await startFitServer({ MAX_MEAL_ANALYSES_PER_USER_PER_DAY: '3' });
  });
  after(() => server.stop());

  const start = (user, body) => server.call('POST', '/v1/fit/meal-analysis/start', { token: user.token, body: { image: IMAGE, ...body } });

  test('Tageslimit zaehlt nach Erstellungstag, nicht nach Mahlzeit-Tag; das zweite Bild zaehlt mit', async () => {
    const user = await server.signUp('limit');
    // Mahlzeiten an anderen Tagen umgehen das Limit nicht mehr.
    assert.equal((await start(user, { mockFixture: 'packaged', day: '2026-01-01' })).status, 201);
    const lasagne = await start(user, { mockFixture: 'lasagne', day: '2026-01-02' });
    assert.equal(lasagne.status, 201);
    const second = await server.call('POST', `/v1/fit/meal-analysis/${lasagne.body.analysis.id}/add-image`, { token: user.token, body: { image: png(9) } });
    assert.equal(second.status, 200);
    // 3 bezahlte Aufrufe heute: Schluss, auch fuer einen weiteren Tag.
    const limited = await start(user, { mockFixture: 'packaged', day: '2026-01-03' });
    assert.equal(limited.status, 429);
    assert.equal(limited.body.error, 'daily_limit');
  });

  test('parallele Starts ueberziehen das Tageslimit nicht', async () => {
    const user = await server.signUp('parallel');
    const results = await Promise.all(Array.from({ length: 6 }, () => start(user, { mockFixture: 'packaged' })));
    const statuses = results.map((result) => result.status).sort();
    assert.deepEqual(statuses, [201, 201, 201, 429, 429, 429]);
  });

  test('derselbe Idempotency-Key gleichzeitig legt nur eine Mahlzeit an', async () => {
    const user = await server.signUp('doppeltipp');
    const body = { day: '2026-09-20', slot: 'snack', items: [{ foodId: 'mock:banana', grams: 120 }] };
    const headers = { 'Idempotency-Key': 'doppeltipp-banane-1' };
    const results = await Promise.all(Array.from({ length: 4 }, () => server.call('POST', '/v1/fit/meals', { token: user.token, body, headers })));
    for (const result of results) assert.ok([201, 409].includes(result.status), JSON.stringify(result.body));
    const ids = new Set(results.filter((result) => result.status === 201).map((result) => result.body.meal.id));
    assert.equal(ids.size, 1);
    const day = await server.call('GET', '/v1/fit/day?day=2026-09-20', { token: user.token });
    assert.equal(day.body.meals.length, 1);
    // Danach bekommt derselbe Schluessel die gemerkte Antwort.
    const later = await server.call('POST', '/v1/fit/meals', { token: user.token, body, headers });
    assert.equal(later.body.meal.id, [...ids][0]);
  });

  test('ein Fehler wird nicht gemerkt: derselbe Schluessel darf es nochmal versuchen', async () => {
    const user = await server.signUp('nochmal');
    const headers = { 'Idempotency-Key': 'nochmal-versuchen-1' };
    const bad = await server.call('POST', '/v1/fit/meals', { token: user.token, body: { slot: 'snack', items: [{ foodId: 'mock:gibtsnicht', grams: 10 }] }, headers });
    assert.equal(bad.status, 400);
    const good = await server.call('POST', '/v1/fit/meals', { token: user.token, body: { day: '2026-09-19', slot: 'snack', items: [{ foodId: 'mock:banana', grams: 100 }] }, headers });
    assert.equal(good.status, 201);
  });

  test('Fehlercodes: no_food 422 beim zweiten Bild, Verwerfen einer bestaetigten Analyse 409', async () => {
    const user = await server.signUp('codes');
    const lasagne = await start(user, { mockFixture: 'lasagne' });
    const noFood = await server.call('POST', `/v1/fit/meal-analysis/${lasagne.body.analysis.id}/add-image`, { token: user.token, body: { image: png(3), mockFixture: 'no_food' } });
    assert.equal(noFood.status, 422);
    assert.equal(noFood.body.error, 'no_food');

    const rice = await start(user, { mockFixture: 'rice_chicken_veg' });
    const items = rice.body.analysis.items.filter((item) => item.food).map((item) => ({ foodId: item.food.id, grams: item.grams }));
    const confirmed = await server.call('POST', `/v1/fit/meal-analysis/${rice.body.analysis.id}/confirm`, { token: user.token, body: { items, confirmLarge: true } });
    assert.equal(confirmed.status, 201);
    const cancelled = await server.call('POST', `/v1/fit/meal-analysis/${rice.body.analysis.id}/cancel`, { token: user.token });
    assert.deepEqual([cancelled.status, cancelled.body.error], [409, 'analysis_closed']);
    assert.equal((await server.call('POST', '/v1/fit/meal-analysis/ana_gibtsnicht/cancel', { token: user.token })).status, 404);
  });

  test('Spanne folgt den korrigierten Gramm', async () => {
    const user = await server.signUp('spanne');
    const rice = await start(user, { mockFixture: 'rice_chicken_veg' });
    const [first, ...rest] = rice.body.analysis.items.filter((item) => item.food);
    const items = [{ foodId: first.food.id, grams: Math.round(first.grams / 2) }, ...rest.map((item) => ({ foodId: item.food.id, grams: item.grams }))];
    const confirmed = await server.call('POST', `/v1/fit/meal-analysis/${rice.body.analysis.id}/confirm`, { token: user.token, body: { items, confirmLarge: true } });
    assert.equal(confirmed.status, 201);
    const { meal } = confirmed.body;
    assert.ok(meal.range.kcalMin <= meal.total.kcal && meal.total.kcal <= meal.range.kcalMax, JSON.stringify(meal));
    // Weniger Reis heisst auch eine kleinere Spanne als die der Schaetzung.
    assert.ok(meal.range.kcalMax < rice.body.analysis.range.kcalMax);
  });

  test('erstes Foto weg: 409 analysis_expired ohne Aufruf, die Analyse ist abgelaufen', async () => {
    const user = await server.signUp('abgelaufen');
    const lasagne = await start(user, { mockFixture: 'lasagne' });
    assert.equal(lasagne.status, 201);
    // Was der stuendliche Sweep taete: das wartende Foto verschwindet.
    const tempDir = path.join(server.dir, 'fit-tmp');
    for (const name of await fs.readdir(tempDir)) await fs.rm(path.join(tempDir, name), { force: true });
    const id = lasagne.body.analysis.id;
    const second = await server.call('POST', `/v1/fit/meal-analysis/${id}/add-image`, { token: user.token, body: { image: png(4) } });
    assert.deepEqual([second.status, second.body.error], [409, 'analysis_expired']);
    const view = await server.call('GET', `/v1/fit/meal-analysis/${id}`, { token: user.token });
    assert.equal(view.body.analysis.status, 'expired');
    // Der abgelehnte Versuch hat nichts gekostet: noch zwei Aufrufe frei (Limit 3).
    assert.equal((await start(user, { mockFixture: 'packaged' })).status, 201);
    assert.equal((await start(user, { mockFixture: 'packaged' })).status, 201);
  });

  test('Behalten von Fotos nur mit STORE_ORIGINAL_MEAL_IMAGES', async () => {
    const user = await server.signUp('behalten');
    assert.equal((await start(user, { mockFixture: 'packaged', keepImage: true })).status, 201);
    const kept = await fs.readdir(path.join(server.dir, 'fit-images')).catch(() => []);
    assert.equal(kept.length, 0);
  });

  test('Sprache beim Etikett-Scan wird geprueft', async () => {
    const user = await server.signUp('etikett');
    const scan = await server.call('POST', '/v1/fit/nutrition-label/scan', { token: user.token, body: { image: IMAGE, language: '<script>' } });
    assert.equal(scan.status, 200);
  });
});
