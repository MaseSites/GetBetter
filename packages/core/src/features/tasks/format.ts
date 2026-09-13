// Relative Pfade mit Absicht: so laeuft die Datei auch in den Tests unter Node.
import type { Language } from '../../i18n';
import { formatMonth, localeFor } from '../../i18n/format';

import { dateOfKey } from './days';

/**
 * „Fr 19. Sep“ — Wochentag, Tag und Monat kurz, ohne die Punkte und Kommas,
 * die Intl je nach Sprache dazwischen setzt.
 */
export function formatTaskDay(language: Language, day: string): string {
  const parts = new Intl.DateTimeFormat(localeFor(language), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).formatToParts(dateOfKey(day));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    (parts.find((entry) => entry.type === type)?.value ?? '').replace(/[.,]/gu, '');
  if (language === 'de') {
    return `${part('weekday')} ${part('day')}. ${part('month').slice(0, 3)}`;
  }
  return `${part('weekday')} ${part('day')} ${part('month')}`;
}

/** „Oktober 2026“ — der Kopf einer Monatsgruppe in Geplant. */
export function formatMonthOf(language: Language, day: string): string {
  return formatMonth(language, dateOfKey(day));
}
