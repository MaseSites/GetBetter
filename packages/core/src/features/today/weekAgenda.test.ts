import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dayDots, weekAgenda, weekDays, type AgendaItem } from './weekAgenda';

/** Ortszeit, damit der Test in jeder Zeitzone dasselbe meint. */
const at = (day: number, hour: number) => new Date(2026, 8, day, hour, 0).toISOString();

const item = (
  day: string,
  kind: AgendaItem['kind'],
  title: string,
  extra: Partial<AgendaItem> = {},
): AgendaItem & { day: string } => ({
  key: `${day}-${title}`,
  kind,
  title,
  color: kind,
  at: null,
  time: null,
  day,
  ...extra,
});

test('weekDays: sieben Tage ab heute, auch ueber den Monat hinweg', () => {
  const days = weekDays('2026-09-28');
  assert.equal(days.length, 7);
  assert.equal(days[0], '2026-09-28');
  assert.equal(days[3], '2026-10-01');
  assert.equal(days[6], '2026-10-04');
});

test('weekAgenda: nur Tage mit Eintraegen, in der richtigen Reihenfolge', () => {
  const days = weekAgenda('2026-09-23', [
    item('2026-09-24', 'task', 'Velo flicken'),
    item('2026-09-24', 'event', 'Zahnarzt', { at: at(24, 15) }),
    item('2026-09-24', 'event', 'Coiffeur', { at: at(24, 10) }),
    item('2026-09-24', 'birthday', 'Anna wird 36'),
    item('2026-09-24', 'task', 'Anrufen', { time: '12:00' }),
    item('2026-09-23', 'event', 'Ferien', { at: null }),
    // Ausserhalb der Woche: faellt weg.
    item('2026-10-05', 'event', 'Zu spaet', { at: at(35, 10) }),
  ]);
  assert.deepEqual(
    days.map((day) => day.day),
    ['2026-09-23', '2026-09-24'],
  );
  assert.deepEqual(
    days[1]?.items.map((row) => row.title),
    ['Anna wird 36', 'Coiffeur', 'Anrufen', 'Zahnarzt', 'Velo flicken'],
  );
  assert.deepEqual(weekAgenda('2026-09-23', []), []);
});

test('dayDots: die Farben der ersten Eintraege eines Tages', () => {
  const days = weekAgenda('2026-09-23', [
    item('2026-09-23', 'event', 'A', { color: '#111' }),
    item('2026-09-23', 'task', 'B', { color: '#222' }),
    item('2026-09-23', 'event', 'C', { color: '#333' }),
  ]);
  assert.deepEqual(dayDots(days, '2026-09-23', 2), ['#111', '#333']);
  assert.deepEqual(dayDots(days, '2026-09-25', 3), []);
});
