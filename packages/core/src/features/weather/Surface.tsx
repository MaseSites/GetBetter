import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, type Theme } from '@/theme';
import { Icon, Text, type IconName } from '@/ui';

import { WEATHER_METRICS } from './metrics';

/** Die leichte Flaeche: ein Hauch Schrift ueber dem Papier, in Hell und Dunkel. */
export function surfaceColor(theme: Theme): string {
  return `${theme.colors.text}${WEATHER_METRICS.surfaceAlpha}`;
}

/** Die Spur hinter Balken und Skalen. */
export function trackColor(theme: Theme): string {
  return `${theme.colors.text}${WEATHER_METRICS.trackAlpha}`;
}

/** Ein Anteil 0–1 als Prozent fuer `left`, `width` und `height`. */
export function share(value: number): `${number}%` {
  const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  return `${clamped * 100}%`;
}

export type SurfaceProps = {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Ein Modul: 16 pt Radius, 16 pt Innenrand, keine Schatten. Drueckbar nur, wenn
 * es selbst keinen Knopf enthaelt.
 */
export function Surface({ children, onPress, accessibilityLabel, style }: SurfaceProps) {
  const theme = useTheme();
  const base: ViewStyle = {
    backgroundColor: surfaceColor(theme),
    borderRadius: theme.radii.md,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  };

  if (!onPress) return <View style={[base, style]}>{children}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [base, style, { opacity: pressed ? 0.7 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

/** Die kleine Marke oben in einem Modul: Symbol und Name. */
export function ModuleLabel({ icon, label }: { icon: IconName; label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.label, { gap: theme.spacing.xs }]}>
      <Icon name={icon} size={14} color={theme.colors.textMuted} />
      <Text variant="overline" tone="muted" numberOfLines={1} style={styles.shrink}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { flexDirection: 'row', alignItems: 'center' },
  shrink: { flexShrink: 1 },
});
