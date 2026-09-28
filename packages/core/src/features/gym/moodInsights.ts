/**
 * „Was dir guttut“: die Laune an Tagen mit und ohne Training, gutem Schlaf,
 * erreichtem Trinkziel. Ein Zusammenhang, keine Ursache — gezeigt wird er
 * erst, wenn beide Seiten genug Tage haben und der Unterschied spuerbar ist.
 */
import { sleepMinutes } from '../../db/pure';

export type MoodFactor = 'workout' | 'sleep' | 'water';

export type MoodInsight = {
  factor: MoodFactor;
  /** Mittlere Laune an Tagen mit, auf eine Stelle. */
  withMood: number;
  /** Mittlere Laune an Tagen ohne. */
  withoutMood: number;
  withDays: number;
  withoutDays: number;
};

/** Je Seite mindestens so viele Tage. */
export const MIN_DAYS = 5;
/** Ab diesem Unterschied lohnt sich ein Satz. */
export const MIN_DIFFERENCE = 0.5;
/** Ab so viel Schlaf gilt eine Nacht als gut. */
export const GOOD_SLEEP_MINUTES = 7 * 60;

type Options = { waterTargetDl?: number };

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function moodInsightsOf(
  moods: readonly { day: string; mood: number }[],
  sleeps: readonly { day: string; bedtime: string; wakeTime: string }[],
  workouts: readonly { day: string }[],
  drinks: readonly { day: string; amountDl: number }[],
  { waterTargetDl = 20 }: Options = {},
): MoodInsight[] {
  const trainedDays = new Set(workouts.map((row) => row.day));
  // Die Nacht gehoert zum Morgen danach — zum Tag, dessen Laune sie praegt.
  const sleptBy = new Map(sleeps.map((row) => [row.day, sleepMinutes(row)]));
  const drankBy = new Map<string, number>();
  for (const row of drinks) drankBy.set(row.day, (drankBy.get(row.day) ?? 0) + row.amountDl);

  // Je Tag eine Laune; wer zweimal eintraegt, zaehlt einmal (die letzte).
  const moodBy = new Map(moods.map((row) => [row.day, row.mood]));

  /** Fuer jeden Tag: gehoert er zu „mit“ (true), „ohne“ (false) oder weiss man es nicht (null)? */
  const splits: Record<MoodFactor, (day: string) => boolean | null> = {
    workout: (day) => trainedDays.has(day),
    sleep: (day) => {
      const minutes = sleptBy.get(day);
      return minutes === undefined ? null : minutes >= GOOD_SLEEP_MINUTES;
    },
    // Ohne einen einzigen Schluck eingetragen wissen wir nichts ueber den Tag.
    water: (day) => {
      const dl = drankBy.get(day);
      return dl === undefined ? null : dl >= waterTargetDl;
    },
  };

  const insights: MoodInsight[] = [];
  for (const factor of ['workout', 'sleep', 'water'] as const) {
    const withSide: number[] = [];
    const withoutSide: number[] = [];
    for (const [day, mood] of moodBy) {
      const side = splits[factor](day);
      if (side === true) withSide.push(mood);
      else if (side === false) withoutSide.push(mood);
    }
    if (withSide.length < MIN_DAYS || withoutSide.length < MIN_DAYS) continue;
    const withMood = round1(mean(withSide));
    const withoutMood = round1(mean(withoutSide));
    if (Math.abs(withMood - withoutMood) < MIN_DIFFERENCE) continue;
    insights.push({
      factor,
      withMood,
      withoutMood,
      withDays: withSide.length,
      withoutDays: withoutSide.length,
    });
  }
  return insights.sort(
    (a, b) => Math.abs(b.withMood - b.withoutMood) - Math.abs(a.withMood - a.withoutMood),
  );
}
