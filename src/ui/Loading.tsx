import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';

import { Text } from './Text';

export type LoadingProps = {
  label?: string;
  compact?: boolean;
};

/** P-019: ein einziger Ladezustand fuer die ganze App. */
export function Loading({ label, compact = false }: LoadingProps) {
  const theme = useTheme();
  const t = useTranslate();

  return (
    <View
      accessibilityRole="progressbar"
      style={[
        styles.wrap,
        { paddingVertical: compact ? theme.spacing.lg : theme.spacing.xxl, gap: theme.spacing.md },
      ]}
    >
      <ActivityIndicator color={theme.colors.accent} />
      <Text variant="label" tone="muted">
        {label ?? t('common.loading')}
      </Text>
    </View>
  );
}

/** Platzhalterbalken fuer Inhalte, die gleich kommen. */
export function Skeleton({
  height = 16,
  width,
}: {
  height?: number;
  width?: number | `${number}%`;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        height,
        width: width ?? '100%',
        borderRadius: theme.radii.sm,
        backgroundColor: theme.colors.surfaceMuted,
      }}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
