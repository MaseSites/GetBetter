import { StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Text } from '@/ui';

import { currentIndex, metricText, type ChartMetric, type ChartSeries } from './chart';
import { WEATHER_METRICS } from './metrics';
import { share } from './Surface';
import { hourNumber } from './time';

/** Beschriftet werden 0, 6, 12 und 18 Uhr. */
const TICK_EVERY = 6;

/**
 * Ein Verlauf ueber 24 Stunden als Balken — ohne Grafik-Bibliothek, aus Views.
 * Die laufende Stunde ist dunkler; rechts stehen Hoechst- und Tiefstwert.
 */
export function DayChart({
  series,
  metric,
  now,
  zone,
}: {
  series: ChartSeries;
  metric: ChartMetric;
  now: number;
  zone: string;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const span = series.max - series.min;
  const highlight = currentIndex(series.times, now);
  const high = metricText(metric, series.high, t, language);
  const low = metricText(metric, series.low, t, language);
  const count = series.values.length;

  return (
    <View
      accessible
      accessibilityLabel={t('weather.chart.summary', { low, high })}
      style={{ gap: theme.spacing.xs }}
    >
      <View style={[styles.row, { gap: theme.spacing.sm }]}>
        <View
          style={[
            styles.bars,
            {
              height: WEATHER_METRICS.chartHeight,
              gap: WEATHER_METRICS.chartBarGap,
              borderBottomColor: theme.colors.border,
            },
          ]}
        >
          {series.times.map((ts, index) => {
            const value = series.values[index] ?? series.min;
            return (
              <View
                key={ts}
                style={[
                  styles.bar,
                  {
                    height: share(span > 0 ? (value - series.min) / span : 0),
                    borderTopLeftRadius: theme.radii.xs,
                    borderTopRightRadius: theme.radii.xs,
                    backgroundColor:
                      index === highlight ? theme.colors.text : theme.colors.textFaint,
                  },
                ]}
              />
            );
          })}
        </View>
        <View
          style={[
            styles.axis,
            { width: WEATHER_METRICS.chartAxis, height: WEATHER_METRICS.chartHeight },
          ]}
        >
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {high}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {low}
          </Text>
        </View>
      </View>
      <View style={[styles.row, { gap: theme.spacing.sm }]}>
        <View style={[styles.ticks, { height: theme.lineHeight.xs }]}>
          {series.times.map((ts, index) =>
            index % TICK_EVERY === 0 ? (
              <Text
                key={ts}
                variant="caption"
                tone="faint"
                style={[styles.tick, { left: share(index / count) }]}
              >
                {hourNumber(language, ts, zone)}
              </Text>
            ) : null,
          )}
        </View>
        <View style={{ width: WEATHER_METRICS.chartAxis }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  bars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bar: { flex: 1 },
  axis: { justifyContent: 'space-between', alignItems: 'flex-end' },
  ticks: { flex: 1 },
  tick: { position: 'absolute', top: 0 },
});
