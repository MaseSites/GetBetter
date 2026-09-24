import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dueAtOfDay } from '../../db/taskFields';

import { postponeKindsFor, postponeSchedule, postponeTarget } from './postpone';
import { schedulePatch } from './schedule';

test('Verschieben: von einem Mittwoch aus', () => {
  const wednesday = '2026-09-16';
  assert.equal(postponeTarget('today', wednesday), wednesday);
  assert.equal(postponeTarget('tomorrow', wednesday), '2026-09-17');
  assert.equal(postponeTarget('nextWeek', wednesday), '2026-09-21');
});

test('Verschieben: nächste Woche am Sonntag und am Montag', () => {
  assert.equal(postponeTarget('nextWeek', '2026-09-20'), '2026-09-21');
  assert.equal(postponeTarget('nextWeek', '2026-09-14'), '2026-09-21');
  assert.equal(postponeTarget('tomorrow', '2026-09-20'), '2026-09-21');
});

test('Verschieben: über Monats- und Jahresende', () => {
  assert.equal(postponeTarget('tomorrow', '2026-09-30'), '2026-10-01');
  assert.equal(postponeTarget('tomorrow', '2026-12-31'), '2027-01-01');
  assert.equal(postponeTarget('nextWeek', '2026-12-31'), '2027-01-04');
  assert.equal(postponeTarget('nextWeek', '2027-02-27'), '2027-03-01');
  assert.equal(postponeTarget('tomorrow', '2028-02-28'), '2028-02-29');
});

test('Verschieben: Überfälliges zählt ab dem echten Heute, die Uhrzeit bleibt', () => {
  const today = '2026-09-16';
  assert.deepEqual(postponeSchedule('tomorrow', today, '07:30'), {
    day: '2026-09-17',
    time: '07:30',
  });
  assert.deepEqual(postponeSchedule('today', today, null), { day: today, time: null });
  assert.deepEqual(postponeKindsFor('2026-09-10', today), ['today', 'tomorrow', 'nextWeek']);
  assert.deepEqual(postponeKindsFor(today, today), ['tomorrow', 'nextWeek']);
  // Spaeteres und Aufgaben ohne Datum lassen sich auf heute holen.
  assert.deepEqual(postponeKindsFor('2026-09-20', today), ['today', 'tomorrow', 'nextWeek']);
  assert.deepEqual(postponeKindsFor(null, today), ['today', 'tomorrow', 'nextWeek']);
});

test('Verschieben: nur die Frist ändert sich, die Wiederholung bleibt', () => {
  const patch = schedulePatch(
    { reminderOffsetMinutes: 15 },
    postponeSchedule('tomorrow', '2026-09-16', '09:00'),
  );
  assert.equal(patch.dueAt, dueAtOfDay('2026-09-17'));
  assert.equal(patch.dueTime, '09:00');
  assert.equal(patch.reminderOffsetMinutes, 15);
  assert.equal('repeat' in patch, false);
});
