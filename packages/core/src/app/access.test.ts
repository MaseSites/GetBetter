import assert from 'node:assert/strict';
import { test } from 'node:test';

import { accessOf, adminFieldsChanged } from './access';

test('adminFieldsChanged: Sperre, Apps und Abo zaehlen, alles andere nicht', () => {
  assert.equal(adminFieldsChanged({}, { disabled: false, blockedApps: [], paidApps: [] }), false);
  assert.equal(adminFieldsChanged({ paidApps: ['getbetter'] }, { paidApps: ['getbetter'] }), false);
  assert.equal(adminFieldsChanged({ paidApps: [] }, { paidApps: ['getbetter'] }), true);
  assert.equal(adminFieldsChanged({ blockedApps: ['betterai'] }, {}), true);
  assert.equal(adminFieldsChanged({ disabled: true }, { disabled: false }), true);
  assert.equal(adminFieldsChanged({ paidApps: ['a', 'b'] }, { paidApps: ['b', 'a'] }), true);
});

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
