import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { bandPieces } from './bandPieces';

const meal = (id: string, kcal: number) => ({
  id,
  total: { kcal, proteinG: 0, carbsG: 0, fatG: 0 },
});

describe('Tagesband', () => {
  test('Abschnitte in der Reihenfolge, was ueber das Ziel geht, ist eigener Abschnitt', () => {
    assert.deepEqual(bandPieces([meal('a', 600), meal('b', 0), meal('c', 900)], 1200), [
      { key: 'a-in', kcal: 600, over: false },
      { key: 'c-in', kcal: 600, over: false },
      { key: 'c-over', kcal: 300, over: true },
    ]);
    assert.deepEqual(bandPieces([], 2000), []);
  });
});
