import { useState } from 'react';
import { Animated, Platform } from 'react-native';

import { useTheme } from '@/theme';

/**
 * Was man drueckt, gibt nach.
 *
 * Ohne diese Rueckmeldung fuehlt sich eine Oberflaeche tot an, auch wenn sie
 * gleich schnell reagiert — auf dem Standbild sieht man keinen Unterschied,
 * beim Bedienen sofort. Das Zurueckfedern ist schneller als das Eindruecken:
 * die Entscheidung darf dauern, die Antwort darauf nicht.
 */
export function usePressScale(to?: number) {
  const theme = useTheme();
  const target = to ?? theme.motion.pressScale.button;
  // Kein `useRef`: der Wert wird waehrend des Renderns gelesen, und dafuer ist
  // der Erstwert von `useState` da.
  const [scale] = useState(() => new Animated.Value(1));

  function run(value: number, duration: number) {
    Animated.timing(scale, {
      toValue: value,
      duration,
      easing: theme.motion.easing.out,
      // Im Browser gibt es kein natives Animated-Modul. `true` faellt dort
      // zwar auf JavaScript zurueck, schreibt aber bei jedem ersten Druck eine
      // Warnung in die Konsole. Auf dem Geraet bleibt die Animation nativ.
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }

  return {
    /** Auf ein `Animated.View` legen: `style={{ transform: [{ scale }] }}`. */
    scale,
    onPressIn: () => run(target, theme.motion.duration.press),
    onPressOut: () => run(1, theme.motion.duration.exit),
  };
}
