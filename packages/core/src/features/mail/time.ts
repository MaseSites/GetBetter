// Relative Pfade mit Absicht: so laeuft die Datei auch in den Tests unter Node.
import type { Language } from '../../i18n';
import { formatTime, formatWeekday, localeFor } from '../../i18n/format';
import { listDateKind } from './format';

/**
 * Die Zeit rechts in einer Zeile: heute „09:14“, dann „Gestern“, die Woche
 * ueber der Wochentag („Di“), sonst „12.9.“ — aus einem anderen Jahr mit Jahr.
 */
export function listTime(language: Language, iso: string, yesterday: string, now = new Date()) {
  switch (listDateKind(iso, now)) {
    case 'time':
      return formatTime(language, iso);
    case 'yesterday':
      return yesterday;
    case 'weekday':
      return formatWeekday(language, iso).replace(/\.$/, '');
    case 'date': {
      const date = new Date(iso);
      const otherYear = date.getFullYear() !== now.getFullYear();
      return new Intl.DateTimeFormat(localeFor(language), {
        day: 'numeric',
        month: 'numeric',
        ...(otherYear ? { year: '2-digit' as const } : {}),
      }).format(date);
    }
    case 'none':
      return '';
  }
}
