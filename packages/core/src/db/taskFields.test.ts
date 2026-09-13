import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dueAtOfDay, dueDayOf, priorityOf } from './taskFields';

test('Wichtigkeit: alte Fahne und fehlender Wert', () => {
  assert.equal(priorityOf(true), 1);
  assert.equal(priorityOf(false), 0);
  assert.equal(priorityOf(undefined), 0);
  assert.equal(priorityOf(null), 0);
});

test('Wichtigkeit: Zahlen bleiben zwischen 0 und 3', () => {
  assert.equal(priorityOf(0), 0);
  assert.equal(priorityOf(2), 2);
  assert.equal(priorityOf(3), 3);
  assert.equal(priorityOf(7), 3);
  assert.equal(priorityOf(-1), 0);
  assert.equal(priorityOf(1.6), 2);
  assert.equal(priorityOf(Number.NaN), 0);
  assert.equal(priorityOf('3'), 0);
});

test('Frist: ein Tag kommt als derselbe Tag zurueck', () => {
  for (const day of ['2026-01-01', '2026-03-29', '2026-09-16', '2026-10-25', '2026-12-31']) {
    assert.equal(dueDayOf({ dueAt: dueAtOfDay(day) }), day);
  }
});

test('Frist: aeltere Zeilen um Mitternacht und fehlende Fristen', () => {
  assert.equal(dueDayOf({ dueAt: new Date(2026, 8, 16).toISOString() }), '2026-09-16');
  assert.equal(dueDayOf({ dueAt: null }), null);
  assert.equal(dueDayOf({ dueAt: 'kaputt' }), null);
});
