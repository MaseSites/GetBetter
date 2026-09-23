/**
 * Der gemessene Verbrauch von aussen (`GET /v1/fit/weights` → `expenditure`).
 *
 * Die Rechnung selbst prueft `fit/energy.test.js`. Hier geht es darum, dass sie
 * wirklich durch die Route kommt: mit vier Wochen Tagebuch und Waage eine Zahl,
 * ohne Daten keine — und dass das Ziel ein **Vorschlag** bleibt.
 */
const assert = require('node:assert/strict');
const { after, before, describe, test } = require('node:test');

const { startFitServer } = require('./fitHarness.js');

const PROFILE = {
  birthDate: '1994-05-10',
  heightCm: 180,
  weightKg: 80,
  sex: 'male',
  activity: 'sedentary',
  trainingDaysPerWeek: 0,
  goal: 'lose',
  pace: 'moderate',
  diet: 'omnivore',
  allergies: [],
};

const DAY_MS = 24 * 60 * 60 * 1000;
const dayBack = (days) => new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);

describe('Better Fit: Verbrauch aus den eigenen Zahlen', () => {
  let server;
  let anna;
  let foodId;

  before(async () => {
    server = await startFitServer();
    anna = await server.signUp('anna');
    await server.call('PUT', '/v1/fit/profile', { token: anna.token, body: PROFILE });
    // Ein Lebensmittel mit runden Werten, damit die Kalorien planbar sind.
    const own = await server.call('POST', '/v1/fit/foods/custom', {
      token: anna.token,
      body: {
        name: 'Testbrei',
        per100: { kcal: 375, proteinG: 10, carbsG: 50, fatG: 15 },
      },
    });
    foodId = own.body?.food?.id ?? null;
    assert.ok(foodId, 'ein eigenes Lebensmittel');
  });
  after(() => server.stop());

  test('ohne Daten gibt es keine Zahl — und keinen Fehler', async () => {
    const empty = await server.call('GET', '/v1/fit/weights', { token: anna.token });
    assert.equal(empty.status, 200);
    assert.equal(empty.body.expenditure, null);
  });

  test('vier Wochen Tagebuch und Waage ergeben einen Verbrauch', async () => {
    // 2100 kcal am Tag (560 g Testbrei à 375 kcal/100 g), Gewicht faellt um 0.4 kg/Woche.
    for (let back = 28; back >= 0; back -= 1) {
      const day = dayBack(back);
      const passed = 28 - back;
      await server.call('POST', '/v1/fit/weights', {
        token: anna.token,
        body: { day, weightKg: Math.round((80 - (0.4 / 7) * passed) * 10) / 10 },
      });
      await server.call('POST', '/v1/fit/meals', {
        token: anna.token,
        body: { day, slot: 'lunch', items: [{ foodId, grams: 560 }], confirmLarge: true },
      });
    }

    const found = await server.call('GET', '/v1/fit/weights', { token: anna.token });
    const energy = found.body.expenditure;
    assert.ok(energy, 'eine Schaetzung');
    assert.equal(energy.meanIntakeKcal, 2100);
    // 2100 gegessen bei 0.4 kg/Woche Verlust -> gut 2400 kcal Verbrauch.
    assert.ok(energy.kcal > 2300 && energy.kcal < 2700, `unerwartet: ${energy.kcal}`);
    assert.ok(energy.days >= 14);
    assert.ok(energy.coverage > 0.9);
    assert.ok(['medium', 'high'].includes(energy.confidence));
  });

  test('das Ziel bleibt ein Vorschlag: gespeichert wird nichts', async () => {
    const before = await server.call('GET', '/v1/fit/weights', { token: anna.token });
    const suggested = before.body.expenditure?.target ?? null;
    if (suggested) {
      assert.ok(suggested.kcal >= 1200);
      assert.equal(typeof suggested.settlesAtKcal, 'number');
      // Ein Schritt bewegt das Ziel um hoechstens 300 kcal.
      assert.ok(Math.abs(suggested.changeKcal) <= 300);
    }
    // Das Profil selbst hat sich nicht veraendert — die Schaetzung schreibt nie.
    const profile = await server.call('GET', '/v1/fit/profile', { token: anna.token });
    assert.equal(profile.body.profile.activity, 'sedentary');
    assert.equal(profile.body.profile.pace, 'moderate');
    // Und zweimal gelesen gibt dasselbe: die Rechnung ist rein.
    const again = await server.call('GET', '/v1/fit/weights', { token: anna.token });
    assert.deepEqual(again.body.expenditure, before.body.expenditure);
  });

  test('fremde Zahlen bleiben fremd', async () => {
    const ben = await server.signUp('ben');
    await server.call('POST', '/v1/fit/profile', { token: ben.token, body: PROFILE });
    const his = await server.call('GET', '/v1/fit/weights', { token: ben.token });
    assert.equal(his.body.expenditure, null);
    assert.equal(his.body.entries.length, 0);
  });
});
