import { useApp } from '@/state/AppContext';

import { DEFAULT_PLACE } from './api';
import { placesOf } from './places';
import { refreshForecast, useForecast } from './store';

/**
 * Das Wetter fuer den ersten Ort des Kontos — die Startseite zeigt es neben dem
 * Datum. `enabled` false holt nichts: die anderen Apps brauchen kein Wetter,
 * auch wenn sie denselben Bildschirm bauen.
 */
export function useWeather(enabled = true) {
  const { account, setWeatherPlace } = useApp();
  const place = account?.weatherPlace ?? placesOf(account)[0] ?? DEFAULT_PLACE;
  const entry = useForecast(place, enabled);

  return {
    place,
    forecast: entry.forecast,
    loading: entry.loading,
    error: entry.failedAt !== null && !entry.forecast,
    retry: () => void refreshForecast(place),
    setPlace: setWeatherPlace,
  };
}
