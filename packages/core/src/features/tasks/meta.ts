// Relative Pfade mit Absicht: so laeuft die Datei auch in den Tests unter Node.
import { dueDayOf } from '../../db/taskFields';
import type { TaskRow } from '../../db/types';

import type { Progress } from './lists';

/**
 * Die Metazeile unter dem Titel, in fester Reihenfolge: Zeit oder Datum ·
 * Wiederholung · Erinnerung · Anhang oder Notiz · Teilaufgaben · Projekt ·
 * hoechstens zwei Tags. Es erscheint nur, was da ist.
 */

export type MetaPart =
  | { kind: 'time'; time: string }
  | { kind: 'date'; day: string; time: string | null; overdue: boolean }
  | { kind: 'repeat' }
  | { kind: 'reminder' }
  | { kind: 'attachment' }
  | { kind: 'note' }
  | { kind: 'subtasks'; done: number; total: number }
  | { kind: 'project'; name: string }
  | { kind: 'tag'; tag: string };

export type MetaOptions = {
  today: string;
  /**
   * `timeOnly`: in Heute und unter einem Tageskopf in Geplant steht der Tag schon
   * darueber. `full`: sonst das Datum. Ueberfaelliges zeigt immer sein Datum.
   */
  dateMode: 'timeOnly' | 'full';
  progress?: Progress;
  /** Projekt- oder Haushaltsname; nur mit `showGroup` sichtbar. */
  groupName?: string | null;
  showGroup: boolean;
};

export const MAX_ROW_TAGS = 2;

export function metaPartsOf(task: TaskRow, options: MetaOptions): MetaPart[] {
  const day = dueDayOf(task);
  const time = day !== null && task.dueTime ? task.dueTime : null;
  const overdue = !task.done && day !== null && day < options.today;

  const when: MetaPart[] =
    day === null
      ? []
      : overdue || options.dateMode === 'full'
        ? [{ kind: 'date', day, time, overdue }]
        : time
          ? [{ kind: 'time', time }]
          : [];
  const repeat: MetaPart[] = task.repeat ? [{ kind: 'repeat' }] : [];
  // Ohne Uhrzeit gibt es keine Erinnerung.
  const reminder: MetaPart[] =
    time !== null && typeof task.reminderOffsetMinutes === 'number' ? [{ kind: 'reminder' }] : [];
  const extra: MetaPart[] =
    (task.attachmentIds?.length ?? 0) > 0
      ? [{ kind: 'attachment' }]
      : task.notes
        ? [{ kind: 'note' }]
        : [];
  const progress = options.progress;
  const subtasks: MetaPart[] =
    progress && progress.total > 0
      ? [{ kind: 'subtasks', done: progress.done, total: progress.total }]
      : [];
  const group: MetaPart[] =
    options.showGroup && options.groupName ? [{ kind: 'project', name: options.groupName }] : [];
  const tags: MetaPart[] = (task.tags ?? [])
    .slice(0, MAX_ROW_TAGS)
    .map((tag) => ({ kind: 'tag', tag }));

  return [...when, ...repeat, ...reminder, ...extra, ...subtasks, ...group, ...tags];
}
