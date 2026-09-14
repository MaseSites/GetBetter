/**
 * Die Bausteine des Avatars: ein Stueck auf einer Leinwand von 100 × 100, und
 * woher es angeflogen kommt. Hier steht nur Rechnung — keine Farbe, kein React.
 * Welche Stuecke eine Figur hat, steht in `features/avatar/`; `ClubAvatar`
 * setzt die Toene aus dem Thema ein, damit der Avatar jede Einstellung sofort
 * mitmacht.
 */

export const AVATAR_CANVAS = 100;

/** Hinten der Koerper, davor das Gesicht (es wandert beim Drehen etwas mit), aussen die Funken. */
export type PieceLayer = 'back' | 'face' | 'spark';

/**
 * Welche Rolle ein Stueck hat. Die Farbe dazu rechnet `avatarTones` aus der
 * gewaehlten Farbe und dem Thema aus.
 *
 * - `plate`/`eye`/`glint` — Schild oder Gesichtsscheibe und was darauf steht
 * - `ink`/`inkGlint`      — Augen und Mund direkt auf dem Koerper
 */
export type PieceTone =
  | 'body'
  | 'bodyAlt'
  | 'plate'
  | 'eye'
  | 'glint'
  | 'ink'
  | 'inkGlint'
  | 'cheek'
  | 'shine'
  | 'pattern'
  | 'beak'
  | 'stalk'
  | 'bulb'
  | 'hat'
  | 'band'
  | 'bow'
  | 'bowKnot'
  | 'organisation'
  | 'health'
  | 'household'
  | 'money'
  | 'ai'
  | 'accent';

/** Eckenradien: oben links, oben rechts, unten rechts, unten links. */
export type Corners = readonly [number, number, number, number];

export type AvatarPiece = {
  id: string;
  layer: PieceLayer;
  tone: PieceTone;
  x: number;
  y: number;
  width: number;
  height: number;
  corners: Corners;
  /** Drehung am Ziel, in Grad. */
  rotate: number;
  /** Wann das Stueck ankommt: 0 zuerst, 1 zuletzt. */
  wave: number;
  /** Augen schliessen sich beim Blinzeln, der Glanzpunkt verschwindet dabei. */
  blink?: 'eye' | 'glint';
  /** Nur ein Rand dieser Breite statt einer Flaeche — etwa die Brillenglaeser. */
  outline?: number;
};

export type Scatter = { dx: number; dy: number; rotate: number; scale: number };

/** Goldener Winkel: so verteilen sich die Startpunkte gleichmaessig rundherum. */
const GOLDEN_ANGLE = 137.508;

/**
 * Woher ein Stueck angeflogen kommt — aus dem Index gerechnet, also bei jedem
 * Start gleich. Zufall im Rendern wuerde bei jedem Neuzeichnen springen.
 */
export function scatterOf(index: number): Scatter {
  const angle = ((index * GOLDEN_ANGLE + 30) % 360) * (Math.PI / 180);
  const distance = 58 + ((index * 37) % 46);
  return {
    dx: Math.round(Math.cos(angle) * distance * 10) / 10,
    dy: Math.round(Math.sin(angle) * distance * 10) / 10,
    rotate: ((index * 83) % 241) - 120,
    scale: 0.3 + ((index * 17) % 41) / 100,
  };
}

/** Wie lange ein Stueck wartet, bis es losfliegt, damit alle bis `totalMs` sitzen. */
export function arrivalDelay(wave: number, totalMs: number, flightMs: number): number {
  const share = Math.min(1, Math.max(0, wave));
  return Math.round(share * Math.max(0, totalMs - flightMs));
}

function channels(hex: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return null;
  const [, red = '0', green = '0', blue = '0'] = match;
  return [parseInt(red, 16), parseInt(green, 16), parseInt(blue, 16)];
}

/** Zwei Farben `#RRGGBB` mischen. Was keine solche Farbe ist, bleibt, wie es ist. */
export function mixHex(from: string, to: string, amount: number): string {
  const a = channels(from);
  const b = channels(to);
  if (!a || !b) return from;
  const share = Math.min(1, Math.max(0, amount));
  const mixed = a.map((value, index) => Math.round(value + ((b[index] ?? value) - value) * share));
  return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}
