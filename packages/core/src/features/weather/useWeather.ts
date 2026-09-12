import { useEffect, useState } from 'react';

import type { WeatherPlace } from '@/db';
import { useApp } from '@/state/AppContext';

import { DEFAULT_PLACE, fetchForecast, type Forecast } from './api';

/** So lange gilt eine Vorhersage, bevor sie neu geholt wird. */
const FRESH_MS = 20 * 60_000;

/** Ein Vorrat je Ort, ueber alle Bildschirme hinweg — die Startseite und das Modul teilen ihn. */
const cache = new Map<string, Forecast>();

function keyOf(place: WeatherPlace): string {
  return `${place.lat.toFixed(3)},${place.lon.toFixed(3)}`;
}

/**
 * Das Wetter fuer den Ort des Kontos. `enabled` false holt nichts — die
 * anderen Apps brauchen kein Wetter, auch wenn sie denselben Bildschirm bauen.
 */
export function useWeather(enabled = true) {
  const { account, setWeatherPlace } = useApp();
  const place = account?.weatherPlace ?? DEFAULT_PLACE;
  const key = keyOf(place);

  const [forecast, setForecast] = useState<Forecast | null>(() => cache.get(key) ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const cached = cache.get(key);
    const showCached = () => setForecast(cached ?? null);
    if (cached && Date.now() - cached.fetchedAt < FRESH_MS) {
      showCached();
      return;
    }

    const startLoading = () => {
      setLoading(true);
      setError(false);
    };
    startLoading();
    fetchForecast(place)
      .then((next) => {
        if (cancelled) return;
        cache.set(key, next);
        setForecast(next);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `place` steckt in `key`; das Objekt selbst wechselt bei jedem Laden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, attempt]);

  return {
    place,
    forecast: forecast && keyOf(forecast.place) === key ? forecast : null,
    loading,
    error,
    retry: () => setAttempt((value) => value + 1),
    setPlace: setWeatherPlace,
  };
}
