import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  birthdayEventId,
  birthdayKey,
  birthdaysBetween,
  daysInMonth,
  personOfBirthdayEvent,
  upcomingBirthdays,
  withBirthday,
  type BirthdayPerson,
} from './birthdays';

const from = new Date(2026, 8, 9, 15, 30); // Mittwoch, 9. September 2026, nachmittags

const anna: BirthdayPerson = { id: 'ct_anna', name: 'Anna', birthday: '1990-09-09' };
const ben: BirthdayPerson = { id: 'ct_ben', name: 'Ben', birthday: '1985-09-14' };
const clara: BirthdayPerson = { id: 'ct_clara', name: 'Clara', birthday: '2000-01-02' };
const leap: BirthdayPerson = { id: 'ct_leap', name: 'Lea', birthday: '2004-02-29' };

test('nimmt nur Kontakte mit Geburtsdatum', () => {
  const rows = [
    { id: 'a', name: 'Mit', birthday: '1990-01-01' },
    { id: 'b', name: 'Ohne', birthday: null },
  ];
  assert.deepEqual(withBirthday(rows), [{ id: 'a', name: 'Mit', birthday: '1990-01-01' }]);
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

test('vor der Geburt gibt es keinen Geburtstag', () => {
  assert.equal(birthdaysBetween([clara], new Date(1999, 0, 1), new Date(2000, 0, 1)).length, 0);
});

test('am 29. Februar Geborene feiern in anderen Jahren am 1. Maerz', () => {
  const found = birthdaysBetween([leap], new Date(2026, 1, 1), new Date(2026, 2, 31));
  assert.deepEqual(
    found.map((entry) => entry.day),
    ['2026-03-01'],
  );
});

test('kennt die Laenge der Monate und laesst den Tag nicht ueberlaufen', () => {
  assert.equal(daysInMonth(2026, 2), 28);
  assert.equal(daysInMonth(2028, 2), 29);
  assert.equal(birthdayKey(1990, 2, 31), '1990-02-28');
  assert.equal(birthdayKey(1990, 9, 9), '1990-09-09');
});

test('findet den Kontakt hinter einem gedachten Kalendereintrag', () => {
  const id = birthdayEventId('ct_anna', '2026-09-09');
  assert.equal(personOfBirthdayEvent(id), 'ct_anna');
  assert.equal(personOfBirthdayEvent('ev_123'), null);
});
