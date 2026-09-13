import {
  dominantDry,
  dominantWet,
  isWet,
  kindOfHour,
  type DryKind,
  type HourLike,
  type WeatherKind,
  type WetKind,
} from './kinds';

/**
 * Ein Satz statt 24 Symbolen: „Ab 16 Uhr Regen. Morgen früh klar.“ Erst wird
 * gerechnet, was zu sagen ist (reine Daten), dann daraus der Satz gebaut —
 * so laesst sich beides ohne App pruefen.
 */

const HOUR_MS = 3_600_000;
const SUMMARY_HOURS = 24;
/** Worueber „die nächsten Stunden“ reden, wenn nichts passiert. */
const STEADY_HOURS = 12;
/** „Morgen früh“: von 6 bis 10 Uhr. */
const MORNING_FROM = 6;
const MORNING_TO = 10;
/** Der Tag im Tag-Blatt: von 6 bis 22 Uhr. */
const DAYTIME_FROM = 6;
const DAYTIME_TO = 22;
const MIDDAY = 12;
const EVENING = 20;
/** So viel vom Tag muss nass sein, damit es „den ganzen Tag“ heisst. */
const WHOLE_DAY_SHARE = 0.75;

export type Say<K extends string> = (key: K, values?: Record<string, string | number>) => string;

// ─── Die naechsten 24 Stunden ────────────────────────────────────────────────

export type NextHoursLead =
  | { type: 'from'; kind: WetKind; ts: number }
  | { type: 'until'; kind: WetKind; ts: number }
  | { type: 'steady'; kind: WeatherKind };

export type NextHoursSummary = { lead: NextHoursLead; tomorrow: WeatherKind | null };

export type SummaryKey =
  | `weather.summary.from.${WetKind}`
  | `weather.summary.until.${WetKind}`
  | `weather.summary.steady.${WeatherKind}`
  | `weather.summary.tomorrow.${WeatherKind}`;

/**
 * `hours` beginnt mit der laufenden Stunde. `tomorrowStart` ist Mitternacht
 * des Folgetags am Ort (ms), oder null, wenn es keinen gibt.
 */
export function summarizeNextHours(
  hours: readonly HourLike[],
  tomorrowStart: number | null,
): NextHoursSummary | null {
  const window = hours.slice(0, SUMMARY_HOURS);
  if (window.length === 0) return null;
  const kinds = window.map(kindOfHour);
  const { lead, after } = leadOf(window, kinds);
  const morning = tomorrowStart === null ? null : morningKind(window, kinds, tomorrowStart);
  return { lead, tomorrow: morning !== null && morning !== after ? morning : null };
}

function leadOf(
  window: readonly HourLike[],
  kinds: readonly WeatherKind[],
): { lead: NextHoursLead; after: WeatherKind } {
  const now = kinds[0] ?? 'cloudy';
  if (isWet(now)) {
    const stop = kinds.findIndex((kind) => !isWet(kind));
    const stopHour = window[stop];
    if (stop < 0 || !stopHour) return { lead: { type: 'steady', kind: now }, after: now };
    return {
      lead: { type: 'until', kind: now, ts: stopHour.ts },
      after: dominantDry(kinds.slice(stop)),
    };
  }
  const start = kinds.findIndex(isWet);
  const startHour = window[start];
  const startKind = kinds[start];
  if (startHour && startKind && isWet(startKind)) {
    return { lead: { type: 'from', kind: startKind, ts: startHour.ts }, after: startKind };
  }
  const steady = dominantDry(kinds.slice(0, STEADY_HOURS));
  return { lead: { type: 'steady', kind: steady }, after: steady };
}

function morningKind(
  window: readonly HourLike[],
  kinds: readonly WeatherKind[],
  tomorrowStart: number,
): WeatherKind | null {
  const from = tomorrowStart + MORNING_FROM * HOUR_MS;
  const to = tomorrowStart + MORNING_TO * HOUR_MS;
  const morning = kinds.filter((_, index) => {
    const ts = window[index]?.ts ?? -1;
    return ts >= from && ts < to;
  });
  if (morning.length === 0) return null;
  return morning.some(isWet) ? dominantWet(morning) : dominantDry(morning);
}

export function nextHoursText(
  summary: NextHoursSummary,
  say: Say<SummaryKey>,
  hourLabel: (ts: number) => string,
): string {
  const { lead } = summary;
  const first =
    lead.type === 'steady'
      ? say(`weather.summary.steady.${lead.kind}`)
      : say(`weather.summary.${lead.type}.${lead.kind}`, { time: hourLabel(lead.ts) });
  return summary.tomorrow
    ? `${first} ${say(`weather.summary.tomorrow.${summary.tomorrow}`)}`
    : first;
}

// ─── Ein ganzer Tag ──────────────────────────────────────────────────────────

export type DaySummary =
  | { type: 'whole'; kind: WeatherKind; percent: number }
  | { type: 'split'; morning: DryKind; later: DryKind }
  | { type: 'dryThenWet'; dry: DryKind; wet: WetKind; ts: number; percent: number; early: boolean }
  | { type: 'wetThenDry'; wet: WetKind; ts: number; percent: number; dry: DryKind };

export type DaySummaryKey =
  | `weather.daySummary.whole.${WeatherKind}`
  | `weather.daySummary.morning.${DryKind}`
  | `weather.daySummary.first.${DryKind}`
  | `weather.daySummary.later.${DryKind}`
  | `weather.daySummary.from.${WetKind}`
  | `weather.daySummary.until.${WetKind}`
  | `weather.daySummary.after.${DryKind}`
  | 'weather.daySummary.sentence';

function highestChance(hours: readonly HourLike[]): number {
  return Math.round(hours.reduce((max, hour) => Math.max(max, hour.rain), 0));
}

/** `hours` darf mehr als den Tag enthalten; `dayStart` ist Mitternacht am Ort (ms). */
export function summarizeDay(hours: readonly HourLike[], dayStart: number): DaySummary | null {
  const between = (from: number, to: number) =>
    hours.filter(
      (hour) => hour.ts >= dayStart + from * HOUR_MS && hour.ts < dayStart + to * HOUR_MS,
    );

  const day = between(DAYTIME_FROM, DAYTIME_TO);
  if (day.length === 0) return null;
  const kinds = day.map(kindOfHour);
  const wetHours = day.filter((_, index) => isWet(kinds[index] ?? 'cloudy'));

  if (wetHours.length === 0) {
    const morning = dominantDry(between(DAYTIME_FROM, MIDDAY).map(kindOfHour));
    const later = dominantDry(between(MIDDAY, EVENING).map(kindOfHour));
    return morning === later
      ? { type: 'whole', kind: morning, percent: 0 }
      : { type: 'split', morning, later };
  }

  if (wetHours.length >= day.length * WHOLE_DAY_SHARE) {
    return { type: 'whole', kind: dominantWet(kinds), percent: highestChance(wetHours) };
  }

  const firstWet = kinds.findIndex(isWet);
  if (firstWet === 0) {
    const stop = kinds.findIndex((kind) => !isWet(kind));
    const stopHour = day[stop];
    if (!stopHour) {
      return { type: 'whole', kind: dominantWet(kinds), percent: highestChance(wetHours) };
    }
    return {
      type: 'wetThenDry',
      wet: dominantWet(kinds.slice(0, stop)),
      ts: stopHour.ts,
      percent: highestChance(day.slice(0, stop)),
      dry: dominantDry(kinds.slice(stop)),
    };
  }

  const startHour = day[firstWet];
  if (!startHour) return null;
  const rest = day.slice(firstWet).filter((_, index) => isWet(kinds[firstWet + index] ?? 'cloudy'));
  return {
    type: 'dryThenWet',
    dry: dominantDry(kinds.slice(0, firstWet)),
    wet: dominantWet(kinds.slice(firstWet)),
    ts: startHour.ts,
    percent: highestChance(rest),
    early: startHour.ts < dayStart + MIDDAY * HOUR_MS,
  };
}

export function dayText(
  summary: DaySummary,
  say: Say<DaySummaryKey>,
  hourLabel: (ts: number) => string,
): string {
  const sentence = (first: string, second: string) =>
    say('weather.daySummary.sentence', { first, second });

  switch (summary.type) {
    case 'whole':
      return say(`weather.daySummary.whole.${summary.kind}`, { percent: summary.percent });
    case 'split':
      return sentence(
        say(`weather.daySummary.morning.${summary.morning}`),
        say(`weather.daySummary.later.${summary.later}`),
      );
    case 'dryThenWet':
      return sentence(
        summary.early
          ? say(`weather.daySummary.first.${summary.dry}`)
          : say(`weather.daySummary.morning.${summary.dry}`),
        say(`weather.daySummary.from.${summary.wet}`, {
          time: hourLabel(summary.ts),
          percent: summary.percent,
        }),
      );
    case 'wetThenDry':
      return sentence(
        say(`weather.daySummary.until.${summary.wet}`, {
          time: hourLabel(summary.ts),
          percent: summary.percent,
        }),
        say(`weather.daySummary.after.${summary.dry}`),
      );
  }
}
