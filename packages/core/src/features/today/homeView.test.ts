import assert from 'node:assert/strict';
import { test } from 'node:test';

import { focusOf, homeViewKey, parseHomeView, upcomingOf } from './homeView';

const at = (hours: number, minutes = 0) => new Date(2026, 8, 22, hours, minutes).toISOString();

const DAY = [
  { key: 'alarm', at: at(6, 40) },
  { key: 'doctor', at: at(15), until: at(17) },
  { key: 'training', at: at(18), until: at(19) },
  { key: 'dinner', at: at(20), until: at(21) },
];

test('parseHomeView: bekannte Ansichten, sonst die erste', () => {
  assert.equal(parseHomeView('grid'), 'grid');
  assert.equal(parseHomeView('focus'), 'focus');
  assert.equal(parseHomeView('list'), 'list');
  assert.equal(parseHomeView('kacheln'), 'list');
  assert.equal(parseHomeView(null), 'list');
  assert.equal(homeViewKey('acc_1'), 'home.view.acc_1');
});

test('upcomingOf: ohne Vergangenes, der laufende zählt mit, höchstens so viele', () => {
  const upcoming = upcomingOf(DAY, new Date(2026, 8, 22, 15, 30), 2);
  assert.deepEqual(
    upcoming.map((entry) => entry.key),
    ['doctor', 'training'],
  );
  assert.deepEqual(upcomingOf(DAY, new Date(2026, 8, 22, 22, 0), 3), []);
});

test('focusOf: der laufende Termin, sonst der nächste, sonst nichts', () => {
  assert.deepEqual(focusOf(DAY, new Date(2026, 8, 22, 15, 30)), {
    entry: DAY[1],
    running: true,
  });
  assert.deepEqual(focusOf(DAY, new Date(2026, 8, 22, 14, 0)), {
    entry: DAY[1],
    running: false,
  });
  assert.equal(focusOf(DAY, new Date(2026, 8, 22, 22, 0)), null);
});
