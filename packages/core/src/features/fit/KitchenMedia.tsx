import { useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
} from 'react-native';

import { useTheme } from '@/theme';
import { Icon, Text, usePressScale, useReducedMotion } from '@/ui';

/**
 * Bilder und Haken der Kueche: ein Foto blendet beim ersten Laden in 200 ms
 * ein, der runde Haken fuellt sich in 160 ms. Bei reduzierter Bewegung steht
 * beides sofort da.
 */

const THUMB = 52;
const THUMB_RADIUS = 12;
const CHECK = 24;
const CHECK_BORDER = 1.7;
const NATIVE = Platform.OS !== 'web';

/** Ein Foto, das einmal weich erscheint. */
export function FadeImage({
  source,
  style,
  label,
}: {
  source: ImageSourcePropType;
  style: StyleProp<ImageStyle>;
  label: string;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(0));

  function shown() {
    if (reduced) {
      opacity.setValue(1);
      return;
    }
    Animated.timing(opacity, {
      toValue: 1,
      duration: theme.motion.duration.reveal,
      easing: theme.motion.easing.out,
      useNativeDriver: NATIVE,
    }).start();
  }

  return (
    <View style={[style, { backgroundColor: theme.colors.surfaceMuted, overflow: 'hidden' }]}>
      <Animated.Image
        source={source}
        accessibilityLabel={label}
        resizeMode="cover"
        onLoad={shown}
        // Breite und Hoehe ausdruecklich: sonst nimmt das Bild im Browser seine eigene Groesse.
        style={[StyleSheet.absoluteFill, styles.fill, { opacity }]}
      />
    </View>
  );
}

/** Das kleine Bild in einer Zeile. Ohne Foto eine ruhige Senke mit Teller. */
export function Thumb({ source, label }: { source: ImageSourcePropType | null; label: string }) {
  const theme = useTheme();
  const box = { width: THUMB, height: THUMB, borderRadius: THUMB_RADIUS };
  if (source) return <FadeImage source={source} style={box} label={label} />;
  return (
    <View style={[box, styles.center, { backgroundColor: theme.colors.surfaceMuted }]}>
      <Icon name="meal" size={20} color={theme.colors.textFaint} />
    </View>
  );
}

/** Der runde Haken: leer mit Linie, erledigt im Signal mit Tinte darauf. */
export function RoundCheck({ checked }: { checked: boolean }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [fill] = useState(() => new Animated.Value(checked ? 1 : 0));

  useEffect(() => {
    if (reduced !== false) {
      fill.setValue(checked ? 1 : 0);
      return;
    }
    Animated.timing(fill, {
      toValue: checked ? 1 : 0,
      duration: theme.motion.duration.press,
      easing: theme.motion.easing.out,
      useNativeDriver: NATIVE,
    }).start();
  }, [checked, fill, reduced, theme.motion]);

  return (
    <View
      style={{
        width: CHECK,
        height: CHECK,
        borderRadius: CHECK / 2,
        borderWidth: CHECK_BORDER,
        borderColor: checked ? theme.colors.accentMark : theme.colors.textFaint,
      }}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.center,
          {
            borderRadius: CHECK / 2,
            backgroundColor: theme.colors.accent,
            opacity: fill,
            transform: [{ scale: fill.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
          },
        ]}
      >
        <Icon name="check" size={14} color={theme.colors.textOnAccent} />
      </Animated.View>
    </View>
  );
}

/**
 * Eine weisse Pille auf Papier (Schatten e1) — Vorschlaege, Stichwoerter,
 * „Bald brauchen“. Ohne `onPress` nur eine Marke.
 */
export function WhiteChip({
  children,
  label,
  onPress,
  selected = false,
  dense = false,
}: {
  children: ReactNode;
  label: string;
  onPress?: () => void;
  selected?: boolean;
  /** Wie „Bald brauchen“ in der Vision: 8 · 12 Innenabstand, ohne Mindesthoehe. */
  dense?: boolean;
}) {
  const theme = useTheme();
  const press = usePressScale();
  const body = (
    <Animated.View
      style={[
        styles.chip,
        dense ? styles.dense : null,
        selected ? null : theme.elevation.card,
        {
          paddingVertical: dense ? theme.spacing.sm : 0,
          gap: theme.spacing.xs,
          borderRadius: theme.radii.pill,
          paddingHorizontal: theme.spacing.md,
          backgroundColor: selected ? theme.colors.inverse : theme.colors.surface,
          transform: [{ scale: onPress ? press.scale : 1 }],
        },
      ]}
    >
      {typeof children === 'string' ? (
        <Text
          variant="label"
          numberOfLines={1}
          style={{
            fontWeight: theme.fontWeight.semibold,
            color: selected ? theme.colors.onInverse : theme.colors.text,
          }}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Animated.View>
  );
  if (!onPress)
    return (
      <View accessible accessibilityLabel={label}>
        {body}
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%' },
  chip: { minHeight: 36, flexDirection: 'row', alignItems: 'center' },
  dense: { minHeight: 0 },
});
