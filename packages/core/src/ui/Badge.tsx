import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type BadgeTone = 'neutral' | 'accent' | 'danger';

export type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  icon?: IconName;
};

export function Badge({ label, tone = 'neutral', icon }: BadgeProps) {
  const theme = useTheme();

  const background: Record<BadgeTone, string> = {
    neutral: theme.colors.surfaceMuted,
    accent: theme.colors.accentSoft,
    danger: theme.colors.dangerSoft,
  };
  const foreground: Record<BadgeTone, string> = {
    neutral: theme.colors.textMuted,
    accent: theme.colors.accentStrong,
    danger: theme.colors.danger,
  };

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: background[tone],
          borderRadius: theme.radii.pill,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
          gap: theme.spacing.xs,
        },
      ]}
    >
      {icon ? <Icon name={icon} size={12} color={foreground[tone]} /> : null}
      <Text
        variant="caption"
        style={{ color: foreground[tone], fontWeight: theme.fontWeight.medium }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
});
