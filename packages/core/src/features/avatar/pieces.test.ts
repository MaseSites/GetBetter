import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AVATAR_CANVAS } from '../intro/avatarPieces';
import { avatarPiecesOf } from './pieces';
import {
  ACCESSORIES_OF,
  AVATAR_EYES,
  AVATAR_KINDS,
  DEFAULT_AVATAR,
  type AvatarStyle,
} from './style';

/** Jede Form, die man waehlen kann. Die Farbe aendert keine Stuecke. */
function everyShape(): AvatarStyle[] {
  return AVATAR_KINDS.flatMap((kind) =>
    AVATAR_EYES.flatMap((eyes) =>
      ACCESSORIES_OF[kind].map((accessory) => ({
        kind,
        eyes,
        accessory,
        color: 'accent' as const,
      })),
    ),
  );
}

const label = (style: AvatarStyle) => `${style.kind}/${style.eyes}/${style.accessory}`;

test('der Roboter von Anfang an hat seine 44 Stuecke', () => {
  assert.equal(avatarPiecesOf(DEFAULT_AVATAR).length, 44);
});

test('jede Form besteht aus 25 bis 50 Stuecken mit eigener Id', () => {
  for (const style of everyShape()) {
    const pieces = avatarPiecesOf(style);
    assert.ok(pieces.length >= 25 && pieces.length <= 50, `${label(style)}: ${pieces.length}`);
    assert.equal(new Set(pieces.map((piece) => piece.id)).size, pieces.length, label(style));
  }
});

test('jedes Stueck sitzt am Ende auf der Leinwand und kommt rechtzeitig an', () => {
  for (const style of everyShape()) {
    for (const piece of avatarPiecesOf(style)) {
      const where = `${label(style)} ${piece.id}`;
      assert.ok(piece.x >= 0 && piece.y >= 0, where);
      assert.ok(piece.x + piece.width <= AVATAR_CANVAS, where);
      assert.ok(piece.y + piece.height <= AVATAR_CANVAS, where);
      assert.ok(piece.width > 0 && piece.height > 0, where);
      assert.ok(piece.wave >= 0 && piece.wave <= 1, where);
    }
  }
});

test('jede Form hat zwei blinzelnde Augen und Funken', () => {
  for (const style of everyShape()) {
    const pieces = avatarPiecesOf(style);
    const eyes = pieces.filter((piece) => piece.blink === 'eye');
    assert.ok(
      eyes.some((piece) => piece.id.startsWith('eye-left')),
      label(style),
    );
    assert.ok(
      eyes.some((piece) => piece.id.startsWith('eye-right')),
      label(style),
    );
    assert.equal(pieces.filter((piece) => piece.layer === 'spark').length, 8, label(style));
  }
});

test('ein Zubehoer bringt seine Stuecke mit, ohne Zubehoer gibt es keine', () => {
  const plain = avatarPiecesOf({ ...DEFAULT_AVATAR, accessory: 'none' });
  assert.ok(!plain.some((piece) => /^(antenna|hat|glasses|bow)-/.test(piece.id)));
  for (const accessory of ['antenna', 'hat', 'glasses', 'bow'] as const) {
    const pieces = avatarPiecesOf({ ...DEFAULT_AVATAR, accessory });
    assert.ok(
      pieces.some((piece) => piece.id.startsWith(`${accessory}-`)),
      accessory,
    );
  }
  const glasses = avatarPiecesOf({ ...DEFAULT_AVATAR, accessory: 'glasses' });
  assert.ok(glasses.some((piece) => (piece.outline ?? 0) > 0));
});

test('das Gesicht liegt vor dem Koerper: Schild vor den Augen', () => {
  for (const style of everyShape()) {
    const pieces = avatarPiecesOf(style);
    const firstEye = pieces.findIndex((piece) => piece.blink === 'eye');
    const plates = pieces.filter((piece) => piece.tone === 'plate');
    for (const plate of plates) {
      assert.ok(pieces.indexOf(plate) < firstEye, label(style));
    }
  }
});

test('dieselbe Form wird nur einmal gerechnet, die Farbe zaehlt dabei nicht', () => {
  const first = avatarPiecesOf(DEFAULT_AVATAR);
  assert.equal(avatarPiecesOf({ ...DEFAULT_AVATAR, color: 'berry' }), first);
  assert.notEqual(avatarPiecesOf({ ...DEFAULT_AVATAR, kind: 'owl', accessory: 'none' }), first);
});
