import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addMonths,
  formatDateValue,
  monthGrid,
  parseDateValue,
  parseTime,
  startOfWeek,
  weekDays,
} from './dates';

test('die Woche beginnt am Montag', () => {
  const sunday = new Date(2026, 8, 13);
  assert.equal(startOfWeek(sunday).getDate(), 7);
  assert.equal(weekDays(sunday).length, 7);
  assert.equal(weekDays(sunday)[0]?.getDay(), 1);
});

test('das Monatsraster hat sechs Wochen', () => {
  assert.equal(monthGrid(new Date(2026, 8, 1)).length, 42);
});

test('der Monatswechsel rutscht nicht in den uebernaechsten Monat', () => {
  assert.equal(addMonths(new Date(2026, 0, 31), 1).getMonth(), 1);
});

test('liest und schreibt das Schweizer Datum', () => {
  assert.equal(formatDateValue(new Date(2026, 8, 9)), '09.09.2026');
  assert.equal(parseDateValue('9.9.2026')?.getDate(), 9);
  assert.equal(parseDateValue('31.02.2026'), null);
  assert.equal(parseDateValue('heute'), null);
});

test('liest Uhrzeiten mit Punkt und Doppelpunkt', () => {
  assert.deepEqual(parseTime('9:05'), { hour: 9, minute: 5 });
  assert.deepEqual(parseTime('09.05'), { hour: 9, minute: 5 });
  assert.equal(parseTime('25:00'), null);
  assert.equal(parseTime('abends'), null);
});
