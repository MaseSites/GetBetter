import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseAmount } from './amount';

test('liest Punkt und Komma als Dezimaltrenner', () => {
  assert.equal(parseAmount('12.50'), 12.5);
  assert.equal(parseAmount('12,50'), 12.5);
});

test('ignoriert Waehrung und Leerzeichen', () => {
  assert.equal(parseAmount('CHF 89.90'), 89.9);
  assert.equal(parseAmount(' 500 '), 500);
});

test('rundet auf Rappen', () => {
  assert.equal(parseAmount('1.005'), 1.01);
  assert.equal(parseAmount('2.999'), 3);
});

test('lehnt Leeres, Null und Negatives ab', () => {
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('0'), null);
  assert.equal(parseAmount('-5'), null);
  assert.equal(parseAmount('abc'), null);
});
