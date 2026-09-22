import type { AiContext, AiContextItem } from '../../db/ai';
import { dayKey } from '../../db/pure';

/**
 * Was der Assistent ueber die Daten der Person weiss: eine kurze Liste, die mit
 * jeder Frage mitgeht. Termine tragen die Kennung `T1`, `T2` …, offene Aufgaben
 * `A1`, `A2` … — darueber verschiebt, loescht oder hakt er ab, ohne je eine
 * echte Id zu sehen. `refs` fuehrt die Kennungen zurueck auf die Ids.
 *
 * Rein gerechnet; `useAssistantContext` sammelt die Daten, der Dienst macht
 * daraus den Text fuer das Modell (`services/api/ai/context.js`).
 */
export type ContextRefs = Readonly<Record<string, string>>;

export type ContextInput = {
  now: Date;
  events?: readonly {
    /** Die Gruppe — ein Termin in mehreren Kalendern ist einer. */
    groupId: string;
    title: string;
    startsAt: string;
    endsAt: string | null;
    allDay: boolean;
  }[];
  tasks?: readonly {
    id: string;
    title: string;
    dueAt: string | null;
    dueTime?: string | null;
    priority?: number;
  }[];
  alarms?: readonly { time: string; label: string; days: readonly string[]; enabled: boolean }[];
  birthdays?: readonly { name: string; day: string; age: number | null }[];
  habits?: readonly { name: string; doneToday: boolean }[];
  notes?: readonly { title: string }[];
  shopping?: readonly { name: string; quantity: string | null }[];
  chores?: readonly { title: string }[];
  bills?: readonly { title: string; amount: string; dueDay: string }[];
  facts?: readonly { label: string; value: string }[];
};

/** Mehr braucht keine Frage — und der Text fuer das Modell bleibt kurz. */
export const CONTEXT_LIMITS = {
  events: 30,
  tasks: 30,
  alarms: 10,
  birthdays: 10,
  habits: 10,
  notes: 10,
  shopping: 30,
  chores: 15,
  bills: 10,
  facts: 12,
} as const;

const pad = (value: number) => String(value).padStart(2, '0');
const timeOf = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Nur was da ist — ein Feld ohne Wert geht gar nicht erst mit. */
function item(fields: AiContextItem): AiContextItem {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ) as AiContextItem;
}

export function contextOf(input: ContextInput): { context: AiContext; refs: ContextRefs } {
  const refs: Record<string, string> = {};
  const items: AiContextItem[] = [];

  (input.events ?? []).slice(0, CONTEXT_LIMITS.events).forEach((event, index) => {
    const ref = `T${index + 1}`;
    refs[ref] = event.groupId;
    const start = new Date(event.startsAt);
    items.push(
      item({
        ref,
        kind: 'event',
        title: event.title,
        date: dayKey(start),
        ...(event.allDay
          ? {}
          : {
              time: timeOf(start),
              ...(event.endsAt ? { end: timeOf(new Date(event.endsAt)) } : {}),
            }),
      }),
    );
  });

  (input.tasks ?? []).slice(0, CONTEXT_LIMITS.tasks).forEach((task, index) => {
    const ref = `A${index + 1}`;
    refs[ref] = task.id;
    const priority = Math.max(0, Math.min(3, Math.round(task.priority ?? 0)));
    items.push(
      item({
        ref,
        kind: 'task',
        title: task.title,
        ...(task.dueAt ? { date: dayKey(new Date(task.dueAt)) } : {}),
        ...(task.dueTime && TIME.test(task.dueTime) ? { time: task.dueTime } : {}),
        ...(priority > 0 ? { note: '!'.repeat(priority) } : {}),
      }),
    );
  });

  for (const alarm of (input.alarms ?? []).filter((row) => row.enabled).slice(0, CONTEXT_LIMITS.alarms)) {
    items.push(
      item({
        kind: 'alarm',
        title: alarm.label || alarm.time,
        time: TIME.test(alarm.time) ? alarm.time : undefined,
        note: alarm.days.join(' '),
      }),
    );
  }

  for (const birthday of (input.birthdays ?? []).slice(0, CONTEXT_LIMITS.birthdays)) {
    items.push(
      item({
        kind: 'birthday',
        title: birthday.age === null ? birthday.name : `${birthday.name} (${birthday.age})`,
        date: birthday.day,
      }),
    );
  }

  for (const habit of (input.habits ?? []).slice(0, CONTEXT_LIMITS.habits)) {
    items.push(item({ kind: 'habit', title: habit.name, note: habit.doneToday ? '✓' : undefined }));
  }
  for (const note of (input.notes ?? []).slice(0, CONTEXT_LIMITS.notes)) {
    if (note.title.trim()) items.push(item({ kind: 'note', title: note.title }));
  }
  for (const entry of (input.shopping ?? []).slice(0, CONTEXT_LIMITS.shopping)) {
    items.push(item({ kind: 'shopping', title: entry.quantity ? `${entry.quantity} ${entry.name}` : entry.name }));
  }
  for (const chore of (input.chores ?? []).slice(0, CONTEXT_LIMITS.chores)) {
    items.push(item({ kind: 'chore', title: chore.title }));
  }
  for (const bill of (input.bills ?? []).slice(0, CONTEXT_LIMITS.bills)) {
    items.push(item({ kind: 'bill', title: `${bill.title} ${bill.amount}`, date: bill.dueDay }));
  }

  return {
    context: {
      now: `${dayKey(input.now)}T${timeOf(input.now)}`,
      items,
      facts: (input.facts ?? []).slice(0, CONTEXT_LIMITS.facts),
    },
    refs,
  };
}
