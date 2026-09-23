import { parseDay, shiftDay } from '../shared/days';

/**
 * Die naechsten sieben Tage als eine Liste — rein gerechnet, getestet in
 * `weekAgenda.test.ts`. Die Uebersicht zeichnet daraus den Wochenstreifen und
 * die Liste darunter.
 */

export const WEEK_DAYS = 7;

export type AgendaItem = {
  key: string;
  kind: 'event' | 'birthday' | 'task';
  title: string;
  /** Die Farbe des Balkens links — die des Termins oder der Funktion. */
  color: string;
  /** ISO-Zeitpunkt bei Terminen mit Uhrzeit, sonst null (ganztaegig, Geburtstag, Aufgabe ohne Zeit). */
  at: string | null;
  /** „14:30“ bei Aufgaben mit Uhrzeit — die stehen nicht als ISO da. */
  time: string | null;
  onPress?: () => void;
};

export type AgendaDay = {
  day: string;
  items: AgendaItem[];
};

/** Die sieben Tage ab heute, als Schluessel. */
export function weekDays(today: string): string[] {
  return Array.from({ length: WEEK_DAYS }, (_, index) => shiftDay(index, parseDay(today)));
}

/** Woran ein Eintrag haengt: Termine an ihrem Beginn, alles andere an seinem Tag. */
function sortKey(item: AgendaItem): string {
  if (item.at) {
    const when = new Date(item.at);
    const clock = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
    return `1${clock}`;
  }
  if (item.time) return `1${item.time}`;
  // Ganztaegiges und Geburtstage zuerst, Aufgaben ohne Zeit zuletzt.
  return item.kind === 'task' ? '2' : '0';
}

/**
 * Die Eintraege der Woche nach Tag, sortiert: Ganztaegiges und Geburtstage
 * zuerst, dann nach Uhrzeit, Aufgaben ohne Zeit am Ende. Tage ohne Eintrag
 * fehlen — die Liste zeigt nur, was es gibt.
 */
export function weekAgenda(
  today: string,
  items: readonly (AgendaItem & { day: string })[],
): AgendaDay[] {
  return weekDays(today).flatMap((day) => {
    const rows = items
      .filter((item) => item.day === day)
      .sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || a.title.localeCompare(b.title));
    return rows.length > 0 ? [{ day, items: rows }] : [];
  });
}

/** Die Punkte unter einem Tag im Streifen — die Farben der Eintraege, hoechstens `limit`. */
export function dayDots(days: readonly AgendaDay[], day: string, limit: number): string[] {
  const found = days.find((entry) => entry.day === day);
  return (found?.items ?? []).slice(0, limit).map((item) => item.color);
}
