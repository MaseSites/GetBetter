import assert from 'node:assert/strict';
import { test } from 'node:test';

import { daysUntil, nextBirthday, parseDay, relativeDay, shiftDay } from './days';

const from = new Date(2026, 8, 9, 15, 30); // Mittwoch, 9. September 2026, nachmittags

/** Ein t(), das nur den Schluessel und die Zahl zurueckgibt. */
const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key}:${Object.values(params).join(',')}` : key;

test('liest einen Tagesschluessel als lokales Datum', () => {
  const date = parseDay('2026-09-09');
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 8);
  assert.equal(date.getDate(), 9);
  assert.equal(date.getHours(), 0);
});

test('zaehlt Tage ab heute, negativ fuer Vergangenes', () => {
  assert.equal(daysUntil('2026-09-09', from), 0);
  assert.equal(daysUntil('2026-09-16', from), 7);
  assert.equal(daysUntil('2026-09-01', from), -8);
});

test('verschiebt Tage auch ueber den Monatswechsel', () => {
  assert.equal(shiftDay(0, from), '2026-09-09');
  assert.equal(shiftDay(30, from), '2026-10-09');
  assert.equal(shiftDay(-9, from), '2026-08-31');
});

test('sagt Heute, Morgen, Gestern und sonst Tage', () => {
  const today = shiftDay(0);
  assert.equal(relativeDay(t as never, 'de', today), 'day.today');
  assert.equal(relativeDay(t as never, 'de', shiftDay(1)), 'day.tomorrow');
  assert.equal(relativeDay(t as never, 'de', shiftDay(-1)), 'day.yesterday');
  assert.equal(relativeDay(t as never, 'de', shiftDay(5)), 'day.in:5');
  assert.equal(relativeDay(t as never, 'de', shiftDay(-3)), 'day.ago:3');
});

test('weit weg steht das Datum', () => {
  const text = relativeDay(t as never, 'de', shiftDay(60));
  assert.match(text, /^\d{2}\.\d{2}\.\d{4}$/);
});

test('findet den naechsten Geburtstag und das Alter', () => {
  const soon = nextBirthday('1990-09-20', from);
  assert.equal(soon.day, '2026-09-20');
  assert.equal(soon.days, 11);
  assert.equal(soon.age, 36);

  const passed = nextBirthday('1990-03-01', from);
  assert.equal(passed.day, '2027-03-01');
  assert.equal(passed.age, 37);

  const today = nextBirthday('2000-09-09', from);
  assert.equal(today.days, 0);
  assert.equal(today.age, 26);
});
