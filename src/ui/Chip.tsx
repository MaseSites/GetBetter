import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';

export type ChipProps = {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

/** Filter- und Auswahl-Chip, u.a. fuer Entdecken und das Onboarding. */
export function Chip({ label, selected = false, disabled = false, onPress }: ChipProps) {
  const theme = useTheme();

  const color = disabled
    ? theme.colors.disabledText
    : selected
      ? theme.colors.textOnAccent
      : theme.colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderRadius: theme.radii.pill,
          paddingHorizontal: theme.spacing.md,
          borderColor: selected ? theme.colors.accent : theme.colors.border,
          backgroundColor: disabled
            ? theme.colors.disabledBackground
            : selected
              ? theme.colors.accent
              : pressed
                ? theme.colors.surfaceMuted
                : theme.colors.surface,
        },
      ]}
    >
      <Text variant="label" style={{ color, fontWeight: theme.fontWeight.medium }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 34,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
