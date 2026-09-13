import type { BirthdayReminders } from '@/db';
import { parseDay } from '@/features/shared/days';
import { localeFor, type Language, type Translate } from '@/i18n';

import { UNKNOWN_BIRTH_YEAR, type UpcomingBirthday } from './birthdays';

/**
 * Wie ein Geburtstag in Worten dasteht — Datum ueber `Intl`, Saetze ueber
 * `t()`. Ohne bekanntes Jahr steht nie ein Alter da.
 */

type Upcoming = Pick<UpcomingBirthday, 'day' | 'days' | 'age'>;

function formatDay(language: Language, day: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(localeFor(language), options).format(parseDay(day));
}

/** „Sa., 20. Sept.“ — in den Zeilen von „Diese Woche“. */
export function formatRowDate(language: Language, day: string): string {
  return formatDay(language, day, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** „20. Okt.“ — in den ruhigen Zeilen. */
export function formatShortDayMonth(language: Language, day: string): string {
  return formatDay(language, day, { day: 'numeric', month: 'short' });
}

/** „20. September“ — ohne Jahr, etwa im Vorschlag beim Anlegen. */
export function formatDayMonthLong(language: Language, day: string): string {
  return formatDay(language, day, { day: 'numeric', month: 'long' });
}

/** „Samstag, 20. September“ — auf der Personenseite und in der Vorschau. */
export function formatLongDay(language: Language, day: string): string {
  return formatDay(language, day, { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Der Monat auf dem Rad: „September“. */
export function monthName(language: Language, month: number): string {
  return new Intl.DateTimeFormat(localeFor(language), { month: 'long' }).format(
    new Date(UNKNOWN_BIRTH_YEAR, month - 1, 1),
  );
}

/** „wird 36 · Sa., 20. Sept.“ */
export function weekLine(t: Translate, language: Language, entry: Upcoming): string {
  const date = formatRowDate(language, entry.day);
  return entry.age !== null ? t('birthdays.turnsOnShort', { age: entry.age, date }) : date;
}

/** „20. Okt. · wird 41“ */
export function compactLine(t: Translate, language: Language, entry: Upcoming): string {
  const date = formatShortDayMonth(language, entry.day);
  return entry.age !== null ? t('birthdays.dateTurns', { date, age: entry.age }) : date;
}

/** „wird heute 36“ */
export function todayLine(t: Translate, entry: Upcoming): string {
  return entry.age !== null
    ? t('birthdays.turnsToday', { age: entry.age })
    : t('birthdays.hasToday');
}

/** „wird 36 am Samstag, 20. September“ — am Tag selbst „wird heute 36“. */
export function nextLine(t: Translate, language: Language, entry: Upcoming): string {
  if (entry.days === 0) return todayLine(t, entry);
  const date = formatLongDay(language, entry.day);
  return entry.age !== null
    ? t('birthdays.turnsOn', { age: entry.age, date })
    : t('birthdays.birthdayOn', { date });
}

/** „1 Woche vorher · Am Tag“ */
export function reminderSummary(t: Translate, reminders: BirthdayReminders): string {
  const week = t('birthdays.reminders.weekBefore');
  const day = t('birthdays.reminders.dayOf');
  if (reminders.weekBefore && reminders.dayOf) {
    return t('birthdays.pair', { first: week, second: day });
  }
  if (reminders.weekBefore) return week;
  if (reminders.dayOf) return day;
  return t('birthdays.reminders.off');
}
