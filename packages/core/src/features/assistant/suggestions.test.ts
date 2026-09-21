import assert from 'node:assert/strict';
import { test } from 'node:test';

import { de } from '../../i18n/de';
import { SUGGESTION_COUNT, poolFor, suggestionsFor } from './suggestions';

test('poolFor: die laufende App zuerst, dann die besuchten — Unbekanntes faellt weg', () => {
  const alone = poolFor('getbetter', []);
  assert.ok(alone.length > 0);
  assert.equal(alone.includes('assistant.chip.shopping'), false);

  const withFamily = poolFor('getbetter', ['betterfamily', 'getbetter', 'bettergarten']);
  assert.ok(withFamily.includes('assistant.chip.shopping'));
  assert.ok(withFamily.includes('assistant.chip.plan'));
  // Die laufende App steht nur einmal drin.
  assert.equal(new Set(withFamily).size, withFamily.length);
});

test('suggestionsFor: drei verschiedene, derselbe Startwert gibt dieselben', () => {
  const args = { current: 'getbetter', seen: ['betterfamily', 'bettergym'] } as const;
  const first = suggestionsFor({ ...args, seed: 0.42 });
  assert.equal(first.length, SUGGESTION_COUNT);
  assert.equal(new Set(first).size, first.length);
  assert.deepEqual(suggestionsFor({ ...args, seed: 0.42 }), first);
});

test('suggestionsFor: andere Startwerte geben meistens andere Beispiele', () => {
  const args = { current: 'getbetter', seen: ['betterfamily', 'bettergym', 'bettermoney'] } as const;
  const seen = new Set<string>();
  for (const seed of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]) {
    seen.add(suggestionsFor({ ...args, seed }).join('|'));
  }
  assert.ok(seen.size > 1, 'immer dieselbe Auswahl');
});

test('suggestionsFor: nie mehr, als der Vorrat hergibt, und jedes Beispiel hat einen Text', () => {
  const small = suggestionsFor({ current: 'bettermoney', seen: [], seed: 0.7, count: 9 });
  assert.equal(small.length, poolFor('bettermoney', []).length);
  for (const key of poolFor('getbetter', ['betterfamily', 'bettergym', 'betterai', 'bettermoney'])) {
    assert.ok(key in de, key);
  }
});
