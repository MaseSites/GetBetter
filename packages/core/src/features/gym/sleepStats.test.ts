import assert from 'node:assert/strict';
import { test } from 'node:test';

import { catchUpOf, regularityOf, sleepDebtOf } from './sleepStats';

const NOW = new Date(2026, 8, 25, 20, 0);

test('ohne Naechte gibt es keine Schuld, sondern nichts', () => {
  assert.equal(sleepDebtOf([], 480, NOW), null);
});

test('die letzte Nacht zaehlt voll', () => {
  const debt = sleepDebtOf([{ day: '2026-09-25', bedtime: '00:00', wakeTime: '06:00' }], 480, NOW);
  assert.deepEqual(debt, { debtMinutes: 120, averageMinutes: 360, nights: 1 });
});

test('aeltere Naechte zaehlen weniger, die aelteste noch 0.3', () => {
  const debt = sleepDebtOf([{ day: '2026-09-12', bedtime: '00:00', wakeTime: '06:00' }], 480, NOW);
  assert.equal(debt?.debtMinutes, 35);
});

test('Naechte ausserhalb der 14 Tage und in der Zukunft fallen weg', () => {
  const debt = sleepDebtOf(
    [
      { day: '2026-09-11', bedtime: '00:00', wakeTime: '04:00' },
      { day: '2026-09-26', bedtime: '00:00', wakeTime: '04:00' },
    ],
    480,
    NOW,
  );
  assert.equal(debt, null);
});

test('zu viel Schlaf zahlt zurueck, aber nie unter null', () => {
  const debt = sleepDebtOf(
    [
      { day: '2026-09-25', bedtime: '22:00', wakeTime: '08:00' },
      { day: '2026-09-24', bedtime: '23:00', wakeTime: '06:00' },
    ],
    480,
    NOW,
  );
  assert.equal(debt?.debtMinutes, 0);
  assert.equal(debt?.averageMinutes, 510);
});

test('dieselbe Nacht zaehlt nur einmal', () => {
  const night = { day: '2026-09-25', bedtime: '00:00', wakeTime: '06:00' };
  assert.equal(sleepDebtOf([night, night], 480, NOW)?.nights, 1);
});

test('Regelmaessigkeit rechnet ueber Mitternacht', () => {
  assert.equal(regularityOf([{ bedtime: '23:30' }, { bedtime: '00:30' }]), null);
  assert.equal(
    regularityOf([{ bedtime: '23:30' }, { bedtime: '00:30' }, { bedtime: '00:00' }]),
    24,
  );
  assert.equal(
    regularityOf([{ bedtime: '22:00' }, { bedtime: '22:00' }, { bedtime: '22:00' }]),
    0,
  );
});

test('Aufholen: hoechstens eine Stunde, in Viertelstunden', () => {
  assert.deepEqual(catchUpOf({ debtMinutes: 50, goalMinutes: 480, wakeMinutes: 7 * 60 }), {
    bedtime: '22:15',
    catchUpMinutes: 45,
  });
  assert.deepEqual(catchUpOf({ debtMinutes: 300, goalMinutes: 480, wakeMinutes: 6 * 60 }), {
    bedtime: '21:00',
    catchUpMinutes: 60,
  });
  assert.equal(catchUpOf({ debtMinutes: 10, goalMinutes: 480, wakeMinutes: 420 }), null);
});
