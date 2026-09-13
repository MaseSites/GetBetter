import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseRecent, recentStorageKey, rememberQuery } from './recent';

test('rememberQuery legt die neue Suche nach vorn und behaelt drei', () => {
  assert.deepEqual(rememberQuery(['a', 'b', 'c'], 'd'), ['d', 'a', 'b']);
});

test('rememberQuery fuehrt eine Suche nie doppelt, egal wie geschrieben', () => {
  assert.deepEqual(rememberQuery(['Physio', 'Maler'], ' maler '), ['maler', 'Physio']);
});

test('rememberQuery merkt sich nichts Leeres', () => {
  const list = ['Physio'];
  assert.equal(rememberQuery(list, '   '), list);
});

test('rememberQuery veraendert die alte Liste nicht', () => {
  const list = ['a'];
  rememberQuery(list, 'b');
  assert.deepEqual(list, ['a']);
});

test('parseRecent liest eine gespeicherte Liste', () => {
  assert.deepEqual(parseRecent('["Physio","Maler"]'), ['Physio', 'Maler']);
});

test('parseRecent nimmt nur Texte und hoechstens drei', () => {
  assert.deepEqual(parseRecent('["a", 1, null, "", "b", "c", "d"]'), ['a', 'b', 'c']);
});

test('parseRecent gibt bei Unsinn eine leere Liste', () => {
  assert.deepEqual(parseRecent(null), []);
  assert.deepEqual(parseRecent('kein json'), []);
  assert.deepEqual(parseRecent('{"a":1}'), []);
});

test('recentStorageKey trennt die Konten', () => {
  assert.notEqual(recentStorageKey('anna'), recentStorageKey('luca'));
});
