const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { MOCK_FOODS } = require('./catalog/mockFoods.js');
const { checkPer100, checkPortion, computeMeal, remaining } = require('./nutrition.js');

const food = (per100) => ({ per100 });

describe('Grenzen je 100 g', () => {
  test('jeder Beispiel-Datensatz besteht die Pruefung ohne Fehler', () => {
    for (const entry of MOCK_FOODS) {
      const check = checkPer100(entry.per100);
      assert.equal(check.ok, true, `${entry.id}: ${check.errors.join(',')}`);
    }
  });

  test('negativ, NaN, unendlich und fehlend werden abgelehnt', () => {
    assert.deepEqual(checkPer100({ kcal: -1, proteinG: 1, carbsG: 1, fatG: 1 }).errors, ['kcal_out_of_range']);
    assert.deepEqual(checkPer100({ kcal: Number.NaN, proteinG: 1, carbsG: 1, fatG: 1 }).errors, ['kcal_missing']);
    assert.deepEqual(checkPer100({ kcal: 100, proteinG: Infinity, carbsG: 1, fatG: 1 }).errors, ['proteinG_missing']);
    assert.deepEqual(checkPer100({ kcal: 100, proteinG: 1, fatG: 1 }).errors, ['carbsG_missing']);
  });

  test('ueber 950 kcal oder mehr Makros als Gewicht ist unmoeglich', () => {
    assert.equal(checkPer100({ kcal: 990, proteinG: 0, carbsG: 0, fatG: 100 }).ok, false);
    assert.deepEqual(checkPer100({ kcal: 500, proteinG: 60, carbsG: 50, fatG: 0 }).errors, ['macros_exceed_weight']);
  });

  test('4/4/9: kleine Luecke warnt, grosse lehnt ab', () => {
    assert.deepEqual(checkPer100({ kcal: 150, proteinG: 10, carbsG: 20, fatG: 0 }).warnings, []);
    assert.deepEqual(checkPer100({ kcal: 160, proteinG: 10, carbsG: 20, fatG: 0 }).warnings, []);
    assert.deepEqual(checkPer100({ kcal: 170, proteinG: 5, carbsG: 20, fatG: 0 }).warnings, ['energy_mismatch']);
    assert.deepEqual(checkPer100({ kcal: 400, proteinG: 5, carbsG: 20, fatG: 0 }).errors, ['energy_mismatch']);
  });
});

describe('Mahlzeit rechnen', () => {
  const rice = food({ kcal: 130, proteinG: 2.7, carbsG: 28.2, fatG: 0.3 });
  const chicken = food({ kcal: 150, proteinG: 31, carbsG: 0, fatG: 2.5 });

  test('Gramm mal Wert je 100 g, dazu der Bereich', () => {
    const meal = computeMeal([
      { food: rice, grams: 200, minGrams: 150, maxGrams: 250 },
      { food: chicken, grams: 120 },
    ]);
    assert.equal(meal.ok, true);
    assert.deepEqual(meal.total, { kcal: 440, proteinG: 42.6, carbsG: 56.4, fatG: 3.6 });
    assert.deepEqual(meal.range, { kcalMin: 375, kcalMax: 505 });
  });

  test('Portionen ausserhalb 1–3000 g sind Fehler, ueber 1500 g fragt die App', () => {
    assert.equal(checkPortion(0).ok, false);
    assert.equal(checkPortion(3001).ok, false);
    assert.equal(checkPortion(1600).needsConfirmation, true);
    const meal = computeMeal([{ food: rice, grams: 5000 }]);
    assert.equal(meal.ok, false);
  });

  test('der Rest des Tages darf negativ sein — dann ist man drueber', () => {
    assert.deepEqual(remaining({ kcal: 2000, proteinG: 120, carbsG: 200, fatG: 60 }, { kcal: 2100, proteinG: 100, carbsG: 250, fatG: 50 }), {
      kcal: -100,
      proteinG: 20,
      carbsG: -50,
      fatG: 10,
    });
  });
});
