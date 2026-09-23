const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { isAutoName, searchHistory, streakOf, trainingDaysOf } = require('./diary.js');
const { currentWeightKg } = require('./goals.js');
const { sumOptional } = require('./nutrition.js');

/** Eine Sicht wie `forOwner`, nur mit Mahlzeiten. */
const ownOf = (meals) => ({ list: (_name, where = () => true) => meals.filter(where) });
const meal = (day, extra = {}) => ({ day, createdAt: `${day}T12:00:00Z`, items: [], ...extra });

describe('Tagebuch: reine Rechnung', () => {
  test('Serie: Tage in Folge, ein leerer heutiger Tag zaehlt ab gestern', () => {
    const own = ownOf([meal('2026-09-20'), meal('2026-09-21'), meal('2026-09-18')]);
    assert.equal(streakOf(own, '2026-09-21'), 2);
    assert.equal(streakOf(own, '2026-09-22'), 2);
    assert.equal(streakOf(own, '2026-09-24'), 0);
  });

  test('Suchverlauf: normalisiert, das Haeufigste gewinnt', () => {
    const own = ownOf([
      meal('2026-09-01', { items: [{ foodId: 'a', term: 'Brot' }] }),
      meal('2026-09-02', { items: [{ foodId: 'b', term: 'brot ' }] }),
      meal('2026-09-03', { items: [{ foodId: 'b', term: 'BROT' }] }),
    ]);
    assert.deepEqual(searchHistory(own), { brot: 'b' });
  });

  test('gebauter Name: neu per Flag, alt am Inhalt erkannt', () => {
    assert.equal(isAutoName({ nameAuto: true, name: 'x', items: [] }), true);
    assert.equal(isAutoName({ name: 'A, B', items: [{ name: 'A' }, { name: 'B' }] }), true);
    assert.equal(isAutoName({ name: 'Zmorge', items: [{ name: 'A' }] }), false);
  });

  test('Gewicht: der neuere Eintrag gilt, ein neueres Profil auch', () => {
    const row = { profile: { weightKg: 70 }, updatedAt: '2026-09-10T08:00:00Z' };
    assert.equal(currentWeightKg(row, [{ day: '2026-09-12', weightKg: 72 }]), 72);
    assert.equal(currentWeightKg(row, [{ day: '2026-09-01', weightKg: 75 }]), 70);
    assert.equal(currentWeightKg(row, []), 70);
  });

  test('Ballaststoffe, Zucker, Salz: nur was bekannt ist', () => {
    assert.deepEqual(sumOptional([{ fiberG: 1.25 }, { fiberG: 2, saltG: 0.3 }, {}]), {
      fiberG: 3.3,
      saltG: 0.3,
    });
  });
});

// Gefunden beim Durchspielen: Das Profil sagte „4 Trainingstage“, der Plan
// hatte drei (Mo/Mi/Sa). Die Woche wurde auf vier verteilt, bekommen hat sie
// drei — 620 kcal je Woche zu wenig.
describe('Trainingstage der Woche', () => {
  const withPlan = (weekdays) => ({ list: (name) => (name === 'workoutPlans' ? [{ weekdays }] : []) });

  test('steht ein Plan, zaehlt er — nicht die Zahl im Profil', () => {
    assert.equal(trainingDaysOf(withPlan([1, 3, 6]), 4), 3);
    assert.equal(trainingDaysOf(withPlan([1, 2, 4, 5]), 2), 4);
  });

  test('ohne Plan bleibt die Zahl aus dem Profil', () => {
    assert.equal(trainingDaysOf({ list: () => [] }, 4), 4);
    assert.equal(trainingDaysOf(null, 3), 3);
  });

  test('ein Plan ohne brauchbare Tage aendert nichts', () => {
    assert.equal(trainingDaysOf(withPlan([]), 4), 4);
    assert.equal(trainingDaysOf(withPlan(null), 4), 4);
    assert.equal(trainingDaysOf({ list: (n) => (n === 'workoutPlans' ? [{}] : []) }, 4), 4);
  });

  test('der neueste Plan gilt', () => {
    const own = {
      list: (name) => (name === 'workoutPlans' ? [{ weekdays: [1, 3, 5] }, { weekdays: [2, 4] }] : []),
    };
    assert.equal(trainingDaysOf(own, 6), 2);
  });
});
