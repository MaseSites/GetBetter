import type { TaskPriority, TaskRepeat, TaskRepeatUnit } from '@/db';
import {
  formatList,
  formatWeekday,
  formatWeekdayLong,
  type Language,
  type Translate,
  type TranslationKey,
} from '@/i18n';
import type { IconName } from '@/ui';

import { addDays, dateOfKey } from './days';
import { formatTaskDay } from './format';
import type { MetaPart } from './meta';
import type { PostponeKind } from './postpone';
import { weekdaysOf } from './recurrence';
import { dayBeforeOffset, type SchedulePreset } from './schedule';

/** Die Zeichen vor dem Titel — Satzzeichen, keine Woerter. */
export const PRIORITY_MARKS = ['', '!', '!!', '!!!'] as const;

const PRIORITY_NAMES: Record<TaskPriority, TranslationKey> = {
  0: 'tasks.priority.none',
  1: 'tasks.priority.low',
  2: 'tasks.priority.medium',
  3: 'tasks.priority.high',
};

const PRIORITY_CHIPS: Record<TaskPriority, TranslationKey> = {
  0: 'tasks.priority.none',
  1: 'tasks.priority.chip.low',
  2: 'tasks.priority.chip.medium',
  3: 'tasks.priority.chip.high',
};

export function priorityName(t: Translate, priority: TaskPriority): string {
  return t(PRIORITY_NAMES[priority]);
}

/** „Priorität hoch“ — als Chip und fuer die Bedienungshilfe. */
export function priorityPhrase(t: Translate, priority: TaskPriority): string {
  return t(PRIORITY_CHIPS[priority]);
}

/** Ein Montag, von dem aus die Wochentagsnamen gebildet werden. */
const REFERENCE_MONDAY = '2024-01-01';

export function weekdayName(language: Language, weekday: number, long: boolean): string {
  const date = dateOfKey(addDays(REFERENCE_MONDAY, weekday - 1));
  return long
    ? formatWeekdayLong(language, date)
    : formatWeekday(language, date.toISOString()).replace(/\.$/u, '');
}

const REPEAT_SINGLE: Record<TaskRepeatUnit, TranslationKey> = {
  day: 'tasks.repeat.daily',
  week: 'tasks.repeat.weekly',
  month: 'tasks.repeat.monthly',
  year: 'tasks.repeat.yearly',
};

const REPEAT_MULTI: Record<TaskRepeatUnit, TranslationKey> = {
  day: 'tasks.repeat.everyDays',
  week: 'tasks.repeat.everyWeeks',
  month: 'tasks.repeat.everyMonths',
  year: 'tasks.repeat.everyYears',
};

export function repeatLabel(t: Translate, language: Language, repeat: TaskRepeat): string {
  const count = Math.max(1, Math.round(repeat.every)) || 1;
  const days = weekdaysOf(repeat);
  if (repeat.unit === 'week' && days.length > 0) {
    const names = formatList(
      language,
      days.map((day) => weekdayName(language, day, true)),
    );
    return count === 1
      ? t('tasks.repeat.weeklyOn', { days: names })
      : t('tasks.repeat.everyWeeksOn', { count, days: names });
  }
  return count === 1 ? t(REPEAT_SINGLE[repeat.unit]) : t(REPEAT_MULTI[repeat.unit], { count });
}

export function reminderLabel(
  t: Translate,
  minutes: number | null | undefined,
  time: string | null,
): string {
  if (time === null) return t('tasks.reminder.needsTime');
  if (minutes === null || minutes === undefined) return t('tasks.reminder.none');
  if (minutes === 0) return t('tasks.reminder.atDue');
  if (minutes === dayBeforeOffset(time)) return t('tasks.reminder.dayBefore');
  return t('tasks.reminder.before', { count: minutes });
}

/** Heute, Morgen, Gestern — sonst „Fr 19. Sep“. */
export function dayLabel(t: Translate, language: Language, day: string, today: string): string {
  if (day === today) return t('day.today');
  if (day === addDays(today, 1)) return t('day.tomorrow');
  if (day === addDays(today, -1)) return t('day.yesterday');
  return formatTaskDay(language, day);
}

const PRESET_LABELS: Record<SchedulePreset, TranslationKey> = {
  tonight: 'tasks.plan.tonight',
  tomorrow: 'tasks.plan.tomorrow',
  weekend: 'tasks.plan.weekend',
  nextWeek: 'tasks.plan.nextWeek',
  none: 'tasks.plan.none',
};

export const PRESET_ICONS: Record<SchedulePreset, IconName> = {
  tonight: 'sleep',
  tomorrow: 'sun',
  weekend: 'home',
  nextWeek: 'calendar',
  none: 'close',
};

export function presetLabel(t: Translate, preset: SchedulePreset): string {
  return t(PRESET_LABELS[preset]);
}

const POSTPONE_LABELS: Record<PostponeKind, TranslationKey> = {
  today: 'tasks.postpone.today',
  tomorrow: 'tasks.postpone.tomorrow',
  nextWeek: 'tasks.postpone.nextWeek',
};

/** Wie im Menue „Planen“: Morgen die Sonne, Nächste Woche der Kalender. */
export const POSTPONE_ICONS: Record<PostponeKind, IconName> = {
  today: 'alarm',
  tomorrow: PRESET_ICONS.tomorrow,
  nextWeek: PRESET_ICONS.nextWeek,
};

export function postponeLabel(t: Translate, kind: PostponeKind): string {
  return t(POSTPONE_LABELS[kind]);
}

/** Der sichtbare Text eines Teils der Metazeile; Symbole haben keinen. */
export function metaText(
  t: Translate,
  language: Language,
  today: string,
  part: MetaPart,
): string | null {
  switch (part.kind) {
    case 'time':
      return part.time;
    case 'date': {
      const day = dayLabel(t, language, part.day, today);
      return part.time ? `${day} ${part.time}` : day;
    }
    case 'subtasks':
      return `${part.done}/${part.total}`;
    case 'project':
      return part.name;
    case 'tag':
      return `#${part.tag}`;
    default:
      return null;
  }
}

/** Die Metazeile als Satz fuer die Bedienungshilfe. */
export function metaA11y(
  t: Translate,
  language: Language,
  today: string,
  parts: readonly MetaPart[],
): string {
  return parts
    .map((part) => {
      switch (part.kind) {
        case 'time':
          return t('tasks.a11y.at', { time: part.time });
        case 'date': {
          const text = metaText(t, language, today, part) ?? '';
          return part.overdue ? t('tasks.a11y.overdue', { date: text }) : text;
        }
        case 'repeat':
          return t('tasks.a11y.repeat');
        case 'reminder':
          return t('tasks.a11y.reminder');
        case 'attachment':
          return t('tasks.a11y.attachment');
        case 'note':
          return t('tasks.a11y.note');
        case 'subtasks':
          return t('tasks.a11y.subtasks', { done: part.done, total: part.total });
        default:
          return metaText(t, language, today, part) ?? '';
      }
    })
    .filter((text) => text.length > 0)
    .join(', ');
}
