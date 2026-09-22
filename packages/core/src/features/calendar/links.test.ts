import assert from 'node:assert/strict';
import { test } from 'node:test';

import { calendarFocusOf, calendarLinkOf } from './links';

test('calendarLinkOf: Tag, Uhrzeit und Termin — ganztägig ohne Uhrzeit', () => {
  const start = new Date(2026, 8, 22, 15, 5).toISOString();
  assert.equal(
    calendarLinkOf({ id: 'ev 1', startsAt: start }),
    '/run/calendar?day=2026-09-22&at=15:05&event=ev%201',
  );
  assert.equal(
    calendarLinkOf({ id: 'ev2', startsAt: new Date(2026, 8, 23).toISOString(), allDay: true }),
    '/run/calendar?day=2026-09-23&event=ev2',
  );
});

test('calendarFocusOf: liest zurück, was calendarLinkOf schreibt', () => {
  const focus = calendarFocusOf({ day: '2026-09-22', at: '15:05', event: 'ev 1' });
  assert.equal(focus?.day.getTime(), new Date(2026, 8, 22).getTime());
  assert.equal(focus?.minutes, 15 * 60 + 5);
  assert.equal(focus?.eventId, 'ev 1');
  // Ohne Uhrzeit nur der Tag.
  const allDay = calendarFocusOf({ day: '2026-09-23', event: 'ev2' });
  assert.equal(allDay?.minutes, undefined);
  assert.equal(allDay?.eventId, 'ev2');
});

test('calendarFocusOf: Krummes zählt nicht', () => {
  assert.equal(calendarFocusOf({}), null);
  assert.equal(calendarFocusOf({ day: 'morgen' }), null);
  assert.equal(calendarFocusOf({ day: '2026-02-31' }), null);
  assert.equal(calendarFocusOf({ day: ['2026-09-22', '2026-09-23'] }), null);
  assert.equal(calendarFocusOf({ day: '2026-09-22', at: '25:00' })?.minutes, undefined);
  assert.equal(calendarFocusOf({ day: '2026-09-22', at: '10:75' })?.minutes, undefined);
  assert.equal(calendarFocusOf({ day: '2026-09-22', event: '' })?.eventId, null);
});
