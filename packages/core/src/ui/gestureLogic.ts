/**
 * Die Entscheidungen hinter den Gesten, ohne React Native: wohin eine Zeile
 * nach dem Loslassen geht und welche Hoehe ein Blatt einnimmt. So lassen sie
 * sich unter Node pruefen, und `SwipeRow` und `Sheet` bleiben schlank.
 */

// ------------------------------------------------------------ Zeilen

export type SwipeRelease = 'leading' | 'trailingFull' | 'openTrailing' | 'close';

export type SwipeSide = 'leading' | 'trailing';

export type SwipeReleaseInput = {
  /** Verschiebung beim Loslassen, negativ nach links. */
  x: number;
  /** Geschwindigkeit in Punkten pro Millisekunde, negativ nach links. */
  vx: number;
  /** Breite der Zeile. */
  width: number;
  /** Breite der Knoepfe, die ein halber Wisch nach links zeigt; 0 ohne Knoepfe. */
  trailingWidth: number;
  hasLeading: boolean;
  hasTrailingFull: boolean;
  /** Ab diesem Anteil der Breite loest ein Wisch ohne weiteren Tipp aus. */
  fullShare: number;
  flingVelocity: number;
};

/** Ein schneller Wisch nach rechts zaehlt ab diesem Anteil wie ein voller. */
const LEADING_FLING_SHARE = 0.35;
/** Ohne Knoepfe muss ein schneller Wisch nach links mindestens so weit gehen. */
const TRAILING_FLING_SHARE = 0.25;

/** Was nach dem Loslassen passiert. */
export function resolveSwipeRelease(input: SwipeReleaseInput): SwipeRelease {
  const { x, vx, width, trailingWidth, fullShare, flingVelocity } = input;

  if (x > 0) {
    if (!input.hasLeading) return 'close';
    const far = x > width * fullShare;
    const flung = vx > flingVelocity * 2 && x > width * LEADING_FLING_SHARE;
    return far || flung ? 'leading' : 'close';
  }

  if (input.hasTrailingFull) {
    const far = x < -width * fullShare;
    const minimum = Math.max(trailingWidth, width * TRAILING_FLING_SHARE);
    const flung = vx < -flingVelocity * 2 && x < -minimum;
    if (far || flung) return 'trailingFull';
  }

  if (trailingWidth > 0 && (x < -trailingWidth / 2 || vx < -flingVelocity)) return 'openTrailing';
  return 'close';
}

/** Welche Seite gerade so weit gezogen ist, dass Loslassen ausloest. */
export function armedSide(
  x: number,
  width: number,
  fullShare: number,
  hasLeading: boolean,
  hasTrailingFull: boolean,
): SwipeSide | null {
  if (hasLeading && x > width * fullShare) return 'leading';
  if (hasTrailingFull && x < -width * fullShare) return 'trailing';
  return null;
}

// ------------------------------------------------------------ Blaetter

export type SheetDetent = 'medium' | 'large';

export type SheetReleaseInput = {
  /** Wo das Blatt beim Anfassen stand. */
  detent: SheetDetent;
  /** Zug seit dem Anfassen, positiv nach unten. */
  dy: number;
  vy: number;
  /** Wie weit „mittel“ unter „gross“ steht. */
  mediumOffset: number;
  dismissDistance: number;
  flingVelocity: number;
};

/** Wie weit ein Blatt in dieser Hoehe nach unten verschoben ist. */
export function detentOffset(detent: SheetDetent, mediumOffset: number): number {
  return detent === 'medium' ? mediumOffset : 0;
}

/**
 * Gross → mittel → zu. Nach oben geht es immer auf gross. Ein schneller Wisch
 * nach unten nimmt eine Stufe, ein langer Zug ueber „mittel“ hinaus schliesst.
 */
export function resolveSheetRelease(input: SheetReleaseInput): SheetDetent | 'close' {
  const { detent, dy, vy, mediumOffset, dismissDistance, flingVelocity } = input;
  const position = detentOffset(detent, mediumOffset) + dy;

  if (position > mediumOffset + dismissDistance) return 'close';
  if (vy > flingVelocity) return detent === 'large' ? 'medium' : 'close';
  if (vy < -flingVelocity) return 'large';
  if (detent === 'large') return dy > dismissDistance ? 'medium' : 'large';
  return dy < -dismissDistance / 2 ? 'large' : 'medium';
}
