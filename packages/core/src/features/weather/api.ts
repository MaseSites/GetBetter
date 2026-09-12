import type { WeatherPlace } from '@/db';
import type { TranslationKey } from '@/i18n';
import type { IconName } from '@/ui';

/**
 * Das Wetter kommt von Open-Meteo — frei, ohne Schluessel, ohne Konto.
 * Zwei Dienste: die Vorhersage und die Ortssuche.
 */
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

/** Ohne gewaehlten Ort gilt Zuerich. */
export const DEFAULT_PLACE: WeatherPlace = { name: 'Zürich', lat: 47.3769, lon: 8.5417 };

export type HourForecast = { at: string; temp: number; code: number; rain: number };
export type DayForecast = {
  day: string;
  code: number;
  max: number;
  min: number;
  rain: number;
  sunrise: string;
  sunset: string;
};

export type Forecast = {
  place: WeatherPlace;
  fetchedAt: number;
  current: { temp: number; feelsLike: number; code: number; wind: number; humidity: number };
  hourly: readonly HourForecast[];
  daily: readonly DayForecast[];
};

type ForecastResponse = {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
    relative_humidity_2m: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
    precipitation_probability: number[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    sunrise: string[];
    sunset: string[];
  };
};

export async function fetchForecast(place: WeatherPlace): Promise<Forecast> {
  const params = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lon),
    current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m',
    hourly: 'temperature_2m,weather_code,precipitation_probability',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
    timezone: 'auto',
    forecast_days: '7',
  });
  const response = await fetch(`${FORECAST_URL}?${params.toString()}`);
  if (!response.ok) throw new Error(`Wetter: ${response.status}`);
  const data = (await response.json()) as ForecastResponse;

  return {
    place,
    fetchedAt: Date.now(),
    current: {
      temp: data.current.temperature_2m,
      feelsLike: data.current.apparent_temperature,
      code: data.current.weather_code,
      wind: data.current.wind_speed_10m,
      humidity: data.current.relative_humidity_2m,
    },
    hourly: data.hourly.time.map((at, index) => ({
      at,
      temp: data.hourly.temperature_2m[index] ?? 0,
      code: data.hourly.weather_code[index] ?? 0,
      rain: data.hourly.precipitation_probability[index] ?? 0,
    })),
    daily: data.daily.time.map((day, index) => ({
      day,
      code: data.daily.weather_code[index] ?? 0,
      max: data.daily.temperature_2m_max[index] ?? 0,
      min: data.daily.temperature_2m_min[index] ?? 0,
      rain: data.daily.precipitation_probability_max[index] ?? 0,
      sunrise: data.daily.sunrise[index] ?? '',
      sunset: data.daily.sunset[index] ?? '',
    })),
  };
}

type GeocodingResponse = {
  results?: {
    name: string;
    latitude: number;
    longitude: number;
    admin1?: string;
    country?: string;
  }[];
};

export type PlaceHit = WeatherPlace & { region: string };

/** Orte zu einem Suchwort — Name, Region und Land, damit man Zuerich von Zuerich unterscheidet. */
export async function searchPlaces(query: string): Promise<PlaceHit[]> {
  const params = new URLSearchParams({ name: query, count: '6', language: 'de', format: 'json' });
  const response = await fetch(`${GEOCODING_URL}?${params.toString()}`);
  if (!response.ok) throw new Error(`Ortssuche: ${response.status}`);
  const data = (await response.json()) as GeocodingResponse;
  return (data.results ?? []).map((hit) => ({
    name: hit.name,
    lat: hit.latitude,
    lon: hit.longitude,
    region: [hit.admin1, hit.country].filter(Boolean).join(', '),
  }));
}

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

/** Die naechsten Stunden ab jetzt — die vergangenen des Tages nicht mehr. */
export function upcomingHours(forecast: Forecast, count = 24, now = new Date()): HourForecast[] {
  const cutoff = new Date(now);
  cutoff.setMinutes(0, 0, 0);
  const start = forecast.hourly.findIndex(
    (hour) => new Date(hour.at).getTime() >= cutoff.getTime(),
  );
  return forecast.hourly.slice(Math.max(0, start), Math.max(0, start) + count);
}
