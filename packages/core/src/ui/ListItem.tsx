import type { ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { usePressScale } from './usePressScale';

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
  const press = usePressScale(theme.motion.pressScale.row);
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
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={[
        {
          borderRadius: theme.radii.sm,
          marginHorizontal: -theme.spacing.sm,
          paddingHorizontal: theme.spacing.sm,
          transform: [{ scale: press.scale }],
        },
      ]}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
    >
      {content}
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const styles = StyleSheet.create({
  // Mindestens 44 hoch, damit die Zeile auch mit einem Daumen zu treffen ist.
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  iconBox: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
