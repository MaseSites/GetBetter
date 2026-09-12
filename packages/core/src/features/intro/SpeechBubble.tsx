import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Text } from '@/ui';

import { useReducedMotion } from './useReducedMotion';

export type SpeechBubbleProps = {
  text: string;
  /** Wo der Avatar steht — der Zipfel zeigt zu ihm. */
  tail?: 'top' | 'left' | 'none';
  /** `lg` fuer die grosse Frage auf dem Startbildschirm. */
  size?: 'md' | 'lg';
  /**
   * Wechselt der Schluessel, erscheint die Blase neu und tippt. Bleibt er
   * gleich, waechst der Text still mit — etwa waehrend man einen Namen tippt.
   */
  typeKey?: string;
};

/** So viele Schritte braucht jeder Satz, egal wie lang er ist. */
const TYPE_STEPS = 26;
const TYPE_TICK_MS = 22;
const TAIL = 14;
const POP_SCALE = 0.94;

const useNativeDriver = Platform.OS !== 'web';

/**
 * Eine Sprechblase, deren Text zuegig erscheint. Der noch fehlende Rest steht
 * unsichtbar schon da, damit die Blase beim Tippen nicht waechst und springt.
 */
export function SpeechBubble({ text, tail = 'none', size = 'md', typeKey }: SpeechBubbleProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const key = typeKey ?? text;
  const [pop] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduced === null) return;
    if (reduced) {
      pop.setValue(1);
      return;
    }
    pop.setValue(0);
    Animated.timing(pop, {
      toValue: 1,
      duration: theme.motion.duration.reveal,
      easing: theme.motion.easing.out,
      useNativeDriver,
    }).start();
  }, [pop, key, reduced, theme.motion]);

  return (
    <Animated.View
      accessible
      accessibilityRole="text"
      accessibilityLabel={text}
      accessibilityLiveRegion="polite"
      style={[
        styles.bubble,
        theme.elevation.raised,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.lg,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          opacity: pop,
          transform: [
            { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [POP_SCALE, 1] }) },
          ],
        },
      ]}
    >
      {tail === 'none' ? null : (
        <View
          style={[
            styles.tail,
            tail === 'top' ? styles.tailTop : [styles.tailLeft, { top: theme.spacing.lg }],
            { backgroundColor: theme.colors.surface, borderRadius: theme.radii.xs / 2 },
          ]}
        />
      )}
      <Typed
        key={key}
        text={text}
        size={size}
        mode={reduced === null ? 'wait' : reduced ? 'full' : 'type'}
      />
    </Animated.View>
  );
}

/** `wait`, solange offen ist, ob Bewegung erwuenscht ist — dann blitzt nichts auf. */
type TypeMode = 'wait' | 'type' | 'full';

function Typed({ text, size, mode }: { text: string; size: 'md' | 'lg'; mode: TypeMode }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (mode !== 'type' || count >= text.length) return;
    const step = Math.max(1, Math.ceil(text.length / TYPE_STEPS));
    const timer = setTimeout(() => setCount((shown) => shown + step), TYPE_TICK_MS);
    return () => clearTimeout(timer);
  }, [mode, count, text.length]);

  const shown = mode === 'full' ? text.length : Math.min(count, text.length);
  const variant = size === 'lg' ? 'title' : 'body';

  return (
    <Text variant={variant} align={size === 'lg' ? 'center' : 'left'}>
      {text.slice(0, shown)}
      {shown < text.length ? (
        <Text variant={variant} style={styles.hidden}>
          {text.slice(shown)}
        </Text>
      ) : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  bubble: { alignSelf: 'stretch' },
  tail: { position: 'absolute', width: TAIL, height: TAIL, transform: [{ rotate: '45deg' }] },
  tailTop: { top: -TAIL / 2 + 1, left: '50%', marginLeft: -TAIL / 2 },
  tailLeft: { left: -TAIL / 2 + 1 },
  hidden: { color: 'transparent' },
});
