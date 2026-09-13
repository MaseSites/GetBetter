import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dueAtOfDay } from '../../db/taskFields';
import type { TaskRow } from '../../db/types';

import {
  countOnDay,
  doneTasks,
  inboxTasks,
  listCounts,
  NO_FILTERS,
  nextOrder,
  PLANNED_DAYS,
  plannedGroups,
  projectGroups,
  searchTasks,
  subtaskProgress,
  tagCounts,
  todayGroups,
  uniqueTags,
} from './lists';
import { metaPartsOf } from './meta';

const today = '2026-09-16';

function makeTask(id: string, patch: Partial<TaskRow> = {}): TaskRow {
  return {
    id,
    accountId: 'acc',
    householdId: null,
    title: id,
    done: false,
    dueAt: null,
    shared: false,
    createdAt: `2026-09-01T08:00:00.000Z`,
    completedAt: null,
    ...patch,
  };
}

const on = (day: string) => dueAtOfDay(day);
const ids = (rows: readonly TaskRow[]) => rows.map((row) => row.id);

test('Heute: überfällig, mit Uhrzeit chronologisch, dann eigene Reihenfolge', () => {
  const rows = [
    makeTask('late', { dueAt: on('2026-09-14') }),
    makeTask('noon', { dueAt: on(today), dueTime: '12:00' }),
    makeTask('early', { dueAt: on(today), dueTime: '08:30' }),
    makeTask('second', { dueAt: on(today), order: 2 }),
    makeTask('first', { dueAt: on(today), order: 1 }),
    makeTask('done', { dueAt: on(today), done: true }),
    makeTask('child', { dueAt: on(today), parentId: 'first' }),
    makeTask('tomorrow', { dueAt: on('2026-09-17') }),
  ];
  const groups = todayGroups(rows, today, 'time');
  assert.deepEqual(ids(groups.overdue), ['late']);
  assert.deepEqual(ids(groups.timed), ['early', 'noon']);
  assert.deepEqual(ids(groups.untimed), ['first', 'second']);
  assert.equal(groups.reorderable, true);
});

test('Heute nach Priorität: eine Liste, nicht von Hand sortierbar', () => {
  const rows = [
    makeTask('low', { dueAt: on(today), priority: 1 }),
    makeTask('flag', { dueAt: on(today), priority: true }),
    makeTask('high', { dueAt: on(today), priority: 3, dueTime: '18:00' }),
    makeTask('none', { dueAt: on(today) }),
  ];
  const groups = todayGroups(rows, today, 'priority');
  assert.deepEqual(groups.timed, []);
  assert.deepEqual(ids(groups.untimed), ['high', 'low', 'flag', 'none']);
  assert.equal(groups.reorderable, false);
});

test('Eingang: ohne Datum und ohne Projekt', () => {
  const rows = [
    makeTask('b', { order: 1 }),
    makeTask('a', { order: 0 }),
    makeTask('dated', { dueAt: on(today) }),
    makeTask('project', { projectId: 'p1' }),
    makeTask('done', { done: true }),
  ];
  assert.deepEqual(ids(inboxTasks(rows, 'time')), ['a', 'b']);
});

test('Geplant: 14 Tage einzeln, danach Monate, Überfälliges vorne', () => {
  const rows = [
    makeTask('late', { dueAt: on('2026-09-01') }),
    makeTask('fri', { dueAt: on('2026-09-18') }),
    makeTask('last', { dueAt: on('2026-09-29') }),
    makeTask('oct', { dueAt: on('2026-10-02') }),
    makeTask('dec', { dueAt: on('2026-12-24') }),
  ];
  const groups = plannedGroups(rows, today);
  assert.equal(groups[0]?.kind, 'overdue');
  const days = groups.filter((group) => group.kind === 'day');
  assert.equal(days.length, PLANNED_DAYS);
  assert.equal(days[0]?.day, today);
  assert.deepEqual(ids(days.find((group) => group.day === '2026-09-18')?.rows ?? []), ['fri']);
  assert.deepEqual(ids(days.find((group) => group.day === '2026-09-29')?.rows ?? []), ['last']);
  assert.deepEqual(
    groups.filter((group) => group.kind === 'month').map((group) => [group.key, ids(group.rows)]),
    [
      ['2026-10', ['oct']],
      ['2026-12', ['dec']],
    ],
  );
});

test('Projekt: ohne Abschnitt zuerst, leere Abschnitte bleiben', () => {
  const rows = [
    makeTask('loose', { projectId: 'p1' }),
    makeTask('lost', { projectId: 'p1', section: 'Gibt es nicht' }),
    makeTask('prep', { projectId: 'p1', section: 'Vorbereitung' }),
    makeTask('other', { projectId: 'p2' }),
  ];
  const groups = projectGroups(rows, { id: 'p1', sections: ['Vorbereitung', 'Umzugstag'] }, 'time');
  assert.deepEqual(
    groups.map((group) => [group.section, ids(group.rows)]),
    [
      [null, ['loose', 'lost']],
      ['Vorbereitung', ['prep']],
      ['Umzugstag', []],
    ],
  );
});

test('Zählen: Übersicht, Tags, morgen', () => {
  const rows = [
    makeTask('inbox', { tags: ['Admin'] }),
    makeTask('late', { dueAt: on('2026-09-10'), tags: ['admin', 'post'] }),
    makeTask('today', { dueAt: on(today) }),
    makeTask('tomorrow', { dueAt: on('2026-09-17'), projectId: 'p1' }),
    makeTask('done', { done: true, tags: ['alt'] }),
  ];
  const counts = listCounts(rows, today);
  assert.equal(counts.inbox, 1);
  assert.equal(counts.today, 2);
  assert.equal(counts.planned, 3);
  assert.equal(counts.projects.get('p1'), 1);
  assert.deepEqual(tagCounts(rows), [
    { tag: 'Admin', count: 2 },
    { tag: 'post', count: 1 },
  ]);
  assert.equal(countOnDay(rows, '2026-09-17'), 1);
  assert.deepEqual(uniqueTags(['a', 'A', '', 'b']), ['a', 'b']);
});

test('Suche: Titel, Notiz, Tag und Projektname; Filter', () => {
  const rows = [
    makeTask('vignette', { title: 'Vignette kaufen', dueAt: on('2026-09-10') }),
    makeTask('note', { title: 'Auto', notes: 'Vignette nicht vergessen' }),
    makeTask('tag', { title: 'Service', tags: ['vignette'], priority: 2 }),
    makeTask('project', { title: 'Kisten', projectId: 'p1' }),
    makeTask('done', { title: 'Vignette 2025', done: true }),
  ];
  const names = new Map([['p1', 'Umzug']]);
  assert.deepEqual(ids(searchTasks(rows, 'vignette', NO_FILTERS, today, names)), [
    'vignette',
    'note',
    'tag',
  ]);
  assert.deepEqual(ids(searchTasks(rows, 'umzug', NO_FILTERS, today, names)), ['project']);
  assert.deepEqual(
    ids(searchTasks(rows, 'vignette', { ...NO_FILTERS, includeDone: true }, today, names)),
    ['vignette', 'note', 'tag', 'done'],
  );
  assert.deepEqual(ids(searchTasks(rows, '', { ...NO_FILTERS, overdue: true }, today, names)), [
    'vignette',
  ]);
  assert.deepEqual(ids(searchTasks(rows, '', { ...NO_FILTERS, priority: true }, today, names)), [
    'tag',
  ]);
  assert.deepEqual(ids(searchTasks(rows, '', { ...NO_FILTERS, noDate: true }, today, names)), [
    'note',
    'tag',
    'project',
  ]);
  assert.deepEqual(ids(searchTasks(rows, '', { ...NO_FILTERS, projectId: 'p1' }, today, names)), [
    'project',
  ]);
  assert.deepEqual(ids(searchTasks(rows, '', { ...NO_FILTERS, tag: 'VIGNETTE' }, today, names)), [
    'tag',
  ]);
});

test('Teilaufgaben, erledigte Liste und nächste Reihenfolge', () => {
  const rows = [
    makeTask('parent', { order: 4 }),
    makeTask('c1', { parentId: 'parent', done: true }),
    makeTask('c2', { parentId: 'parent' }),
    makeTask('finished', {
      done: true,
      completedAt: new Date(2026, 8, 16, 9).toISOString(),
    }),
    makeTask('older', { done: true, completedAt: new Date(2026, 8, 1, 9).toISOString() }),
  ];
  assert.deepEqual(subtaskProgress(rows).get('parent'), { done: 1, total: 2 });
  assert.deepEqual(ids(doneTasks(rows, { kind: 'today', today })), ['finished']);
  assert.deepEqual(ids(doneTasks(rows, { kind: 'inbox' })), ['finished', 'older']);
  assert.equal(nextOrder(rows), 5);
  assert.equal(nextOrder([]), 0);
});

test('Metazeile: feste Reihenfolge, nur was da ist', () => {
  const full = makeTask('full', {
    dueAt: on(today),
    dueTime: '14:30',
    repeat: { every: 1, unit: 'week', fromCompletion: false },
    reminderOffsetMinutes: 0,
    attachmentIds: ['img1'],
    notes: 'Notiz',
    tags: ['a', 'b', 'c'],
  });
  assert.deepEqual(
    metaPartsOf(full, {
      today,
      dateMode: 'timeOnly',
      progress: { done: 2, total: 5 },
      groupName: 'Wohnung',
      showGroup: true,
    }),
    [
      { kind: 'time', time: '14:30' },
      { kind: 'repeat' },
      { kind: 'reminder' },
      { kind: 'attachment' },
      { kind: 'subtasks', done: 2, total: 5 },
      { kind: 'project', name: 'Wohnung' },
      { kind: 'tag', tag: 'a' },
      { kind: 'tag', tag: 'b' },
    ],
  );
  assert.deepEqual(
    metaPartsOf(makeTask('plain'), { today, dateMode: 'full', showGroup: true }),
    [],
  );
});

test('Metazeile: Datum, überfällig, Erinnerung nur mit Uhrzeit', () => {
  const late = makeTask('late', { dueAt: on('2026-09-12'), reminderOffsetMinutes: 0 });
  assert.deepEqual(metaPartsOf(late, { today, dateMode: 'timeOnly', showGroup: false }), [
    { kind: 'date', day: '2026-09-12', time: null, overdue: true },
  ]);
  const later = makeTask('later', { dueAt: on('2026-09-19'), dueTime: '17:00', notes: 'x' });
  assert.deepEqual(
    metaPartsOf(later, { today, dateMode: 'full', groupName: 'Haushalt', showGroup: false }),
    [{ kind: 'date', day: '2026-09-19', time: '17:00', overdue: false }, { kind: 'note' }],
  );
});
