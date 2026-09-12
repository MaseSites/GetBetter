import { memo, useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import { hueTint, useTheme, type Theme } from '@/theme';

import {
  AVATAR_CANVAS,
  AVATAR_PIECES,
  arrivalDelay,
  mixHex,
  scatterOf,
  type AvatarPiece,
  type PieceTone,
} from './avatarPieces';
import { useReducedMotion } from './useReducedMotion';

/**
 * - `assemble` — die Stuecke fliegen an ihren Platz, danach schaut er sich um
 * - `idle`     — steht schon da und schaut sich um
 * - `turnAway` — dreht sich weg und blendet aus
 */
export type AvatarPhase = 'assemble' | 'idle' | 'turnAway';

export type ClubAvatarProps = {
  phase?: AvatarPhase;
  /** Kantenlaenge in Punkten. */
  size?: number;
  /** Alle Stuecke sitzen (ohne Bewegung: sofort). */
  onAssembled?: () => void;
  /** Weggedreht und ausgeblendet. */
  onTurnedAway?: () => void;
  /** Wechselt der Wert, nickt er kurz — etwa bei jedem Schritt im Gespraech. */
  bounceKey?: string | number;
};

/** In dieser Zeit sitzen alle Stuecke; ein einzelnes fliegt so lange. */
const ASSEMBLE_MS = 950;
const FLIGHT_MS = 520;
/** Die eine Drehung beim Zusammensetzen. */
const SPIN_MS = 1100;
const TURN_MS = 420;
/** Einmal nach rechts, nach links und zurueck. */
const SWAY_MS = 5600;
const HOVER_MS = 1800;
const BLINK_CLOSE_MS = 70;
const BLINK_OPEN_MS = 110;
const BLINK_PAUSES_MS = [2600, 3400, 140] as const;
const BOUNCE_UP_MS = 140;
const BOUNCE_DOWN_MS = 260;

const SWAY_DEG = 16;
const TURN_DEG = 90;
const PERSPECTIVE = 700;
/** In Leinwand-Einheiten: wie hoch er schwebt, wie weit das Gesicht beim Drehen mitgeht. */
const HOVER_UNITS = 2.2;
const FACE_DEPTH = 3.5;
const SPARK_FLOAT = 2.8;
const BLINK_CLOSED = 0.1;
const BOUNCE_SCALE = 1.08;
const TURN_SCALE = 0.86;
const CHEEK_OPACITY = 0.45;

const useNativeDriver = Platform.OS !== 'web';

type AnimatedNumber = Animated.Value | Animated.AnimatedInterpolation<number>;

type PieceMotion = {
  piece: AvatarPiece;
  progress: Animated.Value;
  translateX: AnimatedNumber;
  translateY: AnimatedNumber;
  rotate: Animated.AnimatedInterpolation<string>;
  scale: AnimatedNumber;
  scaleY: AnimatedNumber | number;
  opacity: AnimatedNumber;
};

type Handlers = { onAssembled?: () => void; onTurnedAway?: () => void };

/**
 * Die ganze Bewegung lebt ausserhalb von React. Gerendert wird nur, wenn sich
 * Farbe, Groesse oder Phase aendern — Fliegen, Schweben und Blinzeln laufen
 * ueber Animated-Werte, auf dem Geraet nativ.
 */
class AvatarMotion {
  readonly spin = new Animated.Value(0);
  readonly sway = new Animated.Value(0);
  readonly hover = new Animated.Value(0);
  readonly blink = new Animated.Value(1);
  readonly away = new Animated.Value(0);
  readonly bounce = new Animated.Value(1);
  readonly pieces: readonly PieceMotion[];
  readonly rotateY: Animated.AnimatedInterpolation<string>;
  readonly hoverY: AnimatedNumber;
  readonly faceX: AnimatedNumber;
  readonly groupOpacity: AnimatedNumber;
  readonly groupScale: AnimatedNumber;

  private handlers: Handlers = {};
  private assembled = false;
  private running: Animated.CompositeAnimation | null = null;
  private loops: Animated.CompositeAnimation[] = [];
  private nodSeen = false;
  private lastNod: string | number | undefined;

  constructor(private readonly motion: Theme['motion']) {
    const glintOpacity = this.blink.interpolate<number>({
      inputRange: [BLINK_CLOSED, 1],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

    this.pieces = AVATAR_PIECES.map((piece, index) => this.pieceMotion(piece, index, glintOpacity));

    // Eine volle Runde beim Zusammensetzen, danach links-rechts, am Ende weg.
    const spinDeg = this.spin.interpolate<number>({ inputRange: [0, 1], outputRange: [-360, 0] });
    const swayDeg = this.sway.interpolate<number>({
      inputRange: [-1, 1],
      outputRange: [-SWAY_DEG, SWAY_DEG],
    });
    const awayDeg = this.away.interpolate<number>({
      inputRange: [0, 1],
      outputRange: [0, TURN_DEG],
    });
    this.rotateY = Animated.add<number>(
      Animated.add<number>(spinDeg, swayDeg),
      awayDeg,
    ).interpolate({
      inputRange: [-360, 360],
      outputRange: ['-360deg', '360deg'],
    });
    this.hoverY = this.hover.interpolate({
      inputRange: [-1, 1],
      outputRange: [-HOVER_UNITS, HOVER_UNITS],
    });
    this.faceX = this.sway.interpolate({
      inputRange: [-1, 1],
      outputRange: [-FACE_DEPTH, FACE_DEPTH],
    });
    this.groupOpacity = this.away.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
    this.groupScale = Animated.multiply<number>(
      this.bounce,
      this.away.interpolate<number>({ inputRange: [0, 1], outputRange: [1, TURN_SCALE] }),
    );
  }

  private pieceMotion(
    piece: AvatarPiece,
    index: number,
    glintOpacity: Animated.AnimatedInterpolation<number>,
  ): PieceMotion {
    const progress = new Animated.Value(0);
    const scatter = scatterOf(index);
    const range = [0, 1];
    const translateY = progress.interpolate<number>({
      inputRange: range,
      outputRange: [scatter.dy, 0],
    });
    const peak = piece.tone === 'cheek' ? CHEEK_OPACITY : 1;
    const opacity = progress.interpolate<number>({
      inputRange: [0, 0.3, 1],
      outputRange: [0, peak, peak],
    });
    // Funken schweben gegeneinander, Glanzpunkte verschwinden beim Blinzeln.
    const float =
      piece.layer === 'spark'
        ? this.hover.interpolate<number>({
            inputRange: [-1, 1],
            outputRange:
              index % 2 === 0 ? [-SPARK_FLOAT, SPARK_FLOAT] : [SPARK_FLOAT, -SPARK_FLOAT],
          })
        : null;

    return {
      piece,
      progress,
      translateX: progress.interpolate({ inputRange: range, outputRange: [scatter.dx, 0] }),
      translateY: float ? Animated.add<number>(translateY, float) : translateY,
      rotate: progress.interpolate({
        inputRange: range,
        outputRange: [`${piece.rotate + scatter.rotate}deg`, `${piece.rotate}deg`],
      }),
      scale: progress.interpolate({ inputRange: range, outputRange: [scatter.scale, 1] }),
      scaleY: piece.blink ? this.blink : 1,
      opacity: piece.blink === 'glint' ? Animated.multiply<number>(opacity, glintOpacity) : opacity,
    };
  }

  setHandlers(handlers: Handlers) {
    this.handlers = handlers;
  }

  play(phase: AvatarPhase, reduced: boolean) {
    if (phase === 'turnAway') {
      this.turnAway(reduced);
      return;
    }
    this.comeBack();
    if (this.assembled) {
      this.startIdle(reduced);
      return;
    }
    if (phase === 'idle' || reduced) {
      this.snap(reduced);
      return;
    }
    this.assemble();
  }

  nod(key: string | number | undefined, reduced: boolean) {
    if (!this.nodSeen) {
      this.nodSeen = true;
      this.lastNod = key;
      return;
    }
    if (key === this.lastNod) return;
    this.lastNod = key;
    if (reduced) return;
    Animated.sequence([
      this.timing(this.bounce, BOUNCE_SCALE, BOUNCE_UP_MS),
      this.timing(this.bounce, 1, BOUNCE_DOWN_MS),
    ]).start();
  }

  stopAll() {
    this.running?.stop();
    this.running = null;
    this.stopLoops();
  }

  private timing(
    value: Animated.Value,
    toValue: number,
    duration: number,
    easing: (t: number) => number = this.motion.easing.out,
  ) {
    return Animated.timing(value, { toValue, duration, easing, useNativeDriver });
  }

  private snap(reduced: boolean) {
    this.pieces.forEach(({ progress }) => progress.setValue(1));
    this.spin.setValue(1);
    this.assembled = true;
    this.startIdle(reduced);
    this.handlers.onAssembled?.();
  }

  private assemble() {
    this.stopAll();
    this.spin.setValue(0);
    const flights = this.pieces.map(({ piece, progress }) =>
      Animated.timing(progress, {
        toValue: 1,
        duration: FLIGHT_MS,
        delay: arrivalDelay(piece.wave, ASSEMBLE_MS, FLIGHT_MS),
        easing: this.motion.easing.out,
        useNativeDriver,
      }),
    );
    const run = Animated.parallel([...flights, this.timing(this.spin, 1, SPIN_MS)]);
    this.running = run;
    run.start(({ finished }) => {
      if (!finished) return;
      this.running = null;
      this.assembled = true;
      this.startIdle(false);
      this.handlers.onAssembled?.();
    });
  }

  private startIdle(reduced: boolean) {
    this.stopLoops();
    if (reduced) {
      this.sway.setValue(0);
      this.hover.setValue(0);
      return;
    }
    const ease = this.motion.easing.inOut;
    const blink = () => [
      this.timing(this.blink, BLINK_CLOSED, BLINK_CLOSE_MS),
      this.timing(this.blink, 1, BLINK_OPEN_MS),
    ];
    const [first, second, double] = BLINK_PAUSES_MS;
    this.loops = [
      Animated.loop(
        Animated.sequence([
          this.timing(this.sway, 1, SWAY_MS / 4, ease),
          this.timing(this.sway, -1, SWAY_MS / 2, ease),
          this.timing(this.sway, 0, SWAY_MS / 4, ease),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          this.timing(this.hover, 1, HOVER_MS, ease),
          this.timing(this.hover, -1, HOVER_MS, ease),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.delay(first),
          ...blink(),
          Animated.delay(second),
          ...blink(),
          Animated.delay(double),
          ...blink(),
        ]),
      ),
    ];
    this.loops.forEach((loop) => loop.start());
  }

  private stopLoops() {
    this.loops.forEach((loop) => loop.stop());
    this.loops = [];
  }

  private turnAway(reduced: boolean) {
    this.stopAll();
    const duration = reduced ? this.motion.duration.exit : TURN_MS;
    this.timing(this.away, 1, duration, this.motion.easing.inOut).start(({ finished }) => {
      if (finished) this.handlers.onTurnedAway?.();
    });
  }

  private comeBack() {
    this.away.stopAnimation((value) => {
      if (value > 0) this.timing(this.away, 0, this.motion.duration.sheet).start();
    });
  }
}

function toneColors(theme: Theme): Record<PieceTone, string> {
  const head = theme.colors.accent;
  const on = theme.colors.textOnAccent;
  return {
    head,
    headAlt: mixHex(head, on, 0.14),
    visor: theme.colors.surface,
    eye: theme.colors.text,
    glint: theme.colors.surface,
    // Ruhige Wangen: eine Schattierung im Kopfton, kein rosa Rouge.
    cheek: mixHex(head, on, 0.34),
    smile: theme.colors.text,
    stalk: mixHex(head, on, 0.3),
    bulb: hueTint(theme, 'ai').base,
    organisation: hueTint(theme, 'organisation').base,
    health: hueTint(theme, 'health').base,
    household: hueTint(theme, 'household').base,
    money: hueTint(theme, 'money').base,
    ai: hueTint(theme, 'ai').base,
    accent: theme.colors.accentStrong,
  };
}

/**
 * Der Club-Avatar: ein freundlicher Kopf mit Antenne, der sich aus kleinen
 * Stuecken zusammensetzt, einmal dreht, danach sanft schwebt, sich umschaut und
 * blinzelt. Die Farben kommen aus dem Thema — er macht jede Einstellung mit.
 *
 * Wer weniger Bewegung wuenscht, sieht ihn ohne Flug, Drehen und Schweben.
 */
export function ClubAvatar({
  phase = 'assemble',
  size = 160,
  onAssembled,
  onTurnedAway,
  bounceKey,
}: ClubAvatarProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [motion] = useState(() => new AvatarMotion(theme.motion));

  useEffect(() => {
    motion.setHandlers({ onAssembled, onTurnedAway });
  }, [motion, onAssembled, onTurnedAway]);

  useEffect(() => {
    if (reduced === null) return;
    motion.play(phase, reduced);
  }, [motion, phase, reduced]);

  useEffect(() => {
    if (reduced === null) return;
    motion.nod(bounceKey, reduced);
  }, [motion, bounceKey, reduced]);

  useEffect(() => () => motion.stopAll(), [motion]);

  const colors = toneColors(theme);
  const offset = (size - AVATAR_CANVAS) / 2;
  const turning =
    reduced === false
      ? [{ perspective: PERSPECTIVE }, { rotateY: motion.rotateY }, { scale: motion.groupScale }]
      : [{ scale: motion.groupScale }];

  const layer = (name: AvatarPiece['layer']) =>
    motion.pieces
      .filter(({ piece }) => piece.layer === name)
      .map((entry) => (
        <Piece key={entry.piece.id} entry={entry} color={colors[entry.piece.tone]} />
      ));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.frame, { width: size, height: size }]}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: motion.groupOpacity, transform: turning }]}
      >
        <Animated.View
          style={[
            styles.canvas,
            {
              left: offset,
              top: offset,
              transform: [{ scale: size / AVATAR_CANVAS }, { translateY: motion.hoverY }],
            },
          ]}
        >
          {layer('back')}
          <Animated.View
            style={[StyleSheet.absoluteFill, { transform: [{ translateX: motion.faceX }] }]}
          >
            {layer('face')}
          </Animated.View>
          {layer('spark')}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** Ein Stueck. Neu gezeichnet wird es nur, wenn sich seine Farbe aendert. */
const Piece = memo(function Piece({ entry, color }: { entry: PieceMotion; color: string }) {
  const { piece } = entry;
  const [topLeft, topRight, bottomRight, bottomLeft] = piece.corners;

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          left: piece.x,
          top: piece.y,
          width: piece.width,
          height: piece.height,
          borderTopLeftRadius: topLeft,
          borderTopRightRadius: topRight,
          borderBottomRightRadius: bottomRight,
          borderBottomLeftRadius: bottomLeft,
          backgroundColor: color,
          opacity: entry.opacity,
          transform: [
            { translateX: entry.translateX },
            { translateY: entry.translateY },
            { rotate: entry.rotate },
            { scale: entry.scale },
            { scaleY: entry.scaleY },
          ],
        },
      ]}
    />
  );
});

const styles = StyleSheet.create({
  frame: { pointerEvents: 'none' },
  canvas: { position: 'absolute', width: AVATAR_CANVAS, height: AVATAR_CANVAS },
  piece: { position: 'absolute' },
});
