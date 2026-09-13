import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

import type { WeatherPlace } from '@/db';

import { fetchForecast, type Forecast } from './api';
import { isPlace, placeKey } from './places';

/**
 * Der Vorrat an Vorhersagen, je Ort — geteilt von der Startseite, den Seiten
 * und der Orte-Liste. Er liegt auch auf dem Geraet: beim naechsten Oeffnen
 * stehen die letzten Werte sofort da, und offline bleiben sie stehen.
 */

/** So lange gilt eine Vorhersage, bevor sie neu geholt wird. */
export const FRESH_MS = 20 * 60_000;

const STORAGE_PREFIX = 'better-life/weather/forecast/v1/';

export type ForecastEntry = {
  forecast: Forecast | null;
  loading: boolean;
  /** Wann das letzte Holen scheiterte; null, solange es klappt. */
  failedAt: number | null;
};

const EMPTY: ForecastEntry = { forecast: null, loading: false, failedAt: null };

/** Was aus dem Speicher kommt, muss wenigstens die Form einer Vorhersage haben. */
function isStoredForecast(value: unknown): value is Forecast {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const current = candidate.current as Record<string, unknown> | undefined;
  return (
    isPlace(candidate.place) &&
    typeof candidate.fetchedAt === 'number' &&
    typeof candidate.utcOffsetSeconds === 'number' &&
    typeof current?.temp === 'number' &&
    Array.isArray(candidate.hourly) &&
    Array.isArray(candidate.daily) &&
    Array.isArray(candidate.quarters)
  );
}

class ForecastStore {
  private readonly entries = new Map<string, ForecastEntry>();
  private readonly listeners = new Set<() => void>();
  private readonly pending = new Map<string, Promise<void>>();

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly get = (key: string): ForecastEntry => this.entries.get(key) ?? EMPTY;

  /** Holt, wenn nichts Frisches da ist. `force` holt immer (Ziehen zum Aktualisieren). */
  ensure(place: WeatherPlace, force = false): Promise<void> {
    const key = placeKey(place);
    const running = this.pending.get(key);
    if (running) return running;
    const job = this.load(place, key, force).finally(() => this.pending.delete(key));
    this.pending.set(key, job);
    return job;
  }

  private async load(place: WeatherPlace, key: string, force: boolean) {
    if (!this.get(key).forecast) await this.restore(key);
    const cached = this.get(key).forecast;
    if (!force && cached && Date.now() - cached.fetchedAt < FRESH_MS) return;

    this.update(key, { loading: true });
    try {
      const forecast = await fetchForecast(place);
      this.update(key, { forecast, loading: false, failedAt: null });
      await AsyncStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(forecast)).catch(() => {
        // Ohne Platz auf dem Geraet gibt es eben keinen Vorrat fuers naechste Mal.
      });
    } catch {
      // Die Oberflaeche zeigt es: mit Vorrat „Offline · Stand …“, ohne „nicht erreichbar“.
      this.update(key, { loading: false, failedAt: Date.now() });
    }
  }

  private async restore(key: string) {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_PREFIX + key);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (isStoredForecast(parsed) && !this.get(key).forecast) {
        this.update(key, { forecast: parsed });
      }
    } catch {
      // Ein unlesbarer Vorrat ist wie keiner: dann wird eben neu geholt.
    }
  }

  private update(key: string, patch: Partial<ForecastEntry>) {
    this.entries.set(key, { ...this.get(key), ...patch });
    this.listeners.forEach((listener) => listener());
  }
}

export const forecastStore = new ForecastStore();

/** Die Vorhersage eines Orts; holt sie beim ersten Zeigen und wenn sie alt ist. */
export function useForecast(place: WeatherPlace | null, enabled = true): ForecastEntry {
  const key = place ? placeKey(place) : null;
  const snapshot = () => (key ? forecastStore.get(key) : EMPTY);
  const entry = useSyncExternalStore(forecastStore.subscribe, snapshot, snapshot);

  const name = place?.name;
  const lat = place?.lat;
  const lon = place?.lon;
  useEffect(() => {
    if (!enabled || name === undefined || lat === undefined || lon === undefined) return;
    void forecastStore.ensure({ name, lat, lon });
  }, [enabled, name, lat, lon]);

  return entry;
}

export function refreshForecast(place: WeatherPlace): Promise<void> {
  return forecastStore.ensure(place, true);
}
