import assert from 'node:assert/strict';
import { test } from 'node:test';

import { canLeave, neighbourStep, nicknameSuggestion, setupSteps } from './steps';

test('fragt den Vornamen nur, wenn er fehlt', () => {
  assert.deepEqual(setupSteps(false, false), ['name', 'personalize', 'ready']);
  assert.deepEqual(setupSteps(true, false), ['personalize', 'ready']);
});

test('fragt nach der Stimme nur mit Abo und nur, wenn es welche zu waehlen gibt', () => {
  assert.deepEqual(setupSteps(false, true), ['voice', 'name', 'personalize', 'ready']);
  assert.deepEqual(setupSteps(true, true), ['voice', 'personalize', 'ready']);
  // Ohne Abo spricht die beste Stimme — dort gibt es nichts zu waehlen.
  assert.deepEqual(setupSteps(false, true, false), ['name', 'personalize', 'ready']);
});

test('App und Assistent personalisiert man auf einer Seite — auch ohne Abo', () => {
  for (const steps of [
    setupSteps(false, false),
    setupSteps(true, true),
    setupSteps(false, true, false),
    setupSteps(true, false, false),
  ]) {
    assert.equal(steps.filter((step) => step === 'personalize').length, 1);
    assert.equal(steps.at(-1), 'ready');
  }
});

test('Namen brauchen mindestens ein Zeichen, der Rest geht immer weiter', () => {
  const empty = { firstName: '  ', assistantName: '' };
  const filled = { firstName: 'Lea', assistantName: 'Bo' };
  assert.equal(canLeave('name', empty), false);
  assert.equal(canLeave('name', filled), true);
  // Personalisieren ist freiwillig — ohne Namen heisst er eben nicht.
  assert.equal(canLeave('personalize', empty), true);
  assert.equal(canLeave('ready', empty), true);
  // Ohne Wahl gilt die erste passende Stimme — man darf also weiter.
  assert.equal(canLeave('voice', empty), true);
});

test('bleibt beim Wischen innerhalb der Schritte', () => {
  const steps = setupSteps(false, false);
  const last = steps.length - 1;
  assert.equal(neighbourStep(steps, 0, -1), null);
  assert.equal(neighbourStep(steps, 0, 1), 1);
  assert.equal(neighbourStep(steps, last, 1), null);
  assert.equal(neighbourStep(steps, last, -1), last - 1);
});

test('schlaegt den Spitznamen aus dem Benutzernamen vor, sonst aus der E-Mail', () => {
  assert.equal(nicknameSuggestion('matteo.cocetrone', 'x@y.ch'), 'Matteo');
  assert.equal(nicknameSuggestion('anna_meier', ''), 'Anna');
  assert.equal(nicknameSuggestion('lea-99', ''), 'Lea');
  assert.equal(nicknameSuggestion('max2000', ''), 'Max');
  // Zu kurz oder ohne Buchstaben: dann die E-Mail.
  assert.equal(nicknameSuggestion('x1', 'sara.brun@gmx.ch'), 'Sara');
  assert.equal(nicknameSuggestion('123', 'jo@gmx.ch'), 'Jo');
  // Umlaute bleiben, nur der erste Buchstabe wird gross.
  assert.equal(nicknameSuggestion('jürg.meier', ''), 'Jürg');
  // Nichts Brauchbares: kein Vorschlag.
  assert.equal(nicknameSuggestion('', ''), null);
  assert.equal(nicknameSuggestion('42', '7@gmx.ch'), null);
});
