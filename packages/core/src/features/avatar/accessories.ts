import type { AvatarPiece } from '../intro/avatarPieces';

import { eyeToneOf } from './eyes';
import { disc, piece, type EyeLayout, type KindGeometry, type Point } from './shapes';
import type { AvatarAccessory } from './style';

/** Hut und Antenne liegen hinten auf dem Kopf; Brille und Schleife vorne beim Gesicht. */
export type AccessoryPieces = Readonly<{
  back: readonly AvatarPiece[];
  face: readonly AvatarPiece[];
}>;

const NOTHING: AccessoryPieces = { back: [], face: [] };

/** Durchmesser eines Brillenglases bei Augen in normaler Groesse, und sein Rand. */
const LENS = 15;
const LENS_EDGE = 1.8;
/** Kantenlaenge eines Schleifenfluegels. */
const WING = 8;

function antenna(crown: Point): AvatarPiece[] {
  return [
    piece({
      id: 'antenna-stalk',
      tone: 'stalk',
      x: crown.x - 1.25,
      y: crown.y - 12,
      width: 2.5,
      height: 12,
      corners: 1.25,
      wave: 0.44,
    }),
    disc('antenna-bulb', 'bulb', { x: crown.x, y: crown.y - 16 }, 10, 0.74, 'back'),
  ];
}

function hat(crown: Point): AvatarPiece[] {
  return [
    piece({
      id: 'hat-crown',
      tone: 'hat',
      x: crown.x - 10,
      y: crown.y - 17,
      width: 20,
      height: 14,
      corners: [3, 3, 1, 1],
      wave: 0.7,
    }),
    piece({
      id: 'hat-band',
      tone: 'band',
      x: crown.x - 10,
      y: crown.y - 7,
      width: 20,
      height: 3,
      corners: 0.5,
      wave: 0.8,
    }),
    piece({
      id: 'hat-brim',
      tone: 'hat',
      x: crown.x - 15,
      y: crown.y - 4,
      width: 30,
      height: 4,
      corners: 2,
      wave: 0.74,
    }),
  ];
}

function glasses(eyes: EyeLayout): AvatarPiece[] {
  const size = LENS * eyes.scale;
  const tone = eyeToneOf(eyes);
  const lens = (id: string, at: Point, wave: number) =>
    piece({
      id,
      layer: 'face',
      tone,
      x: at.x - size / 2,
      y: at.y - size / 2,
      width: size,
      height: size,
      corners: size / 2,
      outline: LENS_EDGE,
      wave,
    });
  const bridgeY = (eyes.left.y + eyes.right.y) / 2;
  return [
    lens('glasses-left', eyes.left, 0.8),
    lens('glasses-right', eyes.right, 0.84),
    piece({
      id: 'glasses-bridge',
      layer: 'face',
      tone,
      x: eyes.left.x + size / 2 - 0.5,
      y: bridgeY - 0.8,
      width: Math.max(1, eyes.right.x - eyes.left.x - size + 1),
      height: 1.6,
      corners: 0.8,
      wave: 0.88,
    }),
  ];
}

function bow(at: Point): AvatarPiece[] {
  const wing = (id: string, dx: number, wave: number) =>
    piece({
      id,
      layer: 'face',
      tone: 'bow',
      x: at.x + dx - WING / 2,
      y: at.y - WING / 2,
      width: WING,
      height: WING,
      corners: 2,
      rotate: 45,
      wave,
    });
  return [
    wing('bow-left', -5, 0.78),
    wing('bow-right', 5, 0.82),
    disc('bow-knot', 'bowKnot', at, 5, 0.86),
  ];
}

/** Die Stuecke eines Zubehoers, an den Stellen, die die Figur dafuer vorsieht. */
export function accessoryPieces(accessory: AvatarAccessory, kind: KindGeometry): AccessoryPieces {
  switch (accessory) {
    case 'antenna':
      return { back: antenna(kind.crown), face: [] };
    case 'hat':
      return { back: hat(kind.crown), face: [] };
    case 'glasses':
      return { back: [], face: glasses(kind.eyes) };
    case 'bow':
      return { back: [], face: bow(kind.bow) };
    case 'none':
      return NOTHING;
  }
}
