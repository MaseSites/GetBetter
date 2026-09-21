import assert from 'node:assert/strict';
import { test } from 'node:test';

import { de } from '../../i18n/de';
import { PLAN_ROW_VALUE, planBenefitsOf, planStateOf } from './planState';

test('planStateOf: ohne Preis kommt es bald, sonst aktiv vor angefragt vor anfragbar', () => {
  assert.equal(planStateOf({ priceChf: null, paid: true, pending: true }), 'soon');
  assert.equal(planStateOf({ priceChf: 1, paid: true, pending: true }), 'active');
  assert.equal(planStateOf({ priceChf: 1, paid: false, pending: true }), 'pending');
  assert.equal(planStateOf({ priceChf: 8, paid: false, pending: false }), 'available');
});

test('planStateOf: gekuendigt gilt nur, solange das Abo noch laeuft', () => {
  assert.equal(planStateOf({ priceChf: 1, paid: true, pending: false, cancelled: true }), 'cancelled');
  // Ist der Stichtag da, zaehlt das Konto nicht mehr als zahlend — dann ist es wieder anfragbar.
  assert.equal(planStateOf({ priceChf: 1, paid: false, pending: false, cancelled: true }), 'available');
  assert.equal(planStateOf({ priceChf: null, paid: true, pending: false, cancelled: true }), 'soon');
});

test('die Zeile „Abo“ hat fuer jeden Stand einen Text', () => {
  for (const key of Object.values(PLAN_ROW_VALUE)) assert.ok(key in de, key);
});

test('planBenefitsOf: eine Liste zum Abhaken, in BetterAi ohne Stimme und Avatar', () => {
  const assistant = planBenefitsOf('getbetter');
  assert.deepEqual(
    assistant.map((benefit) => benefit.title),
    [
      'plan.benefit.ai',
      'plan.benefit.voices',
      'plan.benefit.voicePick',
      'plan.benefit.assistantName',
      'plan.benefit.avatar',
      'plan.benefit.accent',
      'plan.benefit.preset',
      'plan.benefit.backdrop',
      'plan.benefit.everywhere',
      'plan.benefit.cancelAnytime',
    ],
  );
  const chats = planBenefitsOf('betterai');
  assert.equal(chats[0]?.title, 'plan.benefit.aiChat');
  assert.equal(
    chats.some((benefit) => benefit.title.startsWith('plan.benefit.voice')),
    false,
  );
  for (const benefit of [...assistant, ...chats]) {
    assert.ok(benefit.title in de, benefit.title);
    if (benefit.hint) assert.ok(benefit.hint in de, benefit.hint);
  }
  // Nie „unbegrenzt“ versprechen.
  const planTexts = Object.entries(de)
    .filter(([key]) => key.startsWith('plan.'))
    .map(([, text]) => text);
  assert.ok(planTexts.length > 0);
  assert.equal(/unbegrenzt|unlimit/i.test(planTexts.join(' ')), false);
});
