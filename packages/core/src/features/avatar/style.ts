/**
 * Wie der Avatar aussieht: welche Figur, welche Farbe, welche Augen und was er
 * traegt. Liegt am Konto (`assistantAvatar`) und gilt damit in allen Apps.
 *
 * Reine Rechnung ohne React. Dieselben Werte stehen im Dienst
 * (`services/api/avatar.js`) — der prueft beim Speichern, hier wird nur
 * tolerant gelesen.
 */

export const AVATAR_KINDS = ['robot', 'blob', 'cat', 'owl', 'ghost'] as const;
export type AvatarKind = (typeof AVATAR_KINDS)[number];

/** `accent` folgt der Akzentfarbe der App, die anderen sind feste Toene. */
export const AVATAR_COLORS = [
  'accent',
  'sky',
  'violet',
  'coral',
  'sun',
  'mint',
  'berry',
  'stone',
] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

export const AVATAR_EYES = ['round', 'happy', 'sleepy', 'sparkle'] as const;
export type AvatarEyes = (typeof AVATAR_EYES)[number];

export const AVATAR_ACCESSORIES = ['none', 'antenna', 'hat', 'glasses', 'bow'] as const;
export type AvatarAccessory = (typeof AVATAR_ACCESSORIES)[number];

export type AvatarStyle = Readonly<{
  kind: AvatarKind;
  color: AvatarColor;
  eyes: AvatarEyes;
  accessory: AvatarAccessory;
}>;

/**
 * Was zu welcher Figur passt. Katze und Eule haben oben schon Ohren und
 * Federbueschel — eine Antenne dazwischen saehe verloren aus.
 */
export const ACCESSORIES_OF: Readonly<Record<AvatarKind, readonly AvatarAccessory[]>> = {
  robot: AVATAR_ACCESSORIES,
  blob: AVATAR_ACCESSORIES,
  cat: ['none', 'hat', 'glasses', 'bow'],
  owl: ['none', 'hat', 'glasses', 'bow'],
  ghost: AVATAR_ACCESSORIES,
};

/** Der Roboter kam mit Antenne auf die Welt; alle anderen ohne etwas. */
const DEFAULT_ACCESSORY: Readonly<Record<AvatarKind, AvatarAccessory>> = {
  robot: 'antenna',
  blob: 'none',
  cat: 'none',
  owl: 'none',
  ghost: 'none',
};

/** Der Avatar von Anfang an: der Roboter in der Farbe der App. */
export const DEFAULT_AVATAR: AvatarStyle = {
  kind: 'robot',
  color: 'accent',
  eyes: 'round',
  accessory: 'antenna',
};

function oneOf<T extends string>(options: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (options as readonly string[]).includes(value);
}

export function isAccessoryOf(kind: AvatarKind, accessory: AvatarAccessory): boolean {
  return ACCESSORIES_OF[kind].includes(accessory);
}

export function defaultAccessoryOf(kind: AvatarKind): AvatarAccessory {
  return DEFAULT_ACCESSORY[kind];
}

/**
 * Liest, was am Konto steht — auch Altes oder Kaputtes. Was fehlt oder nicht
 * passt, nimmt je Feld den Standard; ein Zubehoer, das die Figur nicht tragen
 * kann, das der Figur.
 */
export function normalizeAvatar(value: unknown): AvatarStyle {
  const raw =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const kind = oneOf(AVATAR_KINDS, raw.kind) ? raw.kind : DEFAULT_AVATAR.kind;
  const accessory =
    oneOf(AVATAR_ACCESSORIES, raw.accessory) && isAccessoryOf(kind, raw.accessory)
      ? raw.accessory
      : defaultAccessoryOf(kind);
  return {
    kind,
    color: oneOf(AVATAR_COLORS, raw.color) ? raw.color : DEFAULT_AVATAR.color,
    eyes: oneOf(AVATAR_EYES, raw.eyes) ? raw.eyes : DEFAULT_AVATAR.eyes,
    accessory,
  };
}

/**
 * Eine Wahl uebernehmen und dabei gueltig bleiben: wer von der Katze mit Hut
 * zum Roboter wechselt, behaelt den Hut; die Antenne des Roboters faellt bei
 * der Katze weg.
 */
export function withAvatarChange(style: AvatarStyle, change: Partial<AvatarStyle>): AvatarStyle {
  return normalizeAvatar({ ...style, ...change });
}

/** Alles, was die Form bestimmt — die Farbe setzt der Avatar erst beim Zeichnen ein. */
export function avatarShapeKey(style: AvatarStyle): string {
  return `${style.kind}/${style.eyes}/${style.accessory}`;
}

export function sameAvatar(a: AvatarStyle, b: AvatarStyle): boolean {
  return (
    a.kind === b.kind && a.color === b.color && a.eyes === b.eyes && a.accessory === b.accessory
  );
}
