// Relative Pfade mit Absicht: so laeuft die Datei auch in den Tests unter Node.
import type { EventRow } from '../../db/types';
import { MAX_SCHEDULED, reminderInstant, type Reminder } from '../tasks/reminders';

/**
 * Erinnerungen vor Terminen — reine Rechnung, getestet. Dasselbe Format wie
 * bei den Aufgaben (`Reminder`), damit beide ueber denselben Weg aufs Handy
 * kommen (`syncPushReminders`).
 *
 * `EventRow.reminderMinutes`:
 * - `null` oder fehlend: keine Erinnerung
 * - `0`: zur Zeit, `10`, `60`: so viele Minuten vorher
 * - `EVENT_REMINDER_DAY_BEFORE`: am Vortag um 18:00
 *
 * Ganztaegiges hat keine Uhrzeit: `0` heisst dann am Tag um 09:00, jede andere
 * Wahl am Vortag um 18:00.
 */

/** Am Vortag um 18:00 — als Wert gespeichert wie ein Vorlauf von einem Tag. */
export const EVENT_REMINDER_DAY_BEFORE = 1440;

/** Die Wahlen im Editor, in dieser Reihenfolge. */
export const EVENT_REMINDER_CHOICES = [null, 0, 10, 60, EVENT_REMINDER_DAY_BEFORE] as const;
/** Ganztaegig gibt es nur keine, am Tag und am Vortag. */
export const ALL_DAY_REMINDER_CHOICES = [null, 0, EVENT_REMINDER_DAY_BEFORE] as const;

export type EventReminderChoice = (typeof EVENT_REMINDER_CHOICES)[number];

const EVENING = '18:00';
const ALL_DAY_MORNING = '09:00';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Der Tag in Ortszeit als `YYYY-MM-DD`. */
function localDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dayBefore(date: Date): string {
  return localDay(new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1));
}

/** Wann die Erinnerung eines Termins klingelt — `null` ohne Erinnerung. */
export function eventReminderInstant(
  event: Pick<EventRow, 'startsAt' | 'allDay' | 'reminderMinutes'>,
): Date | null {
  const minutes = event.reminderMinutes;
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes) || minutes < 0) {
    return null;
  }
  const start = new Date(event.startsAt);
  if (Number.isNaN(start.getTime())) return null;
  if (event.allDay) {
    return minutes === 0
      ? reminderInstant(localDay(start), ALL_DAY_MORNING, 0)
      : reminderInstant(dayBefore(start), EVENING, 0);
  }
  if (minutes >= EVENT_REMINDER_DAY_BEFORE) return reminderInstant(dayBefore(start), EVENING, 0);
  return new Date(start.getTime() - minutes * 60_000);
}

/**
 * Die naechsten Erinnerungen vor Terminen, frueheste zuerst — nur, was noch
 * kommt, jeder Termin einmal (Kopien in mehreren Kalendern teilen die `groupId`).
 */
export function eventRemindersOf(
  events: readonly EventRow[],
  now: Date,
  options: { max?: number } = {},
): Reminder[] {
  const seen = new Set<string>();
  const list: Reminder[] = [];
  for (const event of events) {
    const group = event.groupId ?? event.id;
    if (seen.has(group)) continue;
    const at = eventReminderInstant(event);
    if (!at || at.getTime() <= now.getTime()) continue;
    seen.add(group);
    list.push({
      taskId: group,
      kind: 'event',
      title: event.title,
      at: at.toISOString(),
      startsAt: event.startsAt,
      allDay: event.allDay,
    });
  }
  return list
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, Math.max(0, options.max ?? MAX_SCHEDULED));
}
