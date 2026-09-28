import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatAmount, readAmount } from './quantity';

test('liest Zahlen in allen Schreibweisen', () => {
  assert.deepEqual(readAmount('200 g Mehl'), { value: 200, length: 3, style: 'fraction' });
  assert.equal(readAmount('1.5 dl')?.value, 1.5);
  assert.equal(readAmount('1,5 dl')?.style, 'decimal');
  assert.equal(readAmount('1/2 TL')?.value, 0.5);
  assert.equal(readAmount('½ TL')?.value, 0.5);
  assert.equal(readAmount('1½ TL')?.value, 1.5);
  assert.equal(readAmount('1 1/2 TL')?.value, 1.5);
  assert.equal(readAmount('1 1/2 TL')?.length, 5);
});

test('ohne Zahl vorne gibt es nichts', () => {
  assert.equal(readAmount('Salz'), null);
  assert.equal(readAmount(''), null);
  assert.equal(readAmount('0 g'), null);
});

test('schreibt ganze, Brüche und Dezimalzahlen', () => {
  assert.equal(formatAmount(3), '3');
  assert.equal(formatAmount(1.5, 'fraction'), '1½');
  assert.equal(formatAmount(0.25, 'fraction'), '¼');
  assert.equal(formatAmount(1.5, 'decimal'), '1.5');
  assert.equal(formatAmount(1 / 3, 'fraction'), '0.33');
});
