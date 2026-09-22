// Relative Pfade mit Absicht: so laeuft die Datei auch in den Tests unter Node.
import { dayKey } from '../../db/pure';
import { readClock } from '../shared/clock';

/**
 * Tagesrechnung der Aufgaben: ein Tag ist `YYYY-MM-DD` in Ortszeit, ohne
 * Uhrzeit. Alles gibt neue Schluessel zurueck, nichts veraendert ein Datum.
 */

/** `YYYY-MM-DD` → lokales Datum um Mitternacht. */
export function dateOfKey(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, date ?? 1);
}

export function addDays(day: string, days: number): string {
  const date = dateOfKey(day);
  return dayKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
}

/** 1 Montag bis 7 Sonntag. */
export function weekdayOf(day: string): number {
  const weekday = dateOfKey(day).getDay();
  return weekday === 0 ? 7 : weekday;
}

/** Der naechste solche Wochentag. `includeToday`: heute zaehlt mit. */
export function nextWeekday(from: string, weekday: number, includeToday: boolean): string {
  const diff = (weekday - weekdayOf(from) + 7) % 7;
  return addDays(from, diff === 0 && !includeToday ? 7 : diff);
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Monate weiter; der 31. wird im kuerzeren Monat zum letzten Tag. */
export function addMonths(day: string, months: number): string {
  const date = dateOfKey(day);
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const clamped = Math.min(date.getDate(), daysInMonth(target.getFullYear(), target.getMonth()));
  return dayKey(new Date(target.getFullYear(), target.getMonth(), clamped));
}

export function endOfMonth(day: string): string {
  const date = dateOfKey(day);
  return dayKey(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function startOfNextMonth(day: string): string {
  const date = dateOfKey(day);
  return dayKey(new Date(date.getFullYear(), date.getMonth() + 1, 1));
}

/** `YYYY-MM` */
export function monthOf(day: string): string {
  return day.slice(0, 7);
}

/** „Nächste Woche“ heisst: der Montag danach. */
export function nextMonday(from: string): string {
  return nextWeekday(from, 1, false);
}

/** „Wochenende“: der kommende Samstag — am Wochenende selbst heute. */
export function weekendDay(from: string): string {
  return weekdayOf(from) >= 6 ? from : nextWeekday(from, 6, true);
}

/** Ein Tag aus Jahr, Monat und Tag — null, wenn es ihn nicht gibt (31.2.). */
export function dayFromParts(year: number, month: number, date: number): string | null {
  if (year < 1000 || month < 1 || month > 12 || date < 1) return null;
  const result = new Date(year, month - 1, date);
  if (result.getMonth() !== month - 1 || result.getDate() !== date) return null;
  return dayKey(result);
}

/** `HH:MM`, oder null, wenn Stunde oder Minute nicht passen. */
export function timeOf(hour: number, minute: number): string | null {
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Nimmt „9:05“, „9.05“, „18“ und „1830“ (`readClock`) — gibt `09:05` zurueck oder null. */
export function parseClock(input: string): string | null {
  const clock = readClock(input);
  return clock ? timeOf(clock.hour, clock.minute) : null;
}

export function minutesOfTime(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}
