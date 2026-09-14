import type { AvatarPiece, PieceTone } from '../intro/avatarPieces';

import { accessoryPieces } from './accessories';
import { eyePieces } from './eyes';
import { blob } from './kinds/blob';
import { cat } from './kinds/cat';
import { ghost } from './kinds/ghost';
import { owl } from './kinds/owl';
import { robot } from './kinds/robot';
import { piece, type KindGeometry } from './shapes';
import { avatarShapeKey, type AvatarKind, type AvatarStyle } from './style';

export const KIND_GEOMETRY: Readonly<Record<AvatarKind, KindGeometry>> = {
  robot,
  blob,
  cat,
  owl,
  ghost,
};

function spark(
  id: string,
  tone: PieceTone,
  x: number,
  y: number,
  size: number,
  shape: 'diamond' | 'dot',
  wave: number,
): AvatarPiece {
  return piece({
    id,
    layer: 'spark',
    tone,
    x,
    y,
    width: size,
    height: size,
    corners: shape === 'dot' ? size / 2 : size / 4,
    rotate: shape === 'diamond' ? 45 : 0,
    wave,
  });
}

/** Die Funken rundherum in den Farben der Bereiche — bei jeder Figur dieselben. */
const SPARKS: readonly AvatarPiece[] = [
  spark('spark-1', 'organisation', 5, 20, 5, 'diamond', 0.8),
  spark('spark-2', 'health', 89, 16, 4.5, 'diamond', 0.84),
  spark('spark-3', 'money', 3, 70, 4, 'diamond', 0.9),
  spark('spark-4', 'household', 91, 70, 5, 'diamond', 0.94),
  spark('spark-5', 'ai', 22, 7, 3, 'dot', 0.88),
  spark('spark-6', 'accent', 75, 5, 3.5, 'dot', 0.96),
  spark('spark-7', 'ai', 95, 40, 3, 'dot', 1),
  spark('spark-8', 'organisation', 1, 44, 2.6, 'dot', 0.98),
];

/** Jede Form wird einmal gerechnet — Vorschauen in einer Auswahl fragen dieselbe oft. */
const known = new Map<string, readonly AvatarPiece[]>();

/**
 * Die Stuecke eines Avatars in Zeichenreihenfolge: hinten Koerper und Hut,
 * davor Schild, Mund und Augen, darueber Brille oder Schleife, aussen die Funken.
 */
export function avatarPiecesOf(style: AvatarStyle): readonly AvatarPiece[] {
  const key = avatarShapeKey(style);
  const cached = known.get(key);
  if (cached) return cached;

  const kind = KIND_GEOMETRY[style.kind];
  const accessory = accessoryPieces(style.accessory, kind);
  const pieces: readonly AvatarPiece[] = [
    ...kind.back,
    ...accessory.back,
    ...kind.face,
    ...eyePieces(style.eyes, kind.eyes),
    ...accessory.face,
    ...SPARKS,
  ];
  known.set(key, pieces);
  return pieces;
}
