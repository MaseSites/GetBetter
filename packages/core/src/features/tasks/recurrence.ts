// Relative Pfade mit Absicht: so laeuft die Datei auch in den Tests unter Node.
import type { TaskRepeat } from '../../db/types';

import { addDays, addMonths, weekdayOf } from './days';

/** Schutz gegen Endlosschleifen bei kaputten Zeilen. */
const MAX_STEPS = 1000;

function everyOf(repeat: TaskRepeat): number {
  return Number.isFinite(repeat.every) ? Math.max(1, Math.round(repeat.every)) : 1;
}

/** Die gueltigen Wochentage, sortiert und ohne Doppelte. */
export function weekdaysOf(repeat: TaskRepeat): number[] {
  return [...new Set(repeat.weekdays ?? [])]
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
    .sort((a, b) => a - b);
}

/** Der `step`-te Termin nach `base` bei Tagen, Monaten und Jahren. */
function nthAfter(repeat: TaskRepeat, base: string, step: number): string {
  const every = everyOf(repeat) * step;
  if (repeat.unit === 'day') return addDays(base, every);
  if (repeat.unit === 'week') return addDays(base, every * 7);
  if (repeat.unit === 'month') return addMonths(base, every);
  return addMonths(base, every * 12);
}

/** Der naechste gewaehlte Wochentag nach `from`, alle `every` Wochen. */
function nextOnWeekdays(repeat: TaskRepeat, days: readonly number[], from: string): string {
  const current = weekdayOf(from);
  const later = days.find((day) => day > current);
  if (later !== undefined) return addDays(from, later - current);
  const monday = addDays(from, 1 - current);
  return addDays(monday, everyOf(repeat) * 7 + (days[0] ?? 1) - 1);
}

/**
 * Wann die naechste Instanz faellig ist.
 *
 * - `fromCompletion`: ab dem Tag des Abhakens („Pflanzen giessen alle 7 Tage“).
 * - sonst ab der alten Frist, aber nie am oder vor dem Tag des Abhakens — wer
 *   eine taegliche Aufgabe drei Tage zu spaet abhakt, bekommt morgen die naechste.
 */
export function nextDueDay(
  repeat: TaskRepeat,
  dueDay: string | null,
  completedDay: string,
): string {
  const base = repeat.fromCompletion || dueDay === null ? completedDay : dueDay;
  const days = repeat.unit === 'week' ? weekdaysOf(repeat) : [];

  if (days.length > 0) {
    let next = nextOnWeekdays(repeat, days, base);
    for (let step = 0; step < MAX_STEPS && next <= completedDay; step += 1) {
      next = nextOnWeekdays(repeat, days, next);
    }
    return next;
  }

  for (let step = 1; step <= MAX_STEPS; step += 1) {
    const next = nthAfter(repeat, base, step);
    if (next > completedDay) return next;
  }
  return nthAfter(repeat, completedDay, 1);
}
