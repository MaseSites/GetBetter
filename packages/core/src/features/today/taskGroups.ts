// Relative Pfade mit Absicht: so laeuft die Datei auch in den Tests unter Node.
import { dueDayOf, priorityOf } from '../../db/taskFields';
import type { TaskRow } from '../../db/types';

/**
 * Welche offenen Aufgaben ein Tag auf der Startseite zeigt. Heute: was
 * ueberfaellig ist, was heute faellig ist, und was noch gar kein Datum hat —
 * sonst saehe man sie nirgends. Ein anderer Tag: nur, was dann faellig ist.
 * Rein, getestet.
 */
export type DayTaskGroups = {
  overdue: TaskRow[];
  due: TaskRow[];
  /** Nur heute: Aufgaben ohne Datum, der Eingang. */
  inbox: TaskRow[];
};

/**
 * Mit Uhrzeit zuerst, nach der Uhrzeit; dann die wichtigen; dann die eigene
 * Reihenfolge der Liste.
 */
function byUrgency(a: TaskRow, b: TaskRow): number {
  const timeA = a.dueTime ?? '';
  const timeB = b.dueTime ?? '';
  if (timeA !== timeB) {
    if (timeA === '') return 1;
    if (timeB === '') return -1;
    return timeA.localeCompare(timeB);
  }
  const priority = priorityOf(b.priority) - priorityOf(a.priority);
  if (priority !== 0) return priority;
  return (a.order ?? 0) - (b.order ?? 0);
}

export function dayTaskGroups(
  tasks: readonly TaskRow[],
  day: string,
  today: string,
): DayTaskGroups {
  const open = tasks.filter((task) => !task.done && !task.parentId);
  const dueOn = (task: TaskRow) => dueDayOf(task);
  const isToday = day === today;
  return {
    // Das Aelteste zuerst: es wartet am laengsten.
    overdue: isToday
      ? open
          .filter((task) => {
            const due = dueOn(task);
            return due !== null && due < today;
          })
          .sort((a, b) => (dueOn(a) ?? '').localeCompare(dueOn(b) ?? '') || byUrgency(a, b))
      : [],
    due: open.filter((task) => dueOn(task) === day).sort(byUrgency),
    inbox: isToday ? open.filter((task) => dueOn(task) === null).sort(byUrgency) : [],
  };
}

/** Wie viele es zusammen sind — der Zaehler im Kopf. */
export function dayTaskCount(groups: DayTaskGroups): number {
  return groups.overdue.length + groups.due.length + groups.inbox.length;
}
