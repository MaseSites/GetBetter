import assert from 'node:assert/strict';
import { test } from 'node:test';

import { clockText, readClock } from './clock';

const read = (input: string) => {
  const clock = readClock(input);
  return clock ? clockText(clock) : null;
};

test('readClock: nur die Stunde heisst volle Stunde', () => {
  assert.equal(read('18'), '18:00');
  assert.equal(read('9'), '09:00');
  assert.equal(read('0'), '00:00');
  assert.equal(read(' 18 '), '18:00');
  assert.equal(read('18 Uhr'), '18:00');
  assert.equal(read('18h'), '18:00');
});

test('readClock: Ziffern ohne Zeichen — die letzten zwei sind Minuten', () => {
  assert.equal(read('1830'), '18:30');
  assert.equal(read('930'), '09:30');
  assert.equal(read('0930'), '09:30');
  assert.equal(read('0005'), '00:05');
});

test('readClock: mit Zeichen dazwischen, wie man es gewohnt ist', () => {
  assert.equal(read('18:30'), '18:30');
  assert.equal(read('9:05'), '09:05');
  assert.equal(read('18.30'), '18:30');
  assert.equal(read('18,30'), '18:30');
  assert.equal(read('18h30'), '18:30');
  assert.equal(read('18 30'), '18:30');
  assert.equal(read('18 Uhr 30'), '18:30');
});

test('readClock: was keine Uhrzeit ist, bleibt null', () => {
  for (const input of ['', '24', '2400', '1860', '183', '18:3', '18:300', '12345', 'abends', '-5', '18:30:00']) {
    assert.equal(read(input), null, input);
  }
});
