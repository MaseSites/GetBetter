import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  armedSide,
  detentOffset,
  resolveSheetRelease,
  resolveSwipeRelease,
  type SwipeReleaseInput,
} from './gestureLogic';

const row: SwipeReleaseInput = {
  x: 0,
  vx: 0,
  width: 400,
  trailingWidth: 152,
  hasLeading: true,
  hasTrailingFull: true,
  fullShare: 0.6,
  flingVelocity: 0.8,
};

test('Zeile: ein voller Wisch nach rechts loest die Aktion links aus', () => {
  assert.equal(resolveSwipeRelease({ ...row, x: 260 }), 'leading');
  assert.equal(resolveSwipeRelease({ ...row, x: 200 }), 'close');
  assert.equal(resolveSwipeRelease({ ...row, x: 150, vx: 2 }), 'leading');
});

test('Zeile: ohne Aktion links tut ein Wisch nach rechts nichts', () => {
  assert.equal(resolveSwipeRelease({ ...row, hasLeading: false, x: 390 }), 'close');
});

test('Zeile: halb nach links oeffnet die Knoepfe, ganz durch loest aus', () => {
  assert.equal(resolveSwipeRelease({ ...row, x: -100 }), 'openTrailing');
  assert.equal(resolveSwipeRelease({ ...row, x: -40 }), 'close');
  assert.equal(resolveSwipeRelease({ ...row, x: -250 }), 'trailingFull');
  assert.equal(resolveSwipeRelease({ ...row, x: -160, vx: -2 }), 'trailingFull');
});

test('Zeile: ohne volle Aktion bleibt es beim Oeffnen', () => {
  assert.equal(resolveSwipeRelease({ ...row, hasTrailingFull: false, x: -390 }), 'openTrailing');
});

test('Zeile: nur eine volle Aktion, keine Knoepfe', () => {
  const only = { ...row, trailingWidth: 0 };
  assert.equal(resolveSwipeRelease({ ...only, x: -100 }), 'close');
  assert.equal(resolveSwipeRelease({ ...only, x: -260 }), 'trailingFull');
});

test('Zeile: scharf ist, was beim Loslassen ausloest', () => {
  assert.equal(armedSide(250, 400, 0.6, true, true), 'leading');
  assert.equal(armedSide(-250, 400, 0.6, true, true), 'trailing');
  assert.equal(armedSide(-250, 400, 0.6, true, false), null);
  assert.equal(armedSide(100, 400, 0.6, true, true), null);
});

const sheet = {
  dy: 0,
  vy: 0,
  mediumOffset: 300,
  dismissDistance: 120,
  flingVelocity: 0.8,
} as const;

test('Blatt: mittel steht um den Abstand tiefer als gross', () => {
  assert.equal(detentOffset('large', 300), 0);
  assert.equal(detentOffset('medium', 300), 300);
});

test('Blatt: nach oben geht es auf gross', () => {
  assert.equal(resolveSheetRelease({ ...sheet, detent: 'medium', dy: -80 }), 'large');
  assert.equal(resolveSheetRelease({ ...sheet, detent: 'medium', dy: -10, vy: -1 }), 'large');
  assert.equal(resolveSheetRelease({ ...sheet, detent: 'medium', dy: -30 }), 'medium');
});

test('Blatt: nach unten gross → mittel → zu', () => {
  assert.equal(resolveSheetRelease({ ...sheet, detent: 'large', dy: 150 }), 'medium');
  assert.equal(resolveSheetRelease({ ...sheet, detent: 'large', dy: 60 }), 'large');
  assert.equal(resolveSheetRelease({ ...sheet, detent: 'large', dy: 40, vy: 1 }), 'medium');
  assert.equal(resolveSheetRelease({ ...sheet, detent: 'large', dy: 450 }), 'close');
  assert.equal(resolveSheetRelease({ ...sheet, detent: 'medium', dy: 130 }), 'close');
  assert.equal(resolveSheetRelease({ ...sheet, detent: 'medium', dy: 20, vy: 1 }), 'close');
  assert.equal(resolveSheetRelease({ ...sheet, detent: 'medium', dy: 60 }), 'medium');
});
