/**
 * Verpackte Produkte von aussen: Barcode mit Pruefziffer, eigenes Produkt vor
 * Open Food Facts, Zwischenspeicher, Naehrwerttabelle und Duplikate.
 * Live nur gegen einen nachgebauten Open-Food-Facts-Server.
 */
const assert = require('node:assert/strict');
const http = require('node:http');
const { after, before, describe, test } = require('node:test');

const { normalizeBarcode } = require('../fit/barcode.js');
const { validateLabel, MOCK_LABEL } = require('../fit/vision/label.js');
const { startFitServer } = require('./fitHarness.js');

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('Barcode und Tabelle, rein', () => {
  test('Pruefziffer, UPC-A wird EAN-13, Unsinn nicht', () => {
    assert.equal(normalizeBarcode('4006381333931'), '4006381333931');
    assert.equal(normalizeBarcode('4006381333932'), null);
    assert.equal(normalizeBarcode('036000291452'), '0036000291452');
    assert.equal(normalizeBarcode('9638-5074'), '96385074');
    assert.equal(normalizeBarcode('12345'), null);
    assert.equal(normalizeBarcode('abc'), null);
  });

  test('Tabelle: kJ allein reicht, unlesbar und unplausibel werden erkannt', () => {
    const onlyKj = structuredClone(MOCK_LABEL);
    onlyKj.per100.energyKcal = null;
    assert.equal(validateLabel(onlyKj).label.per100.kcal, 368);
    assert.equal(validateLabel({ ...MOCK_LABEL, readable: false }).error, 'label_unreadable');
    const wrong = structuredClone(MOCK_LABEL);
    wrong.per100.fatG = 70;
    const checked = validateLabel(wrong);
    assert.equal(checked.label.plausible, false);
    assert.ok(checked.label.problems.includes('energy_mismatch'));
  });
});

describe('Better Fit: verpackte Produkte im Mock-Modus', () => {
  let server;
  let user;
  before(async () => {
    server = await startFitServer();
    user = await server.signUp('laden');
  });
  after(() => server.stop());

  test('Beispielprodukt per Barcode, dann ins Tagebuch mit der Portion der Packung', async () => {
    const found = await server.call('GET', '/v1/fit/foods/barcode/7610000000028', { token: user.token });
    assert.equal(found.status, 200);
    assert.equal(found.body.source, 'off');
    assert.equal(found.body.food.source, 'off');
    assert.match(found.body.food.attribution, /ODbL/);
    assert.deepEqual(found.body.food.allergens, ['milk', 'nuts', 'soy']);
    const meal = await server.call('POST', '/v1/fit/meals', { token: user.token, body: { slot: 'snack', source: 'barcode', items: [{ foodId: found.body.food.id, portions: 1 }] } });
    assert.equal(meal.status, 201);
    assert.equal(meal.body.meal.items[0].grams, 45);
    assert.equal(meal.body.meal.total.kcal, 167);
  });

  test('ungueltig und unbekannt', async () => {
    assert.equal((await server.call('GET', '/v1/fit/foods/barcode/7610000000029', { token: user.token })).body.error, 'barcode_invalid');
    const unknown = await server.call('GET', '/v1/fit/foods/barcode/4006381333931', { token: user.token });
    assert.equal(unknown.status, 404);
    assert.equal(unknown.body.next, 'scan_label');
  });

  test('Tabelle lesen, bestaetigen, danach gewinnt das eigene Produkt vor jeder Datenbank', async () => {
    const scanned = await server.call('POST', '/v1/fit/nutrition-label/scan', { token: user.token, body: { image: PNG } });
    assert.equal(scanned.status, 200);
    assert.equal(scanned.body.label.per100.kcal, 366);
    assert.equal(scanned.body.label.plausible, true);

    const body = { name: scanned.body.label.productName, brand: scanned.body.label.brand, barcode: '4006381333931', per100: scanned.body.label.per100, gramsPerPiece: scanned.body.label.portionGrams };
    const saved = await server.call('POST', '/v1/fit/foods/label', { token: user.token, body });
    assert.equal(saved.status, 201);
    assert.equal(saved.body.food.source, 'label');

    const again = await server.call('GET', '/v1/fit/foods/barcode/4006381333931', { token: user.token });
    assert.equal(again.body.source, 'own');
    assert.equal(again.body.food.id, saved.body.food.id);

    // Derselbe Barcode nochmal: aktualisiert, kein Duplikat.
    const rescan = await server.call('POST', '/v1/fit/foods/label', { token: user.token, body: { ...body, per100: { ...body.per100, kcal: 360, fatG: 6 } } });
    assert.equal(rescan.status, 200);
    assert.equal(rescan.body.duplicate, 'barcode');
    assert.equal(rescan.body.food.id, saved.body.food.id);
    // Gleicher Name ohne Barcode: nachfragen.
    const sameName = await server.call('POST', '/v1/fit/foods/label', { token: user.token, body: { ...body, barcode: null } });
    assert.equal(sameName.status, 409);

    const other = await server.signUp('andere');
    const foreign = await server.call('GET', '/v1/fit/foods/barcode/4006381333931', { token: other.token });
    assert.equal(foreign.status, 404, 'das eigene Produkt einer anderen Person ist nicht sichtbar');
  });

  test('unplausible Werte werden nicht gespeichert', async () => {
    const bad = await server.call('POST', '/v1/fit/foods/label', { token: user.token, body: { name: 'Falsch', per100: { kcal: 100, proteinG: 90, carbsG: 90, fatG: 0 } } });
    assert.equal(bad.body.error, 'per100_invalid');
  });
});

describe('Better Fit: Open Food Facts live gegen einen nachgebauten Server', () => {
  let server;
  let off;
  const requests = [];
  before(async () => {
    off = http.createServer((req, res) => {
      requests.push({ url: req.url, agent: req.headers['user-agent'] });
      if (req.url.includes('4006381333931')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 1, product: { product_name_de: 'Testprodukt', brands: 'Marke', nutriments: { energy_100g: 1674, proteins_100g: 10, carbohydrates_100g: 60, fat_100g: 12 } } }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end('{"status":0}');
      }
    });
    await new Promise((resolve) => off.listen(0, '127.0.0.1', resolve));
    server = await startFitServer({ MEAL_ANALYSIS_MODE: 'live', FIT_OFF_TEST_URL: `http://127.0.0.1:${off.address().port}` });
  });
  after(async () => {
    await server.stop();
    off.close();
  });

  test('fragt einmal, mit User-Agent, und dann aus dem Zwischenspeicher', async () => {
    const user = await server.signUp('off');
    const first = await server.call('GET', '/v1/fit/foods/barcode/4006381333931', { token: user.token });
    assert.equal(first.status, 200);
    assert.equal(first.body.food.per100.kcal, 400);
    await server.call('GET', '/v1/fit/foods/barcode/4006381333931', { token: user.token });
    assert.equal(requests.length, 1);
    assert.match(requests[0].agent, /BetterFit/);
    assert.equal((await server.call('GET', '/v1/fit/foods/barcode/96385074', { token: user.token })).status, 404);
    await server.call('GET', '/v1/fit/foods/barcode/96385074', { token: user.token });
    assert.equal(requests.length, 2, 'auch „nicht gefunden“ wird gemerkt');
  });
});
