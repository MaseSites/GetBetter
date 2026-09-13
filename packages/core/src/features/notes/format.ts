import { formatMonthName, localeFor, type Language, type Translate } from '@/i18n';

import { rowStampOf, type NoteGroup } from './grouping';

/** Die Zeit in einer Zeile: „09:14“, „Gestern“, „Di“ oder „3.9.25“. */
export function formatRowStamp(t: Translate, language: Language, iso: string, now: Date): string {
  const date = new Date(iso);
  const locale = localeFor(language);
  switch (rowStampOf(iso, now)) {
    case 'time':
      return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
    case 'yesterday':
      return t('notes.stamp.yesterday');
    case 'weekday':
      return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);
    default:
      return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'numeric',
        year: '2-digit',
      }).format(date);
  }
}

/** Ueber dem Titel im Editor: „13. September 2026, 09:14“. */
export function formatEditorDate(language: Language, iso: string): string {
  return new Intl.DateTimeFormat(localeFor(language), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** Titel eines Abschnitts; der ungegliederte Rest hat keinen. */
export function sectionLabel(t: Translate, language: Language, group: NoteGroup): string | null {
  switch (group.kind) {
    case 'pinned':
      return t('notes.pinned');
    case 'today':
      return t('notes.section.today');
    case 'week':
      return t('notes.section.week');
    case 'month':
      return formatMonthName(language, new Date(group.year, group.month, 1));
    case 'year':
      return String(group.year);
    default:
      return null;
  }
}
