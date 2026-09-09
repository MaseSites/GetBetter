import assert from 'node:assert/strict';
import { test } from 'node:test';

import { guessCategory, isShoppingCategory, splitQuantity } from './categories';

test('raet die Abteilung aus dem Namen', () => {
  assert.equal(guessCategory('Bananen'), 'produce');
  assert.equal(guessCategory('Vollmilch'), 'dairy');
  assert.equal(guessCategory('Abfallsäcke'), 'household');
  assert.equal(guessCategory('Pouletbrust'), 'meat');
  assert.equal(guessCategory('Rivella'), 'drinks');
  assert.equal(guessCategory('Zopf'), 'bakery');
  assert.equal(guessCategory('Spaghetti'), 'pantry');
});

test('ohne Treffer ist es Anderes', () => {
  assert.equal(guessCategory('Geschenk'), 'other');
  assert.equal(guessCategory(''), 'other');
});

test('erkennt nur die bekannten Abteilungen', () => {
  assert.equal(isShoppingCategory('dairy'), true);
  assert.equal(isShoppingCategory('sweets'), false);
  assert.equal(isShoppingCategory(undefined), false);
});

test('trennt eine Menge vom Namen', () => {
  assert.deepEqual(splitQuantity('2 Bananen'), { name: 'Bananen', quantity: '2' });
  assert.deepEqual(splitQuantity('500 g Mehl'), { name: 'Mehl', quantity: '500 g' });
  assert.deepEqual(splitQuantity('1.5 l Milch'), { name: 'Milch', quantity: '1.5 l' });
});

test('laesst Namen ohne Zahl in Ruhe', () => {
  assert.deepEqual(splitQuantity('Bananen'), { name: 'Bananen', quantity: null });
  assert.deepEqual(splitQuantity('  Brot  '), { name: 'Brot', quantity: null });
});
