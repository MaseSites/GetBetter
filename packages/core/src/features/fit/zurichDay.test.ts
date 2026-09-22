import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { msUntilNextDay, shiftDay, zurichDayOf } from './zurichDay';

describe('Tag in Zuerich', () => {
  test('kurz vor und nach Mitternacht in Zuerich, nicht in UTC', () => {
    // 22:30 UTC im Sommer ist 00:30 in Zuerich — schon der naechste Tag.
    assert.equal(zurichDayOf(new Date('2026-09-22T22:30:00Z')), '2026-09-23');
    assert.equal(zurichDayOf(new Date('2026-09-22T21:59:00Z')), '2026-09-22');
    // Im Winter eine Stunde spaeter.
    assert.equal(zurichDayOf(new Date('2026-12-01T23:30:00Z')), '2026-12-02');
  });

  test('Zeit bis Mitternacht, auch am Tag der Zeitumstellung', () => {
    assert.equal(msUntilNextDay(new Date('2026-09-22T21:00:00Z')), 3600000);
    assert.equal(msUntilNextDay(new Date('2026-10-25T22:30:00Z')), 30 * 60000);
  });

  test('Tage verschieben', () => {
    assert.equal(shiftDay('2026-09-30', 1), '2026-10-01');
    assert.equal(shiftDay('2026-03-01', -1), '2026-02-28');
  });
});
