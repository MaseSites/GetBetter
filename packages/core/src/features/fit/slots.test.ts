import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { shiftDayKey, slotForNow, zurichDay, zurichHour } from './slots';

describe('Mahlzeit nach Zuercher Zeit', () => {
  test('Stunde und Tag in Zuerich, auch um Mitternacht UTC', () => {
    // 22:30 UTC im Sommer ist 00:30 in Zuerich — schon der naechste Tag.
    const late = new Date('2026-07-01T22:30:00Z');
    assert.equal(zurichHour(late), 0);
    assert.equal(zurichDay(late), '2026-07-02');
    assert.equal(zurichHour(new Date('2026-01-15T11:00:00Z')), 12);
  });

  test('die Mahlzeit, die dran ist', () => {
    assert.equal(slotForNow(7), 'breakfast');
    assert.equal(slotForNow(12), 'lunch');
    assert.equal(slotForNow(16), 'snack');
    assert.equal(slotForNow(19), 'dinner');
    assert.equal(slotForNow(23), 'snack');
  });

  test('Tage verschieben ueber den Monatswechsel', () => {
    assert.equal(shiftDayKey('2026-10-01', -1), '2026-09-30');
    assert.equal(shiftDayKey('2026-12-31', 1), '2027-01-01');
  });
});
