import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  birthdayEventId,
  birthdayKey,
  birthdaySections,
  birthdaysBetween,
  dayCountOf,
  daysInMonth,
  DEFAULT_REMINDERS,
  draftBirthdayKey,
  giftYearFor,
  matchesQuery,
  personOfBirthdayEvent,
  previewOf,
  remindersOf,
  suggestContacts,
  UNKNOWN_BIRTH_YEAR,
  upcomingBirthdays,
  withBirthday,
  type BirthdayPerson,
} from './birthdays';

const from = new Date(2026, 8, 9, 15, 30); // Mittwoch, 9. September 2026, nachmittags

const person = (id: string, name: string, birthday: string, yearKnown = true): BirthdayPerson => ({
  id,
  name,
  birthday,
  yearKnown,
});

const anna = person('ct_anna', 'Anna', '1990-09-09');
const ben = person('ct_ben', 'Ben', '1985-09-14');
const clara = person('ct_clara', 'Clara', '2000-01-02');
const leap = person('ct_leap', 'Lea', '2004-02-29');

test('nimmt nur Kontakte mit Geburtsdatum; fehlt die Angabe, gilt das Jahr als bekannt', () => {
  const rows = [
    { id: 'a', name: 'Mit', birthday: '1990-01-01' },
    { id: 'b', name: 'Ohne', birthday: null },
    { id: 'c', name: 'Ohne Jahr', birthday: '2000-05-04', birthYearKnown: false },
  ];
  assert.deepEqual(withBirthday(rows), [
    { id: 'a', name: 'Mit', birthday: '1990-01-01', yearKnown: true },
    { id: 'c', name: 'Ohne Jahr', birthday: '2000-05-04', yearKnown: false },
  ]);
});

test('sortiert die naechsten Geburtstage, heute zuerst', () => {
  const week = upcomingBirthdays([ben, clara, anna], 7, from);
  assert.deepEqual(
    week.map((entry) => [entry.person.name, entry.days, entry.age]),
    [
      ['Anna', 0, 36],
      ['Ben', 5, 41],
    ],
  );
});

test('null Tage heisst nur heute', () => {
  assert.deepEqual(
    upcomingBirthdays([anna, ben], 0, from).map((entry) => entry.person.name),
    ['Anna'],
  );
});

test('ohne Grenze kommen alle, ueber den Jahreswechsel hinweg', () => {
  assert.deepEqual(
    upcomingBirthdays([clara, ben, anna], undefined, from).map((entry) => entry.person.name),
    ['Anna', 'Ben', 'Clara'],
  );
});

test('am gleichen Tag alphabetisch', () => {
  const zoe = person('ct_zoe', 'Zoé', '1991-09-14');
  const adam = person('ct_adam', 'Adam', '1970-09-14');
  assert.deepEqual(
    upcomingBirthdays([zoe, ben, adam], undefined, from).map((entry) => entry.person.name),
    ['Adam', 'Ben', 'Zoé'],
  );
});

test('ohne Jahr gibt es kein Alter', () => {
  const unknown = person('ct_x', 'Xenia', `${UNKNOWN_BIRTH_YEAR}-09-20`, false);
  const [entry] = upcomingBirthdays([unknown], undefined, from);
  assert.equal(entry?.age, null);
  assert.equal(entry?.days, 11);
});

test('vor der Geburt gibt es kein Alter', () => {
  const baby = person('ct_baby', 'Baby', '2026-12-01');
  assert.equal(upcomingBirthdays([baby], undefined, from)[0]?.age, null);
});

test('29. Februar: in anderen Jahren am 1. Maerz, im Schaltjahr am 29.', () => {
  const [inCommonYear] = upcomingBirthdays([leap], undefined, new Date(2027, 1, 28));
  assert.deepEqual([inCommonYear?.day, inCommonYear?.days], ['2027-03-01', 1]);
  const [inLeapYear] = upcomingBirthdays([leap], undefined, new Date(2028, 1, 1));
  assert.equal(inLeapYear?.day, '2028-02-29');
});

test('teilt in heute, diese Woche, diesen Monat und spaeter', () => {
  const today = new Date(2026, 8, 13); // Samstag, 13. September 2026
  const people = [
    person('l', 'Luca', '1997-09-13'),
    person('a', 'Anna', '1990-09-14'),
    person('m', 'Mama', '1964-09-20'),
    person('s', 'Sven', '1985-09-27'),
    person('j', 'Jonas', `${UNKNOWN_BIRTH_YEAR}-10-20`, false),
    person('n', 'Nina', '1999-10-01'),
  ];
  const sections = birthdaySections(upcomingBirthdays(people, undefined, today), today);
  const names = (list: readonly { person: BirthdayPerson }[]) => list.map((e) => e.person.name);
  assert.deepEqual(names(sections.today), ['Luca']);
  assert.deepEqual(names(sections.week), ['Anna', 'Mama']);
  assert.deepEqual(names(sections.month), ['Sven']);
  assert.deepEqual(names(sections.later), ['Nina', 'Jonas']);
});

test('diese Woche reicht auch in den naechsten Monat', () => {
  const today = new Date(2026, 8, 28);
  const early = person('e', 'Eva', '1990-10-03');
  const sections = birthdaySections(upcomingBirthdays([early], undefined, today), today);
  assert.equal(sections.week.length, 1);
});

test('findet Namen ohne Ruecksicht auf Gross, klein und Akzente', () => {
  assert.equal(matchesQuery('Zoé Muster', 'zoe'), true);
  assert.equal(matchesQuery('Anna', ''), true);
  assert.equal(matchesQuery('Anna', 'ben'), false);
});

test('schlaegt Kontakte vor: Wortanfang zuerst, hoechstens drei', () => {
  const rows = [
    { id: '1', name: 'Hanna Keller' },
    { id: '2', name: 'Anna Muster' },
    { id: '3', name: 'Annabelle' },
    { id: '4', name: 'Ben Anner' },
    { id: '5', name: 'Clara' },
  ];
  assert.deepEqual(
    suggestContacts(rows, 'ann').map((row) => row.name),
    ['Anna Muster', 'Annabelle', 'Ben Anner'],
  );
  assert.deepEqual(suggestContacts(rows, '  '), []);
});

test('kennt die Laenge der Monate und laesst den Tag nicht ueberlaufen', () => {
  assert.equal(daysInMonth(2026, 2), 28);
  assert.equal(daysInMonth(2028, 2), 29);
  assert.equal(birthdayKey(1990, 2, 31), '1990-02-28');
  assert.equal(birthdayKey(1990, 9, 9), '1990-09-09');
});

test('ohne Jahr hat der Februar 29 Tage und landet im Platzhalter-Jahr', () => {
  assert.equal(dayCountOf(2, null), 29);
  assert.equal(dayCountOf(2, 2026), 28);
  assert.equal(draftBirthdayKey(2, 29, null), `${UNKNOWN_BIRTH_YEAR}-02-29`);
  assert.equal(draftBirthdayKey(2, 29, 2026), '2026-02-28');
});

test('die Vorschau sagt, wann und wie alt', () => {
  assert.deepEqual(previewOf(9, 20, 1990, from), { day: '2026-09-20', days: 11, age: 36 });
  assert.deepEqual(previewOf(9, 1, null, from), { day: '2027-09-01', days: 357, age: null });
});

test('Erinnerungen: fehlt die Angabe, gilt die Voreinstellung; null heisst keine', () => {
  assert.deepEqual(remindersOf({}), DEFAULT_REMINDERS);
  assert.deepEqual(remindersOf({ birthdayReminders: null }), { weekBefore: false, dayOf: false });
  assert.deepEqual(remindersOf({ birthdayReminders: { weekBefore: false, dayOf: true } }), {
    weekBefore: false,
    dayOf: true,
  });
});

test('eine verschenkte Idee zaehlt zum naechsten Geburtstag, wenn er nah ist', () => {
  assert.equal(giftYearFor('1990-01-02', new Date(2026, 11, 20)), 2027);
  assert.equal(giftYearFor('1990-09-01', new Date(2026, 8, 9)), 2026);
});

test('findet Geburtstage in einem Zeitraum ueber den Jahreswechsel', () => {
  const found = birthdaysBetween([clara, ben], new Date(2026, 11, 20), new Date(2027, 0, 10));
  assert.deepEqual(
    found.map((entry) => [entry.person.name, entry.day, entry.age]),
    [['Clara', '2027-01-02', 27]],
  );
});

test('das Ende des Zeitraums gehoert nicht mehr dazu', () => {
  const found = birthdaysBetween([ben], new Date(2026, 8, 1), new Date(2026, 8, 14));
  assert.equal(found.length, 0);
  assert.equal(birthdaysBetween([ben], new Date(2026, 8, 14), new Date(2026, 8, 15)).length, 1);
});

test('vor der Geburt gibt es keinen Geburtstag — ausser das Jahr ist unbekannt', () => {
  assert.equal(birthdaysBetween([clara], new Date(1999, 0, 1), new Date(2000, 0, 1)).length, 0);
  const unknown = person('u', 'Uli', `${UNKNOWN_BIRTH_YEAR}-06-01`, false);
  assert.equal(birthdaysBetween([unknown], new Date(1999, 0, 1), new Date(2000, 0, 1)).length, 1);
});

test('am 29. Februar Geborene feiern in anderen Jahren am 1. Maerz', () => {
  const found = birthdaysBetween([leap], new Date(2026, 1, 1), new Date(2026, 2, 31));
  assert.deepEqual(
    found.map((entry) => entry.day),
    ['2026-03-01'],
  );
});

test('findet den Kontakt hinter einem gedachten Kalendereintrag', () => {
  const id = birthdayEventId('ct_anna', '2026-09-09');
  assert.equal(personOfBirthdayEvent(id), 'ct_anna');
  assert.equal(personOfBirthdayEvent('ev_123'), null);
});
