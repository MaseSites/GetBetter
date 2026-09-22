/**
 * Die Rechnung hinter dem Stapel in „Was gibt's Neues“: die Mitteilungen
 * liegen fast uebereinander, die vorderste ganz, die dahinter kleiner und
 * immer durchsichtiger — beim Rollen kommt die naechste nach vorn. Rein,
 * ohne Bildschirm, getestet.
 */

/** Jede Karte im Stapel ist gleich hoch und schmal — eine Zeile wie eine E-Mail. */
export const STACK_CARD_HEIGHT = 64;
/** So weit schaut jede Karte unter der davor hervor. */
export const STACK_PEEK = 10;
/**
 * So weit rollt man fuer die naechste Karte — genau eine Karte: die vorderste
 * geht mit dem Finger nach oben weg, die naechste steigt von unten nach.
 */
export const STACK_STEP = STACK_CARD_HEIGHT;
/** So viele Karten sind hinter der vordersten zu sehen. */
export const STACK_BEHIND = 3;

/**
 * Wie eine Karte in jeder Tiefe aussieht: −1 ist schon vorbei (ganz nach oben
 * aus dem Stapel geschoben), 0 ist vorn, 1 bis 3 liegen dahinter, 4 ist nicht
 * mehr zu sehen.
 */
const DEPTHS = [4, 3, 2, 1, 0, -1] as const;
const OPACITY: Readonly<Record<(typeof DEPTHS)[number], number>> = {
  4: 0,
  3: 0.14,
  2: 0.32,
  1: 0.58,
  0: 1,
  [-1]: 0.3,
};
const SCALE: Readonly<Record<(typeof DEPTHS)[number], number>> = {
  4: 0.82,
  3: 0.82,
  2: 0.88,
  1: 0.94,
  0: 1,
  [-1]: 1,
};

/** Wie hoch der Stapel ist: die vorderste Karte und darunter die Raender der anderen. */
export function stackHeight(count: number): number {
  return STACK_CARD_HEIGHT + STACK_PEEK * Math.min(Math.max(count - 1, 0), STACK_BEHIND);
}

/** Welche Karte bei dieser Rollposition vorn liegt. */
export function frontAt(scrollY: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(scrollY / STACK_STEP)));
}

/**
 * Wo die obere Kante einer Karte in der Tiefe `depth` im Stapel steht. Sie ist
 * um ihre Mitte verkleinert — damit ihr unterer Rand genau `STACK_PEEK` je
 * Tiefe unter der vordersten hervorschaut, rueckt sie um die halbe Schrumpfung
 * hinunter.
 */
function topOf(depth: (typeof DEPTHS)[number]): number {
  // Vorbei: ganz ueber dem Stapel, wo die Rollflaeche sie abschneidet.
  if (depth < 0) return -STACK_CARD_HEIGHT;
  const shown = Math.min(depth, STACK_BEHIND);
  return STACK_PEEK * shown + (STACK_CARD_HEIGHT * (1 - SCALE[depth])) / 2;
}

export type StackFrames = {
  /** Rollpositionen, aufsteigend. */
  inputRange: number[];
  translateY: number[];
  opacity: number[];
  scale: number[];
};

/**
 * Was die Karte `index` bei jeder Rollposition tut. Sie liegt in der
 * Rollflaeche bei `index · STACK_STEP` und rollt mit; `translateY` nimmt das
 * zurueck und stellt sie an ihren Platz im Stapel.
 */
export function stackFrames(index: number): StackFrames {
  return {
    inputRange: DEPTHS.map((depth) => (index - depth) * STACK_STEP),
    translateY: DEPTHS.map((depth) => topOf(depth) - STACK_STEP * depth),
    opacity: DEPTHS.map((depth) => OPACITY[depth]),
    scale: DEPTHS.map((depth) => SCALE[depth]),
  };
}
