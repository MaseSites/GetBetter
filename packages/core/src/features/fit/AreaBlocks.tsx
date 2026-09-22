import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Text } from '@/ui';

import { CAPS_EM, LINE } from './KitchenKit';

/**
 * Der Block der Bereichsseiten genau wie in der Vision (`.block`, `.bh`,
 * `.big`): Innenabstand 13 · 16 · 14, Marke und Nebenwert auf einer
 * Grundlinie, darunter die eine grosse Zahl mit leiser Einheit.
 */

const PAD_TOP = 13;
const PAD_BOTTOM = 14;
const FIGURE_TOP = 9;

export function AreaPanel({
  label,
  more,
  children,
}: {
  label: string;
  more?: string | undefined;
  children?: ReactNode;
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
          paddingTop: PAD_TOP,
          paddingBottom: PAD_BOTTOM,
        },
      ]}
    >
      <View style={[styles.head, { gap: theme.spacing.sm }]}>
        <Text
          variant="overline"
          tone="faint"
          numberOfLines={1}
          style={[styles.shrink, { letterSpacing: theme.fontSize.xs * CAPS_EM }]}
        >
          {label}
        </Text>
        {more ? (
          <Text
            variant="caption"
            tone="faint"
            numberOfLines={1}
            style={[
              styles.more,
              {
                fontSize: theme.fontSize.caption,
                lineHeight: LINE.caption,
                fontWeight: theme.fontWeight.semibold,
              },
            ]}
          >
            {more}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Die grosse Zahl; die Einheit steht auf derselben Grundlinie, mit der Zeilenhoehe der Zahl. */
export function AreaFigure({ value, unit }: { value: string; unit?: string | undefined }) {
  const theme = useTheme();
  return (
    <View style={[styles.figure, { gap: theme.spacing.sm, marginTop: FIGURE_TOP }]}>
      <Text variant="hero">{value}</Text>
      {unit ? (
        <Text
          variant="label"
          tone="faint"
          style={[
            styles.shrink,
            {
              fontSize: theme.fontSize.lede,
              lineHeight: theme.lineHeight.hero,
              fontWeight: theme.fontWeight.semibold,
            },
          ]}
        >
          {unit}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline' },
  shrink: { flexShrink: 1 },
  more: { marginLeft: 'auto' },
  figure: { flexDirection: 'row', alignItems: 'baseline' },
});
