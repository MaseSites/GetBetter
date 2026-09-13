/**
 * Die Wettercodes der WMO, gebuendelt zu dem, was man in einem Satz sagen
 * wuerde: trocken (klar, bewoelkt, Nebel) oder nass (Regen, Schnee, Gewitter).
 */

export const DRY_KINDS = ['clear', 'cloudy', 'fog'] as const;
export const WET_KINDS = ['rain', 'snow', 'thunder'] as const;

export type DryKind = (typeof DRY_KINDS)[number];
export type WetKind = (typeof WET_KINDS)[number];
export type WeatherKind = DryKind | WetKind;

/** Was eine Stunde fuer die Einordnung braucht. */
export type HourLike = { ts: number; code: number; rain: number; precip: number };

/** Ab dieser Wahrscheinlichkeit gilt ein nasser Code auch als nass. */
const WET_PROBABILITY = 30;
/** Ab dieser Wahrscheinlichkeit regnet es, egal was der Code sagt. */
const SURE_PROBABILITY = 60;
/** Ab so viel Niederschlag in der Stunde ist es nass, auch ohne Wahrscheinlichkeit. */
const WET_MM = 0.1;

export function isWet(kind: WeatherKind): kind is WetKind {
  return (WET_KINDS as readonly string[]).includes(kind);
}

export function kindOfCode(code: number): WeatherKind {
  if (code >= 95) return 'thunder';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (code === 45 || code === 48) return 'fog';
  if (code <= 1) return 'clear';
  return 'cloudy';
}

/** Eine Stunde: der Code allein luegt manchmal, die Wahrscheinlichkeit entscheidet mit. */
export function kindOfHour(hour: HourLike): WeatherKind {
  const byCode = kindOfCode(hour.code);
  if (isWet(byCode)) {
    return hour.rain >= WET_PROBABILITY || hour.precip >= WET_MM ? byCode : 'cloudy';
  }
  return hour.rain >= SURE_PROBABILITY ? 'rain' : byCode;
}

/** Was am haeufigsten vorkommt; bei Gleichstand das, was zuerst kam. */
function mostFrequent<K extends WeatherKind>(kinds: readonly K[], fallback: K): K {
  const counts = kinds.reduce<ReadonlyMap<K, number>>(
    (map, kind) => new Map(map).set(kind, (map.get(kind) ?? 0) + 1),
    new Map(),
  );
  return (
    kinds.reduce<K | null>((best, kind) => {
      if (best === null) return kind;
      return (counts.get(kind) ?? 0) > (counts.get(best) ?? 0) ? kind : best;
    }, null) ?? fallback
  );
}

export function dominantDry(kinds: readonly WeatherKind[]): DryKind {
  return mostFrequent(
    kinds.filter((kind): kind is DryKind => !isWet(kind)),
    'cloudy',
  );
}

export function dominantWet(kinds: readonly WeatherKind[]): WetKind {
  return mostFrequent(kinds.filter(isWet), 'rain');
}
