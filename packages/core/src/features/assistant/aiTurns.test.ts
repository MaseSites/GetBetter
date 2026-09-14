import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AI_HISTORY_LIMIT,
  AI_TURN_MAX_CHARS,
  aiFailureKey,
  aiFailureOf,
  aiFailureText,
  turnsFor,
} from './aiTurns';

test('turnsFor: die Frage steht immer zuletzt', () => {
  const turns = turnsFor(
    [
      { role: 'user', text: 'Hallo' },
      { role: 'assistant', text: 'Hi!' },
    ],
    'Wie wird das Wetter?',
  );
  assert.deepEqual(turns, [
    { role: 'user', text: 'Hallo' },
    { role: 'assistant', text: 'Hi!' },
    { role: 'user', text: 'Wie wird das Wetter?' },
  ]);
});

test('turnsFor: Leeres und fremde Rollen fallen weg', () => {
  const turns = turnsFor(
    [
      { role: 'assistant', text: '   ' },
      { role: 'system', text: 'geheim' },
      { role: 'user', text: 'eins' },
    ],
    'zwei',
  );
  assert.deepEqual(
    turns.map((turn) => turn.text),
    ['eins', 'zwei'],
  );
});

test('turnsFor: nur die letzten Züge gehen mit, Überlanges wird gekürzt', () => {
  const history = Array.from({ length: 30 }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    text: `Zug ${index}`,
  }));
  const turns = turnsFor(history, 'x'.repeat(AI_TURN_MAX_CHARS + 50));
  assert.equal(turns.length, AI_HISTORY_LIMIT);
  assert.equal(turns[turns.length - 1]?.role, 'user');
  assert.equal(turns[turns.length - 1]?.text.length, AI_TURN_MAX_CHARS);
});

test('aiFailureKey: ohne eingerichtete KI bleibt der ehrliche Satz', () => {
  assert.equal(aiFailureKey('not_configured'), 'assistant.reply');
  assert.equal(aiFailureKey('unknown_route'), 'assistant.reply');
  assert.equal(aiFailureKey('offline'), 'assistant.ai.offline');
  assert.equal(aiFailureKey('rate_limited'), 'assistant.ai.busy');
  assert.equal(aiFailureKey('timeout'), 'assistant.ai.failed');
  assert.equal(aiFailureKey('auth_failed'), 'assistant.ai.failed');
});

test('aiFailureKey: Kontingent und Abo je nach Plan und Preis', () => {
  const failure = (error: string, plan: 'paid' | 'trial' | null, priceChf: number | null) => ({
    error,
    plan,
    resetsOn: '2026-10-01',
    priceChf,
  });
  assert.equal(aiFailureKey(failure('budget_exhausted', 'paid', 8)), 'assistant.ai.budgetExhausted');
  assert.equal(aiFailureKey(failure('budget_exhausted', 'trial', 8)), 'assistant.ai.trialExhausted');
  // BetterMoney hat noch kein Abo: dann sagt er nur, dass es kommt.
  assert.equal(aiFailureKey(failure('budget_exhausted', 'trial', null)), 'assistant.ai.trialExhaustedSoon');
  assert.equal(aiFailureKey('budget_exhausted'), 'assistant.ai.trialExhaustedSoon');
  assert.equal(aiFailureKey(failure('plan_required', 'trial', 8)), 'assistant.ai.planRequired');
  assert.equal(aiFailureKey('plan_required'), 'assistant.ai.planRequired');
  assert.equal(aiFailureKey('read_only'), 'view.readOnly');
});

test('aiFailureOf liest Plan, Datum und Preis aus der Antwort — Unsinn wird null', () => {
  assert.deepEqual(
    aiFailureOf({ error: 'budget_exhausted', details: { error: 'budget_exhausted', plan: 'trial', resetsOn: '2026-10-01', priceChf: 8 } }),
    { error: 'budget_exhausted', plan: 'trial', resetsOn: '2026-10-01', priceChf: 8 },
  );
  assert.deepEqual(aiFailureOf({ error: 'offline' }), { error: 'offline', plan: null, resetsOn: null, priceChf: null });
  assert.deepEqual(
    aiFailureOf({ error: 'x', details: { plan: 'gold', resetsOn: 'morgen', priceChf: '8' } }),
    { error: 'x', plan: null, resetsOn: null, priceChf: null },
  );
});

test('aiFailureText setzt Datum und Preis in der Sprache ein', () => {
  // Intl setzt schmale und geschuetzte Leerzeichen — fuer den Vergleich zaehlt nur, dass eines da ist.
  const t = (key: string, values?: Record<string, string | number>) =>
    `${key}|${values?.date}|${values?.price}`.replace(/\s/g, ' ');
  const paid = aiFailureText(t, 'de', { error: 'budget_exhausted', plan: 'paid', resetsOn: '2026-10-01', priceChf: 8 });
  assert.equal(paid, 'assistant.ai.budgetExhausted|1. Oktober|CHF 8');
  const trial = aiFailureText(t, 'fr', { error: 'budget_exhausted', plan: 'trial', resetsOn: null, priceChf: 4.5 }, new Date(2026, 11, 20));
  assert.match(trial, /^assistant\.ai\.trialExhausted\|1(er)? janvier\|/);
  assert.match(trial, /4[.,]50/);
});
