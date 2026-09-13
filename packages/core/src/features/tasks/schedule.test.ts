import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addMonths,
  dayFromParts,
  endOfMonth,
  nextWeekday,
  parseClock,
  weekdayOf,
  weekendDay,
} from './days';
import { dayBeforeOffset, scheduleFor } from './schedule';

test('Tage: Wochentag, Monatsende, ungültige Tage', () => {
  assert.equal(weekdayOf('2026-09-13'), 7);
  assert.equal(weekdayOf('2026-09-14'), 1);
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-11-15', 3), '2027-02-15');
  assert.equal(endOfMonth('2028-02-10'), '2028-02-29');
  assert.equal(dayFromParts(2026, 2, 30), null);
  assert.equal(dayFromParts(2026, 13, 1), null);
  assert.equal(nextWeekday('2026-09-16', 3, false), '2026-09-23');
  assert.equal(parseClock('9.05'), '09:05');
  assert.equal(parseClock('24:00'), null);
});

test('Planen: Vorschläge von einem Mittwoch aus', () => {
  const wednesday = '2026-09-16';
  assert.deepEqual(scheduleFor('tonight', wednesday, '09:00'), {
    day: wednesday,
    time: '18:00',
  });
  assert.deepEqual(scheduleFor('tomorrow', wednesday, '09:00'), {
    day: '2026-09-17',
    time: '09:00',
  });
  assert.deepEqual(scheduleFor('weekend', wednesday, null), { day: '2026-09-19', time: null });
  assert.deepEqual(scheduleFor('nextWeek', wednesday, null), { day: '2026-09-21', time: null });
  assert.deepEqual(scheduleFor('none', wednesday, '09:00'), { day: null, time: null });
});

test('Planen: am Wochenende', () => {
  assert.equal(weekendDay('2026-09-19'), '2026-09-19');
  assert.equal(weekendDay('2026-09-20'), '2026-09-20');
  assert.deepEqual(scheduleFor('nextWeek', '2026-09-20', null), {
    day: '2026-09-21',
    time: null,
  });
});

test('Am Vortag 18:00 als Minuten vor der Frist', () => {
  assert.equal(dayBeforeOffset('14:30'), 1230);
  assert.equal(dayBeforeOffset('18:00'), 1440);
});
