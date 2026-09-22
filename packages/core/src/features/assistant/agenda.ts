import type { AiContextItem } from '../../db/ai';
import type { Language, Translate } from '../../i18n';
import { formatLongDate } from '../../i18n/format';
import { addDays } from '../tasks/days';

/**
 * „Was habe ich morgen?“ ohne KI: aus derselben Liste, die sonst an die KI
 * ginge — Termine, Aufgaben mit Frist und Geburtstage, je Tag eine Zeile,
 * Ganztaegiges zuerst, dann nach Uhrzeit. Rein, getestet.
 */
const AGENDA_KINDS: readonly AiContextItem['kind'][] = ['event', 'task', 'birthday'];

function dayLabel(t: Translate, language: Language, day: string, today: string): string {
  if (day === today) return t('day.today');
  if (day === addDays(today, 1)) return t('day.tomorrow');
  const [year = 1970, month = 1, date = 1] = day.split('-').map(Number);
  // Mittags, damit der Tag in keiner Zeitzone verrutscht.
  return formatLongDate(language, new Date(year, month - 1, date, 12).toISOString());
}

const entryOf = (item: AiContextItem) => (item.time ? `${item.time} ${item.title}` : item.title);
const orderOf = (item: AiContextItem) => `${item.date ?? ''} ${item.time ?? ''}`;

/** Das Programm von `from` bis `to`, je Tag eine Zeile — oder „Da steht nichts an.“ */
export function agendaText(
  t: Translate,
  language: Language,
  items: readonly AiContextItem[],
  range: { from: string; to: string },
  today: string,
): string {
  const inRange = items
    .filter((item) => AGENDA_KINDS.includes(item.kind) && item.date && item.date >= range.from && item.date <= range.to)
    .sort((a, b) => orderOf(a).localeCompare(orderOf(b)));
  if (inRange.length === 0) return t('assistant.agenda.nothing');
  const days = [...new Set(inRange.map((item) => item.date ?? ''))];
  return days
    .map((day) =>
      t('assistant.agenda.line', {
        day: dayLabel(t, language, day, today),
        items: inRange
          .filter((item) => item.date === day)
          .map(entryOf)
          .join(', '),
      }),
    )
    .join('\n');
}

/**
 * „Welchen meinst du?“ — die Termine, aus denen die Person waehlt. `open`: es
 * gibt etwas zu waehlen, die naechste Antwort waehlt daraus.
 */
export function pickText(
  t: Translate,
  language: Language,
  items: readonly AiContextItem[],
  range: { from: string; to: string },
  today: string,
): { text: string; open: boolean } {
  const events = items.filter((item) => item.kind === 'event');
  const found = events.some((item) => item.date && item.date >= range.from && item.date <= range.to);
  if (!found) return { text: t('assistant.pick.none'), open: false };
  return { text: `${agendaText(t, language, events, range, today)}\n${t('assistant.pick.which')}`, open: true };
}

/** „Wann ist der Zahnarzt?“ — der eine Eintrag mit Tag und Uhrzeit. */
export function whenText(t: Translate, language: Language, item: AiContextItem, today: string): string {
  return t('assistant.agenda.line', {
    day: dayLabel(t, language, item.date ?? today, today),
    items: entryOf(item),
  });
}
