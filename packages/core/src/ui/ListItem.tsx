import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ListItemProps = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  right?: ReactNode;
  showChevron?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
  accessibilityLabel?: string;
};

export function ListItem({
  title,
  subtitle,
  icon,
  right,
  showChevron = false,
  onPress,
  onLongPress,
  disabled = false,
  tone = 'default',
  accessibilityLabel,
}: ListItemProps) {
  const theme = useTheme();
  const interactive = Boolean(onPress || onLongPress) && !disabled;
  const titleTone = disabled ? 'faint' : tone === 'danger' ? 'danger' : 'default';
  const iconColor = disabled
    ? theme.colors.disabledText
    : tone === 'danger'
      ? theme.colors.danger
      : theme.colors.textMuted;

  const content = (
    <View style={[styles.row, { paddingVertical: theme.spacing.md, gap: theme.spacing.md }]}>
      {icon ? (
        <View
          style={[
            styles.iconBox,
            { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radii.sm },
          ]}
        >
          <Icon name={icon} size={18} color={iconColor} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text variant="body" tone={titleTone} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="label" tone="muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {showChevron ? <Icon name="forward" size={18} color={theme.colors.textFaint} /> : null}
    </View>
  );

  if (!interactive) {
    return <View accessibilityLabel={accessibilityLabel}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [
        pressed
          ? {
              backgroundColor: theme.colors.surfaceMuted,
              borderRadius: theme.radii.sm,
              marginHorizontal: -theme.spacing.sm,
              paddingHorizontal: theme.spacing.sm,
            }
          : null,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
