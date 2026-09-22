import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CONTEXT_LIMITS, contextOf } from './context';

const at = (day: string, time: string) => new Date(`${day}T${time}:00`).toISOString();

test('contextOf: jetzt in Ortszeit, Termine mit T-Kennung, Aufgaben mit A-Kennung', () => {
  const { context, refs } = contextOf({
    now: new Date(2026, 8, 21, 19, 42),
    events: [
      { groupId: 'evg_1', title: 'Zahnarzt', startsAt: at('2026-09-23', '14:00'), endsAt: at('2026-09-23', '15:00'), allDay: false },
      { groupId: 'evg_2', title: 'Ferien', startsAt: at('2026-09-28', '00:00'), endsAt: null, allDay: true },
    ],
    tasks: [
      { id: 'tk_9', title: 'Steuern', dueAt: at('2026-09-25', '12:00'), dueTime: '09:00', priority: 2 },
      { id: 'tk_3', title: 'Velo flicken', dueAt: null },
    ],
  });
  assert.equal(context.now, '2026-09-21T19:42');
  assert.deepEqual(refs, { T1: 'evg_1', T2: 'evg_2', A1: 'tk_9', A2: 'tk_3' });
  assert.deepEqual(context.items, [
    { ref: 'T1', kind: 'event', title: 'Zahnarzt', date: '2026-09-23', time: '14:00', end: '15:00' },
    { ref: 'T2', kind: 'event', title: 'Ferien', date: '2026-09-28' },
    { ref: 'A1', kind: 'task', title: 'Steuern', date: '2026-09-25', time: '09:00', note: '!!' },
    { ref: 'A2', kind: 'task', title: 'Velo flicken' },
  ]);
  assert.deepEqual(context.facts, []);
});

test('contextOf: der Rest ohne Kennung, nur eingeschaltete Wecker, alles begrenzt', () => {
  const { context, refs } = contextOf({
    now: new Date(2026, 8, 21, 8, 5),
    alarms: [
      { time: '06:40', label: 'Aufstehen', days: ['mo', 'di'], enabled: true },
      { time: '07:00', label: 'Aus', days: [], enabled: false },
    ],
    birthdays: [
      { name: 'Anna', day: '2026-09-30', age: 36 },
      { name: 'Max', day: '2026-10-02', age: null },
    ],
    habits: [{ name: 'Lesen', doneToday: true }],
    notes: [{ title: 'Ideen' }, { title: '  ' }],
    shopping: [
      { name: 'Bananen', quantity: '2' },
      { name: 'Milch', quantity: null },
    ],
    chores: Array.from({ length: 40 }, (_, index) => ({ title: `Ämtli ${index}` })),
    bills: [{ title: 'Miete', amount: 'CHF 1’200.00', dueDay: '2026-10-01' }],
    facts: [{ label: 'Wasser heute', value: '5 dl' }],
  });
  assert.deepEqual(refs, {});
  const byKind = (kind: string) => context.items.filter((entry) => entry.kind === kind);
  assert.deepEqual(byKind('alarm'), [{ kind: 'alarm', title: 'Aufstehen', time: '06:40', note: 'mo di' }]);
  assert.deepEqual(byKind('birthday').map((entry) => entry.title), ['Anna (36)', 'Max']);
  assert.deepEqual(byKind('habit'), [{ kind: 'habit', title: 'Lesen', note: '✓' }]);
  assert.deepEqual(byKind('note'), [{ kind: 'note', title: 'Ideen' }]);
  assert.deepEqual(byKind('shopping').map((entry) => entry.title), ['2 Bananen', 'Milch']);
  assert.equal(byKind('chore').length, CONTEXT_LIMITS.chores);
  assert.deepEqual(byKind('bill'), [{ kind: 'bill', title: 'Miete CHF 1’200.00', date: '2026-10-01' }]);
  assert.deepEqual(context.facts, [{ label: 'Wasser heute', value: '5 dl' }]);
  assert.equal(context.now, '2026-09-21T08:05');
});
