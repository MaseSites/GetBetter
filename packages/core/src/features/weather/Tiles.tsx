import { StyleSheet, View } from 'react-native';

import { formatNumber, useI18n, type Language, type Translate } from '@/i18n';
import { useTheme } from '@/theme';
import { Icon, Text, type IconName } from '@/ui';

import type { AirQuality, CurrentWeather, DayForecast, Forecast } from './api';
import {
  EAQI_LEVELS,
  compassPoint,
  dayIndexAt,
  eaqiLevel,
  feelsReason,
  hoursFrom,
  hoursOfDay,
  mainPollutant,
  pressureTrend,
  protectionWindow,
  uvLevel,
  uvShare,
  visibilityLevel,
  type EaqiLevel,
} from './insights';
import { WEATHER_METRICS } from './metrics';
import { ModuleLabel, Surface, share, trackColor } from './Surface';
import { clockTime, hourNumber } from './time';

export type TileMetric =
  'uv' | 'air' | 'feels' | 'wind' | 'humidity' | 'sun' | 'visibility' | 'pressure';

type Extra =
  | { kind: 'scale'; share: number }
  | { kind: 'levels'; level: EaqiLevel }
  | { kind: 'compass'; degrees: number };

export type TileReading = {
  metric: TileMetric;
  icon: IconName;
  value: string;
  detail: string;
  extra: Extra | null;
};

/** Jetzt und drei Stunden weiter — daran sieht man, ob der Druck steigt. */
const PRESSURE_LOOKAHEAD = 4;
const METERS_PER_KM = 1000;
/** Darunter zeigt die Sicht eine Nachkommastelle. */
const PRECISE_BELOW_KM = 10;

type Context = { t: Translate; language: Language; zone: string };

/** Die Kacheln in ihrer Reihenfolge; ohne Luftqualitaet faellt nur diese weg. */
export function tileReadings(
  forecast: Forecast,
  now: number,
  t: Translate,
  language: Language,
): TileReading[] {
  const context: Context = { t, language, zone: forecast.timezone };
  const { current } = forecast;
  const todayIndex = dayIndexAt(forecast.daily, now);
  const today = forecast.daily[todayIndex];
  const tomorrow = forecast.daily[todayIndex + 1];
  const later = hoursFrom(forecast.hourly, now, PRESSURE_LOOKAHEAD)[PRESSURE_LOOKAHEAD - 1];

  return [
    uvReading(current.uv, today ? hoursOfDay(forecast.hourly, today.ts) : [], context),
    ...(forecast.air ? [airReading(forecast.air, context)] : []),
    {
      metric: 'feels',
      icon: 'person',
      value: t('weather.degrees', { temp: Math.round(current.feelsLike) }),
      detail: t(`weather.feels.${feelsReason(current)}`),
      extra: null,
    },
    windReading(current, context),
    {
      metric: 'humidity',
      icon: 'water',
      value: t('weather.percent', { percent: Math.round(current.humidity) }),
      detail: t('weather.humidity.dew', { temp: Math.round(current.dewPoint) }),
      extra: null,
    },
    sunReading(today, tomorrow, now, context),
    visibilityReading(current.visibility, context),
    {
      metric: 'pressure',
      icon: 'chart',
      value: t('weather.pressure.value', { value: Math.round(current.pressure) }),
      detail: t(
        `weather.pressure.${pressureTrend(current.pressure, later?.pressure ?? current.pressure)}`,
      ),
      extra: null,
    },
  ];
}

function uvReading(
  uv: number,
  hours: readonly { ts: number; uv: number }[],
  { t, language, zone }: Context,
): TileReading {
  const window = protectionWindow(hours);
  return {
    metric: 'uv',
    icon: 'shield',
    value: t('weather.uv.value', { value: Math.round(uv), level: t(`weather.uv.${uvLevel(uv)}`) }),
    detail: window
      ? t('weather.uv.protect', {
          from: hourNumber(language, window.from, zone),
          to: hourNumber(language, window.to, zone),
        })
      : t('weather.uv.noProtect'),
    extra: { kind: 'scale', share: uvShare(uv) },
  };
}

function airReading(air: AirQuality, { t }: Context): TileReading {
  const level = eaqiLevel(air.index);
  const pollutant = level > 1 ? mainPollutant(air.parts) : null;
  return {
    metric: 'air',
    icon: 'plant',
    value: t('weather.air.value', { index: level, level: t(`weather.air.level${level}`) }),
    detail: pollutant
      ? t('weather.air.main', { pollutant: t(`weather.pollutant.${pollutant}`) })
      : t('weather.air.clean'),
    extra: { kind: 'levels', level },
  };
}

function windReading(current: CurrentWeather, { t }: Context): TileReading {
  return {
    metric: 'wind',
    icon: 'compass',
    value: t('weather.wind.value', {
      speed: Math.round(current.wind),
      direction: t(`weather.dir.${compassPoint(current.windDir)}`),
    }),
    detail: t('weather.wind.gusts', { speed: Math.round(current.gusts) }),
    extra: { kind: 'compass', degrees: current.windDir },
  };
}

function sunReading(
  today: DayForecast | undefined,
  tomorrow: DayForecast | undefined,
  now: number,
  { t, language, zone }: Context,
): TileReading {
  const next = !today
    ? null
    : now < today.sunrise
      ? { isSunset: false, ts: today.sunrise }
      : now < today.sunset
        ? { isSunset: true, ts: today.sunset }
        : tomorrow
          ? { isSunset: false, ts: tomorrow.sunrise }
          : null;
  return {
    metric: 'sun',
    icon: 'sun',
    value: next ? clockTime(language, next.ts, zone) : t('weather.page.noValue'),
    detail: next ? t(next.isSunset ? 'weather.sunset' : 'weather.sunrise') : '',
    extra: null,
  };
}

function visibilityReading(meters: number, { t, language }: Context): TileReading {
  const km = meters / METERS_PER_KM;
  const shown = km < PRECISE_BELOW_KM ? Math.round(km * 10) / 10 : Math.round(km);
  return {
    metric: 'visibility',
    icon: 'eye',
    value: t('weather.visibility.value', { km: formatNumber(language, shown) }),
    detail: t(`weather.visibility.${visibilityLevel(meters)}`),
    extra: null,
  };
}

/** Die Kacheln: zwei Spalten, quadratisch, jede mit Deutung. */
export function Tiles({
  forecast,
  now,
  onOpen,
}: {
  forecast: Forecast;
  now: number;
  onOpen?: (metric: TileMetric) => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const readings = tileReadings(forecast, now, t, language);
  const rows = readings.reduce<TileReading[][]>(
    (all, reading, index) =>
      index % 2 === 0
        ? [...all, [reading]]
        : [...all.slice(0, -1), [...(all[all.length - 1] ?? []), reading]],
    [],
  );

  return (
    <View style={{ gap: theme.spacing.md }}>
      {rows.map((row) => (
        <View
          key={row.map((reading) => reading.metric).join('-')}
          style={[styles.row, { gap: theme.spacing.md }]}
        >
          {row.map((reading) => (
            <Tile
              key={reading.metric}
              reading={reading}
              onPress={onOpen ? () => onOpen(reading.metric) : undefined}
            />
          ))}
          {row.length === 1 ? <View style={styles.tile} /> : null}
        </View>
      ))}
    </View>
  );
}

function Tile({ reading, onPress }: { reading: TileReading; onPress?: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const title = t(`weather.tile.${reading.metric}`);
  const { extra } = reading;

  return (
    <Surface
      onPress={onPress}
      accessibilityLabel={t('weather.tile.a11y', {
        title,
        value: reading.value,
        detail: reading.detail,
      })}
      style={[styles.tile, { gap: theme.spacing.sm }]}
    >
      <ModuleLabel icon={reading.icon} label={title} />
      <View style={[styles.valueRow, { gap: theme.spacing.sm }]}>
        <Text
          variant="title"
          numberOfLines={2}
          style={[styles.grow, { fontSize: theme.fontSize.stat, lineHeight: theme.lineHeight.xl }]}
        >
          {reading.value}
        </Text>
        {extra?.kind === 'compass' ? <Compass degrees={extra.degrees} /> : null}
      </View>
      {extra?.kind === 'scale' ? <ScaleBar value={extra.share} /> : null}
      {extra?.kind === 'levels' ? <LevelBar level={extra.level} /> : null}
      <Text variant="label" tone="muted" numberOfLines={2}>
        {reading.detail}
      </Text>
    </Surface>
  );
}

/** Die UV-Skala 0–11 mit einem Punkt fuer jetzt. */
function ScaleBar({ value }: { value: number }) {
  const theme = useTheme();
  const dot = WEATHER_METRICS.nowDot;
  const height = WEATHER_METRICS.rangeBarHeight;
  return (
    <View style={{ height, borderRadius: theme.radii.pill, backgroundColor: trackColor(theme) }}>
      <View
        style={[
          styles.absolute,
          {
            left: share(value),
            top: (height - dot) / 2,
            width: dot,
            height: dot,
            marginLeft: -dot / 2,
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.text,
          },
        ]}
      />
    </View>
  );
}

/** Die sechs Stufen des EAQI, die aktuelle hervorgehoben. */
function LevelBar({ level }: { level: EaqiLevel }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { gap: 2 }]}>
      {EAQI_LEVELS.map((step) => (
        <View
          key={step}
          style={[
            styles.grow,
            {
              height: WEATHER_METRICS.rangeBarHeight,
              borderRadius: theme.radii.pill,
              backgroundColor: step === level ? theme.colors.text : trackColor(theme),
            },
          ]}
        />
      ))}
    </View>
  );
}

/** Ein Kompass: die Linie zeigt, woher der Wind kommt. */
function Compass({ degrees }: { degrees: number }) {
  const theme = useTheme();
  const size = WEATHER_METRICS.compass;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: theme.radii.pill,
        borderWidth: 1,
        borderColor: theme.colors.borderStrong,
      }}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.center,
          { transform: [{ rotate: `${degrees}deg` }] },
        ]}
      >
        <View style={[styles.needle, { height: size / 2, backgroundColor: theme.colors.text }]} />
      </View>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Icon name="circle" size={6} color={theme.colors.text} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  tile: { flex: 1, aspectRatio: 1, justifyContent: 'space-between' },
  valueRow: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  absolute: { position: 'absolute' },
  center: { alignItems: 'center' },
  needle: { width: 2 },
});
