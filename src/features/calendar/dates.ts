/**
 * Datumsrechnung ohne Fremdbibliothek. Alles arbeitet auf lokaler Zeit;
 * gespeichert wird als ISO-String.
 */

/** Die Woche beginnt am Montag — Schweizer Gewohnheit. */
export const WEEK_STARTS_ON = 1;

export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfDay(date: Date): Date {
  const result = startOfDay(date);
  result.setDate(result.getDate() + 1);
  return result;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  // Erst auf den Ersten, sonst rutscht der 31. in den uebernaechsten Monat.
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function startOfWeek(date: Date): Date {
  const result = startOfDay(date);
  const shift = (result.getDay() - WEEK_STARTS_ON + 7) % 7;
  result.setDate(result.getDate() - shift);
  return result;
}

export function startOfMonth(date: Date): Date {
  const result = startOfDay(date);
  result.setDate(1);
  return result;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/** Die sieben Tage der Woche, in der `date` liegt. */
export function weekDays(date: Date): Date[] {
  const first = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(first, index));
}

/** Sechs Wochen, damit das Raster nicht springt. */
export function monthGrid(date: Date): Date[] {
  const first = startOfWeek(startOfMonth(date));
  return Array.from({ length: 42 }, (_, index) => addDays(first, index));
}

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** "9:05" und "09:05" gelten, alles andere nicht. */
export function parseTime(input: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2})[:.](\d{2})$/.exec(input.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function formatTimeValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** "08.09.2026" */
export function formatDateValue(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
}

export function parseDateValue(input: string): Date | null {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(input.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const result = new Date(year, month - 1, day);
  // Der 31.02. wuerde sonst still zum 03.03. werden.
  if (result.getDate() !== day || result.getMonth() !== month - 1) return null;
  return startOfDay(result);
}

export function withTime(day: Date, hour: number, minute: number): Date {
  const result = startOfDay(day);
  result.setHours(hour, minute, 0, 0);
  return result;
}
