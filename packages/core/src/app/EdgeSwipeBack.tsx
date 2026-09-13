import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type PanResponderInstance,
} from 'react-native';

import { useTheme } from '@/theme';
import { FLING_VELOCITY, isHorizontalSwipe } from '@/ui/gestures';
import { Icon } from '@/ui/Icon';

/**
 * So nah am Rand muss der Wisch beginnen — innerhalb des Seitenrands, damit
 * Chips und Karten, die dort anfangen, selbst gezogen werden koennen.
 */
const EDGE = 20;
/** Ab hier geht es einen Schritt weiter. */
const BACK_DISTANCE = 96;
const BUBBLE = 40;

/** Vom linken Rand nach rechts heisst zurueck, vom rechten nach links vorwaerts. */
type Side = 'back' | 'forward';

/**
 * Am Rand wischen heisst blaettern — wie am iPhone: vom **linken** Rand nach
 * rechts geht es zurueck, vom **rechten** Rand nach links wieder vorwaerts.
 *
 * iOS kann das Zurueck im Stapel schon selbst, Android hat die Systemgeste. Im
 * Browser fehlt beides: dort zeigt ein kleiner Kreis mit Pfeil, wie weit man
 * ist, und ab einer Strecke geht es eine Seite weiter.
 */
export function EdgeSwipeBack({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return <WebEdgeSwipe>{children}</WebEdgeSwipe>;
}

type BackTarget = { canGoBack: () => boolean; back: () => void };

/**
 * Ob es nach vorne ueberhaupt weitergeht. Nur Chromium sagt es ueber die
 * Navigation-API; wo sie fehlt, lassen wir die Geste zu — `history.forward()`
 * tut dann eben nichts, statt dass wir sie grundlos sperren.
 */
function canGoForward(): boolean {
  const nav = (globalThis as { navigation?: { canGoForward?: boolean } }).navigation;
  return nav?.canGoForward ?? true;
}

/** Die Geste ausserhalb von React: waehrend des Ziehens wird nichts gerendert. */
class EdgeController {
  readonly pull = new Animated.Value(0);
  readonly bubbleY = new Animated.Value(0);
  readonly responder: PanResponderInstance;
  private frame = { left: 0, top: 0, width: 0 };
  private target: BackTarget = { canGoBack: () => false, back: () => undefined };
  private side: Side = 'back';
  private onSide: (side: Side) => void = () => undefined;
  private measure: () => void = () => undefined;

  constructor(exitMs: number) {
    const fade = () =>
      Animated.timing(this.pull, { toValue: 0, duration: exitMs, useNativeDriver: false }).start();

    /**
     * An welchem Rand der Finger aufgesetzt hat — oder nirgends. Solange der
     * Rahmen noch nicht vermessen ist, gilt die Fensterbreite: sonst waere der
     * rechte Rand in den ersten Bildern gar nicht da.
     */
    const sideOf = (x0: number): Side | null => {
      const width = this.frame.width > 0 ? this.frame.width : Dimensions.get('window').width;
      if (x0 - this.frame.left <= EDGE) return 'back';
      if (this.frame.left + width - x0 <= EDGE) return 'forward';
      return null;
    };

    /** Wie weit es in die Richtung dieser Seite ging. */
    const travelled = (dx: number) => (this.side === 'back' ? dx : -dx);

    /**
     * Wo der Finger aufgesetzt hat. **Nicht** `gesture.x0`: das steht erst,
     * wenn der Responder zugeteilt ist, und ist in der Pruefphase 0 — damit
     * sah jeder Wisch wie einer vom linken Rand aus. Aus der aktuellen
     * Position minus der zurueckgelegten Strecke kommt der Anfang immer heraus.
     */
    const startX = (gesture: { moveX: number; dx: number }) => gesture.moveX - gesture.dx;

    this.responder = PanResponder.create({
      // Beim Aufsetzen neu vermessen — ein gespeicherter Rand ist nach jeder
      // Groessenaenderung falsch, und ein falscher Rand macht aus jedem Wisch
      // ein Zurueck. Bis der erste Zug kommt, ist die Messung da.
      onStartShouldSetPanResponderCapture: () => {
        this.measure();
        return false;
      },
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        if (!isHorizontalSwipe(gesture)) return false;
        const side = sideOf(startX(gesture));
        if (side === 'back') return gesture.dx > 0 && this.target.canGoBack();
        if (side === 'forward') return gesture.dx < 0 && canGoForward();
        return false;
      },
      onPanResponderGrant: (_, gesture) => {
        this.side = sideOf(startX(gesture)) ?? 'back';
        this.onSide(this.side);
        this.bubbleY.setValue(gesture.moveY - this.frame.top - BUBBLE / 2);
      },
      onPanResponderMove: (_, gesture) => {
        this.pull.setValue(Math.max(0, travelled(gesture.dx)));
        this.bubbleY.setValue(gesture.moveY - this.frame.top - BUBBLE / 2);
      },
      onPanResponderRelease: (_, gesture) => {
        fade();
        const way = travelled(gesture.dx);
        const speed = travelled(gesture.vx);
        if (way < BACK_DISTANCE && !(speed > FLING_VELOCITY && way > EDGE)) return;
        if (this.side === 'back') this.target.back();
        else globalThis.history?.forward();
      },
      onPanResponderTerminate: fade,
      onPanResponderTerminationRequest: () => false,
    });
  }

  setFrame(left: number, top: number, width: number) {
    this.frame = { left, top, width };
  }

  setTarget(target: BackTarget) {
    this.target = target;
  }

  setOnSide(onSide: (side: Side) => void) {
    this.onSide = onSide;
  }

  setMeasure(measure: () => void) {
    this.measure = measure;
  }
}

function WebEdgeSwipe({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const router = useRouter();
  const window = useWindowDimensions();
  const container = useRef<View>(null);
  const [controller] = useState(() => new EdgeController(theme.motion.duration.exit));
  const [side, setSide] = useState<Side>('back');
  const { pull, bubbleY } = controller;

  useEffect(() => {
    controller.setTarget(router);
    controller.setOnSide(setSide);
    controller.setMeasure(() =>
      container.current?.measureInWindow((left, top, width) =>
        controller.setFrame(left, top, width),
      ),
    );
  }, [controller, router]);

  // Der Rahmen steht im Browser mittig; wandert das Fenster, wandert der Rand mit.
  useEffect(() => {
    container.current?.measureInWindow((left, top, width) => controller.setFrame(left, top, width));
  }, [controller, window.width, window.height]);

  const forward = side === 'forward';
  // Die Blase kommt aus ihrem Rand herein — links nach rechts, rechts nach links.
  const bubbleX = pull.interpolate({
    inputRange: [0, BACK_DISTANCE],
    outputRange: forward ? [BUBBLE, -theme.spacing.md] : [-BUBBLE, theme.spacing.md],
    extrapolate: 'clamp',
  });
  const bubbleOpacity = pull.interpolate({
    inputRange: [0, BACK_DISTANCE / 3, BACK_DISTANCE],
    outputRange: [0, 0.6, 1],
    extrapolate: 'clamp',
  });
  const bubbleScale = pull.interpolate({
    inputRange: [0, BACK_DISTANCE],
    outputRange: [0.6, 1],
    extrapolate: 'clamp',
  });

  return (
    <View
      ref={container}
      style={styles.fill}
      onLayout={() =>
        container.current?.measureInWindow((left, top, width) =>
          controller.setFrame(left, top, width),
        )
      }
      {...controller.responder.panHandlers}
    >
      {children}
      <Animated.View
        style={[
          styles.bubble,
          forward ? styles.bubbleRight : styles.bubbleLeft,
          theme.elevation.raised,
          {
            width: BUBBLE,
            height: BUBBLE,
            borderRadius: BUBBLE / 2,
            backgroundColor: theme.colors.surface,
            opacity: bubbleOpacity,
            transform: [{ translateX: bubbleX }, { translateY: bubbleY }, { scale: bubbleScale }],
          },
        ]}
      >
        <Icon name={forward ? 'forward' : 'back'} size={20} color={theme.colors.text} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bubble: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  bubbleLeft: { left: 0 },
  bubbleRight: { right: 0 },
});
