/**
 * Schlafschuld und Regelmaessigkeit — reine Rechnung ueber die Naechte, ohne
 * Speicher. Relativ importiert, damit `npm test` sie ohne App pruefen kann.
 */
import { dayKey, sleepMinutes } from '../../db/pure';

type Night = { day: string; bedtime: string; wakeTime: string };

/** Wie weit zurueck die Schuld reicht — wie bei Rise. */
export const DEBT_NIGHTS = 14;
/** Die letzte Nacht zaehlt voll, die aelteste noch so viel. */
const OLDEST_WEIGHT = 0.3;
/** Mehr als eine Stunde am Abend holt niemand auf, ohne den Rhythmus zu kippen. */
const MAX_CATCH_UP = 60;
/** Aufholen in Viertelstunden — genauer plant niemand. */
const STEP = 15;
const MINUTES_PER_DAY = 24 * 60;

export type SleepDebt = {
  /** Gewichtete Schuld in Minuten, auf 5 gerundet, nie unter 0. */
  debtMinutes: number;
  /** Ungewichteter Schnitt der gezaehlten Naechte. */
  averageMinutes: number;
  /** Wie viele Naechte im Fenster eingetragen sind. */
  nights: number;
};

function ageInDays(day: string, today: string): number {
  const [y1, m1, d1] = day.split('-').map(Number);
  const [y2, m2, d2] = today.split('-').map(Number);
  const a = Date.UTC(y1 ?? 0, (m1 ?? 1) - 1, d1 ?? 1);
  const b = Date.UTC(y2 ?? 0, (m2 ?? 1) - 1, d2 ?? 1);
  return Math.round((b - a) / 86_400_000);
}

/**
 * Schlafschuld ueber die letzten 14 Naechte: je Nacht Bedarf minus Schlaf,
 * juengere schwerer gewichtet (1 → 0.3). Zu viel Schlaf zahlt zurueck, unter 0
 * geht es nicht. Fehlende Naechte zaehlen nicht — ueber sie wissen wir nichts.
 */
export function sleepDebtOf(
  nights: readonly Night[],
  goalMinutes: number,
  now: Date = new Date(),
): SleepDebt | null {
  const today = dayKey(now);
  const seen = new Set<string>();
  let debt = 0;
  let total = 0;
  let count = 0;
  for (const night of nights) {
    const age = ageInDays(night.day, today);
    if (age < 0 || age >= DEBT_NIGHTS || seen.has(night.day)) continue;
    seen.add(night.day);
    const slept = sleepMinutes(night);
    const weight = 1 - ((1 - OLDEST_WEIGHT) * age) / (DEBT_NIGHTS - 1);
    debt += (goalMinutes - slept) * weight;
    total += slept;
    count += 1;
  }
  if (count === 0) return null;
  return {
    debtMinutes: Math.max(0, Math.round(debt / 5) * 5),
    averageMinutes: Math.round(total / count),
    nights: count,
  };
}

function minutesOf(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

/**
 * Wie stark die Bettzeit schwankt: Standardabweichung in Minuten. Ueber
 * Mitternacht gerechnet — 23:30 und 00:30 liegen eine Stunde auseinander,
 * nicht 23. Erst ab drei Naechten; sonst `null`.
 */
export function regularityOf(nights: readonly Pick<Night, 'bedtime'>[]): number | null {
  if (nights.length < 3) return null;
  // Der Abend beginnt am Mittag: was davor liegt, gehoert zur Nacht danach.
  const values = nights.map((night) => {
    const minutes = minutesOf(night.bedtime);
    return minutes < 12 * 60 ? minutes + MINUTES_PER_DAY : minutes;
  });
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.round(Math.sqrt(variance));
}

function clockOf(minutes: number): string {
  const wrapped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

/**
 * Wann heute ins Bett, um etwas Schuld aufzuholen: vom Aufstehen zurueck
 * Bedarf plus hoechstens eine Stunde, in Viertelstunden. Unter einer
 * Viertelstunde Schuld gibt es nichts aufzuholen (`null`).
 */
export function catchUpOf(input: {
  debtMinutes: number;
  goalMinutes: number;
  /** Aufstehen morgen, Minuten nach Mitternacht. */
  wakeMinutes: number;
}): { bedtime: string; catchUpMinutes: number } | null {
  const catchUp = Math.floor(Math.min(input.debtMinutes, MAX_CATCH_UP) / STEP) * STEP;
  if (catchUp <= 0) return null;
  return {
    bedtime: clockOf(input.wakeMinutes - input.goalMinutes - catchUp),
    catchUpMinutes: catchUp,
  };
}
