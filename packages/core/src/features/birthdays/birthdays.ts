// Relative Pfade mit Absicht: so laeuft die Datei auch in den Tests unter Node.
import { dayKey } from '../../db/pure';
import { nextBirthday, parseDay } from '../shared/days';

/**
 * Die Rechnung hinter den Geburtstagen, ohne Speicher und ohne Oberflaeche.
 *
 * Geburtstage liegen bei den Kontakten (`ContactRow.birthday`, `YYYY-MM-DD`).
 * Die Funktion „Geburtstage“, die Kontakte und der Kalender lesen dieselbe
 * Zeile — wer irgendwo einen Geburtstag eintraegt, sieht ihn ueberall.
 */

export type BirthdayPerson = { id: string; name: string; birthday: string };

export type UpcomingBirthday = {
  person: BirthdayPerson;
  /** Der naechste Geburtstag als Tag. */
  day: string;
  /** In wie vielen Tagen — heute ist 0. */
  days: number;
  /** So alt wird die Person an diesem Tag. */
  age: number;
};

/** Nur wer ein Geburtsdatum hat. */
export function withBirthday<T extends { id: string; name: string; birthday: string | null }>(
  rows: readonly T[],
): BirthdayPerson[] {
  return rows.flatMap((row) =>
    row.birthday ? [{ id: row.id, name: row.name, birthday: row.birthday }] : [],
  );
}

/** Die naechsten Geburtstage, heute zuerst; `withinDays` 0 heisst nur heute. */
export function upcomingBirthdays(
  people: readonly BirthdayPerson[],
  withinDays: number,
  from: Date = new Date(),
): UpcomingBirthday[] {
  return people
    .map((person) => ({ person, ...nextBirthday(person.birthday, from) }))
    .filter((entry) => entry.days <= withinDays)
    .sort((a, b) => a.days - b.days || a.person.name.localeCompare(b.person.name));
}

export type BirthdayOccurrence = { person: BirthdayPerson; day: string; age: number };

/**
 * Alle Geburtstage, die in `[from, to)` fallen — ueber Jahresgrenzen hinweg.
 * Der Kalender zeigt sie damit jedes Jahr als ganztaegigen Eintrag, ohne dass
 * je ein Termin angelegt wird. Wer am 29. Februar geboren ist, feiert in den
 * anderen Jahren am 1. Maerz, wie beim naechsten Geburtstag auch.
 */
export function birthdaysBetween(
  people: readonly BirthdayPerson[],
  from: Date,
  to: Date,
): BirthdayOccurrence[] {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const occurrences: BirthdayOccurrence[] = [];

  for (const person of people) {
    const born = parseDay(person.birthday);
    for (let year = start.getFullYear(); year <= to.getFullYear(); year += 1) {
      if (year < born.getFullYear()) continue;
      const date = new Date(year, born.getMonth(), born.getDate());
      if (date.getTime() < start.getTime() || date.getTime() >= to.getTime()) continue;
      occurrences.push({ person, day: dayKey(date), age: year - born.getFullYear() });
    }
  }

  return occurrences.sort((a, b) => a.day.localeCompare(b.day));
}

/** So viele Tage hat ein Monat; `month` von 1 bis 12. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Tag, Monat und Jahr als `YYYY-MM-DD` — der Tag rutscht nie in den naechsten Monat. */
export function birthdayKey(year: number, month: number, day: number): string {
  const safeDay = Math.min(day, daysInMonth(year, month));
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

/**
 * Geburtstage stehen im Kalender als gedachte Termine. Ihre Id verraet, zu
 * welchem Kontakt sie gehoeren, damit ein Tipp den richtigen Eintrag oeffnet.
 */
const EVENT_PREFIX = 'birthday:';

export function birthdayEventId(personId: string, day: string): string {
  return `${EVENT_PREFIX}${personId}:${day}`;
}

/** Die Kontakt-Id hinter einem gedachten Geburtstagstermin — oder null. */
export function personOfBirthdayEvent(eventId: string): string | null {
  if (!eventId.startsWith(EVENT_PREFIX)) return null;
  const rest = eventId.slice(EVENT_PREFIX.length);
  const cut = rest.lastIndexOf(':');
  return cut > 0 ? rest.slice(0, cut) : null;
}
