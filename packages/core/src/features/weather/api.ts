import type { WeatherPlace } from '@/db';
import type { TranslationKey } from '@/i18n';
import type { IconName } from '@/ui';

import { hoursFrom, type Pollutant } from './insights';
import { kindOfCode } from './kinds';
import { DEFAULT_PLACE, isPlace } from './places';
import type { Quarter } from './rain';

export { DEFAULT_PLACE };

/**
 * Das Wetter kommt von Open-Meteo — frei, ohne Schluessel, ohne Konto. Drei
 * Dienste: die Vorhersage, die Luftqualitaet und die Ortssuche. Warnungen
 * liefert keiner davon.
 *
 * Alle Zeiten kommen als Unix-Sekunden (`timeformat=unixtime`) und werden hier
 * zu Millisekunden: so rechnet die App fuer Orte in anderen Zeitzonen richtig,
 * und auch ueber die Umstellung auf Sommerzeit.
 */
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

const TIMEOUT_MS = 12_000;
const SECOND_MS = 1000;
const DAY_MS = 86_400_000;
const FORECAST_DAYS = 7;
/** Drei Stunden in Viertelstunden — zwei fuer das Modul, eine als Reserve. */
const QUARTERS = 12;
const SEARCH_RESULTS = 8;

export type CurrentWeather = {
  ts: number;
  temp: number;
  feelsLike: number;
  code: number;
  wind: number;
  windDir: number;
  gusts: number;
  humidity: number;
  dewPoint: number;
  pressure: number;
  visibility: number;
  uv: number;
  isDay: boolean;
};

export type HourForecast = {
  ts: number;
  temp: number;
  feelsLike: number;
  code: number;
  /** Regenwahrscheinlichkeit in Prozent. */
  rain: number;
  /** Niederschlag in mm. */
  precip: number;
  wind: number;
  windDir: number;
  gusts: number;
  humidity: number;
  pressure: number;
  visibility: number;
  uv: number;
};

export type DayForecast = {
  /** Mitternacht am Ort. */
  ts: number;
  /** `YYYY-MM-DD` am Ort. */
  day: string;
  code: number;
  max: number;
  min: number;
  rain: number;
  precipSum: number;
  sunrise: number;
  sunset: number;
  uvMax: number;
  windMax: number;
  gustMax: number;
  windDir: number;
  /** Tageslicht in Sekunden. */
  daylight: number;
};

export type AirQuality = {
  ts: number;
  /** Der europaeische Index (EAQI), 0 bis ueber 100. */
  index: number;
  parts: Partial<Record<Pollutant, number>>;
  hourly: readonly { ts: number; index: number }[];
};

export type Forecast = {
  place: WeatherPlace;
  fetchedAt: number;
  timezone: string;
  utcOffsetSeconds: number;
  current: CurrentWeather;
  hourly: readonly HourForecast[];
  quarters: readonly Quarter[];
  daily: readonly DayForecast[];
  /** Fehlt, wenn der Luftqualitaets-Dienst nicht antwortet — dann faellt nur die Kachel weg. */
  air: AirQuality | null;
};

export type PlaceHit = WeatherPlace & { region: string };

// ─── Lesen, ohne der Antwort blind zu trauen ────────────────────────────────

function field(record: unknown, name: string): unknown {
  return typeof record === 'object' && record !== null
    ? (record as Record<string, unknown>)[name]
    : undefined;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function numberAt(series: unknown, index: number, fallback = 0): number {
  return Array.isArray(series) ? asNumber(series[index], fallback) : fallback;
}

function timesOf(series: unknown): number[] {
  return Array.isArray(series)
    ? series.filter((value): value is number => typeof value === 'number').map((s) => s * SECOND_MS)
    : [];
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Open-Meteo antwortet mit ${response.status}`);
    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

function coordinates(place: WeatherPlace): Record<string, string> {
  return { latitude: String(place.lat), longitude: String(place.lon) };
}

// ─── Vorhersage ──────────────────────────────────────────────────────────────

function forecastUrl(place: WeatherPlace): string {
  const params = new URLSearchParams({
    ...coordinates(place),
    current:
      'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,' +
      'wind_gusts_10m,relative_humidity_2m,dew_point_2m,pressure_msl,visibility,uv_index,is_day',
    hourly:
      'temperature_2m,apparent_temperature,weather_code,precipitation_probability,precipitation,' +
      'wind_speed_10m,wind_direction_10m,wind_gusts_10m,relative_humidity_2m,pressure_msl,' +
      'visibility,uv_index',
    minutely_15: 'precipitation',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,' +
      'precipitation_sum,sunrise,sunset,uv_index_max,wind_speed_10m_max,wind_gusts_10m_max,' +
      'wind_direction_10m_dominant,daylight_duration',
    timezone: 'auto',
    timeformat: 'unixtime',
    forecast_days: String(FORECAST_DAYS),
    forecast_minutely_15: String(QUARTERS),
  });
  return `${FORECAST_URL}?${params.toString()}`;
}

function parseCurrent(current: unknown): CurrentWeather {
  const temp = field(current, 'temperature_2m');
  if (typeof temp !== 'number') throw new Error('Open-Meteo: keine aktuelle Temperatur');
  return {
    ts: asNumber(field(current, 'time')) * SECOND_MS,
    temp,
    feelsLike: asNumber(field(current, 'apparent_temperature'), temp),
    code: asNumber(field(current, 'weather_code')),
    wind: asNumber(field(current, 'wind_speed_10m')),
    windDir: asNumber(field(current, 'wind_direction_10m')),
    gusts: asNumber(field(current, 'wind_gusts_10m')),
    humidity: asNumber(field(current, 'relative_humidity_2m')),
    dewPoint: asNumber(field(current, 'dew_point_2m')),
    pressure: asNumber(field(current, 'pressure_msl')),
    visibility: asNumber(field(current, 'visibility')),
    uv: asNumber(field(current, 'uv_index')),
    isDay: asNumber(field(current, 'is_day'), 1) === 1,
  };
}

function parseHourly(hourly: unknown): HourForecast[] {
  const at = (name: string, index: number) => numberAt(field(hourly, name), index);
  return timesOf(field(hourly, 'time')).map((ts, index) => ({
    ts,
    temp: at('temperature_2m', index),
    feelsLike: at('apparent_temperature', index),
    code: at('weather_code', index),
    rain: at('precipitation_probability', index),
    precip: at('precipitation', index),
    wind: at('wind_speed_10m', index),
    windDir: at('wind_direction_10m', index),
    gusts: at('wind_gusts_10m', index),
    humidity: at('relative_humidity_2m', index),
    pressure: at('pressure_msl', index),
    visibility: at('visibility', index),
    uv: at('uv_index', index),
  }));
}

function parseDaily(daily: unknown, offsetSeconds: number): DayForecast[] {
  const at = (name: string, index: number) => numberAt(field(daily, name), index);
  return timesOf(field(daily, 'time')).map((ts, index) => ({
    ts,
    // Der Tag am Ort, nicht auf dem Geraet: Mitternacht dort plus Versatz ergibt das UTC-Datum.
    day: new Date(ts + offsetSeconds * SECOND_MS).toISOString().slice(0, 10),
    code: at('weather_code', index),
    max: at('temperature_2m_max', index),
    min: at('temperature_2m_min', index),
    rain: at('precipitation_probability_max', index),
    precipSum: at('precipitation_sum', index),
    sunrise: at('sunrise', index) * SECOND_MS,
    sunset: at('sunset', index) * SECOND_MS,
    uvMax: at('uv_index_max', index),
    windMax: at('wind_speed_10m_max', index),
    gustMax: at('wind_gusts_10m_max', index),
    windDir: at('wind_direction_10m_dominant', index),
    daylight: at('daylight_duration', index),
  }));
}

function parseQuarters(minutely: unknown): Quarter[] {
  const precipitation = field(minutely, 'precipitation');
  return timesOf(field(minutely, 'time')).map((ts, index) => ({
    ts,
    precip: numberAt(precipitation, index),
  }));
}

// ─── Luftqualitaet ───────────────────────────────────────────────────────────

const POLLUTANT_FIELDS: Record<Pollutant, string> = {
  pm2_5: 'european_aqi_pm2_5',
  pm10: 'european_aqi_pm10',
  no2: 'european_aqi_nitrogen_dioxide',
  o3: 'european_aqi_ozone',
  so2: 'european_aqi_sulphur_dioxide',
};

function airUrl(place: WeatherPlace): string {
  const params = new URLSearchParams({
    ...coordinates(place),
    current: ['european_aqi', ...Object.values(POLLUTANT_FIELDS)].join(','),
    hourly: 'european_aqi',
    timezone: 'auto',
    timeformat: 'unixtime',
    forecast_days: String(FORECAST_DAYS),
  });
  return `${AIR_URL}?${params.toString()}`;
}

function parseAir(data: unknown): AirQuality | null {
  const current = field(data, 'current');
  const index = field(current, 'european_aqi');
  if (typeof index !== 'number' || !Number.isFinite(index)) return null;
  const hourly = field(data, 'hourly');
  const series = field(hourly, 'european_aqi');
  const parts = Object.fromEntries(
    (Object.entries(POLLUTANT_FIELDS) as [Pollutant, string][])
      .map(([pollutant, name]) => [pollutant, field(current, name)] as const)
      .filter((entry): entry is readonly [Pollutant, number] => typeof entry[1] === 'number'),
  ) as Partial<Record<Pollutant, number>>;
  return {
    ts: asNumber(field(current, 'time')) * SECOND_MS,
    index,
    parts,
    hourly: timesOf(field(hourly, 'time'))
      .map((ts, position) => ({ ts, index: numberAt(series, position, Number.NaN) }))
      .filter((entry) => Number.isFinite(entry.index)),
  };
}

// ─── Abrufen ─────────────────────────────────────────────────────────────────

/**
 * Vorhersage und Luftqualitaet gleichzeitig. Scheitert die Vorhersage, scheitert
 * alles; scheitert nur die Luftqualitaet, bleibt `air` leer.
 */
export async function fetchForecast(place: WeatherPlace): Promise<Forecast> {
  const [forecast, air] = await Promise.allSettled([
    fetchJson(forecastUrl(place)),
    fetchJson(airUrl(place)),
  ]);
  if (forecast.status === 'rejected') {
    throw forecast.reason instanceof Error ? forecast.reason : new Error('Open-Meteo');
  }
  const data = forecast.value;
  const offset = asNumber(field(data, 'utc_offset_seconds'));
  const hourly = parseHourly(field(data, 'hourly'));
  const daily = parseDaily(field(data, 'daily'), offset);
  if (hourly.length === 0 || daily.length === 0) throw new Error('Open-Meteo: leere Vorhersage');

  const timezone = field(data, 'timezone');
  return {
    place,
    fetchedAt: Date.now(),
    timezone: typeof timezone === 'string' ? timezone : 'UTC',
    utcOffsetSeconds: offset,
    current: parseCurrent(field(data, 'current')),
    hourly,
    quarters: parseQuarters(field(data, 'minutely_15')),
    daily,
    air: air.status === 'fulfilled' ? parseAir(air.value) : null,
  };
}

/** Orte zu einem Suchwort — Name, Region und Land, damit man Zürich von Zürich unterscheidet. */
export async function searchPlaces(query: string, language: string): Promise<PlaceHit[]> {
  const params = new URLSearchParams({
    name: query,
    count: String(SEARCH_RESULTS),
    language,
    format: 'json',
  });
  const data = await fetchJson(`${GEOCODING_URL}?${params.toString()}`);
  const results = field(data, 'results');
  if (!Array.isArray(results)) return [];
  return results
    .map((hit: unknown) => ({
      name: field(hit, 'name'),
      lat: field(hit, 'latitude'),
      lon: field(hit, 'longitude'),
      region: [field(hit, 'admin1'), field(hit, 'country')]
        .filter((part): part is string => typeof part === 'string' && part.length > 0)
        .join(', '),
    }))
    .filter((hit): hit is PlaceHit => isPlace(hit));
}

// ─── Deutung der Codes ───────────────────────────────────────────────────────

/** Die Wettercodes der WMO, gebuendelt zu dem, was man sagen wuerde. */
export function weatherLabelKey(code: number): TranslationKey {
  if (code === 0) return 'weather.code.clear';
  if (code === 1) return 'weather.code.mostlyClear';
  if (code === 2) return 'weather.code.partlyCloudy';
  if (code === 3) return 'weather.code.overcast';
  if (code === 45 || code === 48) return 'weather.code.fog';
  if (code >= 51 && code <= 57) return 'weather.code.drizzle';
  if (code >= 61 && code <= 67) return 'weather.code.rain';
  if (code >= 71 && code <= 77) return 'weather.code.snow';
  if (code >= 80 && code <= 82) return 'weather.code.showers';
  if (code === 85 || code === 86) return 'weather.code.snowShowers';
  if (code >= 95) return 'weather.code.thunder';
  return 'weather.code.partlyCloudy';
}

export function weatherIcon(code: number): IconName {
  if (code <= 1) return 'sun';
  if (code === 2) return 'partlySunny';
  if (code === 3 || code === 45 || code === 48) return 'cloud';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'thunder';
  return 'cloud';
}

/** Nachts ist klar ein Mond und nicht eine Sonne. */
export function weatherIconAt(code: number, isDay: boolean): IconName {
  if (isDay) return weatherIcon(code);
  if (kindOfCode(code) === 'clear') return 'sleep';
  return code === 2 ? 'cloud' : weatherIcon(code);
}

/** Ob die Sonne zu diesem Zeitpunkt am Ort ueber dem Horizont steht. */
export function isDaylight(ts: number, daily: readonly DayForecast[]): boolean {
  const day = daily.find((entry) => ts >= entry.ts && ts < entry.ts + DAY_MS);
  return day ? ts >= day.sunrise && ts < day.sunset : true;
}

/** Die naechsten Stunden ab jetzt — die vergangenen des Tages nicht mehr. */
export function upcomingHours(forecast: Forecast, count = 24, now = Date.now()): HourForecast[] {
  return hoursFrom(forecast.hourly, now, count);
}
