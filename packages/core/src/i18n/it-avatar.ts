import type { TranslationKey } from './de';

/** Italiano: l’avatar (de-avatar.ts). Teil von `it`. */
export const itAvatar = {
  'avatar.title': 'Avatar',
  'avatar.hint': 'Ecco l’aspetto del tuo assistente — uguale in tutte le app Better.',

  'avatar.kind': 'Personaggio',
  'avatar.kind.robot': 'Robot',
  'avatar.kind.blob': 'Gommino',
  'avatar.kind.cat': 'Gatto',
  'avatar.kind.owl': 'Gufo',
  'avatar.kind.ghost': 'Fantasma',

  'avatar.color': 'Colore',
  'avatar.color.accent': 'Come l’app',
  'avatar.color.sky': 'Azzurro',
  'avatar.color.violet': 'Viola',
  'avatar.color.coral': 'Corallo',
  'avatar.color.sun': 'Giallo sole',
  'avatar.color.mint': 'Menta',
  'avatar.color.berry': 'Frutti di bosco',
  'avatar.color.stone': 'Pietra',
  'avatar.color.a11y': 'Colore {color}',
  'avatar.color.mono': 'In bianco e nero non porta colori.',

  'avatar.eyes': 'Occhi',
  'avatar.eyes.round': 'Tondi',
  'avatar.eyes.happy': 'Allegri',
  'avatar.eyes.sleepy': 'Assonnati',
  'avatar.eyes.sparkle': 'Scintillanti',
  'avatar.eyes.a11y': 'Occhi: {eyes}',

  'avatar.accessory': 'Accessorio',
  'avatar.accessory.none': 'Nessuno',
  'avatar.accessory.antenna': 'Antenna',
  'avatar.accessory.hat': 'Cappello',
  'avatar.accessory.glasses': 'Occhiali',
  'avatar.accessory.bow': 'Fiocco',
  'avatar.accessory.a11y': 'Accessorio: {accessory}',

  'avatar.selected': '{label}, selezionato',

} as const satisfies Partial<Record<TranslationKey, string>>;
