import { ActivityIndicator, Animated, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { usePressScale } from './usePressScale';

/**
 * `primary` ist umgekehrtes Papier, nicht die Signalfarbe. Waere jede
 * Haupthandlung gruen, hiesse Gruen nur noch «hier ist ein Knopf» — und
 * genau dann traegt es nichts mehr, wenn es *erledigt* heissen soll.
 * Dafuer gibt es `signal`, sparsam eingesetzt.
 */
export type ButtonVariant = 'primary' | 'signal' | 'secondary' | 'ghost' | 'outline' | 'danger';
export type ButtonSize = 'md' | 'sm';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  /** Ganz runde Enden statt der ueblichen Ecken — auch der Rand folgt ihnen. */
  pill?: boolean;
  accessibilityLabel?: string;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  loading = false,
  fullWidth = true,
  pill = false,
  accessibilityLabel,
}: ButtonProps) {
  const theme = useTheme();
  const press = usePressScale();
  const inactive = disabled || loading;

  const background: Record<ButtonVariant, string> = {
    primary: theme.colors.inverse,
    signal: theme.colors.accent,
    secondary: theme.colors.surfaceMuted,
    ghost: 'transparent',
    outline: 'transparent',
    danger: theme.colors.dangerSoft,
  };
  const foreground: Record<ButtonVariant, string> = {
    primary: theme.colors.onInverse,
    signal: theme.colors.textOnAccent,
    secondary: theme.colors.text,
    ghost: theme.colors.textMuted,
    outline: theme.colors.text,
    danger: theme.colors.danger,
  };

  const height = size === 'md' ? 48 : 40;
  const paddingHorizontal = size === 'md' ? theme.spacing.edge : theme.spacing.md;
  const color = inactive ? theme.colors.disabledText : foreground[variant];

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[
        styles.base,
        {
          height,
          paddingHorizontal,
          borderRadius: pill ? theme.radii.pill : theme.radii.sm,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          // Nur die Umrissknoepfe tragen eine Linie; gefuellte brauchen keine.
          // `outline` ist der kraeftige: Rand in `textFaint` (3:1), Schrift voll.
          borderWidth: variant === 'ghost' || variant === 'outline' ? 1.5 : 0,
          borderColor: inactive
            ? theme.colors.disabledBackground
            : variant === 'outline'
              ? theme.colors.textFaint
              : theme.colors.borderStrong,
          backgroundColor: inactive ? theme.colors.disabledBackground : background[variant],
          transform: [{ scale: inactive ? 1 : press.scale }],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <View style={[styles.content, { gap: theme.spacing.sm }]}>
          {icon ? <Icon name={icon} size={size === 'md' ? 18 : 16} color={color} /> : null}
          <Text
            variant="label"
            numberOfLines={1}
            style={{
              color,
              fontSize: size === 'md' ? theme.fontSize.md : theme.fontSize.sm,
              fontWeight: theme.fontWeight.semibold,
            }}
          >
            {label}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center' },
});
