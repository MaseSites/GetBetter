/**
 * Deutungen statt nackter Zahlen: „6 · Hoch“, „EAQI 2 · Gut“, „Wind lässt es
 * kühler wirken“. Alles rein gerechnet, damit es ohne App pruefbar ist.
 */

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

// ─── UV ──────────────────────────────────────────────────────────────────────

export type UvLevel = 'low' | 'moderate' | 'high' | 'veryHigh' | 'extreme';

/** Die Skala der WHO endet offiziell bei 11+. */
export const UV_SCALE_MAX = 11;
/** Ab hier braucht es Sonnenschutz. */
const UV_PROTECT = 3;

export function uvLevel(uv: number): UvLevel {
  const value = Math.round(uv);
  if (value < 3) return 'low';
  if (value < 6) return 'moderate';
  if (value < 8) return 'high';
  if (value < 11) return 'veryHigh';
  return 'extreme';
}

/** Anteil auf der Skala 0–11, fuer den Punkt auf dem Balken. */
export function uvShare(uv: number): number {
  return clampShare(uv / UV_SCALE_MAX);
}

/** Von der ersten bis nach der letzten Stunde mit UV ab 3. */
export function protectionWindow(
  hours: readonly { ts: number; uv: number }[],
): { from: number; to: number } | null {
  const strong = hours.filter((hour) => Math.round(hour.uv) >= UV_PROTECT);
  const first = strong[0];
  const last = strong[strong.length - 1];
  if (!first || !last) return null;
  return { from: first.ts, to: last.ts + HOUR_MS };
}

// ─── Luftqualitaet (EAQI) ────────────────────────────────────────────────────

export type EaqiLevel = 1 | 2 | 3 | 4 | 5 | 6;
export const EAQI_LEVELS: readonly EaqiLevel[] = [1, 2, 3, 4, 5, 6];

/**
 * Open-Meteo liefert den europaeischen Index als Zahl von 0 bis ueber 100; die
 * Europaeische Umweltagentur teilt ihn in sechs Stufen zu je 20.
 */
export function eaqiLevel(index: number): EaqiLevel {
  if (index <= 20) return 1;
  if (index <= 40) return 2;
  if (index <= 60) return 3;
  if (index <= 80) return 4;
  if (index <= 100) return 5;
  return 6;
}

export type Pollutant = 'pm2_5' | 'pm10' | 'no2' | 'o3' | 'so2';

/** Der Schadstoff mit dem hoechsten Teilindex — ohne Belastung keiner. */
export function mainPollutant(parts: Partial<Record<Pollutant, number>>): Pollutant | null {
  const ranked = (Object.entries(parts) as [Pollutant, number | undefined][])
    .filter((entry): entry is [Pollutant, number] => {
      const value = entry[1];
      return typeof value === 'number' && Number.isFinite(value) && value > 0;
    })
    .sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] ?? null;
}

// ─── Gefuehlt ────────────────────────────────────────────────────────────────

export type FeelsReason = 'similar' | 'wind' | 'humid' | 'colder' | 'warmer';

/** Weniger Unterschied faellt niemandem auf. */
const FEELS_THRESHOLD = 2;
const WINDY_KMH = 15;
const HUMID_PERCENT = 60;

export function feelsReason(input: {
  temp: number;
  feelsLike: number;
  wind: number;
  humidity: number;
}): FeelsReason {
  const difference = input.feelsLike - input.temp;
  if (Math.abs(difference) < FEELS_THRESHOLD) return 'similar';
  if (difference < 0) return input.wind >= WINDY_KMH ? 'wind' : 'colder';
  return input.humidity >= HUMID_PERCENT ? 'humid' : 'warmer';
}

// ─── Wind, Sicht, Druck ──────────────────────────────────────────────────────

export type Compass = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
const COMPASS: readonly Compass[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

/** Woher der Wind kommt, auf acht Richtungen gerundet. */
export function compassPoint(degrees: number): Compass {
  const normalised = ((degrees % 360) + 360) % 360;
  return COMPASS[Math.round(normalised / 45) % COMPASS.length] ?? 'n';
}

export type VisibilityLevel = 'clear' | 'good' | 'hazy' | 'poor';

export function visibilityLevel(meters: number): VisibilityLevel {
  if (meters >= 20_000) return 'clear';
  if (meters >= 10_000) return 'good';
  if (meters >= 4_000) return 'hazy';
  return 'poor';
}

export type PressureTrend = 'rising' | 'falling' | 'steady';

/** Ab einem Hektopascal in drei Stunden aendert sich spuerbar etwas. */
const PRESSURE_STEP = 1;

export function pressureTrend(now: number, later: number): PressureTrend {
  const change = later - now;
  if (change >= PRESSURE_STEP) return 'rising';
  if (change <= -PRESSURE_STEP) return 'falling';
  return 'steady';
}

// ─── Wochenbalken ────────────────────────────────────────────────────────────

function clampShare(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Wo der Balken eines Tages beginnt und endet, gemessen an der ganzen Woche. */
export function rangeBar(
  min: number,
  max: number,
  weekMin: number,
  weekMax: number,
): { start: number; end: number } {
  const span = weekMax - weekMin;
  if (span <= 0) return { start: 0, end: 1 };
  const start = clampShare((Math.min(min, max) - weekMin) / span);
  const end = clampShare((Math.max(min, max) - weekMin) / span);
  return { start, end: Math.max(start, end) };
}

/** Der Punkt fuer jetzt auf demselben Massstab. */
export function nowShare(temp: number, weekMin: number, weekMax: number): number {
  const span = weekMax - weekMin;
  return span <= 0 ? 0.5 : clampShare((temp - weekMin) / span);
}

export function weekSpan(days: readonly { min: number; max: number }[]): {
  min: number;
  max: number;
} {
  if (days.length === 0) return { min: 0, max: 0 };
  return {
    min: Math.min(...days.map((day) => day.min)),
    max: Math.max(...days.map((day) => day.max)),
  };
}

// ─── Zeit ────────────────────────────────────────────────────────────────────

export type Age =
  | { kind: 'justNow' }
  | { kind: 'fresh' }
  | { kind: 'minutes'; count: number }
  | { kind: 'hours'; count: number }
  | { kind: 'days' };

const MINUTE_MS = 60_000;

/**
 * Wie alt die Daten sind: gerade eben, frisch (dann zeigt der Fuss die Uhrzeit)
 * oder „vor 2 Std.“, wenn sie aus dem Vorrat kommen.
 */
export function ageOf(fetchedAt: number, now: number, freshMs: number): Age {
  const age = Math.max(0, now - fetchedAt);
  if (age < MINUTE_MS) return { kind: 'justNow' };
  if (age < freshMs) return { kind: 'fresh' };
  if (age < HOUR_MS) return { kind: 'minutes', count: Math.floor(age / MINUTE_MS) };
  if (age < DAY_MS) return { kind: 'hours', count: Math.floor(age / HOUR_MS) };
  return { kind: 'days' };
}

export function daylightParts(seconds: number): { hours: number; minutes: number } {
  const total = Math.max(0, Math.round(seconds / 60));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

/** Die Stunden ab der laufenden Stunde. */
export function hoursFrom<T extends { ts: number }>(
  hours: readonly T[],
  now: number,
  count: number,
): T[] {
  const start = hours.findIndex((hour) => hour.ts + HOUR_MS > now);
  return start < 0 ? [] : hours.slice(start, start + count);
}

/** Die 24 Stunden eines Tages, der um `dayStart` beginnt. */
export function hoursOfDay<T extends { ts: number }>(hours: readonly T[], dayStart: number): T[] {
  return hours.filter((hour) => hour.ts >= dayStart && hour.ts < dayStart + DAY_MS);
}

/** Welcher Tag der Liste gerade laeuft. */
export function dayIndexAt(days: readonly { ts: number }[], now: number): number {
  const index = days.findIndex((day, position) => {
    const next = days[position + 1];
    return now >= day.ts && (next ? now < next.ts : now < day.ts + DAY_MS);
  });
  return Math.max(0, index);
}
