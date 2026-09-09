import assert from 'node:assert/strict';
import { test } from 'node:test';

import { chatTitleOf, dayKey, monthKey, sleepMinutes } from './pure';

test('schreibt Tag und Monat mit fuehrender Null', () => {
  const date = new Date(2026, 0, 5);
  assert.equal(dayKey(date), '2026-01-05');
  assert.equal(monthKey(date), '2026-01');
});

test('rechnet den Schlaf ueber Mitternacht', () => {
  assert.equal(sleepMinutes({ bedtime: '23:00', wakeTime: '06:30' }), 450);
  assert.equal(sleepMinutes({ bedtime: '00:15', wakeTime: '07:00' }), 405);
  assert.equal(sleepMinutes({ bedtime: '22:00', wakeTime: '22:00' }), 0);
});

test('kuerzt lange Titel und nimmt nur die erste Zeile', () => {
  assert.equal(chatTitleOf('Was koche ich heute?\nBitte vegi.'), 'Was koche ich heute?');
  const long = 'a'.repeat(60);
  assert.equal(chatTitleOf(long).length, 48);
  assert.ok(chatTitleOf(long).endsWith('…'));
});
