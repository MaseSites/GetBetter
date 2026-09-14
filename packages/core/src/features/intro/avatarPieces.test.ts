import assert from 'node:assert/strict';
import { test } from 'node:test';

import { arrivalDelay, mixHex, scatterOf } from './avatarPieces';

test('die Startpunkte sind bei jedem Aufruf gleich und liegen ausserhalb des Kopfs', () => {
  for (let index = 0; index < 50; index += 1) {
    const first = scatterOf(index);
    assert.deepEqual(scatterOf(index), first);
    const distance = Math.hypot(first.dx, first.dy);
    assert.ok(distance >= 57 && distance <= 104, `Stueck ${index}: ${distance}`);
    assert.ok(first.scale > 0 && first.scale < 1);
  }
});

test('die Verzoegerung haelt die Gesamtdauer ein', () => {
  assert.equal(arrivalDelay(0, 950, 520), 0);
  assert.equal(arrivalDelay(1, 950, 520), 430);
  assert.equal(arrivalDelay(2, 950, 520), 430);
  assert.equal(arrivalDelay(-1, 950, 520), 0);
  assert.equal(arrivalDelay(0.5, 400, 520), 0);
});

test('mischt Farben und laesst Fremdes stehen', () => {
  assert.equal(mixHex('#000000', '#FFFFFF', 0.5), '#808080');
  assert.equal(mixHex('#C9F23F', '#14150F', 0), '#C9F23F');
  assert.equal(mixHex('#c9f23f', '#14150f', 1), '#14150F');
  assert.equal(mixHex('rgba(0, 0, 0, 0.4)', '#FFFFFF', 0.5), 'rgba(0, 0, 0, 0.4)');
});
