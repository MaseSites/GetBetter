/**
 * Better Fit von aussen: Token-Pflicht, Besitzer-Trennung (die RLS des
 * lokalen Dienstes), Tagebuch, Ziele, Gewicht, Idempotenz und Rueckgaengig.
 */
const assert = require('node:assert/strict');
const { after, before, describe, test } = require('node:test');

const { startFitServer } = require('./fitHarness.js');

const PROFILE = {
  birthDate: '1994-05-10',
  heightCm: 180,
  weightKg: 80,
  sex: 'male',
  activity: 'moderate',
  trainingDaysPerWeek: 3,
  goal: 'lose',
  pace: 'gentle',
  diet: 'omnivore',
  allergies: ['nuts'],
};

describe('Better Fit: Tagebuch und Schutz', () => {
  let server;
  let anna;
  let ben;

  before(async () => {
    server = await startFitServer();
    anna = await server.signUp('anna');
    ben = await server.signUp('ben');
  });
  after(() => server.stop());

  test('Registrieren und Anmelden geben eine Sitzung', async () => {
    assert.match(anna.token, /^[0-9a-f]{48}$/);
    const login = await server.call('POST', '/v1/sessions', {
      body: { email: anna.email, password: 'passwort-123' },
    });
    assert.equal(login.status, 200);
    assert.match(login.body.session, /^[0-9a-f]{48}$/);
  });

  test('ohne oder mit falschem Token: 401, und /v1/db kennt keine Fit-Daten', async () => {
    assert.equal((await server.call('GET', '/v1/fit/day')).status, 401);
    assert.equal((await server.call('GET', '/v1/fit/day', { token: 'a'.repeat(48) })).status, 401);
    const snapshot = await server.call('GET', '/v1/db');
    assert.equal(
      Object.keys(snapshot.body.tables).some(
        (name) => /meal|weight|pantry|profile/i.test(name) && name !== 'meals',
      ),
      false,
    );
  });

  test('Profil speichern rechnet Ziele; Fehler nennen die Felder', async () => {
    const bad = await server.call('PUT', '/v1/fit/profile', {
      token: anna.token,
      body: { ...PROFILE, heightCm: 5 },
    });
    assert.equal(bad.status, 400);
    assert.deepEqual(bad.body.fields, ['heightCm']);
    const saved = await server.call('PUT', '/v1/fit/profile', { token: anna.token, body: PROFILE });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.goals.isEstimate, true);
    assert.ok(saved.body.goals.kcal > 1500 && saved.body.goals.kcal < 3000);
  });

  test('eine Mahlzeit: der Dienst rechnet, mitgeschickte Kalorien zaehlen nicht', async () => {
    const logged = await server.call('POST', '/v1/fit/meals', {
      token: anna.token,
      body: {
        day: '2026-09-21',
        slot: 'lunch',
        items: [
          { foodId: 'mock:rice_cooked', grams: 200, kcal: 1 },
          { foodId: 'mock:chicken_breast_cooked', grams: 120 },
        ],
        total: { kcal: 5 },
      },
    });
    assert.equal(logged.status, 201);
    assert.equal(logged.body.meal.total.kcal, 440);
    assert.equal(logged.body.day.total.kcal, 440);
    assert.equal(logged.body.day.remaining.kcal, logged.body.day.target.kcal - 440);
    assert.equal(logged.body.meal.items[0].source, 'mock');
  });

  test('fremde Zeilen sind unsichtbar und unveraenderbar', async () => {
    const day = await server.call('GET', '/v1/fit/day?day=2026-09-21', { token: anna.token });
    const mealId = day.body.meals[0].id;
    const benDay = await server.call('GET', '/v1/fit/day?day=2026-09-21', { token: ben.token });
    assert.equal(benDay.body.meals.length, 0);
    assert.equal(benDay.body.hasProfile, false);
    assert.equal(
      (
        await server.call('PATCH', `/v1/fit/meals/${mealId}`, {
          token: ben.token,
          body: { slot: 'dinner' },
        })
      ).status,
      404,
    );
    assert.equal(
      (await server.call('DELETE', `/v1/fit/meals/${mealId}`, { token: ben.token })).status,
      404,
    );
    const again = await server.call('GET', '/v1/fit/day?day=2026-09-21', { token: anna.token });
    assert.equal(again.body.meals[0].slot, 'lunch');
  });

  test('derselbe Idempotency-Key legt nur eine Mahlzeit an', async () => {
    const body = {
      day: '2026-09-22',
      slot: 'breakfast',
      items: [{ foodId: 'mock:banana', grams: 120 }],
    };
    const headers = { 'Idempotency-Key': 'fruehstueck-2026-09-22' };
    const first = await server.call('POST', '/v1/fit/meals', { token: anna.token, body, headers });
    const second = await server.call('POST', '/v1/fit/meals', { token: anna.token, body, headers });
    assert.equal(first.body.meal.id, second.body.meal.id);
    const day = await server.call('GET', '/v1/fit/day?day=2026-09-22', { token: anna.token });
    assert.equal(day.body.meals.length, 1);
  });

  test('unbekannte Lebensmittel und absurde Portionen werden abgelehnt', async () => {
    const unknown = await server.call('POST', '/v1/fit/meals', {
      token: anna.token,
      body: { slot: 'snack', items: [{ foodId: 'mock:gibtsnicht', grams: 10 }] },
    });
    assert.equal(unknown.body.error, 'food_not_found');
    const huge = await server.call('POST', '/v1/fit/meals', {
      token: anna.token,
      body: { slot: 'snack', items: [{ foodId: 'mock:rice', grams: 9000 }] },
    });
    assert.equal(huge.body.error, 'meal_invalid');
    const large = await server.call('POST', '/v1/fit/meals', {
      token: anna.token,
      body: { slot: 'snack', items: [{ foodId: 'mock:water', grams: 2000 }] },
    });
    assert.equal(large.status, 409);
    assert.equal(large.body.error, 'confirm_large_portion');
  });

  test('eigenes Lebensmittel mit Pruefung, danach im Tagebuch nutzbar', async () => {
    const bad = await server.call('POST', '/v1/fit/foods/custom', {
      token: anna.token,
      body: { name: 'Riegel', per100: { kcal: 2000, proteinG: 10, carbsG: 10, fatG: 10 } },
    });
    assert.equal(bad.status, 400);
    const good = await server.call('POST', '/v1/fit/foods/custom', {
      token: anna.token,
      body: {
        name: 'Proteinriegel',
        per100: { kcal: 360, proteinG: 33, carbsG: 30, fatG: 11 },
        gramsPerPiece: 55,
      },
    });
    assert.equal(good.status, 201);
    const found = await server.call('GET', '/v1/fit/foods/search?q=Proteinriegel', {
      token: anna.token,
    });
    assert.equal(found.body.foods[0].id, good.body.food.id);
    const foreign = await server.call('GET', '/v1/fit/foods/search?q=Proteinriegel', {
      token: ben.token,
    });
    assert.equal(
      foreign.body.foods.some((food) => food.id === good.body.food.id),
      false,
    );
    const meal = await server.call('POST', '/v1/fit/meals', {
      token: anna.token,
      body: {
        day: '2026-09-23',
        slot: 'snack',
        items: [{ foodId: good.body.food.id, portions: 1 }],
      },
    });
    assert.equal(meal.body.meal.total.kcal, 198);
  });

  test('Gewicht: einer je Tag, Trend dazu', async () => {
    await server.call('POST', '/v1/fit/weights', {
      token: anna.token,
      body: { day: '2026-09-20', weightKg: 80.4 },
    });
    const replaced = await server.call('POST', '/v1/fit/weights', {
      token: anna.token,
      body: { day: '2026-09-20', weightKg: 80.2 },
    });
    assert.equal(replaced.status, 200);
    const list = await server.call('GET', '/v1/fit/weights', { token: anna.token });
    assert.equal(list.body.entries.length, 1);
    assert.equal(list.body.trend[0].trendKg, 80.2);
    assert.equal(list.body.suggestion, null);
    const refused = await server.call('POST', '/v1/fit/goals/adjustment', {
      token: anna.token,
      body: { kcal: -100 },
    });
    assert.equal(refused.body.error, 'suggestion_changed');
  });

  test('Aenderungen stehen im Protokoll und lassen sich zuruecknehmen', async () => {
    const changes = await server.call('GET', '/v1/fit/changes?table=meals', { token: anna.token });
    const latest = changes.body.changes[0];
    assert.equal(latest.action, 'insert');
    const undo = await server.call('POST', `/v1/fit/changes/${latest.id}/undo`, {
      token: anna.token,
    });
    assert.equal(undo.status, 200);
    const day = await server.call('GET', '/v1/fit/day?day=2026-09-23', { token: anna.token });
    assert.equal(day.body.meals.length, 0);
    assert.equal(
      (await server.call('POST', `/v1/fit/changes/${latest.id}/undo`, { token: anna.token })).body
        .error,
      'already_undone',
    );
    assert.equal(
      (await server.call('POST', `/v1/fit/changes/${latest.id}/undo`, { token: ben.token })).status,
      404,
    );
  });

  test('Abmelden macht das Token ungueltig', async () => {
    const login = await server.call('POST', '/v1/sessions', {
      body: { email: ben.email, password: 'passwort-123' },
    });
    const token = login.body.session;
    assert.equal((await server.call('GET', '/v1/fit/day', { token })).status, 200);
    await server.call('DELETE', '/v1/sessions', { token });
    assert.equal((await server.call('GET', '/v1/fit/day', { token })).status, 401);
  });

  test('alle Fit-Daten loeschen nur mit Bestaetigung', async () => {
    assert.equal(
      (await server.call('DELETE', '/v1/fit/data', { token: anna.token, body: {} })).status,
      400,
    );
    assert.equal(
      (
        await server.call('DELETE', '/v1/fit/data', {
          token: anna.token,
          body: { confirm: 'DELETE' },
        })
      ).status,
      200,
    );
    const profile = await server.call('GET', '/v1/fit/profile', { token: anna.token });
    assert.equal(profile.body.profile, null);
  });
});

describe('Better Fit: uebliche Mahlzeiten und nochmal essen', () => {
  let server;
  let user;
  before(async () => {
    server = await startFitServer();
    user = await server.signUp('muesli');
  });
  after(() => server.stop());

  const log = (slot, items, day) =>
    server.call('POST', '/v1/fit/meals', { token: user.token, body: { day, slot, items } });

  test('gleiche Zusammenstellung zaehlt als eine, die passende Mahlzeit zuerst', async () => {
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(
      new Date(),
    );
    const breakfast = [
      { foodId: 'mock:oats', grams: 60 },
      { foodId: 'mock:milk', grams: 200 },
    ];
    await log('breakfast', breakfast, today);
    // 204 g statt 200 g: auf 10 g gerundet dieselbe Mahlzeit.
    await log(
      'breakfast',
      [
        { foodId: 'mock:oats', grams: 60 },
        { foodId: 'mock:milk', grams: 204 },
      ],
      today,
    );
    await log('lunch', [{ foodId: 'mock:rice_cooked', grams: 200 }], today);
    const usual = await server.call('GET', '/v1/fit/meals/usual?slot=breakfast', {
      token: user.token,
    });
    assert.equal(usual.status, 200);
    assert.equal(usual.body.meals.length, 2);
    assert.equal(usual.body.meals[0].count, 2);
    assert.equal(usual.body.meals[0].slot, 'breakfast');
    const lunchFirst = await server.call('GET', '/v1/fit/meals/usual?slot=lunch', {
      token: user.token,
    });
    assert.equal(lunchFirst.body.meals[0].slot, 'lunch');
  });

  test('nochmal essen rechnet neu, in der gewaehlten Mahlzeit, und nur fuer die eigene', async () => {
    const [first] = (
      await server.call('GET', '/v1/fit/meals/usual?slot=breakfast', { token: user.token })
    ).body.meals;
    const again = await server.call('POST', `/v1/fit/meals/${first.id}/repeat`, {
      token: user.token,
      body: { slot: 'snack' },
    });
    assert.equal(again.status, 201);
    assert.equal(again.body.meal.slot, 'snack');
    assert.equal(again.body.meal.repeatedFrom, first.id);
    assert.ok(Math.abs(again.body.meal.total.kcal - first.kcal) < 1);
    const other = await server.signUp('fremd');
    assert.equal(
      (
        await server.call('POST', `/v1/fit/meals/${first.id}/repeat`, {
          token: other.token,
          body: {},
        })
      ).status,
      404,
    );
  });
});
