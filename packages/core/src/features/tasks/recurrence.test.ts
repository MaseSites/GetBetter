import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { TaskRepeat } from '../../db/types';

import { nextDueDay, weekdaysOf } from './recurrence';

const repeat = (patch: Partial<TaskRepeat>): TaskRepeat => ({
  every: 1,
  unit: 'day',
  fromCompletion: false,
  ...patch,
});

test('täglich: der Tag nach der Frist', () => {
  assert.equal(nextDueDay(repeat({}), '2026-09-16', '2026-09-16'), '2026-09-17');
});

test('zu spät abgehakt: nie am oder vor dem Tag des Abhakens', () => {
  assert.equal(nextDueDay(repeat({}), '2026-09-10', '2026-09-16'), '2026-09-17');
  assert.equal(nextDueDay(repeat({ unit: 'week' }), '2026-09-01', '2026-09-16'), '2026-09-22');
});

test('früh abgehakt: vom alten Termin aus', () => {
  assert.equal(nextDueDay(repeat({ unit: 'week' }), '2026-09-20', '2026-09-16'), '2026-09-27');
});

test('ab Erledigung zählen', () => {
  assert.equal(
    nextDueDay(repeat({ every: 7, fromCompletion: true }), '2026-09-01', '2026-09-16'),
    '2026-09-23',
  );
});

test('ohne Frist: ab dem Abhaken', () => {
  assert.equal(nextDueDay(repeat({ every: 3 }), null, '2026-09-16'), '2026-09-19');
});

test('an Wochentagen', () => {
  const monThu = repeat({ unit: 'week', weekdays: [4, 1] });
  // Donnerstag → Montag
  assert.equal(nextDueDay(monThu, '2026-09-17', '2026-09-17'), '2026-09-21');
  // Montag → Donnerstag
  assert.equal(nextDueDay(monThu, '2026-09-14', '2026-09-14'), '2026-09-17');
});

test('alle zwei Wochen am Montag', () => {
  const everyOther = repeat({ unit: 'week', every: 2, weekdays: [1] });
  assert.equal(nextDueDay(everyOther, '2026-09-14', '2026-09-14'), '2026-09-28');
});

test('monatlich und jährlich am Monatsende', () => {
  assert.equal(nextDueDay(repeat({ unit: 'month' }), '2026-01-31', '2026-01-31'), '2026-02-28');
  assert.equal(nextDueDay(repeat({ unit: 'month' }), '2026-01-31', '2026-03-05'), '2026-03-31');
  assert.equal(nextDueDay(repeat({ unit: 'year' }), '2024-02-29', '2024-02-29'), '2025-02-28');
});

test('kaputte Angaben gelten als eins', () => {
  assert.equal(nextDueDay(repeat({ every: 0 }), '2026-09-16', '2026-09-16'), '2026-09-17');
  assert.equal(nextDueDay(repeat({ every: Number.NaN }), '2026-09-16', '2026-09-16'), '2026-09-17');
  assert.deepEqual(weekdaysOf(repeat({ weekdays: [9, 3, 3, 0, 1] })), [1, 3]);
});
