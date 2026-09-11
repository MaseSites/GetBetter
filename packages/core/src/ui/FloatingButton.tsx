import { Animated, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { usePressScale } from './usePressScale';

export type FloatingButtonProps = {
  label: string;
  icon?: IconName;
  onPress: () => void;
};

/**
 * Der kleine Knopf unten rechts. Nimmt weniger Platz als eine Fussleiste und
 * legt sich ueber den Inhalt, statt ihn zu verkuerzen.
 *
 * Er traegt Tinte, nicht die Signalfarbe: er steht auf jedem Bildschirm, und
 * was immer da ist, kann nicht gleichzeitig «jetzt» heissen. Der helle Ring
 * setzt ihn vom Inhalt darunter ab, ueber den er schwebt.
 */
export function FloatingButton({ label, icon = 'plus', onPress }: FloatingButtonProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const press = usePressScale();

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[
        styles.button,
        theme.elevation.raised,
        {
          right: theme.spacing.edge,
          bottom: theme.spacing.edge + insets.bottom,
          borderRadius: theme.radii.pill,
          backgroundColor: theme.colors.inverse,
          borderWidth: 6,
          borderColor: theme.colors.background,
          transform: [{ scale: press.scale }],
        },
      ]}
    >
      <Icon name={icon} size={24} color={theme.colors.onInverse} />
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
