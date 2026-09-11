import { Animated, Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';
import { usePressScale } from './usePressScale';

export type ChipProps = {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

/**
 * Filter- und Auswahl-Chip. Gewaehlt heisst Tinte, nicht Signalgruen: das
 * Gruen bleibt fuer *jetzt*, *erledigt* und *Fortschritt* reserviert.
 */
export function Chip({ label, selected = false, disabled = false, onPress }: ChipProps) {
  const theme = useTheme();
  const press = usePressScale();

  const color = disabled
    ? theme.colors.disabledText
    : selected
      ? theme.colors.onInverse
      : theme.colors.textMuted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
    >
      <Animated.View
        style={[
          styles.chip,
          {
            borderRadius: theme.radii.pill,
            paddingHorizontal: theme.spacing.md,
            borderColor: selected ? theme.colors.inverse : theme.colors.border,
            backgroundColor: disabled
              ? theme.colors.disabledBackground
              : selected
                ? theme.colors.inverse
                : theme.colors.surface,
            transform: [{ scale: disabled ? 1 : press.scale }],
          },
        ]}
      >
        <Text variant="label" style={{ color, fontWeight: theme.fontWeight.medium }}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
