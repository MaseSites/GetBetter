import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';

import { useTheme } from '@/theme';

import { useReducedMotion } from './useReducedMotion';

const useNativeDriver = Platform.OS !== 'web';

/** Fein — ein Hauch von Rand, kein Rahmen. */
const RING_WIDTH = 1.5;
/** Wie lange der Ring ganz zu sehen ist, bevor er verblasst. */
const HOLD_MS = 420;
/** Das Verblassen darf sich Zeit lassen: es soll auslaufen, nicht abbrechen. */
const FADE_OUT_MS = 520;

/**
 * Ein kurzes Aufleuchten: ein feiner Ring in der hellen Signalfarbe, der
 * erscheint und gleich wieder verblasst — fuer den Eintrag, zu dem man gerade
 * gesprungen ist. Er wartet, bis der Bildschirm angekommen ist, und nimmt
 * keine Tipps an. Bei reduzierter Bewegung blitzt er nur kurz auf, ohne Blende.
 *
 * Liegt ueber dem ganzen Eintrag (`absoluteFill`); `radius` ist dessen Rundung.
 */
export function FlashRing({ radius }: { radius: number }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // Erst wenn klar ist, ob weniger Bewegung gewuenscht ist.
    if (reduced === null) return;
    const fade = (toValue: number, duration: number) =>
      Animated.timing(opacity, {
        toValue,
        duration: reduced ? 0 : duration,
        easing: theme.motion.easing.out,
        useNativeDriver,
      });
    const flash = Animated.sequence([
      // Nach dem Bildschirmwechsel und dem Rollen dorthin — sonst leuchtet er ungesehen.
      Animated.delay(theme.motion.duration.sheet + theme.motion.duration.reveal),
      fade(1, theme.motion.duration.press),
      Animated.delay(HOLD_MS),
      fade(0, FADE_OUT_MS),
    ]);
    flash.start();
    return () => flash.stop();
  }, [opacity, reduced, theme.motion]);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: radius,
          borderWidth: RING_WIDTH,
          borderColor: theme.colors.accent,
          opacity,
          pointerEvents: 'none',
        },
      ]}
    />
  );
}
