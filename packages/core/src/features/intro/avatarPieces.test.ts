import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AVATAR_CANVAS, AVATAR_PIECES, arrivalDelay, mixHex, scatterOf } from './avatarPieces';

test('der Avatar besteht aus 30 bis 50 Stuecken mit eigener Id', () => {
  assert.ok(AVATAR_PIECES.length >= 30 && AVATAR_PIECES.length <= 50);
  const ids = new Set(AVATAR_PIECES.map((piece) => piece.id));
  assert.equal(ids.size, AVATAR_PIECES.length);
});

test('jedes Stueck sitzt am Ende auf der Leinwand', () => {
  for (const piece of AVATAR_PIECES) {
    assert.ok(piece.x >= 0 && piece.y >= 0, piece.id);
    assert.ok(piece.x + piece.width <= AVATAR_CANVAS, piece.id);
    assert.ok(piece.y + piece.height <= AVATAR_CANVAS, piece.id);
    assert.ok(piece.wave >= 0 && piece.wave <= 1, piece.id);
  }
});

test('die Startpunkte sind bei jedem Aufruf gleich und liegen ausserhalb des Kopfs', () => {
  AVATAR_PIECES.forEach((_, index) => {
    const first = scatterOf(index);
    assert.deepEqual(scatterOf(index), first);
    const distance = Math.hypot(first.dx, first.dy);
    assert.ok(distance >= 57 && distance <= 104, `Stueck ${index}: ${distance}`);
    assert.ok(first.scale > 0 && first.scale < 1);
  });
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
