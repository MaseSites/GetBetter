import type { AvatarPiece, Corners, PieceLayer, PieceTone } from '../intro/avatarPieces';

/**
 * Werkzeug fuer die Figuren: ein Stueck, ein Mosaik aus Kacheln, Punkte auf
 * einem Bogen. Alles auf der Leinwand von 100 × 100, ohne Farbe und ohne React.
 */

export type Point = Readonly<{ x: number; y: number }>;

/** Wo die Augen einer Figur sitzen, wie gross sie sind und worauf. */
export type EyeLayout = Readonly<{
  left: Point;
  right: Point;
  scale: number;
  /** Auf einem hellen Schild oder einer Gesichtsscheibe — sonst direkt auf dem Koerper. */
  onPlate: boolean;
  wave: number;
}>;

/** Eine Figur: was hinten liegt, was zum Gesicht gehoert, und wo Zubehoer Platz findet. */
export type KindGeometry = Readonly<{
  back: readonly AvatarPiece[];
  face: readonly AvatarPiece[];
  eyes: EyeLayout;
  /** Die Mitte oben am Kopf — hier sitzen Hut und Antenne. */
  crown: Point;
  /** Wo eine Schleife sitzt: am Hals oder im Haar. */
  bow: Point;
}>;

export function round(radius: number): Corners {
  return [radius, radius, radius, radius];
}

export type PieceSpec = Omit<AvatarPiece, 'layer' | 'rotate' | 'corners'> & {
  layer?: PieceLayer;
  rotate?: number;
  corners?: Corners | number;
};

/** Ein Stueck; ohne Angabe hinten, ungedreht und eckig. */
export function piece({
  layer = 'back',
  rotate = 0,
  corners = 0,
  ...rest
}: PieceSpec): AvatarPiece {
  return {
    ...rest,
    layer,
    rotate,
    corners: typeof corners === 'number' ? round(corners) : corners,
  };
}

export type GridSpec = Readonly<{
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cols: number;
  rows: number;
  gap: number;
  /** Radius innen, wo Kacheln aneinanderstossen. */
  inner: number;
  /** Radius der aeusseren Ecken oben und unten. */
  top: number;
  bottom: number;
}>;

/**
 * Ein Koerper als Mosaik: Kacheln im Wechsel zweier Toene, aussen rund, von
 * aussen nach innen gelegt — die Mitte kommt zuletzt.
 */
export function tileGrid(spec: GridSpec): AvatarPiece[] {
  const tileWidth = (spec.width - spec.gap * (spec.cols - 1)) / spec.cols;
  const tileHeight = (spec.height - spec.gap * (spec.rows - 1)) / spec.rows;
  const midCol = (spec.cols - 1) / 2;
  const midRow = (spec.rows - 1) / 2;
  const farthest = Math.hypot(midCol, midRow);

  return Array.from({ length: spec.rows * spec.cols }, (_, index) => {
    const row = Math.floor(index / spec.cols);
    const col = index % spec.cols;
    const top = row === 0;
    const bottom = row === spec.rows - 1;
    const left = col === 0;
    const right = col === spec.cols - 1;
    const closeness = 1 - Math.hypot(col - midCol, row - midRow) / farthest;
    return piece({
      id: `${spec.id}-${row}-${col}`,
      tone: (row + col) % 2 === 0 ? 'body' : 'bodyAlt',
      x: spec.x + col * (tileWidth + spec.gap),
      y: spec.y + row * (tileHeight + spec.gap),
      width: tileWidth,
      height: tileHeight,
      corners: [
        top && left ? spec.top : spec.inner,
        top && right ? spec.top : spec.inner,
        bottom && right ? spec.bottom : spec.inner,
        bottom && left ? spec.bottom : spec.inner,
      ],
      wave: 0.3 * closeness + (index % 3) * 0.02,
    });
  });
}

export type RowSpec = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
  count: number;
  left: Corners;
  middle: Corners;
  right: Corners;
}>;

/** Ein Koerper aus Reihen verschiedener Breite — so entsteht ein Tropfen statt eines Quadrats. */
export function tileRows(id: string, rows: readonly RowSpec[], gap: number): AvatarPiece[] {
  return rows.flatMap((row, rowIndex) => {
    const width = (row.width - gap * (row.count - 1)) / row.count;
    return Array.from({ length: row.count }, (_, col) => {
      const x = row.x + col * (width + gap);
      const centre = Math.hypot(x + width / 2 - 50, row.y + row.height / 2 - 50);
      const closeness = 1 - Math.min(1, centre / 45);
      return piece({
        id: `${id}-${rowIndex}-${col}`,
        tone: (rowIndex + col) % 2 === 0 ? 'body' : 'bodyAlt',
        x,
        y: row.y,
        width,
        height: row.height,
        corners: col === 0 ? row.left : col === row.count - 1 ? row.right : row.middle,
        wave: 0.3 * closeness + ((rowIndex + col) % 3) * 0.02,
      });
    });
  });
}

export type ArcSpec = Readonly<{
  id: string;
  tone: PieceTone;
  cx: number;
  cy: number;
  radius: number;
  dot: number;
  count: number;
  /** Winkel in Grad, 0 ist rechts, 90 unten. */
  from: number;
  to: number;
  wave: number;
  /** Wie weit sich die Ankunft ueber den Bogen verteilt. */
  spread: number;
}>;

/** Punkte auf einem Bogen, von links nach rechts gelegt — ein Laecheln, ein Mund. */
export function dotArc(spec: ArcSpec): AvatarPiece[] {
  return Array.from({ length: spec.count }, (_, index) => {
    const share = spec.count > 1 ? index / (spec.count - 1) : 0;
    const angle = ((spec.from + share * (spec.to - spec.from)) * Math.PI) / 180;
    return piece({
      id: `${spec.id}-${index}`,
      layer: 'face',
      tone: spec.tone,
      x: spec.cx + Math.cos(angle) * spec.radius - spec.dot / 2,
      y: spec.cy + Math.sin(angle) * spec.radius - spec.dot / 2,
      width: spec.dot,
      height: spec.dot,
      corners: spec.dot / 2,
      wave: spec.wave + share * spec.spread,
    });
  });
}

/** Ein rundes Stueck um einen Mittelpunkt. */
export function disc(
  id: string,
  tone: PieceTone,
  centre: Point,
  size: number,
  wave: number,
  layer: PieceLayer = 'face',
): AvatarPiece {
  return piece({
    id,
    layer,
    tone,
    x: centre.x - size / 2,
    y: centre.y - size / 2,
    width: size,
    height: size,
    corners: size / 2,
    wave,
  });
}
