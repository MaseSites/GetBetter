const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { computeGoals, suggestAdjustment, validateProfile, weightTrend, ageOn } = require('./goals.js');

const TODAY = '2026-09-21';
const BASE = {
  birthDate: '1994-05-10',
  heightCm: 180,
  weightKg: 80,
  sex: 'male',
  activity: 'moderate',
  trainingDaysPerWeek: 3,
  goal: 'maintain',
  pace: 'gentle',
};

const profileOf = (patch = {}) => {
  const result = validateProfile({ ...BASE, ...patch }, TODAY);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  return result.profile;
};

describe('Profil pruefen', () => {
  test('gueltig mit Standardwerten', () => {
    const profile = profileOf();
    assert.equal(profile.diet, 'omnivore');
    assert.deepEqual(profile.allergies, []);
    assert.equal(profile.timezone, 'Europe/Zurich');
  });

  test('falsche Werte nennen ihre Felder', () => {
    const result = validateProfile({ ...BASE, heightCm: 20, weightKg: 'x', allergies: ['gift'], birthDate: '2020-01-01' }, TODAY);
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors.sort(), ['allergies', 'birthDate', 'heightCm', 'weightKg']);
  });

  test('Alter zaehlt erst ab dem Geburtstag', () => {
    assert.equal(ageOn('2000-09-22', TODAY), 25);
    assert.equal(ageOn('2000-09-21', TODAY), 26);
  });
});

describe('Ziele', () => {
  test('Mifflin-St Jeor, Aktivitaet und Makros ergeben die Kalorien', () => {
    const goals = computeGoals(profileOf(), TODAY);
    // 10*80 + 6.25*180 - 5*32 + 5 = 1770
    assert.equal(goals.bmr, 1770);
    assert.equal(goals.tdee, Math.round(1770 * 1.55));
    assert.equal(goals.kcal, 2740);
    const fromMacros = goals.proteinG * 4 + goals.carbsG * 4 + goals.fatG * 9;
    assert.ok(Math.abs(fromMacros - goals.kcal) <= 10);
    assert.equal(goals.isEstimate, true);
  });

  test('Abnehmen zieht ab, aber nie unter den Grundumsatz', () => {
    const lose = computeGoals(profileOf({ goal: 'lose', pace: 'moderate' }), TODAY);
    assert.equal(lose.kcal, 2740 - 550);
    const small = computeGoals(profileOf({ goal: 'lose', pace: 'moderate', weightKg: 45, heightCm: 150, sex: 'female', activity: 'sedentary' }), TODAY);
    assert.ok(small.kcal >= 1200);
    assert.ok(small.kcal >= small.bmr - 10);
  });

  test('Trainingstage mehr, Ruhetage weniger — die Woche bleibt gleich', () => {
    const goals = computeGoals(profileOf({ trainingDaysPerWeek: 3 }), TODAY);
    assert.ok(goals.trainingDay.kcal > goals.restDay.kcal);
    const week = 3 * goals.trainingDay.kcal + 4 * goals.restDay.kcal;
    assert.ok(Math.abs(week - 7 * goals.kcal) <= 40);
  });

  test('Minderjaehrige und Schwangere: nur Erhalt, nie ein Defizit', () => {
    const teen = computeGoals(profileOf({ birthDate: '2010-01-01', goal: 'lose', pace: 'moderate' }), TODAY);
    assert.equal(teen.goal, 'maintain');
    assert.deepEqual(teen.safety.reasons, ['minor']);
    const pregnant = computeGoals(profileOf({ sex: 'female', pregnant: true, goal: 'lose' }), TODAY, -200);
    assert.equal(pregnant.safety.mode, 'maintain_only');
    assert.equal(pregnant.adjustment, 0);
  });

  // Gefunden beim Durchspielen des Testkontos: 45 kg auf 185 cm ist BMI 13.1,
  // und die App rechnete dafuer einen Plan mit Ueberschuss, als waere nichts.
  test('sehr tiefes Gewicht: nur Erhalt, auch wenn jemand zunehmen will', () => {
    const thin = computeGoals(profileOf({ heightCm: 185, weightKg: 45, goal: 'gain' }), TODAY);
    assert.equal(thin.goal, 'maintain');
    assert.ok(thin.safety.reasons.includes('very_low_weight'));
    // Und schon gar kein Defizit.
    const losing = computeGoals(profileOf({ heightCm: 185, weightKg: 45, goal: 'lose' }), TODAY);
    assert.equal(losing.goal, 'maintain');
  });

  test('genau an der Grenze und darueber bleibt alles normal', () => {
    // 60 kg auf 185 cm ist BMI 17.53 — knapp darueber, also unauffaellig.
    const edge = computeGoals(profileOf({ heightCm: 185, weightKg: 60, goal: 'gain' }), TODAY);
    assert.deepEqual(edge.safety.reasons, []);
    assert.equal(edge.goal, 'gain');
    const normal = computeGoals(profileOf({ heightCm: 185, weightKg: 75, goal: 'lose' }), TODAY);
    assert.equal(normal.goal, 'lose');
  });
});

describe('Gewichtstrend', () => {
  const days = (count, start, perDay) =>
    Array.from({ length: count }, (_, index) => {
      const date = new Date(Date.parse('2026-09-01T12:00:00Z') + index * 86400000);
      return { day: date.toISOString().slice(0, 10), weightKg: start + perDay * index };
    });

  test('ein Ausreisser bewegt den Trend kaum', () => {
    const trend = weightTrend([...days(5, 80, 0), { day: '2026-09-06', weightKg: 83 }]);
    assert.ok(trend.at(-1).trendKg < 80.4);
  });

  test('zu wenig Daten: kein Vorschlag', () => {
    assert.equal(suggestAdjustment(profileOf({ goal: 'lose' }), days(5, 80, 0), '2026-09-06'), null);
  });

  test('stagniert beim Abnehmen: hoechstens 100 kcal weniger', () => {
    const suggestion = suggestAdjustment(profileOf({ goal: 'lose', pace: 'moderate' }), days(20, 80, 0), '2026-09-20');
    assert.ok(suggestion);
    assert.equal(suggestion.kcal, -100);
  });
});
