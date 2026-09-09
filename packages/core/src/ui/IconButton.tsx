import { Pressable } from 'react-native';

import { useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';

export type IconButtonProps = {
  icon: IconName;
  /** Was der Knopf tut — die Vorlesefunktion hat sonst nur ein Symbol. */
  label: string;
  onPress: () => void;
  tone?: 'default' | 'faint' | 'danger' | 'accent';
  size?: number;
};

/**
 * Ein Symbol als Knopf, z.B. der Papierkorb rechts in einer Zeile. Nur dort,
 * wo die Zeile selbst nicht drueckbar ist — ein Knopf im Knopf waere im
 * Browser ungueltig.
 */
export function IconButton({ icon, label, onPress, tone = 'faint', size = 18 }: IconButtonProps) {
  const theme = useTheme();
  const color = {
    default: theme.colors.text,
    faint: theme.colors.textFaint,
    danger: theme.colors.danger,
    accent: theme.colors.accent,
  }[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={theme.spacing.md}
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: theme.spacing.xs })}
    >
      <Icon name={icon} size={size} color={color} />
    </Pressable>
  );
}
