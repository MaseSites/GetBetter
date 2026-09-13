import { useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { formatNumber, useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Icon, PlainList, PlainRow, Segmented, Sheet, Text, useSwipeSteps } from '@/ui';

import { weatherIcon, weatherLabelKey, type DayForecast, type Forecast } from './api';
import { chartSeries } from './chart';
import { DayChart } from './DayChart';
import { compassPoint, uvLevel } from './insights';
import { dayText, summarizeDay } from './summary';
import { clockTime, hourLabel, longDay } from './time';

type DayMetric = 'temp' | 'rain' | 'wind' | 'uv';
const DAY_METRICS: readonly DayMetric[] = ['temp', 'rain', 'wind', 'uv'];

/**
 * Ein Tag im Blatt, zuerst mittelhoch: Kopf, Segment fuer den Verlauf, ein Satz
 * und die Zeilen fuer Sonne, UV, Wind und Regen. Seitlich wischen blaettert.
 */
export function DaySheet({
  forecast,
  dayIndex,
  now,
  onChangeDay,
  onClose,
}: {
  forecast: Forecast;
  dayIndex: number | null;
  now: number;
  onChangeDay: (index: number) => void;
  onClose: () => void;
}) {
  const { language } = useI18n();
  const day = dayIndex === null ? undefined : forecast.daily[dayIndex];

  return (
    <Sheet
      visible={day !== undefined}
      onClose={onClose}
      detent="medium"
      title={day ? longDay(language, day.ts, forecast.timezone) : undefined}
    >
      {day && dayIndex !== null ? (
        <DayBody
          forecast={forecast}
          day={day}
          dayIndex={dayIndex}
          now={now}
          onChangeDay={onChangeDay}
        />
      ) : null}
    </Sheet>
  );
}

function DayBody({
  forecast,
  day,
  dayIndex,
  now,
  onChangeDay,
}: {
  forecast: Forecast;
  day: DayForecast;
  dayIndex: number;
  now: number;
  onChangeDay: (index: number) => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const [metric, setMetric] = useState<DayMetric>('temp');
  const zone = forecast.timezone;
  const last = forecast.daily.length - 1;

  const step = (direction: -1 | 1) => {
    const next = Math.min(last, Math.max(0, dayIndex + direction));
    if (next !== dayIndex) onChangeDay(next);
  };
  const swipe = useSwipeSteps(step);

  const series = chartSeries(forecast, metric, day.ts);
  const summary = summarizeDay(forecast.hourly, day.ts);
  const sentence = summary ? dayText(summary, t, (ts) => hourLabel(language, ts, zone)) : null;
  const rainAmount = Math.round(day.precipSum * 10) / 10;

  return (
    <Animated.View
      {...swipe.panHandlers}
      accessibilityActions={[
        { name: 'previous', label: t('weather.daySheet.previous') },
        { name: 'next', label: t('weather.daySheet.next') },
      ]}
      onAccessibilityAction={(event) => step(event.nativeEvent.actionName === 'next' ? 1 : -1)}
      style={[swipe.style, { gap: theme.spacing.lg }]}
    >
      <View style={[styles.row, { gap: theme.spacing.md }]}>
        <Icon name={weatherIcon(day.code)} size={32} color={theme.colors.text} />
        <View style={styles.grow}>
          <Text variant="body" style={{ fontWeight: theme.fontWeight.semibold }}>
            {t(weatherLabelKey(day.code))}
          </Text>
          <Text variant="label" tone="muted">
            {t('weather.page.hiLo', { max: Math.round(day.max), min: Math.round(day.min) })}
          </Text>
        </View>
      </View>

      <Segmented
        options={DAY_METRICS.map((value) => ({
          value,
          label: t(`weather.daySheet.metric.${value}`),
        }))}
        value={metric}
        onChange={setMetric}
        accessibilityLabel={t('weather.daySheet.metrics')}
      />

      {series ? <DayChart series={series} metric={metric} now={now} zone={zone} /> : null}

      {sentence ? <Text variant="body">{sentence}</Text> : null}

      <PlainList separatorInset="none">
        <PlainRow
          title={t('weather.daySheet.sun')}
          trailing={
            <Value
              text={t('weather.daySheet.sunValue', {
                rise: clockTime(language, day.sunrise, zone),
                set: clockTime(language, day.sunset, zone),
              })}
            />
          }
        />
        <PlainRow
          title={t('weather.daySheet.uv')}
          trailing={
            <Value
              text={t('weather.uv.value', {
                value: Math.round(day.uvMax),
                level: t(`weather.uv.${uvLevel(day.uvMax)}`),
              })}
            />
          }
        />
        <PlainRow
          title={t('weather.daySheet.wind')}
          trailing={
            <Value
              text={t('weather.wind.value', {
                speed: Math.round(day.windMax),
                direction: t(`weather.dir.${compassPoint(day.windDir)}`),
              })}
            />
          }
        />
        <PlainRow
          title={t('weather.daySheet.rain')}
          trailing={
            <Value
              text={t('weather.daySheet.rainValue', {
                amount: formatNumber(language, rainAmount),
              })}
            />
          }
        />
      </PlainList>
    </Animated.View>
  );
}

function Value({ text }: { text: string }) {
  return (
    <Text variant="body" tone="muted">
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
});
