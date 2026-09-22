import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  STACK_BEHIND,
  STACK_CARD_HEIGHT,
  STACK_PEEK,
  STACK_STEP,
  frontAt,
  stackFrames,
  stackHeight,
} from './stack';

/** Wo die Karte `index` bei Rollposition `y` sichtbar steht und wie sie aussieht. */
function lookOf(index: number, y: number) {
  const frames = stackFrames(index);
  const at = frames.inputRange.indexOf(y);
  assert.notEqual(at, -1, `keine Stufe bei ${y}`);
  const scale = frames.scale[at] ?? 1;
  const top = index * STACK_STEP - y + (frames.translateY[at] ?? 0);
  return { top, bottom: top + STACK_CARD_HEIGHT / 2 + (STACK_CARD_HEIGHT * scale) / 2, opacity: frames.opacity[at] ?? 0 };
}

test('die vorderste Karte steht oben und ist ganz hell', () => {
  for (const index of [0, 1, 4]) {
    const front = lookOf(index, index * STACK_STEP);
    assert.equal(front.top, 0);
    assert.equal(front.opacity, 1);
  }
});

test('dahinter schaut jede Karte ein Stück weiter hervor — und wird immer durchsichtiger', () => {
  const front = lookOf(0, 0);
  const behind = [1, 2, 3].map((index) => lookOf(index, 0));
  behind.forEach((card, depth) => {
    assert.ok(Math.abs(card.bottom - (front.bottom + STACK_PEEK * (depth + 1))) < 1e-9);
  });
  const opacities = [front, ...behind].map((card) => card.opacity);
  assert.deepEqual([...opacities].sort((a, b) => b - a), opacities);
  // Mehr als drei dahinter sieht man nicht.
  assert.equal(lookOf(STACK_BEHIND + 1, 0).opacity, 0);
});

test('was vorbei ist, geht ganz nach oben weg — die nächste steigt von unten nach vorn', () => {
  const passed = lookOf(0, STACK_STEP);
  assert.ok(passed.bottom <= 0, 'ganz über dem Stapel');
  assert.ok(passed.opacity < 1);
  // Die zweite lag darunter und steht jetzt vorn.
  assert.ok(lookOf(1, 0).top > 0);
  assert.equal(lookOf(1, STACK_STEP).top, 0);
});

test('Rollpositionen steigen, und der Stapel ist so hoch wie nötig', () => {
  const { inputRange } = stackFrames(2);
  assert.deepEqual([...inputRange].sort((a, b) => a - b), inputRange);
  assert.equal(stackHeight(0), STACK_CARD_HEIGHT);
  assert.equal(stackHeight(1), STACK_CARD_HEIGHT);
  assert.equal(stackHeight(3), STACK_CARD_HEIGHT + 2 * STACK_PEEK);
  assert.equal(stackHeight(9), STACK_CARD_HEIGHT + STACK_BEHIND * STACK_PEEK);
});

test('frontAt: die Karte, die beim Rollen vorn liegt', () => {
  assert.equal(frontAt(0, 5), 0);
  assert.equal(frontAt(STACK_STEP * 1.4, 5), 1);
  assert.equal(frontAt(STACK_STEP * 1.6, 5), 2);
  assert.equal(frontAt(STACK_STEP * 9, 5), 4);
  assert.equal(frontAt(-20, 5), 0);
  assert.equal(frontAt(100, 0), 0);
});
