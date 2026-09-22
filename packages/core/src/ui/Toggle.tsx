import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme';

import { useReducedMotion } from './useReducedMotion';

export type ToggleProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
};

/** Masse wie am iPhone: eine Pille, darin der runde Knopf mit etwas Luft. */
const TRACK_WIDTH = 50;
const TRACK_HEIGHT = 30;
const THUMB_GAP = 3;
const THUMB = TRACK_HEIGHT - THUMB_GAP * 2;
const TRAVEL = TRACK_WIDTH - THUMB - THUMB_GAP * 2;
/** So viel groesser wird die Flaeche, auf die man tippen kann — 44 pt hoch. */
const HIT_SLOP = 8;
const DURATION = 180;

/**
 * Der Schalter. Ein: die Pille im Better-Gruen (`accent`), der Knopf in
 * `textOnAccent` — dieselbe Paarung wie der Senden-Knopf, lesbar in jeder
 * Akzentfarbe. Aus: eine graue Pille mit hellem Knopf. Die Stellung des
 * Knopfs sagt es auch ohne Farbe. Ersetzt den `Switch` von React Native, der im
 * Browser einen tuerkisen Knopf und eine zu schmale Spur zeichnet.
 */
export function Toggle({
  value,
  onValueChange,
  accessibilityLabel,
  disabled = false,
}: ToggleProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(value ? 1 : 0));

  useEffect(() => {
    const to = value ? 1 : 0;
    if (reduced === true) {
      progress.setValue(to);
      return;
    }
    // Farben lassen sich nicht nativ animieren — darum alles im selben Takt in JS.
    Animated.timing(progress, {
      toValue: to,
      duration: DURATION,
      easing: theme.motion.easing.out,
      useNativeDriver: false,
    }).start();
  }, [value, reduced, progress, theme.motion]);

  // Aus steht ein heller Knopf auf der grauen Spur — im Dunkeln die helle Schrift.
  const thumbOff = theme.scheme === 'dark' ? theme.colors.text : theme.colors.surface;

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={HIT_SLOP}
      style={{ opacity: disabled ? 0.45 : 1 }}
    >
      <Animated.View
        style={[
          styles.track,
          {
            borderRadius: theme.radii.pill,
            backgroundColor: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [theme.colors.borderStrong, theme.colors.accent],
            }),
          },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            theme.elevation.card,
            {
              borderRadius: theme.radii.pill,
              backgroundColor: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [thumbOff, theme.colors.textOnAccent],
              }),
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, TRAVEL],
                  }),
                },
              ],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: TRACK_WIDTH, height: TRACK_HEIGHT, padding: THUMB_GAP, justifyContent: 'center' },
  thumb: { width: THUMB, height: THUMB },
});
