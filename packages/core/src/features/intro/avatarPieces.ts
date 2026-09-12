/**
 * Der Club-Avatar als Bauplan: ein freundlicher Kopf aus 44 Stuecken auf einer
 * Leinwand von 100 × 100. Hier steht nur Rechnung — keine Farbe, kein React.
 * `ClubAvatar` setzt die Toene aus dem Thema ein, damit der Avatar jede
 * Einstellung sofort mitmacht.
 */

export const AVATAR_CANVAS = 100;

/** Hinten der Kopf, davor das Gesicht (es wandert beim Drehen etwas mit), aussen die Funken. */
export type PieceLayer = 'back' | 'face' | 'spark';

export type PieceTone =
  | 'head'
  | 'headAlt'
  | 'visor'
  | 'eye'
  | 'glint'
  | 'cheek'
  | 'smile'
  | 'stalk'
  | 'bulb'
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
};

function round(corner: number): Corners {
  return [corner, corner, corner, corner];
}

const HEAD = {
  x: 18,
  y: 24,
  width: 64,
  height: 58,
  cols: 4,
  rows: 4,
  gap: 2,
  inner: 3.5,
  outer: 9,
};

/** Der Kopf als Mosaik: 4 × 4 Kacheln, aussen rund, von aussen nach innen gelegt. */
function headTiles(): AvatarPiece[] {
  const tileWidth = (HEAD.width - HEAD.gap * (HEAD.cols - 1)) / HEAD.cols;
  const tileHeight = (HEAD.height - HEAD.gap * (HEAD.rows - 1)) / HEAD.rows;
  const midCol = (HEAD.cols - 1) / 2;
  const midRow = (HEAD.rows - 1) / 2;
  const farthest = Math.hypot(midCol, midRow);
  const tiles: AvatarPiece[] = [];

  for (let row = 0; row < HEAD.rows; row += 1) {
    for (let col = 0; col < HEAD.cols; col += 1) {
      const top = row === 0;
      const bottom = row === HEAD.rows - 1;
      const left = col === 0;
      const right = col === HEAD.cols - 1;
      const closeness = 1 - Math.hypot(col - midCol, row - midRow) / farthest;
      tiles.push({
        id: `tile-${row}-${col}`,
        layer: 'back',
        tone: (row + col) % 2 === 0 ? 'head' : 'headAlt',
        x: HEAD.x + col * (tileWidth + HEAD.gap),
        y: HEAD.y + row * (tileHeight + HEAD.gap),
        width: tileWidth,
        height: tileHeight,
        corners: [
          top && left ? HEAD.outer : HEAD.inner,
          top && right ? HEAD.outer : HEAD.inner,
          bottom && right ? HEAD.outer : HEAD.inner,
          bottom && left ? HEAD.outer : HEAD.inner,
        ],
        rotate: 0,
        wave: 0.3 * closeness + ((row * HEAD.cols + col) % 3) * 0.02,
      });
    }
  }
  return tiles;
}

const SMILE = { cx: 50, cy: 56, radius: 8, dot: 3.2, count: 7, from: 25, to: 155 };

/** Das Laecheln aus Punkten auf einem Bogen, von links nach rechts gelegt. */
function smileDots(): AvatarPiece[] {
  return Array.from({ length: SMILE.count }, (_, index) => {
    const share = index / (SMILE.count - 1);
    const angle = ((SMILE.from + share * (SMILE.to - SMILE.from)) * Math.PI) / 180;
    return {
      id: `smile-${index}`,
      layer: 'face' as const,
      tone: 'smile' as const,
      x: SMILE.cx + Math.cos(angle) * SMILE.radius - SMILE.dot / 2,
      y: SMILE.cy + Math.sin(angle) * SMILE.radius - SMILE.dot / 2,
      width: SMILE.dot,
      height: SMILE.dot,
      corners: round(SMILE.dot / 2),
      rotate: 0,
      wave: 0.62 + share * 0.24,
    };
  });
}

function spark(
  id: string,
  tone: PieceTone,
  x: number,
  y: number,
  size: number,
  shape: 'diamond' | 'dot',
  wave: number,
): AvatarPiece {
  return {
    id,
    layer: 'spark',
    tone,
    x,
    y,
    width: size,
    height: size,
    corners: round(shape === 'dot' ? size / 2 : size / 4),
    rotate: shape === 'diamond' ? 45 : 0,
    wave,
  };
}

function buildPieces(): readonly AvatarPiece[] {
  const back: AvatarPiece[] = [
    {
      id: 'body',
      layer: 'back',
      tone: 'head',
      x: 24,
      y: 90,
      width: 52,
      height: 10,
      corners: [10, 10, 3, 3],
      rotate: 0,
      wave: 0.24,
    },
    {
      id: 'neck',
      layer: 'back',
      tone: 'headAlt',
      x: 40,
      y: 84,
      width: 20,
      height: 5,
      corners: round(2.5),
      rotate: 0,
      wave: 0.32,
    },
    {
      id: 'ear-left',
      layer: 'back',
      tone: 'headAlt',
      x: 11,
      y: 44,
      width: 8,
      height: 18,
      corners: [4, 1.5, 1.5, 4],
      rotate: 0,
      wave: 0.38,
    },
    {
      id: 'ear-right',
      layer: 'back',
      tone: 'headAlt',
      x: 81,
      y: 44,
      width: 8,
      height: 18,
      corners: [1.5, 4, 4, 1.5],
      rotate: 0,
      wave: 0.4,
    },
    {
      id: 'stalk',
      layer: 'back',
      tone: 'stalk',
      x: 48.75,
      y: 12,
      width: 2.5,
      height: 12,
      corners: round(1.25),
      rotate: 0,
      wave: 0.44,
    },
    {
      id: 'bulb',
      layer: 'back',
      tone: 'bulb',
      x: 45,
      y: 3,
      width: 10,
      height: 10,
      corners: round(5),
      rotate: 0,
      wave: 0.74,
    },
  ];

  const face: AvatarPiece[] = [
    {
      id: 'visor',
      layer: 'face',
      tone: 'visor',
      x: 25,
      y: 35,
      width: 50,
      height: 34,
      corners: round(13),
      rotate: 0,
      wave: 0.46,
    },
    {
      id: 'eye-left',
      layer: 'face',
      tone: 'eye',
      x: 35,
      y: 44,
      width: 8,
      height: 11,
      corners: round(4),
      rotate: 0,
      wave: 0.56,
      blink: 'eye',
    },
    {
      id: 'eye-right',
      layer: 'face',
      tone: 'eye',
      x: 57,
      y: 44,
      width: 8,
      height: 11,
      corners: round(4),
      rotate: 0,
      wave: 0.6,
      blink: 'eye',
    },
    {
      id: 'glint-left',
      layer: 'face',
      tone: 'glint',
      x: 37.2,
      y: 45.6,
      width: 2.6,
      height: 2.6,
      corners: round(1.3),
      rotate: 0,
      wave: 0.68,
      blink: 'glint',
    },
    {
      id: 'glint-right',
      layer: 'face',
      tone: 'glint',
      x: 59.2,
      y: 45.6,
      width: 2.6,
      height: 2.6,
      corners: round(1.3),
      rotate: 0,
      wave: 0.7,
      blink: 'glint',
    },
    {
      id: 'cheek-left',
      layer: 'face',
      tone: 'cheek',
      x: 28.5,
      y: 58,
      width: 7,
      height: 4,
      corners: round(2),
      rotate: 0,
      wave: 0.72,
    },
    {
      id: 'cheek-right',
      layer: 'face',
      tone: 'cheek',
      x: 64.5,
      y: 58,
      width: 7,
      height: 4,
      corners: round(2),
      rotate: 0,
      wave: 0.74,
    },
    ...smileDots(),
  ];

  const sparks: AvatarPiece[] = [
    spark('spark-1', 'organisation', 5, 20, 5, 'diamond', 0.8),
    spark('spark-2', 'health', 89, 16, 4.5, 'diamond', 0.84),
    spark('spark-3', 'money', 3, 70, 4, 'diamond', 0.9),
    spark('spark-4', 'household', 91, 70, 5, 'diamond', 0.94),
    spark('spark-5', 'ai', 22, 7, 3, 'dot', 0.88),
    spark('spark-6', 'accent', 75, 5, 3.5, 'dot', 0.96),
    spark('spark-7', 'ai', 95, 40, 3, 'dot', 1),
    spark('spark-8', 'organisation', 1, 44, 2.6, 'dot', 0.98),
  ];

  return [...headTiles(), ...back, ...face, ...sparks];
}

export const AVATAR_PIECES: readonly AvatarPiece[] = buildPieces();

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
