import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Text, usePressScale } from '@/ui';

/** Eine Zahl des Tages. `share` zeichnet den Balken darunter, 0 bis 1. */
export type DayStat = {
  key: string;
  label: string;
  value: string;
  unit?: string;
  share?: number;
  /** Balken in Signal statt Tinte — fuer die eine Zahl, die gerade zaehlt. */
  strong?: boolean;
  /** Macht die Kachel drueckbar, z.B. wenn die App dahinter noch fehlt. */
  onPress?: () => void;
};

/**
 * Drei Zahlen am Fuss des Tages: gross die Zahl, klein die Einheit daneben,
 * ein duenner Balken darunter. Man liest sie im Vorbeigehen.
 */
export function DayStats({ stats }: { stats: readonly DayStat[] }) {
  const theme = useTheme();
  if (stats.length === 0) return null;

  return (
    <View style={[styles.row, { gap: theme.spacing.sm }]}>
      {stats.map((stat) => (
        <Tile key={stat.key} stat={stat} />
      ))}
    </View>
  );
}

function Tile({ stat }: { stat: DayStat }) {
  const theme = useTheme();
  const press = usePressScale();

  const tile = (
    <Animated.View
      style={{
        backgroundColor: theme.colors.surfaceMuted,
        borderRadius: theme.radii.item,
        padding: theme.spacing.md,
        transform: stat.onPress ? [{ scale: press.scale }] : [],
      }}
    >
      <Text
        variant="overline"
        tone="faint"
        numberOfLines={1}
        style={{
          fontSize: theme.fontSize.micro,
          lineHeight: theme.lineHeight.micro,
          letterSpacing: theme.tracking.label,
        }}
      >
        {stat.label}
      </Text>
      <View style={[styles.value, { gap: theme.spacing.xs, marginTop: theme.spacing.xs }]}>
        <Text
          variant="title"
          numberOfLines={1}
          style={{
            fontSize: theme.fontSize.stat,
            lineHeight: theme.lineHeight.stat,
            letterSpacing: theme.tracking.title,
          }}
        >
          {stat.value}
        </Text>
        {stat.unit ? (
          <Text
            variant="caption"
            tone="faint"
            numberOfLines={1}
            style={[styles.unit, { fontWeight: theme.fontWeight.semibold }]}
          >
            {stat.unit}
          </Text>
        ) : null}
      </View>
      {stat.share === undefined ? null : (
        <View
          style={[
            styles.track,
            {
              marginTop: theme.spacing.sm,
              backgroundColor: theme.colors.borderStrong,
              borderRadius: theme.radii.pill,
            },
          ]}
        >
          <View
            style={{
              width: `${Math.max(0, Math.min(1, stat.share)) * 100}%`,
              height: '100%',
              borderRadius: theme.radii.pill,
              backgroundColor: stat.strong ? theme.colors.accentStrong : theme.colors.text,
            }}
          />
        </View>
      )}
    </Animated.View>
  );

  if (!stat.onPress) return <View style={styles.cell}>{tile}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${stat.label} ${stat.unit ?? ''}`}
      onPress={stat.onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={styles.cell}
    >
      {tile}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  cell: { flex: 1, minWidth: 0 },
  // Die Einheit sitzt auf der Grundlinie der Zahl, nicht in ihrer Mitte.
  value: { flexDirection: 'row', alignItems: 'baseline' },
  unit: { flexShrink: 1 },
  track: { height: 3, overflow: 'hidden' },
});
