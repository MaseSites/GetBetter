/**
 * Better Fit, Ernaehrung: Mahlzeit bearbeiten, Rueckgaengig mit der ganzen
 * Zeile, Suchverlauf, Sprache, Ballaststoffe, zuletzt gegessen, „Wie gestern“,
 * Serie, neues Gewicht und „Was passt noch?“ — gegen den echten Dienst.
 */
const assert = require('node:assert/strict');
const { after, before, describe, test } = require('node:test');

const { startFitServer } = require('./fitHarness.js');

const PROFILE = {
  birthDate: '1990-03-01',
  heightCm: 170,
  weightKg: 70,
  sex: 'female',
  activity: 'light',
  trainingDaysPerWeek: 0,
  goal: 'maintain',
  pace: 'gentle',
  diet: 'omnivore',
  allergies: [],
};

describe('Better Fit: Ernaehrung', () => {
  let server;
  let cara;
  const call = (method, route, options = {}) =>
    server.call(method, route, { token: cara.token, ...options });

  before(async () => {
    server = await startFitServer();
    cara = await server.signUp('cara');
    await call('PUT', '/v1/fit/profile', { body: PROFILE });
  });
  after(() => server.stop());

  test('PATCH: Gramm aendern, Name folgt, grosse Portion fragt nach', async () => {
    const logged = await call('POST', '/v1/fit/meals', {
      body: {
        day: '2026-09-10',
        slot: 'lunch',
        items: [
          { foodId: 'mock:banana', grams: 120 },
          { foodId: 'mock:apple', grams: 150 },
        ],
      },
    });
    assert.equal(logged.status, 201);
    const id = logged.body.meal.id;
    const big = await call('PATCH', `/v1/fit/meals/${id}`, {
      body: { items: [{ foodId: 'mock:banana', grams: 1600 }] },
    });
    assert.equal(big.status, 409);
    assert.equal(big.body.error, 'confirm_large_portion');
    const patched = await call('PATCH', `/v1/fit/meals/${id}`, {
      body: { items: [{ foodId: 'mock:banana', grams: 240 }], slot: 'snack' },
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.meal.name, 'Banane');
    assert.equal(patched.body.meal.slot, 'snack');
    assert.equal(patched.body.meal.items.length, 1);

    // Rueckgaengig bringt die ganze Zeile zurueck, auch ohne das neue `updatedAt`.
    const changes = await call('GET', '/v1/fit/changes?table=meals');
    const update = changes.body.changes.find((row) => row.action === 'update');
    assert.equal((await call('POST', `/v1/fit/changes/${update.id}/undo`)).status, 200);
    const day = await call('GET', '/v1/fit/day?day=2026-09-10');
    const meal = day.body.meals.find((row) => row.id === id);
    assert.equal(meal.items.length, 2);
    assert.equal(meal.slot, 'lunch');
    assert.equal('updatedAt' in meal, false);
  });

  test('Suchverlauf: das gewaehlte Lebensmittel steht beim gleichen Wort oben', async () => {
    await call('POST', '/v1/fit/meals', {
      body: {
        day: '2026-09-11',
        slot: 'breakfast',
        items: [{ foodId: 'mock:strawberry', grams: 100, term: 'Beeren ' }],
      },
    });
    const found = await call('GET', '/v1/fit/foods/search?q=beeren');
    assert.equal(found.body.foods[0].id, 'mock:strawberry');
  });

  test('Sprache: Namen in Suche, Tagebuch und zuletzt gegessen', async () => {
    const fr = { headers: { 'Accept-Language': 'fr' } };
    const found = await call('GET', '/v1/fit/foods/search?q=banane', fr);
    assert.equal(found.body.foods[0].name, 'Banane');
    const day = await call('GET', '/v1/fit/day?day=2026-09-11', fr);
    assert.equal(day.body.meals[0].items[0].name, 'Fraises');
    assert.equal(day.body.meals[0].name, 'Fraises');
    const recent = await call('GET', '/v1/fit/foods/recent', {
      headers: { 'Accept-Language': 'it' },
    });
    assert.equal(recent.body.foods[0].food.name, 'Fragole');
    assert.equal(recent.body.foods[0].grams, 100);
  });

  test('Ballaststoffe je Zeile und je Tag', async () => {
    const day = await call('GET', '/v1/fit/day?day=2026-09-11');
    assert.equal(day.body.meals[0].items[0].fiberG, 2);
    assert.equal(day.body.nutrients.fiberG, 2);
  });

  test('„Wie gestern“ und Serie', async () => {
    const copied = await call('POST', '/v1/fit/days/2026-09-12/copy', {
      body: { from: '2026-09-11' },
      headers: { 'Idempotency-Key': 'copy-2026-09-12-a' },
    });
    assert.equal(copied.status, 201);
    assert.equal(copied.body.meals.length, 1);
    const again = await call('POST', '/v1/fit/days/2026-09-12/copy', {
      body: { from: '2026-09-11' },
      headers: { 'Idempotency-Key': 'copy-2026-09-12-a' },
    });
    assert.equal(again.body.meals[0].id, copied.body.meals[0].id);
    const empty = await call('POST', '/v1/fit/days/2026-09-13/copy', {
      body: { from: '2026-09-01' },
    });
    assert.equal(empty.body.error, 'nothing_to_copy');
    // 10., 11., 12. in Folge; der 13. ist noch leer und zaehlt ab dem Vortag.
    const day = await call('GET', '/v1/fit/day?day=2026-09-13');
    assert.equal(day.body.streak, 3);
  });

  test('ein neueres Gewicht aendert die Ziele', async () => {
    const before = (await call('GET', '/v1/fit/profile')).body.goals;
    await call('POST', '/v1/fit/weights', { body: { day: '2099-01-01', weightKg: 90 } });
    const afterGoals = (await call('GET', '/v1/fit/profile')).body.goals;
    assert.ok(afterGoals.bmr > before.bmr);
  });

  test('Was passt noch? schlaegt Rezepte mit Zeilen je Portion vor', async () => {
    const fits = await call('GET', '/v1/fit/fits?day=2026-09-20&slot=dinner');
    assert.equal(fits.status, 200);
    assert.ok(fits.body.remaining.kcal > 0);
    assert.ok(fits.body.fits.length > 0);
    for (const entry of fits.body.fits) {
      assert.ok(entry.items.length > 0);
      assert.ok(entry.perServing.kcal <= fits.body.remaining.kcal + 50);
    }
  });
});
