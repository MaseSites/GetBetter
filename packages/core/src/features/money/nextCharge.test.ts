import assert from 'node:assert/strict';
import { test } from 'node:test';

import { chargesOn, isDayKey, nextChargeDay, subscriptionsChargedOn } from './nextCharge';

test('monatlich: dieser Monat, wenn der Tag noch kommt', () => {
  assert.equal(nextChargeDay('2026-01-28', 'month', '2026-09-25'), '2026-09-28');
});

test('monatlich: heute zaehlt noch', () => {
  assert.equal(nextChargeDay('2026-01-25', 'month', '2026-09-25'), '2026-09-25');
});

test('monatlich: sonst der naechste Monat, auch ueber Silvester', () => {
  assert.equal(nextChargeDay('2026-01-05', 'month', '2026-09-25'), '2026-10-05');
  assert.equal(nextChargeDay('2026-01-05', 'month', '2026-12-20'), '2027-01-05');
});

test('der 31. wird zum Monatsletzten — und danach wieder der 31.', () => {
  assert.equal(nextChargeDay('2026-01-31', 'month', '2026-09-01'), '2026-09-30');
  assert.equal(nextChargeDay('2026-01-31', 'month', '2026-02-01'), '2026-02-28');
  assert.equal(nextChargeDay('2026-01-31', 'month', '2028-02-01'), '2028-02-29');
  assert.equal(nextChargeDay('2026-01-31', 'month', '2026-10-01'), '2026-10-31');
  // Am 30. September schon abgebucht: am 1. Oktober kommt der 31. Oktober.
  assert.equal(nextChargeDay('2026-01-31', 'month', '2026-09-30'), '2026-09-30');
});

test('der 30. im Februar ist der 28.', () => {
  assert.equal(nextChargeDay('2026-01-30', 'month', '2027-02-10'), '2027-02-28');
  assert.equal(nextChargeDay('2026-01-30', 'month', '2027-03-01'), '2027-03-30');
});

test('liegt der Anfang vorne, ist er die naechste Abbuchung', () => {
  assert.equal(nextChargeDay('2026-11-15', 'month', '2026-09-25'), '2026-11-15');
  assert.equal(nextChargeDay('2027-01-01', 'year', '2026-09-25'), '2027-01-01');
});

test('jaehrlich: dieses Jahr oder das naechste', () => {
  assert.equal(nextChargeDay('2025-11-03', 'year', '2026-09-25'), '2026-11-03');
  assert.equal(nextChargeDay('2025-03-03', 'year', '2026-09-25'), '2027-03-03');
  assert.equal(nextChargeDay('2025-09-25', 'year', '2026-09-25'), '2026-09-25');
});

test('jaehrlich am 29. Februar: sonst am 28.', () => {
  assert.equal(nextChargeDay('2024-02-29', 'year', '2026-01-10'), '2026-02-28');
  assert.equal(nextChargeDay('2024-02-29', 'year', '2027-03-01'), '2028-02-29');
});

test('krumme Tage geben null', () => {
  assert.equal(nextChargeDay('2026-02-30', 'month', '2026-09-25'), null);
  assert.equal(nextChargeDay('gestern', 'month', '2026-09-25'), null);
  assert.equal(nextChargeDay('2026-01-05', 'month', '2026-13-01'), null);
  assert.equal(isDayKey('2026-09-25'), true);
  assert.equal(isDayKey('2026-9-25'), false);
});

test('chargesOn: genau an den Abbuchungstagen', () => {
  assert.equal(chargesOn('2026-01-31', 'month', '2026-09-30'), true);
  assert.equal(chargesOn('2026-01-31', 'month', '2026-09-29'), false);
  assert.equal(chargesOn('2026-01-31', 'month', '2026-10-31'), true);
  assert.equal(chargesOn('2025-06-10', 'year', '2026-06-10'), true);
  assert.equal(chargesOn('2025-06-10', 'year', '2026-07-10'), false);
  // Vor dem Anfang wird nichts abgebucht.
  assert.equal(chargesOn('2026-10-10', 'month', '2026-09-10'), false);
});

test('subscriptionsChargedOn: ohne Datum keins', () => {
  const rows = [
    { id: 'a', startDay: '2026-01-05', interval: 'month' as const },
    { id: 'b', startDay: null, interval: 'month' as const },
    { id: 'c', interval: 'year' as const },
    { id: 'd', startDay: '2025-10-05', interval: 'year' as const },
  ];
  assert.deepEqual(
    subscriptionsChargedOn(rows, '2026-10-05').map((row) => row.id),
    ['a', 'd'],
  );
  assert.deepEqual(
    subscriptionsChargedOn(rows, '2026-11-05').map((row) => row.id),
    ['a'],
  );
});
