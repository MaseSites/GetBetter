import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type EmptyStateProps = {
  icon?: IconName;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
};

/**
 * Kein Bildschirm bleibt weiss. Wo nichts ist, steht hier, warum.
 *
 * Kein trauriges Maskottchen und kein «Ups»: ein Zeichen, ein Satz, der sagt
 * was jetzt geht, und genau ein Knopf. Leer ist kein Fehler.
 */
export function EmptyState({
  icon = 'info',
  title,
  body,
  actionLabel,
  onAction,
  compact = false,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingVertical: compact ? theme.spacing.lg : theme.spacing.xxl,
          paddingHorizontal: theme.spacing.lg,
          gap: theme.spacing.sm,
        },
      ]}
    >
      <View
        style={[
          styles.iconBox,
          { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radii.lg },
        ]}
      >
        <Icon name={icon} size={28} color={theme.colors.textFaint} />
      </View>
      <Text variant="title" align="center" style={{ marginTop: theme.spacing.sm }}>
        {title}
      </Text>
      <Text variant="body" tone="muted" align="center" style={styles.body}>
        {body}
      </Text>
      {actionLabel && onAction ? (
        <View style={{ marginTop: theme.spacing.md }}>
          <Button label={actionLabel} onPress={onAction} fullWidth={false} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  iconBox: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  // Ein Satz liest sich schlecht ueber die ganze Breite.
  body: { maxWidth: 280 },
});
