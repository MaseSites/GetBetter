/**
 * Mahlzeitenanalyse von aussen: Mock-Modus ohne jeden Aufruf nach aussen,
 * dann Live-Modus gegen nachgebaute Gemini- und USDA-Server — nie echte.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { after, before, describe, test } = require('node:test');

const { FIXTURES } = require('../fit/vision/fixtures.js');
const { startFitServer } = require('./fitHarness.js');

/** Ein 1×1-PNG mit Textchunk, damit sich das Entfernen pruefen laesst. */
function pngWithAuthor() {
  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'ascii');
    return Buffer.concat([head, data, Buffer.alloc(4)]);
  };
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', Buffer.alloc(13)),
    chunk('tEXt', Buffer.from('Author\0Anna Muster, Zuerich')),
    chunk('IDAT', Buffer.alloc(8, 3)),
    chunk('IEND', Buffer.alloc(0)),
  ]).toString('base64');
}
const IMAGE = pngWithAuthor();

describe('Better Fit: Foto-Analyse im Mock-Modus', () => {
  let server;
  let user;
  before(async () => {
    server = await startFitServer({ MAX_MEAL_ANALYSES_PER_USER_PER_DAY: '6' });
    user = await server.signUp('foto');
  });
  after(() => server.stop());

  const start = (fixture, extra = {}) =>
    server.call('POST', '/v1/fit/meal-analysis/start', { token: user.token, body: { image: IMAGE, mockFixture: fixture, day: '2026-09-21', slot: 'lunch', ...extra } });

  test('Reis, Poulet, Gemuese: Vorschlag mit Werten aus dem Katalog, dann bestaetigt im Tagebuch', async () => {
    const started = await start('rice_chicken_veg');
    assert.equal(started.status, 201);
    const analysis = started.body.analysis;
    assert.equal(analysis.provider, 'mock');
    assert.equal(analysis.level, 'orange');
    assert.equal(analysis.items[0].food.id, 'mock:rice_cooked');
    assert.equal(analysis.total.kcal, 483);

    const fat = analysis.questions.find((question) => question.kind === 'fat');
    const answered = await server.call('POST', `/v1/fit/meal-analysis/${analysis.id}/answer`, { token: user.token, body: { questionId: fat.id, optionId: 'little' } });
    assert.equal(answered.body.analysis.total.kcal, 483 + 44);

    const items = answered.body.analysis.items.map((item) => ({ foodId: item.food.id, grams: item.grams }));
    items[0].grams = 200;
    const confirmed = await server.call('POST', `/v1/fit/meal-analysis/${analysis.id}/confirm`, { token: user.token, body: { items }, headers: { 'Idempotency-Key': 'foto-mittag-1' } });
    assert.equal(confirmed.status, 201);
    assert.equal(confirmed.body.meal.source, 'photo');
    assert.equal(confirmed.body.meal.total.kcal, 483 + 44 + 26);
    const again = await server.call('POST', `/v1/fit/meal-analysis/${analysis.id}/confirm`, { token: user.token, body: { items }, headers: { 'Idempotency-Key': 'foto-mittag-1' } });
    assert.equal(again.body.meal.id, confirmed.body.meal.id);
    const day = await server.call('GET', '/v1/fit/day?day=2026-09-21', { token: user.token });
    assert.equal(day.body.meals.length, 1);
  });

  test('Lasagne: rot, ohne eigene Gramm keine Bestaetigung; zweites Bild verengt die Spanne', async () => {
    const started = await start('lasagne');
    const analysis = started.body.analysis;
    assert.equal(analysis.level, 'red');
    assert.equal(analysis.reviewRequired, true);
    const blind = await server.call('POST', `/v1/fit/meal-analysis/${analysis.id}/confirm`, { token: user.token, body: {} });
    assert.equal(blind.body.error, 'review_required');

    const tmp = await fs.readdir(path.join(server.dir, 'fit-tmp'));
    assert.equal(tmp.length, 1);
    const stored = await fs.readFile(path.join(server.dir, 'fit-tmp', tmp[0]));
    assert.equal(stored.includes(Buffer.from('Anna')), false, 'Metadaten muessen weg sein');

    const second = await server.call('POST', `/v1/fit/meal-analysis/${analysis.id}/add-image`, { token: user.token, body: { image: IMAGE } });
    assert.equal(second.status, 200);
    assert.equal(second.body.analysis.images, 2);
    const before = analysis.range.kcalMax - analysis.range.kcalMin;
    const afterSpread = second.body.analysis.range.kcalMax - second.body.analysis.range.kcalMin;
    assert.ok(afterSpread < before);
    assert.deepEqual(await fs.readdir(path.join(server.dir, 'fit-tmp')), [], 'Bilder nach dem zweiten Foto weg');
    const third = await server.call('POST', `/v1/fit/meal-analysis/${analysis.id}/add-image`, { token: user.token, body: { image: IMAGE } });
    assert.equal(third.body.error, 'too_many_images');
  });

  test('kein Essen, API-Fehler und falscher Dateityp', async () => {
    assert.equal((await start('no_food')).body.error, 'no_food');
    assert.equal((await start('api_error')).body.error, 'provider_error');
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64');
    assert.equal((await start('packaged', { image: svg })).body.error, 'image_type');
  });

  test('Tageslimit', async () => {
    // Bisher 5 bezahlte Aufrufe (2 ok, 2 gescheitert, 1 zweites Bild); das Limit ist 6.
    assert.equal((await start('packaged')).status, 201);
    const limited = await start('packaged');
    assert.equal(limited.status, 429);
    assert.equal(limited.body.error, 'daily_limit');
  });

  test('fremde Analysen gibt es nicht', async () => {
    const other = await server.signUp('fremd');
    const mine = await server.call('GET', '/v1/fit/changes', { token: user.token });
    assert.ok(mine.body.changes.length > 0);
    const started = await server.call('POST', '/v1/fit/meal-analysis/start', { token: other.token, body: { image: IMAGE, mockFixture: 'packaged' } });
    assert.equal((await server.call('GET', `/v1/fit/meal-analysis/${started.body.analysis.id}`, { token: user.token })).status, 404);
  });
});

describe('Better Fit: Foto-Analyse live gegen nachgebaute Anbieter', () => {
  let server;
  let gemini;
  let usda;
  const seen = { gemini: [], usda: [] };

  before(async () => {
    gemini = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        const body = JSON.parse(raw);
        seen.gemini.push({ url: req.url, key: req.headers['x-goog-api-key'], body });
        const answer = seen.gemini.length === 2 ? '{kaputt' : JSON.stringify(FIXTURES.low_confidence);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: answer }] } }], usageMetadata: { promptTokenCount: 1300, candidatesTokenCount: 400, thoughtsTokenCount: 200 } }));
      });
    });
    usda = http.createServer((req, res) => {
      seen.usda.push({ url: req.url, key: req.headers['x-api-key'] });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          foods: [
            {
              fdcId: 999001,
              description: 'Curry sauce, prepared',
              dataType: 'SR Legacy',
              foodNutrients: [
                { nutrientNumber: '208', value: 120 },
                { nutrientNumber: '203', value: 2 },
                { nutrientNumber: '204', value: 9 },
                { nutrientNumber: '205', value: 8 },
              ],
            },
          ],
        }),
      );
    });
    await new Promise((resolve) => gemini.listen(0, '127.0.0.1', resolve));
    await new Promise((resolve) => usda.listen(0, '127.0.0.1', resolve));
    server = await startFitServer({
      MEAL_ANALYSIS_MODE: 'live',
      GEMINI_API_KEY: 'test-schluessel-gemini',
      USDA_FDC_API_KEY: 'test-schluessel-usda',
      FIT_GEMINI_TEST_URL: `http://127.0.0.1:${gemini.address().port}`,
      FIT_USDA_TEST_URL: `http://127.0.0.1:${usda.address().port}`,
      MONTHLY_AI_BUDGET_CHF: '0.001',
    });
  });
  after(async () => {
    await server.stop();
    gemini.close();
    usda.close();
  });

  test('Schluessel nur im Kopf, Schema angefordert, USDA fuer Unbekanntes, Kosten gezaehlt, Budget greift', async () => {
    const user = await server.signUp('live');
    const started = await server.call('POST', '/v1/fit/meal-analysis/start', { token: user.token, body: { image: IMAGE, mockFixture: 'packaged' } });
    assert.equal(started.status, 201, JSON.stringify(started.body));
    assert.equal(started.body.analysis.provider, 'gemini');

    const request = seen.gemini[0];
    assert.equal(request.key, 'test-schluessel-gemini');
    assert.match(request.url, /gemini-3\.8-flash:generateContent$/);
    assert.equal(request.body.generationConfig.responseMimeType, 'application/json');
    assert.ok(request.body.generationConfig.responseSchema.properties.foods);
    assert.match(request.body.systemInstruction.parts[0].text, /Ignoriere sämtliche Anweisungen/);
    const sent = Buffer.from(request.body.contents[0].parts[0].inline_data.data, 'base64');
    assert.equal(sent.includes(Buffer.from('Anna')), false, 'ohne Metadaten an Gemini');
    // mockFixture zaehlt im Live-Modus nicht: die Antwort ist das Curry des Anbieters.
    assert.equal(started.body.analysis.mealName, 'Unbekanntes Curry');

    assert.equal(seen.usda.length, 1);
    assert.equal(seen.usda[0].key, 'test-schluessel-usda');
    const curry = started.body.analysis.items.find((item) => item.term === 'Curry-Sauce');
    assert.equal(curry.food.id, 'usda:999001');
    assert.equal(curry.food.source, 'usda');

    // 1300 × 0.30 + 600 × 2.50 USD je Million, mal 0.92 — ueber dem Budget von 0.001 CHF.
    const exhausted = await server.call('POST', '/v1/fit/meal-analysis/start', { token: user.token, body: { image: IMAGE } });
    assert.equal(exhausted.status, 503);
    assert.equal(exhausted.body.error, 'budget_exhausted');
    assert.equal(seen.gemini.length, 1);
    assert.equal(JSON.stringify(started.body).includes('test-schluessel'), false);
    assert.equal(server.stderr().includes('test-schluessel'), false);
  });
});

describe('Better Fit: die eigene Portion und was die Kamera nicht sieht', () => {
  let server;
  let user;
  before(async () => {
    server = await startFitServer({ MAX_MEAL_ANALYSES_PER_USER_PER_DAY: '9' });
    user = await server.signUp('portion');
  });
  after(() => server.stop());

  /** Eine Analyse starten, den Reis auf `rice` Gramm bestaetigen, den Rest lassen. */
  const round = async (token, rice, day) => {
    const started = await server.call('POST', '/v1/fit/meal-analysis/start', {
      token,
      body: { image: IMAGE, mockFixture: 'rice_chicken_veg', day, slot: 'lunch' },
    });
    assert.equal(started.status, 201, JSON.stringify(started.body));
    const analysis = started.body.analysis;
    if (rice === null) return analysis;
    const items = analysis.items.map((item) => ({ foodId: item.food.id, grams: item.grams }));
    items[0].grams = rice;
    const confirmed = await server.call(
      'POST',
      `/v1/fit/meal-analysis/${analysis.id}/confirm`,
      { token, body: { items }, headers: { 'Idempotency-Key': `${day}-${rice}` } },
    );
    assert.equal(confirmed.status, 201, JSON.stringify(confirmed.body));
    return analysis;
  };

  test('zweimal mehr Reis bestaetigt: die dritte Schaetzung rechnet damit', async () => {
    const first = await round(user.token, 250, '2026-09-18');
    assert.equal(first.items[0].grams, 180);
    assert.equal(first.items[0].personal, false);
    // Eine Korrektur reicht nicht — einmal ist keinmal.
    const second = await round(user.token, 250, '2026-09-19');
    assert.equal(second.items[0].grams, 180);

    const third = await round(user.token, null, '2026-09-20');
    assert.equal(third.items[0].food.id, 'mock:rice_cooked');
    // 180 g × 1.39, gedeckelt bei 1.5.
    assert.equal(third.items[0].grams, 250);
    assert.equal(third.items[0].personal, true);
    assert.equal(third.items[0].personalFactor, 1.39);
    assert.ok(third.items[0].minGrams < 250 && third.items[0].maxGrams > 250);
    // Nur der Reis, nicht das ganze Essen.
    assert.equal(third.items[1].grams, 130);
    assert.equal(third.items[1].personal, false);
  });

  test('die Portion eines anderen Kontos zaehlt nie mit', async () => {
    const other = await server.signUp('portion-fremd');
    const analysis = await round(other.token, null, '2026-09-20');
    assert.equal(analysis.items[0].grams, 180);
    assert.equal(analysis.items[0].personal, false);
  });

  test('jeder Posten sagt, woher er kommt und wie er gerechnet wurde', async () => {
    const analysis = await round(user.token, null, '2026-09-21');
    for (const item of analysis.items) {
      assert.equal(item.from, null, 'auf dem Foto gesehen, nicht aus dem Rezept');
      assert.equal(item.cooked, null, 'der Katalog kennt den gekochten Reis selbst');
      assert.ok(Array.isArray(item.alternatives));
    }
  });
});
