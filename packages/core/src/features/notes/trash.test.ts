import assert from 'node:assert/strict';
import { test } from 'node:test';

import { TRASH_DAYS, trashCutoff, trashDaysLeft } from './trash';

test('Papierkorb: 30 Tage, dann weg', () => {
  const now = new Date('2026-09-13T10:00:00.000Z');
  assert.equal(trashCutoff(now), '2026-08-14T10:00:00.000Z');
  assert.equal(trashDaysLeft('2026-09-13T09:00:00.000Z', now), TRASH_DAYS);
  assert.equal(trashDaysLeft('2026-09-03T10:00:00.000Z', now), 20);
  assert.equal(trashDaysLeft('2026-08-01T10:00:00.000Z', now), 1);
});
