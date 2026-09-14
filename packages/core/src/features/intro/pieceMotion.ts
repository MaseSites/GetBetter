import { Animated } from 'react-native';

import { scatterOf, type AvatarPiece } from './avatarPieces';

/** In Leinwand-Einheiten: wie weit Funken schweben und die Augen wandern. */
const SPARK_FLOAT = 2.8;
const GAZE_UNITS = 2.6;
/** Beim Zerfallen: so klein wird ein Stueck, und so weit dreht es sich dabei. */
const SCATTER_SCALE = 0.12;
const SCATTER_SPIN_DEG = 140;
/** Die Stuecke fliegen nicht schnurgerade — so weit weicht jedes seitlich aus. */
const SCATTER_ARC = 0.22;
const CHEEK_OPACITY = 0.45;

export type AnimatedNumber = Animated.Value | Animated.AnimatedInterpolation<number>;

export type PieceMotion = {
  piece: AvatarPiece;
  progress: Animated.Value;
  translateX: AnimatedNumber;
  translateY: AnimatedNumber;
  rotate: Animated.AnimatedInterpolation<string>;
  scale: AnimatedNumber;
  scaleY: AnimatedNumber | number;
  opacity: AnimatedNumber;
};

/** Was alle Stuecke einer Figur teilen: Schweben, Blick, Blinzeln und das Ziel. */
export type SharedMotion = Readonly<{
  hover: Animated.Value;
  gaze: Animated.Value;
  blink: Animated.Value;
  targetX: Animated.Value;
  targetY: Animated.Value;
  /** 1 bei offenen Augen, 0 geschlossen — Glanzpunkte verschwinden damit. */
  glintOpacity: Animated.AnimatedInterpolation<number>;
}>;

/** Mehrere Bewegungen auf derselben Achse addieren; was fehlt, faellt weg. */
function sum(parts: readonly (AnimatedNumber | null)[]): AnimatedNumber {
  const [first, ...rest] = parts.filter((part): part is AnimatedNumber => part !== null);
  if (!first) return new Animated.Value(0);
  return rest.reduce<AnimatedNumber>((total, part) => Animated.add<number>(total, part), first);
}

/**
 * Ein Stueck auf einer Bahn mit drei Punkten: 0 verstreut, 1 an seinem Platz,
 * 2 im Ziel. Das Zusammensetzen laeuft von 0 nach 1, das Zerfallen von 1
 * nach 2 — dieselbe Zahl, zwei Richtungen.
 */
export function pieceMotionOf(
  piece: AvatarPiece,
  index: number,
  shared: SharedMotion,
): PieceMotion {
  const progress = new Animated.Value(0);
  const scatter = scatterOf(index);
  const home = [0, 1];
  const peak = piece.tone === 'cheek' ? CHEEK_OPACITY : 1;
  const opacity = progress.interpolate<number>({
    inputRange: [0, 0.3, 1, 1.7, 2],
    outputRange: [0, peak, peak, peak, 0],
  });
  // Funken schweben gegeneinander, Glanzpunkte verschwinden beim Blinzeln.
  const float =
    piece.layer === 'spark'
      ? shared.hover.interpolate<number>({
          inputRange: [-1, 1],
          outputRange: index % 2 === 0 ? [-SPARK_FLOAT, SPARK_FLOAT] : [SPARK_FLOAT, -SPARK_FLOAT],
        })
      : null;
  // Nur die Augen wandern — der Kopf bleibt, wo er ist.
  const look = piece.blink
    ? shared.gaze.interpolate<number>({
        inputRange: [-1, 1],
        outputRange: [-GAZE_UNITS, GAZE_UNITS],
      })
    : null;

  // Wie weit es auf dem Weg zum Ziel schon ist, und wie es dabei ausweicht.
  const gone = progress.interpolate<number>({
    inputRange: [1, 2],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const arc = (span: number) =>
    progress.interpolate<number>({
      inputRange: [1, 1.5, 2],
      outputRange: [0, span * SCATTER_ARC, 0],
      extrapolate: 'clamp',
    });

  const homeX = progress.interpolate<number>({
    inputRange: home,
    outputRange: [scatter.dx, 0],
    extrapolate: 'clamp',
  });
  const homeY = progress.interpolate<number>({
    inputRange: home,
    outputRange: [scatter.dy, 0],
    extrapolate: 'clamp',
  });

  const translateX = sum([
    homeX,
    Animated.multiply<number>(gone, shared.targetX),
    arc(scatter.dx),
    look,
  ]);
  const translateY = sum([
    homeY,
    Animated.multiply<number>(gone, shared.targetY),
    arc(scatter.dy),
    float,
  ]);
  const spin = scatter.rotate < 0 ? -SCATTER_SPIN_DEG : SCATTER_SPIN_DEG;

  return {
    piece,
    progress,
    translateX,
    translateY,
    rotate: progress.interpolate({
      inputRange: [0, 1, 2],
      outputRange: [
        `${piece.rotate + scatter.rotate}deg`,
        `${piece.rotate}deg`,
        `${piece.rotate + spin}deg`,
      ],
    }),
    scale: progress.interpolate({
      inputRange: [0, 1, 2],
      outputRange: [scatter.scale, 1, SCATTER_SCALE],
    }),
    scaleY: piece.blink ? shared.blink : 1,
    opacity:
      piece.blink === 'glint' ? Animated.multiply<number>(opacity, shared.glintOpacity) : opacity,
  };
}
