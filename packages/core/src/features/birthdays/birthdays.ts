// Relative Pfade mit Absicht: so laeuft die Datei auch in den Tests unter Node.
import { dayKey } from '../../db/pure';
import type { BirthdayReminders } from '../../db/types';
import { nextBirthday, parseDay } from '../shared/days';

/**
 * Die Rechnung hinter den Geburtstagen, ohne Speicher und ohne Oberflaeche.
 *
 * Geburtstage liegen bei den Kontakten (`ContactRow.birthday`, `YYYY-MM-DD`).
 * Die Funktion „Geburtstage“, die Kontakte und der Kalender lesen dieselbe
 * Zeile — wer irgendwo einen Geburtstag eintraegt, sieht ihn ueberall.
 *
 * Ist das Jahr unbekannt (`birthYearKnown: false`), steht in `birthday` das
 * Jahr `UNKNOWN_BIRTH_YEAR`. Es ist ein Schaltjahr, damit der 29. Februar
 * gespeichert werden kann; ein Alter gibt es dann nicht.
 */

export type BirthdayPerson = {
  id: string;
  name: string;
  birthday: string;
  /** Ob das Jahr stimmt — sonst gibt es kein Alter. */
  yearKnown: boolean;
};

export type UpcomingBirthday = {
  person: BirthdayPerson;
  /** Der naechste Geburtstag als Tag. */
  day: string;
  /** In wie vielen Tagen — heute ist 0. */
  days: number;
  /** So alt wird die Person an diesem Tag; null ohne bekanntes Jahr. */
  age: number | null;
};

/** Platzhalter-Jahr ohne bekanntes Geburtsjahr; ein Schaltjahr fuer den 29. Februar. */
export const UNKNOWN_BIRTH_YEAR = 2000;

/** Ab so vielen Personen steht oben ein Suchfeld. */
export const SEARCH_MIN_PEOPLE = 15;

/** „Diese Woche“: morgen bis in sieben Tagen. */
export const WEEK_DAYS = 7;

/** So viele Kontakte schlaegt das Blatt beim Tippen des Namens vor. */
export const SUGGESTION_LIMIT = 3;

/** Die Voreinstellung: eine Woche vorher und am Tag. */
export const DEFAULT_REMINDERS: BirthdayReminders = { weekBefore: true, dayOf: true };

/** Wie nah der Geburtstag sein muss, damit eine verschenkte Idee zu ihm zaehlt. */
const GIFT_LOOKAHEAD_DAYS = 60;

type BirthdayRowLike = {
  id: string;
  name: string;
  birthday: string | null;
  birthYearKnown?: boolean;
};

/** Nur wer ein Geburtsdatum hat. Fehlt `birthYearKnown`, gilt das Jahr als bekannt. */
export function withBirthday<T extends BirthdayRowLike>(rows: readonly T[]): BirthdayPerson[] {
  return rows.flatMap((row) =>
    row.birthday
      ? [
          {
            id: row.id,
            name: row.name,
            birthday: row.birthday,
            yearKnown: row.birthYearKnown !== false,
          },
        ]
      : [],
  );
}

/** Das Alter am naechsten Geburtstag — null ohne Jahr oder vor der Geburt. */
function ageOrNull(yearKnown: boolean, age: number): number | null {
  return yearKnown && age > 0 ? age : null;
}

/**
 * Die naechsten Geburtstage, heute zuerst, bei gleichem Tag alphabetisch —
 * ueber den Jahreswechsel hinweg. `withinDays` 0 heisst nur heute; ohne
 * Angabe alle. Am 29. Februar Geborene feiern in anderen Jahren am 1. Maerz.
 */
export function upcomingBirthdays(
  people: readonly BirthdayPerson[],
  withinDays: number = Number.POSITIVE_INFINITY,
  from: Date = new Date(),
): UpcomingBirthday[] {
  return people
    .map((person) => {
      const next = nextBirthday(person.birthday, from);
      return {
        person,
        day: next.day,
        days: next.days,
        age: ageOrNull(person.yearKnown, next.age),
      };
    })
    .filter((entry) => entry.days <= withinDays)
    .sort((a, b) => a.days - b.days || a.person.name.localeCompare(b.person.name));
}

export type BirthdaySections = {
  /** Wer heute feiert — nur in der Karte oben, nicht noch einmal in der Liste. */
  today: UpcomingBirthday[];
  /** Morgen bis in sieben Tagen. */
  week: UpcomingBirthday[];
  /** Der Rest des laufenden Monats. */
  month: UpcomingBirthday[];
  /** Alles danach. */
  later: UpcomingBirthday[];
};

/** Je naeher, desto weiter oben: heute, diese Woche, dieser Monat, spaeter. */
export function birthdaySections(
  entries: readonly UpcomingBirthday[],
  from: Date = new Date(),
): BirthdaySections {
  const sections: BirthdaySections = { today: [], week: [], month: [], later: [] };
  for (const entry of entries) {
    const date = parseDay(entry.day);
    const sameMonth =
      date.getFullYear() === from.getFullYear() && date.getMonth() === from.getMonth();
    if (entry.days <= 0) sections.today.push(entry);
    else if (entry.days <= WEEK_DAYS) sections.week.push(entry);
    else if (sameMonth) sections.month.push(entry);
    else sections.later.push(entry);
  }
  return sections;
}

/** Kleinbuchstaben ohne Akzente — „Zoé“ findet man auch mit „zoe“. */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Passt der Name zur Suche? Eine leere Suche passt immer. */
export function matchesQuery(name: string, query: string): boolean {
  const needle = fold(query);
  return needle.length === 0 || fold(name).includes(needle);
}

/**
 * Kontakte, die zum getippten Namen passen: erst die, bei denen ein Wort so
 * beginnt, dann die, die es irgendwo enthalten.
 */
export function suggestContacts<T extends { id: string; name: string }>(
  rows: readonly T[],
  query: string,
  limit: number = SUGGESTION_LIMIT,
): T[] {
  const needle = fold(query);
  if (needle.length === 0) return [];
  const startsWord = (row: T) =>
    fold(row.name)
      .split(/\s+/)
      .some((word) => word.startsWith(needle));
  const matching = rows.filter((row) => fold(row.name).includes(needle));
  const ranked = [
    ...matching.filter(startsWord).sort((a, b) => a.name.localeCompare(b.name)),
    ...matching.filter((row) => !startsWord(row)).sort((a, b) => a.name.localeCompare(b.name)),
  ];
  return ranked.slice(0, limit);
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

/** Der gespeicherte Tag aus den Raedern; ohne Jahr mit dem Platzhalter-Jahr. */
export function draftBirthdayKey(month: number, day: number, year: number | null): string {
  return birthdayKey(year ?? UNKNOWN_BIRTH_YEAR, month, day);
}

/** Wie viele Tage das Tagesrad zeigt — ohne Jahr hat der Februar 29. */
export function dayCountOf(month: number, year: number | null): number {
  return daysInMonth(year ?? UNKNOWN_BIRTH_YEAR, month);
}

/** Was die Vorschau sagt: der naechste Geburtstag und das Alter dann. */
export function previewOf(
  month: number,
  day: number,
  year: number | null,
  from: Date = new Date(),
): { day: string; days: number; age: number | null } {
  const next = nextBirthday(draftBirthdayKey(month, day, year), from);
  return { day: next.day, days: next.days, age: ageOrNull(year !== null, next.age) };
}

/** Die Erinnerungen einer Person: fehlt die Angabe, gilt die Voreinstellung. */
export function remindersOf(row: {
  birthdayReminders?: BirthdayReminders | null;
}): BirthdayReminders {
  if (row.birthdayReminders === undefined) return DEFAULT_REMINDERS;
  return row.birthdayReminders ?? { weekBefore: false, dayOf: false };
}

/**
 * Fuer welches Jahr eine Geschenkidee verschenkt wird: steht der Geburtstag
 * in den naechsten 60 Tagen an, fuer diesen; sonst fuer den letzten.
 */
export function giftYearFor(birthday: string, from: Date = new Date()): number {
  const next = nextBirthday(birthday, from);
  const year = parseDay(next.day).getFullYear();
  return next.days <= GIFT_LOOKAHEAD_DAYS ? year : year - 1;
}

export type BirthdayOccurrence = {
  person: BirthdayPerson;
  day: string;
  /** Nur sinnvoll mit `person.yearKnown`. */
  age: number;
};

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
      // Ohne bekanntes Jahr gibt es kein „vor der Geburt“.
      if (person.yearKnown && year < born.getFullYear()) continue;
      const date = new Date(year, born.getMonth(), born.getDate());
      if (date.getTime() < start.getTime() || date.getTime() >= to.getTime()) continue;
      occurrences.push({ person, day: dayKey(date), age: year - born.getFullYear() });
    }
  }

  return occurrences.sort((a, b) => a.day.localeCompare(b.day));
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
