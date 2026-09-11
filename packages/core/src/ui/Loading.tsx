import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';

import { Text } from './Text';

export type LoadingProps = {
  label?: string;
  compact?: boolean;
};

/** Ein einziger Ladezustand fuer die ganze App. */
export function Loading({ label, compact = false }: LoadingProps) {
  const theme = useTheme();
  const t = useTranslate();

  if (compact) {
    return (
      <View
        accessibilityRole="progressbar"
        style={[styles.compact, { paddingVertical: theme.spacing.md, gap: theme.spacing.sm }]}
      >
        <Skeleton height={8} width={48} />
        <Text variant="label" tone="muted">
          {label ?? t('common.loading')}
        </Text>
      </View>
    );
  }

  return (
    <View
      accessibilityRole="progressbar"
      style={[styles.wrap, { paddingVertical: theme.spacing.xxl, gap: theme.spacing.sm }]}
    >
      <View style={[styles.skeletonTitle, { gap: theme.spacing.sm }]}>
        <Skeleton height={12} width="28%" />
        <Skeleton height={24} width="56%" />
      </View>
      {[0, 1, 2].map((row) => (
        <View
          key={row}
          style={[
            styles.skeletonRow,
            theme.elevation.card,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radii.md,
              padding: theme.spacing.md,
              gap: theme.spacing.md,
            },
          ]}
        >
          <Skeleton height={28} width={28} />
          <View style={[styles.skeletonCopy, { gap: theme.spacing.sm }]}>
            <Skeleton height={12} width="46%" />
            <Skeleton height={9} width="72%" />
          </View>
        </View>
      ))}
      {label ? (
        <Text variant="caption" tone="faint" align="center">
          {label}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Platzhalterbalken fuer Inhalte, die gleich kommen.
 *
 * Besser als ein Kreisel: das Geruest steht schon da und fuellt sich, dadurch
 * springt beim Eintreffen der Daten nichts — und das Warten fuehlt sich
 * kuerzer an, als es ist. Es pulst nur die Deckkraft, nichts bewegt sich.
 */
export function Skeleton({
  height = 16,
  width,
}: {
  height?: number;
  width?: number | `${number}%`;
}) {
  const theme = useTheme();
  const [pulse] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 700,
          easing: theme.motion.easing.inOut,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: theme.motion.easing.inOut,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, theme.motion.easing.inOut]);

  return (
    <Animated.View
      style={{
        height,
        width: width ?? '100%',
        borderRadius: theme.radii.xs,
        backgroundColor: theme.colors.surfaceMuted,
        opacity: pulse,
      }}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  compact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  skeletonTitle: { marginBottom: 4 },
  skeletonRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center' },
  skeletonCopy: { flex: 1 },
});
