import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
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
 * So nah am linken Rand muss der Wisch beginnen — innerhalb des Seitenrands,
 * damit Chips und Karten, die dort anfangen, selbst gezogen werden koennen.
 */
const EDGE = 20;
/** Ab hier geht es zurueck. */
const BACK_DISTANCE = 96;
const BUBBLE = 40;

/**
 * Vom linken Rand nach rechts wischen heisst zurueck — wie am iPhone.
 *
 * iOS kann das im Stapel schon selbst, Android hat die Systemgeste. Im Browser
 * fehlt beides: dort zeigt ein kleiner Kreis mit Pfeil, wie weit man ist, und
 * ab einer Strecke geht es eine Seite zurueck.
 */
export function EdgeSwipeBack({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return <WebEdgeSwipe>{children}</WebEdgeSwipe>;
}

type BackTarget = { canGoBack: () => boolean; back: () => void };

/** Die Geste ausserhalb von React: waehrend des Ziehens wird nichts gerendert. */
class EdgeController {
  readonly pull = new Animated.Value(0);
  readonly bubbleY = new Animated.Value(0);
  readonly responder: PanResponderInstance;
  private frame = { left: 0, top: 0 };
  private target: BackTarget = { canGoBack: () => false, back: () => undefined };

  constructor(exitMs: number) {
    const fade = () =>
      Animated.timing(this.pull, { toValue: 0, duration: exitMs, useNativeDriver: false }).start();

    this.responder = PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        gesture.x0 - this.frame.left <= EDGE &&
        gesture.dx > 0 &&
        isHorizontalSwipe(gesture) &&
        this.target.canGoBack(),
      onPanResponderGrant: (_, gesture) => {
        this.bubbleY.setValue(gesture.y0 - this.frame.top - BUBBLE / 2);
      },
      onPanResponderMove: (_, gesture) => {
        this.pull.setValue(Math.max(0, gesture.dx));
        this.bubbleY.setValue(gesture.moveY - this.frame.top - BUBBLE / 2);
      },
      onPanResponderRelease: (_, gesture) => {
        fade();
        if (gesture.dx >= BACK_DISTANCE || (gesture.vx > FLING_VELOCITY && gesture.dx > EDGE)) {
          this.target.back();
        }
      },
      onPanResponderTerminate: fade,
      onPanResponderTerminationRequest: () => false,
    });
  }

  setFrame(left: number, top: number) {
    this.frame = { left, top };
  }

  setTarget(target: BackTarget) {
    this.target = target;
  }
}

function WebEdgeSwipe({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const router = useRouter();
  const window = useWindowDimensions();
  const container = useRef<View>(null);
  const [controller] = useState(() => new EdgeController(theme.motion.duration.exit));
  const { pull, bubbleY } = controller;

  useEffect(() => {
    controller.setTarget(router);
  }, [controller, router]);

  // Der Rahmen steht im Browser mittig; wandert das Fenster, wandert der Rand mit.
  useEffect(() => {
    container.current?.measureInWindow((left, top) => controller.setFrame(left, top));
  }, [controller, window.width, window.height]);

  const bubbleX = pull.interpolate({
    inputRange: [0, BACK_DISTANCE],
    outputRange: [-BUBBLE, theme.spacing.md],
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
        container.current?.measureInWindow((left, top) => controller.setFrame(left, top))
      }
      {...controller.responder.panHandlers}
    >
      {children}
      <Animated.View
        style={[
          styles.bubble,
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
        <Icon name="back" size={20} color={theme.colors.text} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bubble: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
});
