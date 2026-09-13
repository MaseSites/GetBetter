import { View } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { PlainList, PlainRow, SectionHeader, Sheet, Text } from '@/ui';

import type { Forecast } from './api';
import { chartSeries, type ChartMetric } from './chart';
import { DayChart } from './DayChart';
import { dayIndexAt, daylightParts } from './insights';
import { tileReadings, type TileMetric } from './Tiles';
import { clockTime } from './time';

/** Ein Tipp auf eine Kachel: derselbe Wert mit Deutung, darunter sein Verlauf heute. */
export function MetricSheet({
  forecast,
  metric,
  now,
  onClose,
}: {
  forecast: Forecast;
  metric: TileMetric | null;
  now: number;
  onClose: () => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();

  const reading = metric
    ? tileReadings(forecast, now, t, language).find((entry) => entry.metric === metric)
    : undefined;
  const today = forecast.daily[dayIndexAt(forecast.daily, now)];
  const chartMetric: ChartMetric | null = metric && metric !== 'sun' ? metric : null;
  const series = today && chartMetric ? chartSeries(forecast, chartMetric, today.ts) : null;
  const zone = forecast.timezone;

  return (
    <Sheet
      visible={reading !== undefined}
      onClose={onClose}
      detent="medium"
      title={reading ? t(`weather.tile.${reading.metric}`) : undefined}
      subtitle={metric === 'air' ? t('weather.air.scale') : undefined}
    >
      {reading ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text
            variant="title"
            style={{ fontSize: theme.fontSize.xl, lineHeight: theme.lineHeight.xl }}
          >
            {reading.value}
          </Text>
          {reading.detail ? (
            <Text variant="body" tone="muted">
              {reading.detail}
            </Text>
          ) : null}

          {series && chartMetric ? (
            <>
              <SectionHeader label={t('weather.metric.today')} />
              <DayChart series={series} metric={chartMetric} now={now} zone={zone} />
            </>
          ) : null}

          {metric === 'sun' && today ? (
            <PlainList separatorInset="none">
              <PlainRow
                title={t('weather.sunrise')}
                trailing={<Trailing text={clockTime(language, today.sunrise, zone)} />}
              />
              <PlainRow
                title={t('weather.sunset')}
                trailing={<Trailing text={clockTime(language, today.sunset, zone)} />}
              />
              <PlainRow
                title={t('weather.sun.daylightTitle')}
                trailing={
                  <Trailing text={t('weather.sun.daylight', daylightParts(today.daylight))} />
                }
              />
            </PlainList>
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}

function Trailing({ text }: { text: string }) {
  return (
    <Text variant="body" tone="muted">
      {text}
    </Text>
  );
}
