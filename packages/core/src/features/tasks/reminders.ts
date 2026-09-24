// Relative Pfade mit Absicht: so laeuft die Datei auch in den Tests unter Node.
import { dueDayOf } from '../../db/taskFields';
import type { TaskRow } from '../../db/types';

/**
 * Welche Erinnerungen das Handy stellen soll — reine Rechnung, getestet.
 * Aus den offenen Aufgaben mit Tag, Uhrzeit und Vorlauf wird je eine
 * Erinnerung zum Zeitpunkt „Uhrzeit minus Vorlauf“; Vergangenes faellt weg.
 */
export type Reminder = {
  taskId: string;
  title: string;
  /** Wann sie klingelt, als ISO-Zeit. */
  at: string;
};

/** iOS haelt hoechstens 64 offene Erinnerungen — darunter bleiben wir. */
export const MAX_SCHEDULED = 60;

/** Der Zeitpunkt in Ortszeit — `null`, wenn Tag oder Uhrzeit krumm sind. */
export function reminderInstant(day: string, time: string, offsetMinutes: number): Date | null {
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if (!year || !month || !date) return null;
  if (hour === undefined || minute === undefined || Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }
  const at = new Date(year, month - 1, date, hour, minute - Math.max(0, offsetMinutes), 0, 0);
  return Number.isNaN(at.getTime()) ? null : at;
}

/**
 * Die naechsten Erinnerungen, frueheste zuerst — nur offene Aufgaben mit Tag,
 * Uhrzeit und Vorlauf, nur was noch kommt, hoechstens `limit`.
 */
export function remindersOf(
  tasks: readonly TaskRow[],
  now: Date,
  limit: number = MAX_SCHEDULED,
): Reminder[] {
  const list: Reminder[] = [];
  for (const task of tasks) {
    if (task.done) continue;
    const day = dueDayOf(task);
    const time = task.dueTime ?? null;
    const offset = task.reminderOffsetMinutes;
    if (!day || !time || offset === null || offset === undefined) continue;
    const at = reminderInstant(day, time, offset);
    if (!at || at.getTime() <= now.getTime()) continue;
    list.push({ taskId: task.id, title: task.title, at: at.toISOString() });
  }
  return list.sort((a, b) => a.at.localeCompare(b.at)).slice(0, Math.max(0, limit));
}

/** Hat sich etwas geaendert? Sonst muss das Handy nichts neu stellen. */
export function sameReminders(a: readonly Reminder[], b: readonly Reminder[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((entry, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      other.taskId === entry.taskId &&
      other.title === entry.title &&
      other.at === entry.at
    );
  });
}
