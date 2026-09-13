import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dropIndex, moveItem, orderChanges, shiftOf } from './order';

test('moveItem verschiebt und lässt das Original stehen', () => {
  const list = Object.freeze(['a', 'b', 'c', 'd']);
  assert.deepEqual(moveItem(list, 0, 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(moveItem(list, 3, 0), ['d', 'a', 'b', 'c']);
  assert.deepEqual(moveItem(list, 1, 1), ['a', 'b', 'c', 'd']);
  assert.deepEqual(moveItem(list, 1, 99), ['a', 'c', 'd', 'b']);
  assert.deepEqual(moveItem(list, 7, 0), ['a', 'b', 'c', 'd']);
  assert.deepEqual(list, ['a', 'b', 'c', 'd']);
});

test('dropIndex: ueber die Mitte der Nachbarn', () => {
  const heights = [50, 50, 50];
  assert.equal(dropIndex(0, 0, heights), 0);
  assert.equal(dropIndex(0, 20, heights), 0);
  assert.equal(dropIndex(0, 60, heights), 1);
  assert.equal(dropIndex(0, 500, heights), 2);
  assert.equal(dropIndex(2, -60, heights), 1);
  assert.equal(dropIndex(2, -500, heights), 0);
  assert.equal(dropIndex(1, 0, [44, 76, 60]), 1);
});

test('shiftOf: wer ausweicht und wohin', () => {
  // 0 nach 2 gezogen: 1 und 2 rutschen hoch.
  assert.deepEqual(
    [0, 1, 2, 3].map((index) => shiftOf(index, 0, 2, 50)),
    [0, -50, -50, 0],
  );
  // 3 nach 1 gezogen: 1 und 2 rutschen runter.
  assert.deepEqual(
    [0, 1, 2, 3].map((index) => shiftOf(index, 3, 1, 40)),
    [0, 40, 40, 0],
  );
});

test('orderChanges: nur was sich aendert', () => {
  const current = new Map<string, number | undefined>([
    ['a', 0],
    ['b', 5],
    ['c', undefined],
  ]);
  assert.deepEqual(orderChanges(['a', 'c', 'b'], current), [
    { id: 'c', order: 1 },
    { id: 'b', order: 2 },
  ]);
});
