import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ACCESSORIES_OF,
  AVATAR_ACCESSORIES,
  AVATAR_COLORS,
  AVATAR_EYES,
  AVATAR_KINDS,
  DEFAULT_AVATAR,
  avatarShapeKey,
  defaultAccessoryOf,
  isAccessoryOf,
  normalizeAvatar,
  sameAvatar,
  withAvatarChange,
} from './style';

test('der Standard ist der Roboter mit Antenne in der Farbe der App', () => {
  assert.deepEqual(DEFAULT_AVATAR, {
    kind: 'robot',
    color: 'accent',
    eyes: 'round',
    accessory: 'antenna',
  });
  assert.ok(isAccessoryOf(DEFAULT_AVATAR.kind, DEFAULT_AVATAR.accessory));
});

test('es gibt mindestens fuenf Figuren, acht Farben, vier Augen und fuenf Zubehoere', () => {
  assert.ok(AVATAR_KINDS.length >= 5);
  assert.equal(AVATAR_COLORS.length, 8);
  assert.equal(AVATAR_EYES.length, 4);
  assert.equal(AVATAR_ACCESSORIES.length, 5);
});

test('jede Figur kann ohne Zubehoer und traegt ihr Standard-Zubehoer', () => {
  for (const kind of AVATAR_KINDS) {
    assert.ok(ACCESSORIES_OF[kind].includes('none'), kind);
    assert.ok(isAccessoryOf(kind, defaultAccessoryOf(kind)), kind);
  }
  assert.equal(isAccessoryOf('cat', 'antenna'), false);
  assert.equal(isAccessoryOf('owl', 'antenna'), false);
});

test('ohne gueltigen Wert gilt der Standard', () => {
  for (const value of [undefined, null, 'robot', 42, [], ['cat']]) {
    assert.deepEqual(normalizeAvatar(value), DEFAULT_AVATAR);
  }
  assert.deepEqual(normalizeAvatar({}), DEFAULT_AVATAR);
});

test('liest einen vollstaendigen Avatar unveraendert', () => {
  const owl = { kind: 'owl', color: 'sun', eyes: 'sparkle', accessory: 'glasses' } as const;
  assert.deepEqual(normalizeAvatar(owl), owl);
});

test('ersetzt nur die Felder, die nicht passen', () => {
  assert.deepEqual(normalizeAvatar({ kind: 'cat', color: 'pink', eyes: 'happy' }), {
    kind: 'cat',
    color: 'accent',
    eyes: 'happy',
    accessory: 'none',
  });
  assert.deepEqual(normalizeAvatar({ kind: 'dragon', color: 'mint', eyes: 7, accessory: 'hat' }), {
    kind: 'robot',
    color: 'mint',
    eyes: 'round',
    accessory: 'hat',
  });
});

test('ein Zubehoer, das die Figur nicht tragen kann, weicht ihrem Standard', () => {
  assert.equal(normalizeAvatar({ kind: 'cat', accessory: 'antenna' }).accessory, 'none');
  assert.equal(normalizeAvatar({ kind: 'robot', accessory: 'crown' }).accessory, 'antenna');
  assert.equal(normalizeAvatar({ kind: 'ghost', accessory: 'antenna' }).accessory, 'antenna');
});

test('ueberzaehlige Felder fallen weg', () => {
  const read = normalizeAvatar({ ...DEFAULT_AVATAR, size: 3, script: '<b>' });
  assert.deepEqual(Object.keys(read).sort(), ['accessory', 'color', 'eyes', 'kind']);
  assert.deepEqual(read, DEFAULT_AVATAR);
});

test('ein Wechsel der Figur behaelt, was passt', () => {
  const catWithHat = withAvatarChange(DEFAULT_AVATAR, { kind: 'cat', accessory: 'hat' });
  assert.equal(catWithHat.accessory, 'hat');
  assert.equal(withAvatarChange(catWithHat, { kind: 'robot' }).accessory, 'hat');
  assert.equal(withAvatarChange(DEFAULT_AVATAR, { kind: 'owl' }).accessory, 'none');
  assert.equal(withAvatarChange(DEFAULT_AVATAR, { color: 'berry' }).color, 'berry');
  // Unveraenderlich: das Original bleibt, wie es war.
  assert.equal(DEFAULT_AVATAR.kind, 'robot');
});

test('die Form haengt nicht an der Farbe', () => {
  const berry = withAvatarChange(DEFAULT_AVATAR, { color: 'berry' });
  assert.equal(avatarShapeKey(berry), avatarShapeKey(DEFAULT_AVATAR));
  assert.equal(sameAvatar(berry, DEFAULT_AVATAR), false);
  assert.equal(sameAvatar(normalizeAvatar({ ...berry }), berry), true);
  assert.notEqual(
    avatarShapeKey(withAvatarChange(DEFAULT_AVATAR, { eyes: 'happy' })),
    avatarShapeKey(DEFAULT_AVATAR),
  );
});
