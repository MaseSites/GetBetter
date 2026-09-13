import { dayKey } from './pure';
import type { TaskPriority } from './types';

/** Die vier Stufen: keine, !, !!, !!!. */
export const TASK_PRIORITIES = [0, 1, 2, 3] as const satisfies readonly TaskPriority[];

/**
 * Liest die Wichtigkeit einer Aufgabe, egal wie sie gespeichert ist. Aeltere
 * Zeilen kennen nur die Fahne (`true`) — die gilt als eine Stufe. Alles, was
 * keine Zahl ist, heisst keine.
 */
export function priorityOf(value: unknown): TaskPriority {
  if (value === true) return 1;
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const rounded = Math.round(value);
  if (rounded <= 0) return 0;
  if (rounded >= 3) return 3;
  return rounded as TaskPriority;
}

/** Der Tag einer Frist als `YYYY-MM-DD` in Ortszeit — null ohne oder mit kaputter Frist. */
export function dueDayOf(row: { dueAt: string | null }): string | null {
  if (!row.dueAt) return null;
  const date = new Date(row.dueAt);
  return Number.isNaN(date.getTime()) ? null : dayKey(date);
}

/**
 * Wie ein Tag als Frist gespeichert wird: um 12:00 Ortszeit. So bleibt es in
 * jeder Zeitzone zwischen −11 und +11 Stunden derselbe Tag, auch fuer Code,
 * der nur die ersten zehn Zeichen liest. Die Uhrzeit steht in `dueTime`.
 */
export function dueAtOfDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, date ?? 1, 12).toISOString();
}
