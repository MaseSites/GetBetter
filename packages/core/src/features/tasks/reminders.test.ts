import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dueAtOfDay } from '../../db/taskFields';
import type { TaskRow } from '../../db/types';

import { MAX_SCHEDULED, reminderInstant, remindersOf, sameReminders } from './reminders';

function task(id: string, day: string | null, time: string | null, offset: number | null): TaskRow {
  return {
    id,
    accountId: 'a',
    householdId: null,
    shared: false,
    title: `Aufgabe ${id}`,
    done: false,
    completedAt: null,
    dueAt: day ? dueAtOfDay(day) : null,
    dueTime: time,
    reminderOffsetMinutes: offset,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  } as TaskRow;
}

test('reminderInstant: Uhrzeit minus Vorlauf, in Ortszeit', () => {
  const at = reminderInstant('2026-09-24', '09:30', 15);
  assert.ok(at);
  assert.deepEqual(
    [at.getFullYear(), at.getMonth(), at.getDate(), at.getHours(), at.getMinutes()],
    [2026, 8, 24, 9, 15],
  );
  // Ein Vorlauf ueber Mitternacht landet am Vortag.
  const early = reminderInstant('2026-09-24', '00:10', 30);
  assert.equal(early?.getDate(), 23);
  assert.equal(reminderInstant('krumm', '09:30', 0), null);
  assert.equal(reminderInstant('2026-09-24', 'x', 0), null);
});

test('remindersOf: nur offene mit Tag, Uhrzeit und Vorlauf, nur was noch kommt, frueheste zuerst', () => {
  const now = new Date(2026, 8, 23, 12, 0);
  const rows = [
    task('spaeter', '2026-09-25', '08:00', 0),
    task('bald', '2026-09-23', '14:00', 30),
    task('vorbei', '2026-09-23', '11:00', 0),
    task('ohneZeit', '2026-09-24', null, 0),
    task('ohneVorlauf', '2026-09-24', '10:00', null),
    { ...task('erledigt', '2026-09-24', '10:00', 0), done: true },
  ];
  const list = remindersOf(rows, now);
  assert.deepEqual(
    list.map((entry) => entry.taskId),
    ['bald', 'spaeter'],
  );
  assert.equal(list[0]?.title, 'Aufgabe bald');
  assert.equal(new Date(list[0]?.at ?? '').getHours(), 13);
});

test('remindersOf: hoechstens so viele, wie das Handy halten kann', () => {
  const now = new Date(2026, 8, 23, 0, 0);
  const rows = Array.from({ length: MAX_SCHEDULED + 20 }, (_, index) =>
    task(`t${index}`, '2026-10-01', '09:00', index),
  );
  assert.equal(remindersOf(rows, now).length, MAX_SCHEDULED);
  assert.equal(remindersOf(rows, now, 3).length, 3);
});

test('sameReminders: gleich heisst gleich in Id, Titel und Zeit', () => {
  const a = [{ taskId: '1', title: 'x', at: '2026-09-23T10:00:00.000Z' }];
  assert.equal(sameReminders(a, [...a]), true);
  assert.equal(sameReminders(a, [{ ...a[0]!, title: 'y' }]), false);
  assert.equal(sameReminders(a, []), false);
});
