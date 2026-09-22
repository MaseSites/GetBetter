import assert from 'node:assert/strict';
import { test } from 'node:test';

import { USERNAME_COOLDOWN_DAYS, usernameFreeAt } from './usernameCooldown';

const NOW = new Date('2026-09-22T10:00:00Z');

test('usernameFreeAt: ohne Aenderung geht es gleich', () => {
  assert.equal(usernameFreeAt(undefined, NOW), null);
  assert.equal(usernameFreeAt(null, NOW), null);
  assert.equal(usernameFreeAt('kaputt', NOW), null);
});

test('usernameFreeAt: einen Monat nach der letzten Aenderung wieder', () => {
  const free = usernameFreeAt('2026-09-20T10:00:00Z', NOW);
  assert.equal(free?.toISOString(), '2026-10-20T10:00:00.000Z');
  assert.equal(USERNAME_COOLDOWN_DAYS, 30);
  // Genau nach dem Monat ist es wieder frei.
  assert.equal(usernameFreeAt('2026-08-23T10:00:00Z', NOW), null);
  assert.equal(usernameFreeAt('2026-08-23T10:00:01Z', NOW)?.toISOString(), '2026-09-22T10:00:01.000Z');
});
