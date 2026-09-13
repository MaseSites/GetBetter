import { useLocalSearchParams } from 'expo-router';

import type { ModuleDefinition } from '@/mocks/types';

import { parsePlaceParam } from './places';
import { PlacePages } from './PlacePages';
import { PlacesList } from './PlacesList';

/**
 * Das Wetter im Vollbild, ohne Tab-Leiste.
 *
 * - `/run/weather` — die Ortsseiten, beginnend beim Ort der Startseite
 * - `/run/weather?place=<lat>,<lon>` (optional `&name=Bern`) — genau diese
 *   Seite; ist der Ort nicht gemerkt, eine voruebergehende Seite mit „Hinzufügen“
 * - `/run/weather?view=places` — die Orte-Liste, als eigener Bildschirm darueber
 */
export function WeatherView(_props: { module: ModuleDefinition }) {
  const params = useLocalSearchParams<{ place?: string; name?: string; view?: string }>();
  if (params.view === 'places') return <PlacesList />;

  const coords = parsePlaceParam(params.place);
  const name = typeof params.name === 'string' ? params.name.trim() : '';
  const requested = coords ? { ...coords, ...(name ? { name } : {}) } : null;
  return <PlacePages requested={requested} />;
}
