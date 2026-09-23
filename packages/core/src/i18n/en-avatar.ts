import type { TranslationKey } from './de';

/** Englisch: der Avatar (de-avatar.ts). Teil von `en`. */
export const enAvatar = {
  'avatar.title': 'Avatar',
  'avatar.hint': 'This is how your assistant looks — the same in all Better apps.',

  'avatar.kind': 'Character',
  'avatar.kind.robot': 'Robot',
  'avatar.kind.blob': 'Blob',
  'avatar.kind.cat': 'Cat',
  'avatar.kind.owl': 'Owl',
  'avatar.kind.ghost': 'Ghost',

  'avatar.color': 'Colour',
  'avatar.color.accent': 'Like the app',
  'avatar.color.sky': 'Sky blue',
  'avatar.color.violet': 'Violet',
  'avatar.color.coral': 'Coral',
  'avatar.color.sun': 'Sunny yellow',
  'avatar.color.mint': 'Mint',
  'avatar.color.berry': 'Berry',
  'avatar.color.stone': 'Stone',
  'avatar.color.a11y': 'Colour {color}',
  'avatar.color.mono': 'In black and white, it wears no colour.',

  'avatar.eyes': 'Eyes',
  'avatar.eyes.round': 'Round',
  'avatar.eyes.happy': 'Happy',
  'avatar.eyes.sleepy': 'Sleepy',
  'avatar.eyes.sparkle': 'Sparkly',
  'avatar.eyes.a11y': 'Eyes: {eyes}',

  'avatar.accessory': 'Accessory',
  'avatar.accessory.none': 'None',
  'avatar.accessory.antenna': 'Antenna',
  'avatar.accessory.hat': 'Hat',
  'avatar.accessory.glasses': 'Glasses',
  'avatar.accessory.bow': 'Bow',
  'avatar.accessory.a11y': 'Accessory: {accessory}',

  'avatar.selected': '{label}, selected',

} as const satisfies Partial<Record<TranslationKey, string>>;
