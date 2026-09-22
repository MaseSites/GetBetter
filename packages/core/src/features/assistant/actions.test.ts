import assert from 'node:assert/strict';
import { test } from 'node:test';

import { birthdayKey, eventWindow, mealSlotAt, movedWindow, parseAction } from './actions';

const local = (iso: string) => {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

test('parseAction: ein Termin, sauber gelesen; Unbekanntes und Kaputtes faellt weg', () => {
  assert.deepEqual(
    parseAction({
      name: 'create_event',
      args: { title: ' Zahnarzt ', date: '2026-09-23', start: '14:00', end: 'bald', location: 'Bern' },
    }),
    {
      name: 'create_event',
      title: 'Zahnarzt',
      date: '2026-09-23',
      start: '14:00',
      end: null,
      location: 'Bern',
      note: null,
    },
  );
  assert.equal(parseAction({ name: 'create_event', args: { title: 'Ohne Tag' } }), null);
  assert.equal(parseAction({ name: 'delete_everything', args: {} }), null);
  assert.equal(parseAction({ name: 'toString', args: {} }), null);
  assert.equal(parseAction({ name: 'delete_event', args: { ref: 'irgendwas' } }), null);
  assert.deepEqual(parseAction({ name: 'delete_event', args: { ref: 'T2' } }), { name: 'delete_event', ref: 'T2' });
});

test('parseAction: Vorgaben, wo der Assistent nichts sagt', () => {
  assert.deepEqual(parseAction({ name: 'create_task', args: { title: 'Steuern', priority: 9 } }), {
    name: 'create_task',
    title: 'Steuern',
    date: null,
    time: null,
    priority: 0,
    note: null,
  });
  assert.deepEqual(parseAction({ name: 'add_habit', args: { name: 'Lesen' } }), {
    name: 'add_habit',
    habit: 'Lesen',
    perWeek: 7,
  });
  assert.deepEqual(parseAction({ name: 'add_expense', args: { amount: '12.50', category: 'luxus' } }), {
    name: 'add_expense',
    amount: 12.5,
    category: 'other',
    note: null,
  });
  assert.deepEqual(parseAction({ name: 'set_alarm', args: { time: '06:40', days: ['fr', 'mo', 'mo', 'xx'] } }), {
    name: 'set_alarm',
    time: '06:40',
    label: '',
    days: ['mo', 'fr'],
  });
  assert.deepEqual(parseAction({ name: 'log_water', args: { dl: 2.54 } }), { name: 'log_water', dl: 2.5 });
  assert.equal(parseAction({ name: 'add_shopping', args: { items: ['', 42] } }), null);
  assert.deepEqual(parseAction({ name: 'add_shopping', args: { items: [' 2 Bananen', 'Milch'] } }), {
    name: 'add_shopping',
    items: ['2 Bananen', 'Milch'],
  });
});

test('Geburtstage: ohne Jahr im Jahr 2000, und nur echte Tage', () => {
  assert.equal(birthdayKey(3, 14, 1990), '1990-03-14');
  assert.equal(birthdayKey(2, 29, null), '2000-02-29');
  assert.equal(birthdayKey(2, 29, 2023), null);
  assert.equal(birthdayKey(6, 31, null), null);
  assert.deepEqual(parseAction({ name: 'add_birthday', args: { name: 'Anna', month: 9, day: 30 } }), {
    name: 'add_birthday',
    person: 'Anna',
    birthday: '2000-09-30',
    yearKnown: false,
  });
  assert.equal(parseAction({ name: 'add_birthday', args: { name: 'Anna', month: 2, day: 31 } }), null);
});

test('eventWindow: ohne Start ganztaegig, ohne Ende eine Stunde, nie ueber Mitternacht', () => {
  // Wie im Kalender: das Tagesende ist Mitternacht des Folgetags.
  const allDay = eventWindow('2026-09-23', null, null);
  assert.equal(allDay.allDay, true);
  assert.equal(local(allDay.startsAt), '2026-09-23 00:00');
  assert.equal(local(allDay.endsAt), '2026-09-24 00:00');

  const hour = eventWindow('2026-09-23', '14:00', null);
  assert.deepEqual([hour.allDay, local(hour.startsAt), local(hour.endsAt)], [false, '2026-09-23 14:00', '2026-09-23 15:00']);

  const wrongEnd = eventWindow('2026-09-23', '14:00', '13:00');
  assert.equal(local(wrongEnd.endsAt), '2026-09-23 15:00');

  const late = eventWindow('2026-09-23', '23:30', null);
  assert.equal(local(late.endsAt), '2026-09-24 00:00');
});

test('movedWindow: was nicht genannt ist, bleibt — Tag, Zeit und Dauer', () => {
  const timed = eventWindow('2026-09-23', '14:00', '15:30');
  const otherDay = movedWindow(timed, { date: '2026-09-25', start: null, end: null });
  assert.deepEqual([local(otherDay.startsAt), local(otherDay.endsAt)], ['2026-09-25 14:00', '2026-09-25 15:30']);

  const later = movedWindow(timed, { date: null, start: '16:00', end: null });
  assert.deepEqual([local(later.startsAt), local(later.endsAt)], ['2026-09-23 16:00', '2026-09-23 17:30']);

  const allDay = eventWindow('2026-09-23', null, null);
  const stillAllDay = movedWindow(allDay, { date: '2026-09-24', start: null, end: null });
  assert.equal(stillAllDay.allDay, true);
  assert.equal(local(stillAllDay.startsAt), '2026-09-24 00:00');
  const nowTimed = movedWindow(allDay, { date: null, start: '09:00', end: null });
  assert.deepEqual([nowTimed.allDay, local(nowTimed.endsAt)], [false, '2026-09-23 10:00']);
});

test('mealSlotAt: Fruehstueck, Mittag, Zvieri, Znacht', () => {
  assert.deepEqual([7, 12, 16, 19, 23].map(mealSlotAt), ['breakfast', 'lunch', 'snack', 'dinner', 'snack']);
});
