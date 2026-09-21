/** Was ohne Abo gesperrt ist — rein, ohne Dateien. */
const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { LOCKED_FIELDS, keepLockedFields, lockedChangesOf, sameValue } = require('./entitlement.js');
const { canPersonalize, planSettings, pricedApps } = require('./plans.js');

const DEFAULT = planSettings({});
const owl = { kind: 'owl', color: 'sun', eyes: 'sparkle', accessory: 'glasses' };

describe('Personalisieren mit Abo', () => {
  test('pricedApps und canPersonalize: ein Abo einer App mit Preis genuegt', () => {
    assert.deepEqual(pricedApps(DEFAULT), ['getbetter', 'betterfamily', 'bettergym', 'betterai']);
    assert.equal(canPersonalize({ paidApps: ['betterfamily'] }, DEFAULT), true);
    assert.equal(canPersonalize({ paidApps: ['bettermoney'] }, DEFAULT), false);
    assert.equal(canPersonalize({ paidApps: 'getbetter' }, DEFAULT), false);
    assert.equal(canPersonalize({}, DEFAULT), false);
    assert.equal(canPersonalize(undefined, DEFAULT), false);
    const money = planSettings({ BETTER_PRICE_BETTERMONEY_CHF: '2' });
    assert.deepEqual(pricedApps(money), ['getbetter', 'betterfamily', 'bettergym', 'betterai', 'bettermoney']);
    assert.equal(canPersonalize({ paidApps: ['bettermoney'] }, money), true);
  });

  test('gesperrt sind Farben, Hintergrund und der Assistent — hell/dunkel nicht', () => {
    assert.deepEqual(LOCKED_FIELDS, [
      'accentKey',
      'themePreset',
      'backdrop',
      'assistantAvatar',
      'assistantName',
      'assistantVoice',
    ]);
    assert.equal(LOCKED_FIELDS.includes('themeMode'), false);
  });

  test('lockedChangesOf: nur echte Aenderungen, nur was die Route schreibt', () => {
    const row = { accentKey: 'blue', assistantAvatar: owl, themeMode: 'dark' };
    assert.deepEqual(lockedChangesOf(row, { themeMode: 'light', firstName: 'Anna' }), []);
    assert.deepEqual(lockedChangesOf(row, { accentKey: 'blue' }), []);
    // Der Avatar mit anders geordneten Feldern ist derselbe.
    assert.deepEqual(lockedChangesOf(row, { assistantAvatar: { accessory: 'glasses', eyes: 'sparkle', color: 'sun', kind: 'owl' } }), []);
    assert.deepEqual(lockedChangesOf(row, { accentKey: 'rose', backdrop: 'forest', assistantName: '' }), [
      'accentKey',
      'backdrop',
      'assistantName',
    ]);
    assert.deepEqual(lockedChangesOf(row, { assistantVoice: 'eleven:x', accentKey: 'rose' }, ['accentKey']), ['accentKey']);
    assert.deepEqual(lockedChangesOf(undefined, { themePreset: 'mono' }), ['themePreset']);
  });

  test('keepLockedFields: ohne Abo gilt, was gespeichert ist — mit Abo, was kommt', () => {
    const known = { id: 'a', accentKey: 'blue', backdrop: 'forest', paidApps: ['bettermoney'] };
    const incoming = { id: 'a', accentKey: 'rose', themeMode: 'dark', assistantVoice: 'eleven:x', paidApps: ['bettermoney'] };
    const kept = keepLockedFields(incoming, known, DEFAULT);
    assert.deepEqual(kept, { id: 'a', accentKey: 'blue', themeMode: 'dark', paidApps: ['bettermoney'], backdrop: 'forest' });
    assert.deepEqual(incoming.accentKey, 'rose', 'die Eingabe bleibt unveraendert');

    const fresh = keepLockedFields({ id: 'b', themePreset: 'mono', firstName: 'Ben' }, undefined, DEFAULT);
    assert.deepEqual(fresh, { id: 'b', firstName: 'Ben' });

    const paid = { ...known, paidApps: ['getbetter'] };
    assert.equal(keepLockedFields(incoming, paid, DEFAULT), incoming);
  });

  test('sameValue vergleicht Werte, nicht Verweise', () => {
    assert.equal(sameValue('a', 'a'), true);
    assert.equal(sameValue({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 }), true);
    assert.equal(sameValue({ a: 1 }, { a: 1, b: 2 }), false);
    assert.equal(sameValue(null, {}), false);
    assert.equal(sameValue(undefined, ''), false);
  });
});
