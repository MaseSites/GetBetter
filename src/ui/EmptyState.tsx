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
 * P-019: Kein Bildschirm bleibt weiss. Wo nichts ist, steht hier, warum.
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
          { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radii.pill },
        ]}
      >
        <Icon name={icon} size={22} color={theme.colors.textFaint} />
      </View>
      <Text variant="title" align="center">
        {title}
      </Text>
      <Text variant="label" tone="muted" align="center">
        {body}
      </Text>
      {actionLabel && onAction ? (
        <View style={{ marginTop: theme.spacing.sm }}>
          <Button label={actionLabel} onPress={onAction} variant="secondary" fullWidth={false} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  iconBox: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
