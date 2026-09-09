import { dayKey } from '@/db';
import { formatShortDate, type Language, type TranslationKey } from '@/i18n';

const DAY_MS = 86_400_000;

/** Nah genug, um es in Tagen zu sagen; weiter weg steht das Datum. */
const NEAR_DAYS = 14;

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** `YYYY-MM-DD` → lokales Datum um Mitternacht. */
export function parseDay(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

/** Tage von heute bis zu diesem Tag — negativ, wenn er vorbei ist. */
export function daysUntil(key: string, from: Date = new Date()): number {
  const today = new Date(from);
  today.setHours(0, 0, 0, 0);
  return Math.round((parseDay(key).getTime() - today.getTime()) / DAY_MS);
}

/** Der Tag in `days` Tagen als Schluessel. */
export function shiftDay(days: number, from: Date = new Date()): string {
  const result = new Date(from);
  result.setDate(result.getDate() + days);
  return dayKey(result);
}

/** "Heute", "Morgen", "In 5 Tagen", "Vor 3 Tagen" — sonst das Datum. */
export function relativeDay(t: Translate, language: Language, key: string): string {
  const diff = daysUntil(key);
  if (diff === 0) return t('day.today');
  if (diff === 1) return t('day.tomorrow');
  if (diff === -1) return t('day.yesterday');
  if (diff > 1 && diff <= NEAR_DAYS) return t('day.in', { days: diff });
  if (diff < -1 && diff >= -NEAR_DAYS) return t('day.ago', { days: -diff });
  return formatShortDate(language, parseDay(key).toISOString());
}

/** Wann ein Geburtstag das naechste Mal ist und wie alt die Person dann wird. */
export function nextBirthday(
  birthday: string,
  from: Date = new Date(),
): { day: string; days: number; age: number } {
  const born = parseDay(birthday);
  const today = new Date(from);
  today.setHours(0, 0, 0, 0);
  let next = new Date(today.getFullYear(), born.getMonth(), born.getDate());
  if (next.getTime() < today.getTime()) {
    next = new Date(today.getFullYear() + 1, born.getMonth(), born.getDate());
  }
  const day = dayKey(next);
  return { day, days: daysUntil(day, from), age: next.getFullYear() - born.getFullYear() };
}
