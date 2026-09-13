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
 * - `scatter`  — er zerfaellt und fliegt als Welle zum Ziel davon
 */
export type AvatarPhase = 'assemble' | 'idle' | 'turnAway' | 'scatter';

/** Wohin die Stuecke beim Zerfallen fliegen, in Punkten vom Mittelpunkt aus. */
export type AvatarTarget = { x: number; y: number };

export type ClubAvatarProps = {
  phase?: AvatarPhase;
  /** Kantenlaenge in Punkten. */
  size?: number;
  /**
   * Im Ruhezustand wandert nur der Blick, nicht der ganze Koerper. Ruhiger —
   * gedacht fuer den Assistenten, wo er lange einfach dasteht.
   */
  gazeOnly?: boolean;
  /** Ziel fuer `scatter`. Ohne Angabe fliegen die Stuecke einfach auseinander. */
  target?: AvatarTarget;
  /** Alle Stuecke sitzen (ohne Bewegung: sofort). */
  onAssembled?: () => void;
  /** Weggedreht und ausgeblendet. */
  onTurnedAway?: () => void;
  /** Zerfallen und angekommen — jetzt darf er aus dem Baum. */
  onScattered?: () => void;
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
/** Zerfallen: ein Stueck fliegt so lange, alle zusammen brauchen so lange. */
const SCATTER_MS = 760;
const DRIFT_MS = 440;
/** Wie lange der Blick fuer einmal hin und her braucht. Ruhig, nicht hektisch. */
const GAZE_MS = 4200;
/** Und wie lange er dazwischen stehen bleibt — sonst pendelt er, statt zu schauen. */
const GAZE_HOLD_MS = 900;

const SWAY_DEG = 16;
const TURN_DEG = 90;
const PERSPECTIVE = 700;
/** In Leinwand-Einheiten: wie hoch er schwebt, wie weit das Gesicht beim Drehen mitgeht. */
const HOVER_UNITS = 2.2;
const FACE_DEPTH = 3.5;
const SPARK_FLOAT = 2.8;
const BLINK_CLOSED = 0.1;
/** Wie weit die Augen dabei wandern, in Leinwand-Einheiten. */
const GAZE_UNITS = 2.6;
/** Beim Zerfallen: so klein wird ein Stueck, und so weit dreht es sich dabei. */
const SCATTER_SCALE = 0.12;
const SCATTER_SPIN_DEG = 140;
/** Die Stuecke fliegen nicht schnurgerade — so weit weicht jedes seitlich aus. */
const SCATTER_ARC = 0.22;
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

/** Mehrere Bewegungen auf derselben Achse addieren; was fehlt, faellt weg. */
function sum(parts: readonly (AnimatedNumber | null)[]): AnimatedNumber {
  const [first, ...rest] = parts.filter((part): part is AnimatedNumber => part !== null);
  if (!first) return new Animated.Value(0);
  return rest.reduce<AnimatedNumber>((total, part) => Animated.add<number>(total, part), first);
}

type Handlers = {
  onAssembled?: () => void;
  onTurnedAway?: () => void;
  onScattered?: () => void;
};

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
  /** Wohin er schaut: -1 links, 1 rechts. Bewegt nur die Augen. */
  readonly gaze = new Animated.Value(0);
  /** Wohin die Stuecke zerfallen. Wird von aussen gesetzt, wenn es gemessen ist. */
  readonly targetX = new Animated.Value(0);
  readonly targetY = new Animated.Value(0);
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

  /**
   * Ein Stueck auf einer Bahn mit drei Punkten: 0 verstreut, 1 an seinem Platz,
   * 2 im Ziel. Das Zusammensetzen laeuft von 0 nach 1, das Zerfallen von 1
   * nach 2 — dieselbe Zahl, zwei Richtungen.
   */
  private pieceMotion(
    piece: AvatarPiece,
    index: number,
    glintOpacity: Animated.AnimatedInterpolation<number>,
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
        ? this.hover.interpolate<number>({
            inputRange: [-1, 1],
            outputRange:
              index % 2 === 0 ? [-SPARK_FLOAT, SPARK_FLOAT] : [SPARK_FLOAT, -SPARK_FLOAT],
          })
        : null;
    // Nur die Augen wandern — der Kopf bleibt, wo er ist.
    const look = piece.blink
      ? this.gaze.interpolate<number>({
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
      Animated.multiply<number>(gone, this.targetX),
      arc(scatter.dx),
      look,
    ]);
    const translateY = sum([
      homeY,
      Animated.multiply<number>(gone, this.targetY),
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
      scaleY: piece.blink ? this.blink : 1,
      opacity: piece.blink === 'glint' ? Animated.multiply<number>(opacity, glintOpacity) : opacity,
    };
  }

  setHandlers(handlers: Handlers) {
    this.handlers = handlers;
  }

  play(phase: AvatarPhase, reduced: boolean, gazeOnly: boolean) {
    if (phase === 'turnAway') {
      this.turnAway(reduced);
      return;
    }
    if (phase === 'scatter') {
      this.scatter(reduced);
      return;
    }
    this.comeBack();
    if (this.assembled) {
      this.startIdle(reduced, gazeOnly);
      return;
    }
    if (phase === 'idle' || reduced) {
      this.snap(reduced, gazeOnly);
      return;
    }
    this.assemble(gazeOnly);
  }

  /** Wohin die Stuecke zerfallen — gemessen, sobald der Platz bekannt ist. */
  setTarget(target: AvatarTarget | undefined) {
    this.targetX.setValue(target?.x ?? 0);
    this.targetY.setValue(target?.y ?? 0);
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

  private snap(reduced: boolean, gazeOnly: boolean) {
    this.pieces.forEach(({ progress }) => progress.setValue(1));
    this.spin.setValue(1);
    this.assembled = true;
    this.startIdle(reduced, gazeOnly);
    this.handlers.onAssembled?.();
  }

  private assemble(gazeOnly: boolean) {
    this.stopAll();
    this.spin.setValue(0);
    this.blink.setValue(1);
    // Nach einem Zerfall stehen die Stuecke im Ziel — von dort faengt niemand
    // an. Sie gehen zuerst zurueck an ihre Startpunkte.
    this.pieces.forEach(({ progress }) => progress.setValue(0));
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
      this.startIdle(false, gazeOnly);
      this.handlers.onAssembled?.();
    });
  }

  /**
   * Er zerfaellt und fliegt als Welle zum Ziel: was zuletzt angekommen war,
   * geht zuerst. Wer weniger Bewegung wuenscht, sieht ihn nur ausblenden.
   */
  private scatter(reduced: boolean) {
    this.stopAll();
    this.blink.setValue(1);
    this.assembled = false;

    if (reduced) {
      this.timing(this.away, 1, this.motion.duration.exit, this.motion.easing.inOut).start(
        ({ finished }) => {
          if (finished) this.handlers.onScattered?.();
        },
      );
      return;
    }

    const flights = this.pieces.map(({ piece, progress }) =>
      Animated.timing(progress, {
        toValue: 2,
        duration: DRIFT_MS,
        delay: arrivalDelay(1 - piece.wave, SCATTER_MS, DRIFT_MS),
        easing: this.motion.easing.inOut,
        useNativeDriver,
      }),
    );
    const run = Animated.parallel(flights);
    this.running = run;
    run.start(({ finished }) => {
      if (!finished) return;
      this.running = null;
      this.handlers.onScattered?.();
    });
  }

  private startIdle(reduced: boolean, gazeOnly: boolean) {
    this.stopLoops();
    if (reduced) {
      this.sway.setValue(0);
      this.hover.setValue(0);
      this.gaze.setValue(0);
      return;
    }
    const ease = this.motion.easing.inOut;
    const blink = () => [
      this.timing(this.blink, BLINK_CLOSED, BLINK_CLOSE_MS),
      this.timing(this.blink, 1, BLINK_OPEN_MS),
    ];
    const [first, second, double] = BLINK_PAUSES_MS;

    // Der Blick wandert immer, mit Pausen dazwischen — so wirkt es wie
    // Umschauen und nicht wie ein Pendel.
    const looking = Animated.loop(
      Animated.sequence([
        Animated.delay(GAZE_HOLD_MS),
        this.timing(this.gaze, 1, GAZE_MS / 4, ease),
        Animated.delay(GAZE_HOLD_MS),
        this.timing(this.gaze, -1, GAZE_MS / 2, ease),
        Animated.delay(GAZE_HOLD_MS),
        this.timing(this.gaze, 0, GAZE_MS / 4, ease),
      ]),
    );
    const swaying = Animated.loop(
      Animated.sequence([
        this.timing(this.sway, 1, SWAY_MS / 4, ease),
        this.timing(this.sway, -1, SWAY_MS / 2, ease),
        this.timing(this.sway, 0, SWAY_MS / 4, ease),
      ]),
    );
    const hovering = Animated.loop(
      Animated.sequence([
        this.timing(this.hover, 1, HOVER_MS, ease),
        this.timing(this.hover, -1, HOVER_MS, ease),
      ]),
    );
    const blinking = Animated.loop(
      Animated.sequence([
        Animated.delay(first),
        ...blink(),
        Animated.delay(second),
        ...blink(),
        Animated.delay(double),
        ...blink(),
      ]),
    );

    // Wo nur der Blick wandern soll, steht der Koerper still.
    if (gazeOnly) this.sway.setValue(0);
    this.loops = gazeOnly ? [looking, hovering, blinking] : [looking, swaying, hovering, blinking];
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
  gazeOnly = false,
  target,
  onAssembled,
  onTurnedAway,
  onScattered,
  bounceKey,
}: ClubAvatarProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [motion] = useState(() => new AvatarMotion(theme.motion));

  useEffect(() => {
    motion.setHandlers({ onAssembled, onTurnedAway, onScattered });
  }, [motion, onAssembled, onTurnedAway, onScattered]);

  // Auf die Zahlen hoeren, nicht auf das Objekt: sonst liefe der Effekt bei
  // jedem Rendern, weil der Aufrufer es frisch baut.
  const targetX = target?.x;
  const targetY = target?.y;
  useEffect(() => {
    motion.setTarget(
      targetX === undefined || targetY === undefined ? undefined : { x: targetX, y: targetY },
    );
  }, [motion, targetX, targetY]);

  useEffect(() => {
    if (reduced === null) return;
    motion.play(phase, reduced, gazeOnly);
  }, [motion, phase, reduced, gazeOnly]);

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
