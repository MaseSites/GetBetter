import type { AvatarPiece, PieceTone } from '../intro/avatarPieces';

import { piece, type EyeLayout, type Point } from './shapes';
import type { AvatarEyes } from './style';

type EyeTones = Readonly<{ eye: PieceTone; glint: PieceTone }>;
type EyeShape = (
  id: string,
  at: Point,
  scale: number,
  tones: EyeTones,
  wave: number,
) => AvatarPiece[];

/** Glanzpunkte kommen etwas nach dem Auge an. */
const GLINT_DELAY = 0.12;
/** Die Striche der froehlichen Augen stehen so schraeg. */
const HAPPY_TILT = 40;

/**
 * Die vier Augen. Jedes Stueck blinzelt (`blink: 'eye'`) und wandert mit dem
 * Blick; Glanzpunkte verschwinden beim Blinzeln.
 */
const SHAPES: Readonly<Record<AvatarEyes, EyeShape>> = {
  round: (id, at, s, tones, wave) => [
    piece({
      id,
      layer: 'face',
      tone: tones.eye,
      x: at.x - 4 * s,
      y: at.y - 5.5 * s,
      width: 8 * s,
      height: 11 * s,
      corners: 4 * s,
      wave,
      blink: 'eye',
    }),
    piece({
      id: `${id}-glint`,
      layer: 'face',
      tone: tones.glint,
      x: at.x - 1.8 * s,
      y: at.y - 3.9 * s,
      width: 2.6 * s,
      height: 2.6 * s,
      corners: 1.3 * s,
      wave: wave + GLINT_DELAY,
      blink: 'glint',
    }),
  ],

  // Zwei Striche wie ein Dach: ^ ^
  happy: (id, at, s, tones, wave) =>
    [-1, 1].map((side) => {
      const width = 6.2 * s;
      const height = 2.4 * s;
      return piece({
        id: `${id}-${side < 0 ? 'rise' : 'fall'}`,
        layer: 'face',
        tone: tones.eye,
        x: at.x + side * 2.2 * s - width / 2,
        y: at.y + 0.4 * s - height / 2,
        width,
        height,
        corners: height / 2,
        rotate: side * HAPPY_TILT,
        wave: wave + (side > 0 ? 0.03 : 0),
        blink: 'eye',
      });
    }),

  // Halb zu: unten rund, oben ein Lid.
  sleepy: (id, at, s, tones, wave) => [
    piece({
      id,
      layer: 'face',
      tone: tones.eye,
      x: at.x - 4.5 * s,
      y: at.y - 1 * s,
      width: 9 * s,
      height: 4.6 * s,
      corners: [1.2 * s, 1.2 * s, 4.5 * s, 4.5 * s],
      wave,
      blink: 'eye',
    }),
    piece({
      id: `${id}-lid`,
      layer: 'face',
      tone: tones.eye,
      x: at.x - 5 * s,
      y: at.y - 2.9 * s,
      width: 10 * s,
      height: 1.5 * s,
      corners: 0.75 * s,
      wave: wave + 0.06,
      blink: 'eye',
    }),
  ],

  // Gross, mit einem Funkeln und einem kleinen Glanz.
  sparkle: (id, at, s, tones, wave) => [
    piece({
      id,
      layer: 'face',
      tone: tones.eye,
      x: at.x - 4.5 * s,
      y: at.y - 6 * s,
      width: 9 * s,
      height: 12 * s,
      corners: 4.5 * s,
      wave,
      blink: 'eye',
    }),
    piece({
      id: `${id}-spark`,
      layer: 'face',
      tone: tones.glint,
      x: at.x - 3.4 * s,
      y: at.y - 4.4 * s,
      width: 3.6 * s,
      height: 3.6 * s,
      corners: 0.7 * s,
      rotate: 45,
      wave: wave + GLINT_DELAY,
      blink: 'glint',
    }),
    piece({
      id: `${id}-glint`,
      layer: 'face',
      tone: tones.glint,
      x: at.x + 0.5 * s,
      y: at.y + 1.1 * s,
      width: 1.8 * s,
      height: 1.8 * s,
      corners: 0.9 * s,
      wave: wave + GLINT_DELAY + 0.04,
      blink: 'glint',
    }),
  ],
};

/** Auf einem Schild traegt das Auge die Schrift des Themas, auf dem Koerper die lesbare Tinte. */
export function eyeToneOf(layout: EyeLayout): PieceTone {
  return layout.onPlate ? 'eye' : 'ink';
}

export function eyePieces(eyes: AvatarEyes, layout: EyeLayout): AvatarPiece[] {
  const tones: EyeTones = layout.onPlate
    ? { eye: 'eye', glint: 'glint' }
    : { eye: 'ink', glint: 'inkGlint' };
  const shape = SHAPES[eyes];
  return [
    ...shape('eye-left', layout.left, layout.scale, tones, layout.wave),
    ...shape('eye-right', layout.right, layout.scale, tones, layout.wave + 0.04),
  ];
}
