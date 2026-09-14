import assert from 'node:assert/strict';
import { test } from 'node:test';

import { accessOf } from './access';

test('accessOf: ohne Angaben ist alles freigeschaltet', () => {
  assert.equal(accessOf({}, 'getbetter'), 'ok');
  assert.equal(accessOf({ blockedApps: [] }, 'bettergym'), 'ok');
});

test('accessOf: eine weggenommene App trifft nur diese App', () => {
  const account = { blockedApps: ['bettergym'] };
  assert.equal(accessOf(account, 'bettergym'), 'blocked');
  assert.equal(accessOf(account, 'getbetter'), 'ok');
});

test('accessOf: ein gesperrtes Konto geht vor', () => {
  assert.equal(accessOf({ disabled: true, blockedApps: ['bettergym'] }, 'bettergym'), 'disabled');
  assert.equal(accessOf({ disabled: true }, 'getbetter'), 'disabled');
});
