import { useState } from 'react';
import { Animated, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Text } from '@/ui';

import { useGrow } from './TrainingParts';

/** Wie die Vision: 128 hoch, 14 unter der Zahl, Punkte und Linie von Rand zu Rand. */
const HEIGHT = 128;
const CHART_TOP = 14;
const PAD_TOP = 14;
const PAD_BOTTOM = 18;
const DOT = 6;
const LINE = 2.5;
const SWATCH_LINE = 3;
const SWATCH = 12;
const LEGEND_DOT = 7;
const LEGEND_TOP = 10;
const LEGEND_GAP = 14;
const SWATCH_GAP = 6;
const LEGEND_LINE = 16;

type Point = { weightKg: number; trendKg: number };

/**
 * Die Waage als blasse Punkte, der Trend als Linie in Tinte — wie bei
 * MacroFactor, von Rand zu Rand. Ohne Grafikbibliothek: die Linie sind gedrehte Striche
 * zwischen zwei Punkten, die Punkte kleine runde Flaechen. Beim ersten
 * Zeichnen blendet die Linie ein.
 *
 * Die Punkte tragen `textFaint`, nicht `borderStrong`: ein Datenpunkt ist
 * Information und braucht darum 3:1 zur Flaeche. `borderStrong` liegt bei 1.57
 * und ist fuer Trennlinien gedacht, nicht fuer Marken — gemessen ueber alle
 * Modi, Akzente und Voreinstellungen.
 */
export function WeightChart({ points, label }: { points: readonly Point[]; label: string }) {
  const { t } = useI18n();
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const show = useGrow();
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const values = points.flatMap((point) => [point.weightKg, point.trendKg]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (index: number) =>
    points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
  const y = (value: number) =>
    PAD_TOP + (1 - (value - min) / span) * (HEIGHT - PAD_TOP - PAD_BOTTOM);
  const trend = points.map((point, index) => ({ x: x(index), y: y(point.trendKg) }));
  const legendText = { lineHeight: LEGEND_LINE, fontWeight: theme.fontWeight.regular } as const;

  return (
    <View style={{ marginTop: CHART_TOP }}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        onLayout={onLayout}
        style={styles.chart}
      >
        {width > 0
          ? points.map((point, index) => (
              <View
                key={`dot-${index}`}
                style={[
                  styles.abs,
                  {
                    left: x(index) - DOT / 2,
                    top: y(point.weightKg) - DOT / 2,
                    width: DOT,
                    height: DOT,
                    borderRadius: DOT / 2,
                    backgroundColor: theme.colors.textFaint,
                  },
                ]}
              />
            ))
          : null}
        {width > 0 ? (
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: show }]}>
            {trend.slice(1).map((point, index) => {
              const from = trend[index];
              if (!from) return null;
              const dx = point.x - from.x;
              const dy = point.y - from.y;
              const length = Math.hypot(dx, dy);
              return (
                <View
                  key={`line-${index}`}
                  style={[
                    styles.abs,
                    {
                      left: (from.x + point.x) / 2 - length / 2,
                      top: (from.y + point.y) / 2 - LINE / 2,
                      width: length + LINE / 2,
                      height: LINE,
                      borderRadius: LINE,
                      backgroundColor: theme.colors.text,
                      transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
                    },
                  ]}
                />
              );
            })}
          </Animated.View>
        ) : null}
      </View>
      <View style={[styles.row, { gap: LEGEND_GAP, marginTop: LEGEND_TOP }]}>
        <View style={[styles.row, { gap: SWATCH_GAP }]}>
          <View
            style={{
              width: LEGEND_DOT,
              height: LEGEND_DOT,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.textFaint,
            }}
          />
          <Text variant="label" tone="muted" style={legendText}>
            {t('fit6.v.legend.scale')}
          </Text>
        </View>
        <View style={[styles.row, { gap: SWATCH_GAP }]}>
          <View
            style={{
              width: SWATCH,
              height: SWATCH_LINE,
              borderRadius: SWATCH_LINE,
              backgroundColor: theme.colors.text,
            }}
          />
          <Text variant="label" tone="muted" style={legendText}>
            {t('fit6.v.legend.trend')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  // Die Punkte am Rand sind wie in der Vision halb abgeschnitten.
  chart: { height: HEIGHT, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
});
