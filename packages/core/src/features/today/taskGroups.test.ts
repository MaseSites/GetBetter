import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dueAtOfDay } from '../../db/taskFields';
import type { TaskRow } from '../../db/types';
import { dayTaskCount, dayTaskGroups } from './taskGroups';

const TODAY = '2026-09-22';
const TOMORROW = '2026-09-23';

function task(id: string, patch: Partial<TaskRow> = {}): TaskRow {
  return {
    id,
    accountId: 'acc',
    householdId: null,
    title: id,
    done: false,
    dueAt: null,
    shared: false,
    createdAt: '2026-09-01T08:00:00.000Z',
    completedAt: null,
    ...patch,
  };
}

const on = (day: string) => dueAtOfDay(day);
const ids = (rows: readonly TaskRow[]) => rows.map((row) => row.id);

const ROWS: TaskRow[] = [
  task('alt', { dueAt: on('2026-09-18') }),
  task('gestern', { dueAt: on('2026-09-21') }),
  task('abend', { dueAt: on(TODAY), dueTime: '18:00' }),
  task('morgens', { dueAt: on(TODAY), dueTime: '08:30' }),
  task('wichtig', { dueAt: on(TODAY), priority: 3 }),
  task('normal', { dueAt: on(TODAY), order: 1 }),
  task('eingang'),
  task('morgen', { dueAt: on(TOMORROW) }),
  task('erledigt', { dueAt: on(TODAY), done: true }),
  task('teil', { dueAt: on(TODAY), parentId: 'normal' }),
];

test('heute: überfällig (Ältestes zuerst), heute (mit Uhrzeit zuerst), dann ohne Datum', () => {
  const groups = dayTaskGroups(ROWS, TODAY, TODAY);
  assert.deepEqual(ids(groups.overdue), ['alt', 'gestern']);
  assert.deepEqual(ids(groups.due), ['morgens', 'abend', 'wichtig', 'normal']);
  assert.deepEqual(ids(groups.inbox), ['eingang']);
  assert.equal(dayTaskCount(groups), 7);
});

test('ein anderer Tag: nur, was dann fällig ist — nichts Überfälliges, kein Eingang', () => {
  const groups = dayTaskGroups(ROWS, TOMORROW, TODAY);
  assert.deepEqual(ids(groups.due), ['morgen']);
  assert.deepEqual(groups.overdue, []);
  assert.deepEqual(groups.inbox, []);
  assert.equal(dayTaskCount(dayTaskGroups(ROWS, '2026-09-30', TODAY)), 0);
});

test('Erledigtes und Teilaufgaben stehen nie da', () => {
  const all = dayTaskGroups(ROWS, TODAY, TODAY);
  const shown = [...all.overdue, ...all.due, ...all.inbox];
  assert.equal(
    shown.some((row) => row.id === 'erledigt' || row.id === 'teil'),
    false,
  );
});
