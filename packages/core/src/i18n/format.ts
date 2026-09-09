import type { Language } from './index';

/** Schweizer Formate ueber Intl. Keine handgeschriebenen Datums- oder Zahlenformate. */
const LOCALE: Record<Language, string> = {
  de: 'de-CH',
  fr: 'fr-CH',
  it: 'it-CH',
  en: 'en-CH',
};

export function localeFor(language: Language): string {
  return LOCALE[language];
}

export function formatTime(language: Language, iso: string): string {
  return new Intl.DateTimeFormat(localeFor(language), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatWeekday(language: Language, iso: string): string {
  return new Intl.DateTimeFormat(localeFor(language), { weekday: 'short' }).format(new Date(iso));
}

export function formatLongDate(language: Language, iso: string): string {
  return new Intl.DateTimeFormat(localeFor(language), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso));
}

export function formatShortDate(language: Language, iso: string): string {
  return new Intl.DateTimeFormat(localeFor(language), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatNumber(language: Language, value: number): string {
  return new Intl.NumberFormat(localeFor(language)).format(value);
}

export function formatMoney(language: Language, value: number, currency = 'CHF'): string {
  return new Intl.NumberFormat(localeFor(language), {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Verbindet eine Liste sprachrichtig: "a, b und c". */
export function formatList(language: Language, items: readonly string[]): string {
  if (items.length === 0) return '';
  const formatter = new Intl.ListFormat(localeFor(language), {
    style: 'long',
    type: 'conjunction',
  });
  return formatter.format([...items]);
}
