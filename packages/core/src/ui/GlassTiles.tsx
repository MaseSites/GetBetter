import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { usePressScale } from './usePressScale';

/** Zehn Glaeser wie im Entwurf — zusammen das Tagesziel. */
export const GLASS_COUNT = 10;
const GLASS_HEIGHT = 38;
const GLASS_BORDER = 1.5;
const ACTION_HEIGHT = 44;
/** Gegen Rundungsfehler: 3.3 dl von 33 dl sind genau ein Glas, nicht 0.9999. */
const EPSILON = 1e-9;

/**
 * Das Trinken als Reihe von Glaesern: jedes ist ein Zehntel des Tagesziels,
 * volle stehen im Signal. So sieht man ohne Zahl, wie weit der Tag ist.
 * Die Zahl dazu steht im Kopf des Blocks und als Vorlesetext.
 */
export function GlassTiles({ share, label }: { share: number; label: string }) {
  const theme = useTheme();
  const filled = Math.max(0, Math.min(GLASS_COUNT, Math.floor(share * GLASS_COUNT + EPSILON)));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: GLASS_COUNT, now: filled }}
      style={[styles.row, { gap: theme.spacing.xs, marginTop: theme.spacing.md }]}
    >
      {Array.from({ length: GLASS_COUNT }, (_, index) => (
        <View
          key={`glass-${index}`}
          style={[
            styles.glass,
            {
              borderRadius: theme.radii.xs,
              borderColor: index < filled ? theme.colors.accentStrong : theme.colors.borderStrong,
              backgroundColor: index < filled ? theme.colors.accent : 'transparent',
            },
          ]}
        />
      ))}
    </View>
  );
}

/**
 * Ein Knopf im Block: Tinte fuer das, was man meistens tut, sonst die Senke.
 * Mehrere nebeneinander teilen sich die Breite.
 */
export function PanelAction({
  label,
  icon,
  primary = false,
  disabled = false,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  icon?: IconName | undefined;
  primary?: boolean | undefined;
  disabled?: boolean | undefined;
  accessibilityLabel?: string | undefined;
  onPress: () => void;
}) {
  const theme = useTheme();
  const press = usePressScale();
  const color = primary ? theme.colors.onInverse : theme.colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={styles.grow}
    >
      <Animated.View
        style={[
          styles.action,
          {
            gap: theme.spacing.xs,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radii.pill,
            backgroundColor: primary ? theme.colors.inverse : theme.colors.surfaceMuted,
            opacity: disabled ? 0.5 : 1,
            transform: [{ scale: press.scale }],
          },
        ]}
      >
        {icon ? <Icon name={icon} size={16} color={color} /> : null}
        <Text
          variant="label"
          numberOfLines={1}
          style={{
            color,
            fontSize: theme.fontSize.lede,
            lineHeight: theme.lineHeight.lede,
            fontWeight: theme.fontWeight.semibold,
          }}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  glass: { flex: 1, height: GLASS_HEIGHT, borderWidth: GLASS_BORDER },
  action: {
    minHeight: ACTION_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
