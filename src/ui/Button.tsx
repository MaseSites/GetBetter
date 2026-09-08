import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
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
  accessibilityLabel?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  loading = false,
  fullWidth = true,
  accessibilityLabel,
}: ButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;

  const background: Record<ButtonVariant, string> = {
    primary: theme.colors.accent,
    secondary: theme.colors.surface,
    ghost: 'transparent',
    danger: theme.colors.dangerSoft,
  };
  const pressedBackground: Record<ButtonVariant, string> = {
    primary: theme.colors.accentStrong,
    secondary: theme.colors.surfaceMuted,
    ghost: theme.colors.surfaceMuted,
    danger: theme.colors.dangerSoft,
  };
  const foreground: Record<ButtonVariant, string> = {
    primary: theme.colors.textOnAccent,
    secondary: theme.colors.text,
    ghost: theme.colors.accent,
    danger: theme.colors.danger,
  };
  const border: Record<ButtonVariant, string> = {
    primary: theme.colors.accent,
    secondary: theme.colors.border,
    ghost: 'transparent',
    danger: theme.colors.dangerSoft,
  };

  const height = size === 'md' ? 48 : 36;
  const paddingHorizontal = size === 'md' ? theme.spacing.lg : theme.spacing.md;
  const color = inactive ? theme.colors.disabledText : foreground[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          paddingHorizontal,
          borderRadius: theme.radii.md,
          borderWidth: 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          borderColor: inactive ? theme.colors.disabledBackground : border[variant],
          backgroundColor: inactive
            ? theme.colors.disabledBackground
            : pressed
              ? pressedBackground[variant]
              : background[variant],
          opacity: pressed && !inactive && variant === 'ghost' ? 0.9 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <View style={[styles.content, { gap: theme.spacing.sm }]}>
          {icon ? <Icon name={icon} size={size === 'md' ? 18 : 16} color={color} /> : null}
          <Text
            variant={size === 'md' ? 'body' : 'label'}
            style={{ color, fontWeight: theme.fontWeight.semibold }}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center' },
});
