/**
 * Der Dienst prueft den Avatar mit eigenen Listen — dieselben stehen in den
 * Apps. Dieser Test liest die Quelle der Apps und haelt beide gleich.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const {
  ACCESSORIES_OF,
  AVATAR_ACCESSORIES,
  AVATAR_COLORS,
  AVATAR_EYES,
  AVATAR_KINDS,
  isAvatarStyle,
} = require('../avatar.js');

const STYLE_SOURCE = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'packages',
  'core',
  'src',
  'features',
  'avatar',
  'style.ts',
);

const words = (text) => [...text.matchAll(/'([a-z]+)'/g)].map((match) => match[1]);

function listIn(source, name) {
  const match = new RegExp(`export const ${name} = \\[([^\\]]*)\\]`).exec(source);
  assert.ok(match, name);
  return words(match[1]);
}

function accessoriesIn(source, kind) {
  const match = new RegExp(`\\n  ${kind}: (AVATAR_ACCESSORIES|\\[[^\\]]*\\])`).exec(source);
  assert.ok(match, kind);
  return match[1] === 'AVATAR_ACCESSORIES' ? listIn(source, 'AVATAR_ACCESSORIES') : words(match[1]);
}

test('die Listen stimmen mit den Apps ueberein', () => {
  const source = fs.readFileSync(STYLE_SOURCE, 'utf8');
  assert.deepEqual(AVATAR_KINDS, listIn(source, 'AVATAR_KINDS'));
  assert.deepEqual(AVATAR_COLORS, listIn(source, 'AVATAR_COLORS'));
  assert.deepEqual(AVATAR_EYES, listIn(source, 'AVATAR_EYES'));
  assert.deepEqual(AVATAR_ACCESSORIES, listIn(source, 'AVATAR_ACCESSORIES'));
  for (const kind of AVATAR_KINDS) {
    assert.deepEqual(ACCESSORIES_OF[kind], accessoriesIn(source, kind), kind);
  }
});

test('nimmt jede gueltige Kombination an', () => {
  for (const kind of AVATAR_KINDS) {
    for (const accessory of ACCESSORIES_OF[kind]) {
      assert.ok(
        isAvatarStyle({ kind, color: 'mint', eyes: 'happy', accessory }),
        `${kind}/${accessory}`,
      );
    }
  }
});

test('weist alles andere ab', () => {
  const robot = { kind: 'robot', color: 'accent', eyes: 'round', accessory: 'antenna' };
  const invalid = [
    undefined,
    null,
    'robot',
    [robot],
    {},
    { ...robot, kind: 'Robot' },
    { ...robot, color: 'red' },
    { ...robot, eyes: '' },
    { ...robot, accessory: 42 },
    { kind: 'cat', color: 'accent', eyes: 'round', accessory: 'antenna' },
    { ...robot, __extra: true },
    { kind: 'robot', color: 'accent', eyes: 'round' },
  ];
  for (const value of invalid) {
    assert.equal(isAvatarStyle(value), false, JSON.stringify(value));
  }
  assert.equal(isAvatarStyle(robot), true);
});
