import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ingredientForShopping, ingredientParts, scaleIngredient } from './scale';

test('rechnet die typischen Zeilen um', () => {
  assert.equal(scaleIngredient('200 g Mehl', 2), '400 g Mehl');
  assert.equal(scaleIngredient('200 g Mehl', 0.5), '100 g Mehl');
  assert.equal(scaleIngredient('1/2 TL Salz', 3), '1½ TL Salz');
  assert.equal(scaleIngredient('2 Eier', 1.5), '3 Eier');
  assert.equal(scaleIngredient('1 Ei', 0.5), '½ Ei');
  assert.equal(scaleIngredient('1.5 dl Rahm', 2), '3 dl Rahm');
  assert.equal(scaleIngredient('1.5 dl Rahm', 1.5), '2.5 dl Rahm');
});

test('rundet auf sinnvolle Stufen', () => {
  assert.equal(scaleIngredient('125 g Butter', 1.5), '190 g Butter');
  assert.equal(scaleIngredient('30 g Zucker', 1 / 3), '10 g Zucker');
  assert.equal(scaleIngredient('1 Prise Salz', 0.25), '¼ Prise Salz');
});

test('ohne Zahl und bei Faktor 1 bleibt alles', () => {
  assert.equal(scaleIngredient('Salz und Pfeffer', 2), 'Salz und Pfeffer');
  assert.equal(scaleIngredient('1,5 dl Milch', 1), '1,5 dl Milch');
});

test('trennt Menge und Name für die Liste', () => {
  assert.equal(ingredientParts('1/2 TL Salz').unit, 'TL');
  assert.deepEqual(ingredientForShopping('500 g Magronen', 2), {
    name: 'Magronen',
    quantity: '1000 g',
  });
  assert.deepEqual(ingredientForShopping('3 Rüebli', 1), { name: 'Rüebli', quantity: '3' });
  assert.deepEqual(ingredientForShopping('Petersilie', 2), { name: 'Petersilie', quantity: null });
});
