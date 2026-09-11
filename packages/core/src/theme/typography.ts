import { Platform, type TextStyle } from 'react-native';

/**
 * Schriftgrössen-Skala. Keine anderen Grössen im Code verwenden.
 *
 * Sieben Stufen von 11 bis 56. Der grosse Sprung nach oben ist Absicht: eine
 * Kalorienzahl, ein Kontostand oder die nächste Uhrzeit soll man sehen, ohne
 * sie zu suchen. Bis 28 herauf sieht in einer Liste alles gleich wichtig aus.
 */
export const fontSize = {
  /** Beschriftung in der Leiste. */
  micro: 10,
  xs: 11,
  /** Uhrzeiten im Tagesband, Datum ueber der Begruessung. */
  caption: 12,
  sm: 13,
  /** Der eine Satz unter einer Ueberschrift. */
  lede: 14,
  md: 15,
  lg: 20,
  /** Die Zahl in einer Kachel. */
  stat: 22,
  xl: 28,
  /** Titel eines Bereichs. */
  title: 30,
  /** Bildschirmtitel und Begrüssung. */
  display: 34,
  /** Die eine Zahl, um die es auf dem Bildschirm geht. */
  hero: 56,
} as const;

export const lineHeight = {
  micro: 12,
  xs: 14,
  caption: 16,
  sm: 18,
  lede: 20,
  md: 21,
  lg: 26,
  stat: 24,
  xl: 32,
  title: 32,
  display: 36,
  hero: 54,
} as const;

/**
 * Laufweite in Pixeln — je grösser die Schrift, desto enger.
 * `caps` gilt für Grossbuchstaben-Marken, die brauchen umgekehrt mehr Luft.
 */
export const tracking = {
  hero: -2.5,
  display: -0.8,
  title: -0.4,
  body: -0.1,
  none: 0,
  caps: 1.2,
  /** Herkunft rechts im Tagesband. */
  tag: 0.5,
  /** Beschriftung einer Zahlenkachel. */
  label: 0.8,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

/**
 * Zwei Schriften: eine für Zahlen und Titel, eine fürs Lesen.
 *
 * Im Browser kommen sie über `app/html.tsx` von Google Fonts. Auf dem Gerät
 * fehlen sie noch — dort greift die Systemschrift, bis die Dateien mit
 * `expo-font` gebündelt sind. Beide stehen unter der Open Font License.
 */
export const fontFamily = Platform.select({
  web: '"Instrument Sans", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  default: undefined,
});

/** Für Zahlen, Titel und alles, was auffallen soll. */
export const fontFamilyDisplay = Platform.select({
  web: '"Bricolage Grotesque", "Instrument Sans", system-ui, -apple-system, sans-serif',
  default: undefined,
});

/**
 * Ziffern gleicher Breite. Ohne das springen Werte in Listen und Zähler beim
 * Aktualisieren hin und her.
 */
export const numeric: { fontVariant: TextStyle['fontVariant'] } = {
  fontVariant: ['tabular-nums'],
};

export type FontSizeKey = keyof typeof fontSize;
export type TrackingKey = keyof typeof tracking;
