import type { ReactNode } from 'react';
import { StyleSheet, Text as RNText, type StyleProp, type TextStyle } from 'react-native';

import { useTheme } from '@/theme';

export type TextVariant = 'display' | 'title' | 'section' | 'body' | 'label' | 'caption';

export type TextTone = 'default' | 'muted' | 'faint' | 'accent' | 'danger' | 'onAccent';

export type TextProps = {
  children: ReactNode;
  variant?: TextVariant;
  tone?: TextTone;
  align?: 'left' | 'center' | 'right';
  numberOfLines?: number;
  onPress?: () => void;
  style?: StyleProp<TextStyle>;
};

export function Text({
  children,
  variant = 'body',
  tone = 'default',
  align = 'left',
  numberOfLines,
  onPress,
  style,
}: TextProps) {
  const theme = useTheme();

  const byVariant: Record<TextVariant, TextStyle> = {
    display: {
      fontSize: theme.fontSize.xl,
      lineHeight: theme.lineHeight.xl,
      fontWeight: theme.fontWeight.bold,
    },
    title: {
      fontSize: theme.fontSize.lg,
      lineHeight: theme.lineHeight.lg,
      fontWeight: theme.fontWeight.semibold,
    },
    section: {
      fontSize: theme.fontSize.sm,
      lineHeight: theme.lineHeight.sm,
      fontWeight: theme.fontWeight.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    body: {
      fontSize: theme.fontSize.md,
      lineHeight: theme.lineHeight.md,
      fontWeight: theme.fontWeight.regular,
    },
    label: {
      fontSize: theme.fontSize.sm,
      lineHeight: theme.lineHeight.sm,
      fontWeight: theme.fontWeight.medium,
    },
    caption: {
      fontSize: theme.fontSize.xs,
      lineHeight: theme.lineHeight.xs,
      fontWeight: theme.fontWeight.regular,
    },
  };

  const byTone: Record<TextTone, string> = {
    default: theme.colors.text,
    muted: theme.colors.textMuted,
    faint: theme.colors.textFaint,
    accent: theme.colors.accent,
    danger: theme.colors.danger,
    onAccent: theme.colors.textOnAccent,
  };

  return (
    <RNText
      numberOfLines={numberOfLines}
      onPress={onPress}
      {...(onPress ? { accessibilityRole: 'button' as const } : {})}
      style={StyleSheet.flatten([
        { fontFamily: theme.fontFamily, textAlign: align, color: byTone[tone] },
        byVariant[variant],
        style,
      ])}
    >
      {children}
    </RNText>
  );
}
