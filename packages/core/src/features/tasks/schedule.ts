// Relative Pfade mit Absicht: so laeuft die Datei auch in den Tests unter Node.
import { dueAtOfDay } from '../../db/taskFields';
import type { TaskPatch } from '../../db/tasks';
import type { TaskRow } from '../../db/types';

import { addDays, minutesOfTime, nextMonday, weekendDay } from './days';

/**
 * Was eine Planung an der Aufgabe aendert. Ohne Tag faellt alles weg, was
 * einen Tag braucht; mit Uhrzeit kommt die Erinnerung zur Uhrzeit, wenn noch
 * keine gewaehlt war.
 */
export function schedulePatch(
  task: Pick<TaskRow, 'reminderOffsetMinutes'>,
  target: { day: string | null; time: string | null },
): TaskPatch {
  if (target.day === null) {
    return { dueAt: null, dueTime: null, reminderOffsetMinutes: null, repeat: null };
  }
  return {
    dueAt: dueAtOfDay(target.day),
    dueTime: target.time,
    reminderOffsetMinutes: target.time === null ? null : (task.reminderOffsetMinutes ?? 0),
  };
}

/** Das Menue „Planen“: Heute Abend, Morgen, Wochenende, Nächste Woche, Kein Datum. */
export const SCHEDULE_PRESETS = ['tonight', 'tomorrow', 'weekend', 'nextWeek', 'none'] as const;

export type SchedulePreset = (typeof SCHEDULE_PRESETS)[number];

export type Schedule = { day: string | null; time: string | null };

/** „Heute Abend“ ist um diese Zeit, und „Am Vortag“ erinnert dann. */
export const EVENING_TIME = '18:00';

const MINUTES_PER_DAY = 24 * 60;

/**
 * Wohin ein Vorschlag eine Aufgabe legt. Eine vorhandene Uhrzeit bleibt, ausser
 * bei „Heute Abend“ (18:00) und „Kein Datum“ (keine).
 */
export function scheduleFor(
  preset: SchedulePreset,
  today: string,
  currentTime: string | null,
): Schedule {
  switch (preset) {
    case 'tonight':
      return { day: today, time: EVENING_TIME };
    case 'tomorrow':
      return { day: addDays(today, 1), time: currentTime };
    case 'weekend':
      return { day: weekendDay(today), time: currentTime };
    case 'nextWeek':
      return { day: nextMonday(today), time: currentTime };
    case 'none':
      return { day: null, time: null };
  }
}

/** Die festen Erinnerungen in Minuten vor der Frist: zur Fälligkeit, 5, 15, 30. */
export const REMINDER_OFFSETS = [0, 5, 15, 30] as const;

/** „Am Vortag 18:00“, als Minuten vor einer Frist um `time`. */
export function dayBeforeOffset(time: string): number {
  return minutesOfTime(time) + MINUTES_PER_DAY - minutesOfTime(EVENING_TIME);
}
