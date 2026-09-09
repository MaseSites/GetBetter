import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

export type CardProps = {
  children?: ReactNode;
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Card({
  children,
  title,
  subtitle,
  footer,
  onPress,
  accessibilityLabel,
  padded = true,
  style,
}: CardProps) {
  const theme = useTheme();

  // Kein Rahmen: Weiss auf dem gedaempften Hintergrund trennt genug.
  const base: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: padded ? theme.spacing.lg : 0,
    gap: theme.spacing.md,
  };

  const body = (
    <>
      {title ? (
        <View style={styles.head}>
          <View style={styles.headText}>
            <Text variant="title">{title}</Text>
            {subtitle ? (
              <Text variant="label" tone="muted">
                {subtitle}
              </Text>
            ) : null}
          </View>
          {onPress ? <Icon name="forward" size={18} color={theme.colors.textFaint} /> : null}
        </View>
      ) : null}
      {children}
      {footer}
    </>
  );

  if (!onPress) {
    return <View style={[base, style]}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [
        base,
        pressed ? { backgroundColor: theme.colors.surfaceMuted } : null,
        style,
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headText: { flex: 1, gap: 2 },
});
