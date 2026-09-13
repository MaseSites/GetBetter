import type { WeatherPlace } from '@/db';

/**
 * Die gemerkten Orte fuers Wetter — rein gerechnet, ohne Speicher dahinter.
 * Das Konto haelt die Liste (`weatherPlaces`), `weatherPlace` ist der erste
 * Ort; aeltere Konten kennen nur ihn und werden hier beim Lesen umgezogen.
 */

/** Hoechstens so viele gemerkte Orte, dazu der eigene Standort. */
export const MAX_PLACES = 20;

/** Ohne gemerkten Ort gilt Zuerich. */
export const DEFAULT_PLACE: WeatherPlace = { name: 'Zürich', lat: 47.3769, lon: 8.5417 };

/** Nachkommastellen fuer den Schluessel — auf gut hundert Meter genau. */
const KEY_DIGITS = 3;
/** Nachkommastellen fuer den ungefaehren Standort — etwa ein Kilometer. */
const APPROXIMATE_DIGITS = 2;

export type PlaceHolder =
  { weatherPlace?: WeatherPlace; weatherPlaces?: readonly WeatherPlace[] } | null | undefined;

export type AddResult = 'added' | 'duplicate' | 'full';

function isLatitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;
}

function isLongitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;
}

/** Ein Ort mit Namen und gueltigen Koordinaten — alles andere faellt beim Lesen weg. */
export function isPlace(value: unknown): value is WeatherPlace {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.name === 'string' &&
    candidate.name.trim().length > 0 &&
    isLatitude(candidate.lat) &&
    isLongitude(candidate.lon)
  );
}

export function placeKey(place: Pick<WeatherPlace, 'lat' | 'lon'>): string {
  return `${place.lat.toFixed(KEY_DIGITS)},${place.lon.toFixed(KEY_DIGITS)}`;
}

export function findPlace(places: readonly WeatherPlace[], key: string): WeatherPlace | undefined {
  return places.find((place) => placeKey(place) === key);
}

/** Die Orte eines Kontos: ohne Doppelte, hoechstens 20, nie leer. */
export function placesOf(holder: PlaceHolder): readonly WeatherPlace[] {
  const saved = (holder?.weatherPlaces ?? [])
    .filter(isPlace)
    .filter(
      (place, index, all) =>
        all.findIndex((other) => placeKey(other) === placeKey(place)) === index,
    )
    .slice(0, MAX_PLACES);
  if (saved.length > 0) return saved;
  const single = holder?.weatherPlace;
  return isPlace(single) ? [single] : [DEFAULT_PLACE];
}

/** Hinten anfuegen — ausser er ist schon da oder die Liste ist voll. */
export function withPlace(
  places: readonly WeatherPlace[],
  place: WeatherPlace,
): { places: readonly WeatherPlace[]; result: AddResult } {
  if (places.some((other) => placeKey(other) === placeKey(place))) {
    return { places, result: 'duplicate' };
  }
  if (places.length >= MAX_PLACES) return { places, result: 'full' };
  return { places: [...places, place], result: 'added' };
}

/** Nach vorne holen: der erste Ort ist der, den die Startseite zeigt. */
export function withPlaceFirst(
  places: readonly WeatherPlace[],
  place: WeatherPlace,
): readonly WeatherPlace[] {
  return [place, ...places.filter((other) => placeKey(other) !== placeKey(place))].slice(
    0,
    MAX_PLACES,
  );
}

/** Entfernen. Ein Ort bleibt immer — den letzten gibt die Liste nicht her. */
export function withoutPlace(
  places: readonly WeatherPlace[],
  key: string,
): readonly WeatherPlace[] {
  const next = places.filter((place) => placeKey(place) !== key);
  return next.length > 0 ? next : places;
}

/** Fuer Rückgängig: wieder an die alte Stelle. */
export function insertedPlace(
  places: readonly WeatherPlace[],
  place: WeatherPlace,
  index: number,
): readonly WeatherPlace[] {
  if (places.some((other) => placeKey(other) === placeKey(place))) return places;
  if (places.length >= MAX_PLACES) return places;
  const at = Math.min(Math.max(0, index), places.length);
  return [...places.slice(0, at), place, ...places.slice(at)];
}

/** Einen Platz nach oben (-1) oder unten (1); am Rand bleibt alles, wie es ist. */
export function movedPlace(
  places: readonly WeatherPlace[],
  key: string,
  direction: -1 | 1,
): readonly WeatherPlace[] {
  const from = places.findIndex((place) => placeKey(place) === key);
  const to = from + direction;
  const moving = places[from];
  const other = places[to];
  if (from < 0 || !moving || !other) return places;
  return places.map((place, index) => (index === from ? other : index === to ? moving : place));
}

/** Der ungefaehre Standort: gerundet, damit er nicht auf das Haus genau ist. */
export function approximate(value: number): number {
  const factor = 10 ** APPROXIMATE_DIGITS;
  return Math.round(value * factor) / factor;
}

/** `?place=47.37,8.54` — alles, was keine gueltige Koordinate ist, gilt nicht. */
export function parsePlaceParam(
  value: string | readonly string[] | undefined,
): { lat: number; lon: number } | null {
  const raw = typeof value === 'string' ? value : value?.[0];
  if (!raw) return null;
  const parts = raw.split(',').map((part) => part.trim());
  const [latText, lonText] = parts;
  if (parts.length !== 2 || !latText || !lonText) return null;
  const lat = Number(latText);
  const lon = Number(lonText);
  return isLatitude(lat) && isLongitude(lon) ? { lat, lon } : null;
}
