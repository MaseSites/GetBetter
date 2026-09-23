'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');

const { dataKey, forDisk, isSealed, open, seal, unseal } = require('./crypt.js');

const KEY = crypto.randomBytes(32);

test('seal und open: was hineingeht, kommt heraus — und nichts davon steht im Klartext', () => {
  const secret = '{"tables":{"accounts":[{"email":"anna@test.ch"}]}}';
  const sealed = seal(KEY, secret);
  assert.ok(isSealed(sealed));
  assert.ok(!sealed.includes('anna'));
  assert.equal(open(KEY, sealed), secret);
  // Zweimal versiegelt sieht zweimal anders aus (frische Nonce).
  assert.notEqual(seal(KEY, secret), sealed);
});

test('ein anderer Schluessel oder ein veraendertes Byte scheitert laut', () => {
  const sealed = seal(KEY, 'geheim');
  assert.throws(() => open(crypto.randomBytes(32), sealed));
  const parsed = JSON.parse(sealed);
  const tampered = JSON.stringify({ ...parsed, data: Buffer.from('x').toString('base64') });
  assert.throws(() => open(KEY, tampered));
});

test('unseal: Klartext bleibt Klartext, Verschluesseltes braucht den Schluessel', () => {
  assert.equal(unseal(null, '{"revision":1}'), '{"revision":1}');
  assert.equal(unseal(KEY, seal(KEY, 'x')), 'x');
  assert.throws(() => unseal(null, seal(KEY, 'x')), /BETTER_DATA_KEY/u);
  assert.equal(forDisk(null, 'klar'), 'klar');
  assert.ok(isSealed(forDisk(KEY, 'klar')));
});

test('dataKey: leer heisst Klartext, krumm ist ein Fehler, 64 Hex sind 32 Bytes', () => {
  assert.equal(dataKey({}), null);
  assert.equal(dataKey({ BETTER_DATA_KEY: '  ' }), null);
  assert.throws(() => dataKey({ BETTER_DATA_KEY: 'zu-kurz' }), /64 Hex/u);
  assert.equal(dataKey({ BETTER_DATA_KEY: KEY.toString('hex') })?.length, 32);
});
