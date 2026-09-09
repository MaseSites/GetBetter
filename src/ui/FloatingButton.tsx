import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';

export type FloatingButtonProps = {
  label: string;
  icon?: IconName;
  onPress: () => void;
};

/**
 * Der kleine Knopf unten rechts. Nimmt weniger Platz als eine Fussleiste und
 * legt sich ueber den Inhalt, statt ihn zu verkuerzen.
 */
export function FloatingButton({ label, icon = 'plus', onPress }: FloatingButtonProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          right: theme.spacing.lg,
          bottom: theme.spacing.lg + insets.bottom,
          borderRadius: theme.radii.lg,
          backgroundColor: pressed ? theme.colors.accentStrong : theme.colors.accent,
        },
      ]}
    >
      <Icon name={icon} size={24} color={theme.colors.textOnAccent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
