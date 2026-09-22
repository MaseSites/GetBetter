import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { groupPlates, platesFor } from './plates';

describe('Scheibenrechner', () => {
  test('gaengige Gewichte: je Seite, schwerste zuerst', () => {
    assert.deepEqual(platesFor(60).perSide, [20]);
    assert.deepEqual(platesFor(100).perSide, [25, 15]);
    assert.deepEqual(platesFor(142.5).perSide, [25, 25, 10, 1.25]);
    assert.deepEqual(platesFor(62.5).perSide, [20, 1.25]);
    assert.equal(platesFor(62.5).totalKg, 62.5);
    assert.equal(platesFor(62.5).restKg, 0);
  });

  test('nur die Stange, oder weniger', () => {
    assert.deepEqual(platesFor(20), { perSide: [], totalKg: 20, restKg: 0, belowBar: false });
    assert.equal(platesFor(15).belowBar, true);
  });

  test('was sich nicht genau legen laesst, steht als Rest da', () => {
    const load = platesFor(61);
    assert.deepEqual(load.perSide, [20]);
    assert.equal(load.totalKg, 60);
    assert.equal(load.restKg, 1);
  });

  test('gleiche Scheiben zusammengefasst', () => {
    assert.deepEqual(groupPlates([25, 25, 10, 1.25]), [
      { kg: 25, count: 2 },
      { kg: 10, count: 1 },
      { kg: 1.25, count: 1 },
    ]);
  });
});
