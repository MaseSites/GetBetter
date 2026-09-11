import type { ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, type ElevationLevel } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';
import { usePressScale } from './usePressScale';

export type CardProps = {
  children?: ReactNode;
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  padded?: boolean;
  /** `raised` nur fuer das, was gerade dran ist — nicht fuer jede Karte. */
  elevation?: ElevationLevel;
  style?: StyleProp<ViewStyle>;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Card({
  children,
  title,
  subtitle,
  footer,
  onPress,
  accessibilityLabel,
  padded = true,
  elevation = 'card',
  style,
}: CardProps) {
  const theme = useTheme();
  const press = usePressScale(theme.motion.pressScale.row);

  // Kein Rahmen: Weiss auf dem gedaempften Hintergrund trennt genug, der
  // flache Schatten setzt die Karte nur eine Haaresbreite ab.
  const base: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: padded ? theme.spacing.lg : 0,
    gap: theme.spacing.md,
    ...theme.elevation[elevation],
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
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[base, { transform: [{ scale: press.scale }] }, style]}
    >
      {body}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headText: { flex: 1, gap: 2 },
});
