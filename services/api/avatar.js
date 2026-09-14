/**
 * Wie ein Avatar aussehen darf. Dieselben Werte stehen in den Apps
 * (`packages/core/src/features/avatar/style.ts`); `test/avatar.test.js`
 * haelt beide gleich.
 *
 * Die Apps lesen tolerant — hier wird streng geprueft: nur die vier Felder,
 * nur bekannte Werte, und nur Zubehoer, das die Figur tragen kann.
 */
const AVATAR_KINDS = ['robot', 'blob', 'cat', 'owl', 'ghost'];
const AVATAR_COLORS = ['accent', 'sky', 'violet', 'coral', 'sun', 'mint', 'berry', 'stone'];
const AVATAR_EYES = ['round', 'happy', 'sleepy', 'sparkle'];
const AVATAR_ACCESSORIES = ['none', 'antenna', 'hat', 'glasses', 'bow'];

const ACCESSORIES_OF = {
  robot: AVATAR_ACCESSORIES,
  blob: AVATAR_ACCESSORIES,
  cat: ['none', 'hat', 'glasses', 'bow'],
  owl: ['none', 'hat', 'glasses', 'bow'],
  ghost: AVATAR_ACCESSORIES,
};

const AVATAR_FIELDS = ['kind', 'color', 'eyes', 'accessory'];

function isAvatarStyle(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== AVATAR_FIELDS.length) return false;
  if (!keys.every((key) => AVATAR_FIELDS.includes(key))) return false;
  if (!AVATAR_KINDS.includes(value.kind)) return false;
  if (!AVATAR_COLORS.includes(value.color)) return false;
  if (!AVATAR_EYES.includes(value.eyes)) return false;
  return ACCESSORIES_OF[value.kind].includes(value.accessory);
}

module.exports = {
  ACCESSORIES_OF,
  AVATAR_ACCESSORIES,
  AVATAR_COLORS,
  AVATAR_EYES,
  AVATAR_KINDS,
  isAvatarStyle,
};
