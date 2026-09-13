import assert from 'node:assert/strict';
import { test } from 'node:test';

import { listTime } from './time';

const now = new Date(2026, 8, 11, 15, 30); // Freitag, 11. September 2026

test('09:14, Gestern, Di, 12.9. — und mit Jahr aus einem anderen Jahr', () => {
  assert.equal(listTime('de', new Date(2026, 8, 11, 9, 14).toISOString(), 'Gestern', now), '09:14');
  assert.equal(
    listTime('de', new Date(2026, 8, 10, 9, 0).toISOString(), 'Gestern', now),
    'Gestern',
  );
  assert.equal(listTime('de', new Date(2026, 8, 8, 9, 0).toISOString(), 'Gestern', now), 'Di');
  assert.equal(listTime('de', new Date(2026, 8, 1, 9, 0).toISOString(), 'Gestern', now), '1.9.');
  assert.equal(
    listTime('de', new Date(2025, 11, 24, 9, 0).toISOString(), 'Gestern', now),
    '24.12.25',
  );
  assert.equal(listTime('de', 'kaputt', 'Gestern', now), '');
});
