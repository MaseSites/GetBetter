/**
 * Die App rechnet vor, wann der Benutzername wieder frei ist; der Dienst
 * entscheidet. Beide muessen dieselbe Frist kennen.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { USERNAME_COOLDOWN_DAYS, usernameFreeAt } = require('../auth.js');

const CLIENT = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'packages',
  'core',
  'src',
  'features',
  'profile',
  'usernameCooldown.ts',
);

test('App und Dienst kennen dieselbe Frist fuer den Benutzernamen', () => {
  const source = fs.readFileSync(CLIENT, 'utf8');
  const match = /export const USERNAME_COOLDOWN_DAYS = (\d+);/.exec(source);
  assert.ok(match, 'USERNAME_COOLDOWN_DAYS fehlt in der App');
  assert.equal(Number(match[1]), USERNAME_COOLDOWN_DAYS);
});

test('usernameFreeAt im Dienst: ohne Aenderung frei, danach einen Monat nicht', () => {
  const now = new Date('2026-09-22T10:00:00Z');
  assert.equal(usernameFreeAt({}, now), null);
  assert.equal(usernameFreeAt({ usernameChangedAt: '2026-09-20T10:00:00Z' }, now), '2026-10-20T10:00:00.000Z');
  assert.equal(usernameFreeAt({ usernameChangedAt: '2026-08-01T10:00:00Z' }, now), null);
});
