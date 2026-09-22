import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { Text, type TextTone } from '@/ui';

/**
 * Die Bausteine der Ernaehrung, genau nach dem Entwurf (Ernaehrung.dc.html):
 * ein Block mit 13/16/14 Innenabstand, Marke in Grossbuchstaben und Nebenwert
 * rechts auf derselben Grundlinie. Die Zeilenhoehen sind die natuerlichen der
 * Instrument Sans („normal“ im Entwurf), nicht die gerundeten Stufen des Themas.
 */
export const FIT_LINE = { xs: 14, caption: 15, sm: 16, lede: 18, md: 19, body: 20 } as const;
/** Schriftgroesse 16 — der Fliesstext des Entwurfs (Name der Mahlzeit, kcal). */
export const FIT_BODY = 16;
/** Grossbuchstaben mit .09em Luft. */
const CAPS_EM = 0.09;
/** Innenabstand oben und unten eines Blocks. */
const BLOCK_TOP = 13;
const BLOCK_BOTTOM = 14;

/** Die kleine Marke in Grossbuchstaben — im Block und als Abschnitt („Der Tag“). */
export function BlockLabel({
  children,
  color,
  style,
}: {
  children: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View style={style}>
      <Text
        variant="overline"
        tone="faint"
        numberOfLines={1}
        style={{
          fontSize: theme.fontSize.xs,
          lineHeight: FIT_LINE.xs,
          letterSpacing: theme.fontSize.xs * CAPS_EM,
          ...(color ? { color } : null),
        }}
      >
        {children}
      </Text>
    </View>
  );
}

/** Ein Block des Entwurfs: Karte, Marke links, Nebenwert rechts. */
export function Block({
  label,
  more,
  children,
  style,
}: {
  label?: string;
  more?: string | undefined;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        theme.elevation.card,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.panel,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: BLOCK_TOP,
          paddingBottom: BLOCK_BOTTOM,
        },
        style,
      ]}
    >
      {label ? (
        <View style={[styles.head, { gap: theme.spacing.sm }]}>
          <View style={styles.grow}>
            <BlockLabel>{label}</BlockLabel>
          </View>
          {more ? <Quiet weight="semibold">{more}</Quiet> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Leiser Text in 12 oder 13 pt, wie Nebenwert, Metazeile und Legende. */
export function Quiet({
  children,
  size = 'caption',
  weight = 'regular',
  tone = 'faint',
  lines = 1,
}: {
  children: ReactNode;
  size?: 'caption' | 'sm';
  weight?: 'regular' | 'medium' | 'semibold';
  tone?: TextTone;
  lines?: number;
}) {
  const theme = useTheme();
  return (
    <Text
      variant="caption"
      tone={tone}
      numberOfLines={lines}
      style={{
        fontSize: theme.fontSize[size],
        lineHeight: FIT_LINE[size],
        fontWeight: theme.fontWeight[weight],
        fontVariant: ['tabular-nums'],
      }}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline' },
  grow: { flex: 1, minWidth: 0 },
});
