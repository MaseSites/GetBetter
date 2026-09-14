import { ScrollView, StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Icon, Text, type IconName } from '@/ui';

import { isDaylight, weatherIconAt, weatherLabelKey, type Forecast } from './api';
import { dayIndexAt, hoursFrom } from './insights';
import { WEATHER_METRICS } from './metrics';
import { nextHoursText, summarizeNextHours } from './summary';
import { Surface } from './Surface';
import { clockTime, hourLabel, hourNumber } from './time';

const HOURS = 24;
const HOUR_MS = 3_600_000;
/** Ab hier lohnt sich die Regenwahrscheinlichkeit als Zahl. */
export const RAIN_WORTH_SHOWING = 20;

type Column =
  | { kind: 'hour'; ts: number; temp: number; code: number; rain: number }
  | { kind: 'sunrise' | 'sunset'; ts: number };

/**
 * Die naechsten 24 Stunden. Die Kopfzeile ist ein ganzer Satz; darunter die
 * Leiste mit Uhrzeit, Symbol, Regen ab 20 % und Temperatur — Sonnenauf- und
 * -untergang bekommen je eine eigene Spalte.
 */
export function HoursModule({
  forecast,
  now,
  onPress,
}: {
  forecast: Forecast;
  now: number;
  onPress?: () => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const zone = forecast.timezone;

  const hours = hoursFrom(forecast.hourly, now, HOURS);
  const last = hours[hours.length - 1];
  if (!last) return null;

  const tomorrow = forecast.daily[dayIndexAt(forecast.daily, now) + 1];
  const summary = summarizeNextHours(hours, tomorrow?.ts ?? null);
  const sentence = summary
    ? nextHoursText(summary, t, (ts) => hourLabel(language, ts, zone))
    : null;

  const sun: Column[] = forecast.daily
    .flatMap((day): Column[] => [
      { kind: 'sunrise', ts: day.sunrise },
      { kind: 'sunset', ts: day.sunset },
    ])
    .filter((column) => column.ts > now && column.ts < last.ts + HOUR_MS);
  const columns: Column[] = [
    ...hours.map((hour): Column => ({ kind: 'hour', ...hour })),
    ...sun,
  ].sort((a, b) => a.ts - b.ts);

  return (
    <Surface onPress={onPress} accessibilityLabel={sentence ?? t('weather.hours.open')}>
      {sentence ? (
        <Text variant="label" style={{ fontWeight: theme.fontWeight.semibold }}>
          {sentence}
        </Text>
      ) : null}
      <View style={[styles.rule, { backgroundColor: theme.colors.border }]} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.xs }}
      >
        {columns.map((column, index) => (
          <HourColumn
            key={`${column.kind}-${column.ts}`}
            column={column}
            isFirst={index === 0}
            forecast={forecast}
          />
        ))}
      </ScrollView>
    </Surface>
  );
}

function HourColumn({
  column,
  isFirst,
  forecast,
}: {
  column: Column;
  isFirst: boolean;
  forecast: Forecast;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const zone = forecast.timezone;

  if (column.kind !== 'hour') {
    const time = clockTime(language, column.ts, zone);
    const event = t(column.kind === 'sunrise' ? 'weather.hours.sunrise' : 'weather.hours.sunset');
    const icon: IconName = column.kind === 'sunrise' ? 'sun' : 'sleep';
    return (
      <View
        accessible
        accessibilityLabel={t('weather.hours.sunColumn', { event, time })}
        style={[styles.column, { width: WEATHER_METRICS.sunColumn, gap: theme.spacing.xs }]}
      >
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {time}
        </Text>
        <Icon name={icon} size={WEATHER_METRICS.hourIcon} color={theme.colors.text} />
        <View style={{ height: theme.lineHeight.xs }} />
        <Text variant="caption" numberOfLines={1}>
          {event}
        </Text>
      </View>
    );
  }

  const time = isFirst ? t('weather.now') : hourNumber(language, column.ts, zone);
  const temp = Math.round(column.temp);
  const condition = t(weatherLabelKey(column.code));
  return (
    <View
      accessible
      accessibilityLabel={t('weather.hours.column', { time, temp, condition })}
      style={[styles.column, { width: WEATHER_METRICS.hourColumn, gap: theme.spacing.xs }]}
    >
      <Text
        variant="caption"
        tone={isFirst ? 'default' : 'muted'}
        numberOfLines={1}
        style={isFirst ? { fontWeight: theme.fontWeight.semibold } : undefined}
      >
        {time}
      </Text>
      <Icon
        name={weatherIconAt(column.code, isDaylight(column.ts, forecast.daily))}
        size={WEATHER_METRICS.hourIcon}
        color={theme.colors.text}
      />
      <View style={{ height: theme.lineHeight.xs }}>
        {column.rain >= RAIN_WORTH_SHOWING ? (
          <Text
            variant="caption"
            numberOfLines={1}
            style={{ fontWeight: theme.fontWeight.semibold }}
          >
            {t('weather.percent', { percent: Math.round(column.rain) })}
          </Text>
        ) : null}
      </View>
      <Text variant="label" numberOfLines={1}>
        {t('weather.degrees', { temp })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rule: { height: StyleSheet.hairlineWidth },
  column: { alignItems: 'center' },
});
