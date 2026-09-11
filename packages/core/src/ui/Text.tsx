import type { ReactNode } from 'react';
import { StyleSheet, Text as RNText, type StyleProp, type TextStyle } from 'react-native';

import { numeric, useTheme } from '@/theme';

export type TextVariant =
  /** Die eine Zahl, um die es auf dem Bildschirm geht. */
  | 'hero'
  | 'display'
  | 'title'
  | 'section'
  | 'body'
  | 'label'
  | 'caption'
  /** Kleine Marke in Grossbuchstaben — Datum, Bereich, Rubrik. */
  | 'overline';

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

  /** Zahlen und Titel tragen die Displayschrift, Fliesstext die Leseschrift. */
  const display = theme.fontFamilyDisplay;
  const ui = theme.fontFamily;

  const byVariant: Record<TextVariant, TextStyle> = {
    hero: {
      fontFamily: display,
      fontSize: theme.fontSize.hero,
      lineHeight: theme.lineHeight.hero,
      fontWeight: theme.fontWeight.extrabold,
      letterSpacing: theme.tracking.hero,
    },
    display: {
      fontFamily: display,
      fontSize: theme.fontSize.display,
      lineHeight: theme.lineHeight.display,
      fontWeight: theme.fontWeight.bold,
      letterSpacing: theme.tracking.display,
    },
    title: {
      fontFamily: display,
      fontSize: theme.fontSize.lg,
      lineHeight: theme.lineHeight.lg,
      fontWeight: theme.fontWeight.bold,
      letterSpacing: theme.tracking.title,
    },
    // Abschnittstitel wie im Entwurf: Displayschrift, Grossbuchstaben, etwas Luft.
    section: {
      fontFamily: display,
      fontSize: theme.fontSize.sm,
      lineHeight: theme.lineHeight.sm,
      fontWeight: theme.fontWeight.bold,
      letterSpacing: theme.tracking.tag,
      textTransform: 'uppercase',
    },
    body: {
      fontFamily: ui,
      fontSize: theme.fontSize.md,
      lineHeight: theme.lineHeight.md,
      fontWeight: theme.fontWeight.regular,
      letterSpacing: theme.tracking.body,
    },
    label: {
      fontFamily: ui,
      fontSize: theme.fontSize.sm,
      lineHeight: theme.lineHeight.sm,
      fontWeight: theme.fontWeight.medium,
    },
    caption: {
      fontFamily: ui,
      fontSize: theme.fontSize.xs,
      lineHeight: theme.lineHeight.xs,
      fontWeight: theme.fontWeight.regular,
    },
    overline: {
      fontFamily: ui,
      fontSize: theme.fontSize.xs,
      lineHeight: theme.lineHeight.xs,
      fontWeight: theme.fontWeight.semibold,
      letterSpacing: theme.tracking.caps,
      textTransform: 'uppercase',
    },
  };

  const byTone: Record<TextTone, string> = {
    default: theme.colors.text,
    muted: theme.colors.textMuted,
    faint: theme.colors.textFaint,
    accent: theme.colors.accentStrong,
    danger: theme.colors.danger,
    onAccent: theme.colors.textOnAccent,
  };

  return (
    <RNText
      numberOfLines={numberOfLines}
      onPress={onPress}
      {...(onPress ? { accessibilityRole: 'button' as const } : {})}
      style={StyleSheet.flatten([
        // Ziffern gleicher Breite ueberall: sonst springen Werte in Listen und
        // Zaehlern bei jeder Aktualisierung seitlich hin und her.
        numeric,
        { textAlign: align, color: byTone[tone] },
        byVariant[variant],
        style,
      ])}
    >
      {children}
    </RNText>
  );
}
