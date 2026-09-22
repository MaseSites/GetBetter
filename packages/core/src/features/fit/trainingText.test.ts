import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  dashRange,
  describeSets,
  formatClock,
  formatsOf,
  minutesOf,
  monthEnd,
  monthGrid,
  plannedMinutes,
  shiftMonth,
  shortName,
  weekBars,
} from './trainingText';

const units = { kg: 'kg', seconds: 's' };
const set = (weightKg: number | null, reps: number | null, seconds: number | null = null) => ({
  weightKg,
  reps,
  seconds,
});

describe('Zahlen im Training', () => {
  test('„Letztes Mal: 60 kg × 8 · 8 · 7“, Gewichtswechsel und Sprache', () => {
    const de = formatsOf('de');
    assert.equal(
      describeSets([set(60, 8), set(60, 8), set(60, 7)], de, units),
      '60 kg × 8 · 8 · 7',
    );
    assert.equal(describeSets([set(60, 8), set(62.5, 6)], de, units), '60 kg × 8 · 62.5 kg × 6');
    assert.equal(describeSets([set(62.5, 6)], formatsOf('fr'), units), '62,5 kg × 6');
    assert.equal(describeSets([set(null, 12), set(null, 10)], de, units), '12 · 10');
    assert.equal(
      describeSets([set(null, null, 45), set(null, null, 40)], de, units),
      '45 s · 40 s',
    );
  });

  test('Uhr, Vorzeichen', () => {
    assert.equal(formatClock(90), '1:30');
    assert.equal(formatClock(5), '0:05');
    assert.equal(formatClock(-3), '0:00');
    const de = formatsOf('de');
    assert.equal(de.signed.format(2.5), '+2.5');
    assert.equal(de.signed.format(0), '0');
    assert.ok(de.signed.format(-1).includes('1'));
  });

  test('Minuten ohne Aufwaermen, Zeituebungen mit ihrer Zeit', () => {
    const exercises = [{ exerciseId: 'a', restSeconds: 90 }];
    const sets = Array.from({ length: 8 }, () => ({ exerciseId: 'a', warmup: false }));
    assert.equal(minutesOf({ exercises, sets: [...sets, { exerciseId: 'a', warmup: true }] }), 18);
    assert.equal(minutesOf({ exercises, sets: [] }), 10);
  });

  test('Wochenbalken: feste Reihenfolge, nur Gruppen mit Saetzen, gemeinsame Skala', () => {
    const bars = weekBars({ chest: { sets: 6 }, legs: { sets: 3 } }, { legs: { sets: 9 } });
    assert.deepEqual(
      bars.map((bar) => [bar.group, bar.sets, bar.last]),
      [
        ['legs', 3, 9],
        ['chest', 6, 0],
      ],
    );
    assert.equal(bars[0]?.lastShare, 1);
  });

  test('Monatsstreifen: Montag zuerst, Monatswechsel', () => {
    const grid = monthGrid('2026-09');
    // Der 1. September 2026 ist ein Dienstag.
    assert.deepEqual(grid[0]?.slice(0, 2), [null, '2026-09-01']);
    assert.equal(grid.flat().filter(Boolean).length, 30);
    assert.equal(shiftMonth('2026-01', -1), '2025-12');
    assert.equal(shiftMonth('2026-12', 1), '2027-01');
    assert.equal(monthEnd('2028-02'), '2028-02-29');
  });
});

describe('Kurzformen im Trainingsheft', () => {
  test('Bereich mit Halbgeviertstrich', () => {
    assert.equal(dashRange('6-8'), '6–8');
    assert.equal(dashRange('30 s'), '30 s');
  });
  test('Name vor „mit“', () => {
    assert.equal(shortName('Kniebeuge mit Langhantel', ' mit '), 'Kniebeuge');
    assert.equal(shortName('Bankdrücken', ' mit '), 'Bankdrücken');
  });
  test('geplante Minuten, auf 5 gerundet', () => {
    assert.equal(plannedMinutes([{ sets: 12, restSeconds: 150 }]), 40);
    assert.equal(plannedMinutes([]), 5);
  });
});
