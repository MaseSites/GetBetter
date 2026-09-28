import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { EventRow } from '../../db/types';
import { MAX_SCHEDULED, mergeReminders, sameReminders } from '../tasks/reminders';

import {
  EVENT_REMINDER_DAY_BEFORE,
  eventReminderInstant,
  eventRemindersOf,
} from './reminders';

function event(
  id: string,
  start: Date,
  minutes: number | null | undefined,
  extra: Partial<EventRow> = {},
): EventRow {
  return {
    id,
    accountId: 'a',
    householdId: null,
    calendar: 'personal',
    calendarId: null,
    isPrivate: false,
    title: `Termin ${id}`,
    location: null,
    notes: null,
    startsAt: start.toISOString(),
    endsAt: null,
    allDay: false,
    color: null,
    ...(minutes === undefined ? {} : { reminderMinutes: minutes }),
    createdAt: '2026-09-01T00:00:00.000Z',
    ...extra,
  } as EventRow;
}

const parts = (at: Date | null) =>
  at ? [at.getMonth() + 1, at.getDate(), at.getHours(), at.getMinutes()] : null;

test('eventReminderInstant: Minuten vor Beginn, Vortag 18:00, keine', () => {
  const start = new Date(2026, 8, 24, 14, 0);
  assert.deepEqual(parts(eventReminderInstant(event('a', start, 0))), [9, 24, 14, 0]);
  assert.deepEqual(parts(eventReminderInstant(event('a', start, 10))), [9, 24, 13, 50]);
  assert.deepEqual(parts(eventReminderInstant(event('a', start, 60))), [9, 24, 13, 0]);
  assert.deepEqual(
    parts(eventReminderInstant(event('a', start, EVENT_REMINDER_DAY_BEFORE))),
    [9, 23, 18, 0],
  );
  assert.equal(eventReminderInstant(event('a', start, null)), null);
  assert.equal(eventReminderInstant(event('a', start, undefined)), null);
  assert.equal(eventReminderInstant(event('a', start, -5)), null);
});

test('eventReminderInstant: frueh am Morgen rutscht ueber Mitternacht, Monatswechsel zaehlt', () => {
  assert.deepEqual(parts(eventReminderInstant(event('a', new Date(2026, 8, 24, 0, 30), 60))), [
    9, 23, 23, 30,
  ]);
  assert.deepEqual(
    parts(eventReminderInstant(event('a', new Date(2026, 9, 1, 8, 0), EVENT_REMINDER_DAY_BEFORE))),
    [9, 30, 18, 0],
  );
});

test('eventReminderInstant: ganztaegig am Tag um 9, sonst am Vortag um 18', () => {
  const day = new Date(2026, 8, 24, 0, 0);
  const allDay = { allDay: true };
  assert.deepEqual(parts(eventReminderInstant(event('a', day, 0, allDay))), [9, 24, 9, 0]);
  assert.deepEqual(parts(eventReminderInstant(event('a', day, 10, allDay))), [9, 23, 18, 0]);
  assert.deepEqual(
    parts(eventReminderInstant(event('a', day, EVENT_REMINDER_DAY_BEFORE, allDay))),
    [9, 23, 18, 0],
  );
});

test('eventRemindersOf: nur was noch kommt, frueheste zuerst, jede Gruppe einmal', () => {
  const now = new Date(2026, 8, 23, 12, 0);
  const rows = [
    event('spaeter', new Date(2026, 8, 25, 9, 0), 10),
    event('bald', new Date(2026, 8, 23, 15, 0), 60),
    event('vorbei', new Date(2026, 8, 23, 12, 5), 10),
    event('ohne', new Date(2026, 8, 24, 9, 0), null),
    event('kopie1', new Date(2026, 8, 24, 10, 0), 0, { groupId: 'g1' }),
    event('kopie2', new Date(2026, 8, 24, 10, 0), 0, { groupId: 'g1' }),
  ];
  const list = eventRemindersOf(rows, now);
  assert.deepEqual(
    list.map((entry) => entry.taskId),
    ['bald', 'g1', 'spaeter'],
  );
  assert.equal(list[0]?.kind, 'event');
  assert.equal(list[0]?.title, 'Termin bald');
  assert.equal(new Date(list[0]?.at ?? '').getHours(), 14);
  assert.equal(list[0]?.startsAt, rows[1]?.startsAt);
});

test('eventRemindersOf: hoechstens max', () => {
  const now = new Date(2026, 8, 23, 0, 0);
  const rows = Array.from({ length: MAX_SCHEDULED + 5 }, (_, index) =>
    event(`e${index}`, new Date(2026, 9, 1, 9, index), 0),
  );
  assert.equal(eventRemindersOf(rows, now).length, MAX_SCHEDULED);
  assert.equal(eventRemindersOf(rows, now, { max: 2 }).length, 2);
});

test('mergeReminders: Aufgaben und Termine teilen sich das Limit', () => {
  const task = { taskId: 't', title: 'A', at: '2026-09-24T10:00:00.000Z' };
  const first = { taskId: 'e', title: 'T', at: '2026-09-24T08:00:00.000Z', kind: 'event' as const };
  const merged = mergeReminders([[task], [first]]);
  assert.deepEqual(
    merged.map((entry) => entry.taskId),
    ['e', 't'],
  );
  assert.equal(mergeReminders([[task], [first]], 1).length, 1);
  // Gleiche Id und Zeit, aber einmal Aufgabe, einmal Termin: nicht dasselbe.
  assert.equal(sameReminders([task], [{ ...task, kind: 'event' }]), false);
  assert.equal(sameReminders([task], [{ ...task, kind: 'task' }]), true);
});
