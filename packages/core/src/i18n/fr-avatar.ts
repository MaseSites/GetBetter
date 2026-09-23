import type { TranslationKey } from './de';

/** Français : l’avatar (de-avatar.ts). Teil von `fr`. */
export const frAvatar = {
  'avatar.title': 'Avatar',
  'avatar.hint': 'Voici l’apparence de ton assistant — la même dans toutes les apps Better.',

  'avatar.kind': 'Personnage',
  'avatar.kind.robot': 'Robot',
  'avatar.kind.blob': 'Boule',
  'avatar.kind.cat': 'Chat',
  'avatar.kind.owl': 'Hibou',
  'avatar.kind.ghost': 'Fantôme',

  'avatar.color': 'Couleur',
  'avatar.color.accent': 'Comme l’app',
  'avatar.color.sky': 'Bleu ciel',
  'avatar.color.violet': 'Violet',
  'avatar.color.coral': 'Corail',
  'avatar.color.sun': 'Jaune soleil',
  'avatar.color.mint': 'Menthe',
  'avatar.color.berry': 'Baie',
  'avatar.color.stone': 'Pierre',
  'avatar.color.a11y': 'Couleur {color}',
  'avatar.color.mono': 'En noir et blanc, il ne porte pas de couleur.',

  'avatar.eyes': 'Yeux',
  'avatar.eyes.round': 'Ronds',
  'avatar.eyes.happy': 'Joyeux',
  'avatar.eyes.sleepy': 'Endormis',
  'avatar.eyes.sparkle': 'Pétillants',
  'avatar.eyes.a11y': 'Yeux : {eyes}',

  'avatar.accessory': 'Accessoire',
  'avatar.accessory.none': 'Aucun',
  'avatar.accessory.antenna': 'Antenne',
  'avatar.accessory.hat': 'Chapeau',
  'avatar.accessory.glasses': 'Lunettes',
  'avatar.accessory.bow': 'Nœud',
  'avatar.accessory.a11y': 'Accessoire : {accessory}',

  'avatar.selected': '{label}, choisi',

} as const satisfies Partial<Record<TranslationKey, string>>;
