import { Easing } from 'react-native';

/**
 * Bewegung ist kurz, oder sie ist nicht da.
 *
 * Drei Regeln, die den Unterschied machen:
 * - `ease-in` ist verboten. Es fängt langsam an, genau dort schaut man hin,
 *   und die App fühlt sich träge an — auch wenn sie gleich schnell ist.
 * - Was über die Tastatur oder einen Kurzbefehl passiert, animiert nie. Das
 *   sieht man hundertmal am Tag, jede Animation wird dabei zur Bremse.
 * - Rausgehen ist schneller als reingehen. Die Entscheidung darf dauern, die
 *   Antwort darauf nicht.
 */
export const duration = {
  /** Knopfdruck — muss sofort spürbar sein. */
  press: 160,
  /** Zeile, Chip, Farbwechsel. */
  hover: 140,
  /** Menü, Auswahl, kleines Aufklappen. */
  reveal: 200,
  /** Blatt, Dialog, Bildschirmwechsel. */
  sheet: 240,
  /** Alles, was raus geht. */
  exit: 180,
} as const;

/** Kräftiger als das eingebaute `ease-out`, das ist zu zaghaft. */
export const easing = {
  out: Easing.bezier(0.23, 1, 0.32, 1),
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
  linear: Easing.linear,
} as const;

/** Wie stark ein Element beim Drücken nachgibt. */
export const pressScale = {
  /** Knöpfe und Karten. */
  button: 0.97,
  /** Ganze Zeilen — die sind gross, da reicht weniger. */
  row: 0.99,
} as const;

export type DurationKey = keyof typeof duration;
