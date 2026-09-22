import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { addToBasket, photoPreview, removeFromBasket, totalOf, type PhotoRow } from './mealMath';

const per100 = { kcal: 100, proteinG: 10, carbsG: 10, fatG: 1 };

describe('Vorschau beim Eintragen', () => {
  test('Korb: gleiches Lebensmittel zaehlt zusammen, entfernen geht', () => {
    const one = addToBasket([], { foodId: 'a', name: 'A', per100, grams: 100 });
    const two = addToBasket(one, { foodId: 'a', name: 'A', per100, grams: 50 });
    assert.equal(two.length, 1);
    assert.equal(two[0]?.grams, 150);
    const three = addToBasket(two, { foodId: 'b', name: 'B', per100, grams: 20 });
    assert.equal(totalOf(three).kcal, 170);
    assert.deepEqual(
      removeFromBasket(three, 'a').map((item) => item.foodId),
      ['b'],
    );
  });

  test('Foto: Spanne folgt den geaenderten Gramm, eigene Zeilen ohne Spanne', () => {
    const food = { id: 'a', name: 'A', per100 };
    const rows: PhotoRow[] = [
      { key: '1', term: 'a', food, grams: 200, aiGrams: 100, minGrams: 80, maxGrams: 130 },
      { key: '2', term: 'b', food, grams: 50, aiGrams: null, minGrams: null, maxGrams: null },
      { key: '3', term: 'c', food: null, grams: 70, aiGrams: 70, minGrams: 60, maxGrams: 80 },
    ];
    assert.deepEqual(photoPreview(rows), { kcal: 250, min: 210, max: 310 });
  });
});
