import { formatNumber, type Language, type Translate } from '@/i18n';

import type { Forecast, HourForecast } from './api';
import { hoursOfDay, UV_SCALE_MAX } from './insights';

/** Was sich als Verlauf ueber einen Tag zeichnen laesst. */
export type ChartMetric =
  'temp' | 'feels' | 'rain' | 'wind' | 'uv' | 'humidity' | 'visibility' | 'pressure' | 'air';

export type ChartSeries = {
  times: readonly number[];
  values: readonly number[];
  /** Der Massstab der Balken. */
  min: number;
  max: number;
  /** Tiefster und hoechster Wert, fuer die Beschriftung. */
  low: number;
  high: number;
};

const HOUR_MS = 3_600_000;
const PERCENT_MAX = 100;
const EAQI_TOP = 100;
const WIND_FLOOR_KMH = 20;
const PRESSURE_PAD_HPA = 2;
/** Temperaturbalken beginnen unter dem Tiefstwert, damit der kaelteste nicht verschwindet. */
const TEMP_FLOOR_SHARE = 0.25;
const METERS_PER_KM = 1000;

const PICK: Record<Exclude<ChartMetric, 'air'>, (hour: HourForecast) => number> = {
  temp: (hour) => hour.temp,
  feels: (hour) => hour.feelsLike,
  rain: (hour) => hour.rain,
  wind: (hour) => hour.wind,
  uv: (hour) => hour.uv,
  humidity: (hour) => hour.humidity,
  visibility: (hour) => hour.visibility / METERS_PER_KM,
  pressure: (hour) => hour.pressure,
};

function domainOf(metric: ChartMetric, low: number, high: number): { min: number; max: number } {
  switch (metric) {
    case 'temp':
    case 'feels': {
      const span = Math.max(high - low, 1);
      return { min: low - span * TEMP_FLOOR_SHARE, max: high };
    }
    case 'rain':
    case 'humidity':
      return { min: 0, max: PERCENT_MAX };
    case 'wind':
      return { min: 0, max: Math.max(high, WIND_FLOOR_KMH) };
    case 'uv':
      return { min: 0, max: Math.max(high, UV_SCALE_MAX) };
    case 'air':
      return { min: 0, max: Math.max(high, EAQI_TOP) };
    case 'visibility':
      return { min: 0, max: Math.max(high, 1) };
    case 'pressure':
      return { min: low - PRESSURE_PAD_HPA, max: high + PRESSURE_PAD_HPA };
  }
}

/** Die Stunden eines Tages als Reihe; ohne Werte `null`. */
export function chartSeries(
  forecast: Forecast,
  metric: ChartMetric,
  dayStart: number,
): ChartSeries | null {
  const points =
    metric === 'air'
      ? hoursOfDay(forecast.air?.hourly ?? [], dayStart).map((point) => ({
          ts: point.ts,
          value: point.index,
        }))
      : hoursOfDay(forecast.hourly, dayStart).map((hour) => ({
          ts: hour.ts,
          value: PICK[metric](hour),
        }));
  if (points.length === 0) return null;

  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  return {
    times: points.map((point) => point.ts),
    values,
    low,
    high,
    ...domainOf(metric, low, high),
  };
}

/** Welcher Balken die laufende Stunde ist, oder keiner. */
export function currentIndex(times: readonly number[], now: number): number | null {
  const index = times.findIndex((ts) => now >= ts && now < ts + HOUR_MS);
  return index < 0 ? null : index;
}

/** Ein Wert mit Einheit, fuer die Achse. */
export function metricText(
  metric: ChartMetric,
  value: number,
  t: Translate,
  language: Language,
): string {
  switch (metric) {
    case 'temp':
    case 'feels':
      return t('weather.degrees', { temp: Math.round(value) });
    case 'rain':
    case 'humidity':
      return t('weather.percent', { percent: Math.round(value) });
    case 'wind':
      return t('weather.windValue', { speed: Math.round(value) });
    case 'uv':
    case 'air':
      return formatNumber(language, Math.round(value));
    case 'visibility':
      return t('weather.visibility.value', { km: formatNumber(language, Math.round(value)) });
    case 'pressure':
      return t('weather.pressure.value', { value: Math.round(value) });
  }
}
