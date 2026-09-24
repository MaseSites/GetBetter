import { Animated, Platform } from 'react-native';

import type { Theme } from '@/theme';

import { arrivalDelay, type AvatarPiece } from './avatarPieces';
import { pieceMotionOf, type AnimatedNumber, type PieceMotion } from './pieceMotion';

export type { PieceMotion } from './pieceMotion';

/**
 * - `assemble` — die Stuecke fliegen an ihren Platz, danach schaut er sich um
 * - `idle`     — steht schon da und schaut sich um
 * - `turnAway` — dreht sich weg und blendet aus
 * - `scatter`  — er zerfaellt und fliegt als Welle zum Ziel davon
 */
export type AvatarPhase = 'assemble' | 'idle' | 'turnAway' | 'scatter';

/** Wohin die Stuecke beim Zerfallen fliegen, in Punkten vom Mittelpunkt aus. */
export type AvatarTarget = { x: number; y: number };

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
/** In Leinwand-Einheiten: wie hoch er schwebt, wie weit das Gesicht beim Drehen mitgeht. */
const HOVER_UNITS = 2.2;
const FACE_DEPTH = 3.5;
const BLINK_CLOSED = 0.1;
const BOUNCE_SCALE = 1.08;
const TURN_SCALE = 0.86;

const useNativeDriver = Platform.OS !== 'web';

/**
 * Eine Schleife ohne Sprung. `Animated.loop` setzt vor jeder Runde jeden Wert
 * auf den zurueck, mit dem er *gebaut* wurde — nicht auf den, bei dem die Runde
 * endete. Das Schweben endet unten und begann in der Mitte: am Ende jeder
 * Runde sprang der Avatar. Ohne das Zuruecksetzen faengt jede Runde genau dort
 * an, wo die vorige aufgehoert hat.
 */
function seamless(animation: Animated.CompositeAnimation): Animated.CompositeAnimation {
  return Animated.loop(animation, { resetBeforeIteration: false });
}

type Handlers = {
  onAssembled?: () => void;
  onTurnedAway?: () => void;
  onScattered?: () => void;
};

/**
 * Die ganze Bewegung lebt ausserhalb von React. Gerendert wird nur, wenn sich
 * Farbe, Groesse oder Phase aendern — Fliegen, Schweben und Blinzeln laufen
 * ueber Animated-Werte, auf dem Geraet nativ. Die Stuecke stehen beim Bauen
 * fest; eine andere Form bekommt eine neue Bewegung.
 */
export class AvatarMotion {
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

  constructor(
    private readonly motion: Theme['motion'],
    pieces: readonly AvatarPiece[],
  ) {
    const shared = {
      hover: this.hover,
      gaze: this.gaze,
      blink: this.blink,
      targetX: this.targetX,
      targetY: this.targetY,
      glintOpacity: this.blink.interpolate<number>({
        inputRange: [BLINK_CLOSED, 1],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }),
    };
    this.pieces = pieces.map((piece, index) => pieceMotionOf(piece, index, shared));

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
    const looking = seamless(
      Animated.sequence([
        Animated.delay(GAZE_HOLD_MS),
        this.timing(this.gaze, 1, GAZE_MS / 4, ease),
        Animated.delay(GAZE_HOLD_MS),
        this.timing(this.gaze, -1, GAZE_MS / 2, ease),
        Animated.delay(GAZE_HOLD_MS),
        this.timing(this.gaze, 0, GAZE_MS / 4, ease),
      ]),
    );
    const swaying = seamless(
      Animated.sequence([
        this.timing(this.sway, 1, SWAY_MS / 4, ease),
        this.timing(this.sway, -1, SWAY_MS / 2, ease),
        this.timing(this.sway, 0, SWAY_MS / 4, ease),
      ]),
    );
    // Hoch, runter, hoch … — ab der zweiten Runde von ganz unten nach ganz oben.
    const hovering = seamless(
      Animated.sequence([
        this.timing(this.hover, 1, HOVER_MS, ease),
        this.timing(this.hover, -1, HOVER_MS, ease),
      ]),
    );
    const blinking = seamless(
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
