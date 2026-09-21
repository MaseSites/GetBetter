import assert from 'node:assert/strict';
import { test } from 'node:test';

import { canLeave, neighbourStep, setupSteps } from './steps';

test('fragt den Vornamen nur, wenn er fehlt', () => {
  assert.deepEqual(setupSteps(false, false), ['name', 'assistant', 'avatar', 'style', 'ready']);
  assert.deepEqual(setupSteps(true, false), ['assistant', 'avatar', 'style', 'ready']);
});

test('fragt nach der Stimme nur, wenn es welche zu waehlen gibt', () => {
  assert.deepEqual(setupSteps(false, true), [
    'voice',
    'name',
    'assistant',
    'avatar',
    'style',
    'ready',
  ]);
  assert.deepEqual(setupSteps(true, true), ['voice', 'assistant', 'avatar', 'style', 'ready']);
});

test('die Stimme kommt zuerst — er redet von Anfang an', () => {
  assert.equal(setupSteps(false, true)[0], 'voice');
  assert.equal(setupSteps(true, true)[0], 'voice');
});

test('der Avatar kommt gleich nach dem Namen des Assistenten', () => {
  for (const steps of [
    setupSteps(false, false),
    setupSteps(true, false),
    setupSteps(false, true),
    setupSteps(true, true),
  ]) {
    assert.equal(steps.indexOf('avatar'), steps.indexOf('assistant') + 1);
  }
});

test('ohne Abo kurz: Stimme, Name des Assistenten und Avatar fallen weg', () => {
  assert.deepEqual(setupSteps(false, true, false), ['name', 'style', 'ready']);
  assert.deepEqual(setupSteps(true, true, false), ['style', 'ready']);
  assert.deepEqual(setupSteps(true, false, false), ['style', 'ready']);
  // Mit Abo wie bisher.
  assert.deepEqual(setupSteps(true, true, true), setupSteps(true, true));
});

test('Namen brauchen mindestens ein Zeichen, der Rest geht immer weiter', () => {
  const empty = { firstName: '  ', assistantName: '' };
  const filled = { firstName: 'Lea', assistantName: 'Bo' };
  assert.equal(canLeave('name', empty), false);
  assert.equal(canLeave('name', filled), true);
  assert.equal(canLeave('assistant', empty), false);
  assert.equal(canLeave('assistant', filled), true);
  assert.equal(canLeave('style', empty), true);
  assert.equal(canLeave('ready', empty), true);
  // Ohne Wahl gilt die erste passende Stimme — man darf also weiter.
  assert.equal(canLeave('voice', empty), true);
  // Ohne Wahl bleibt der Roboter — auch das ist ein Avatar.
  assert.equal(canLeave('avatar', empty), true);
});

test('bleibt beim Wischen innerhalb der Schritte', () => {
  const steps = setupSteps(false, false);
  const last = steps.length - 1;
  assert.equal(neighbourStep(steps, 0, -1), null);
  assert.equal(neighbourStep(steps, 0, 1), 1);
  assert.equal(neighbourStep(steps, last, 1), null);
  assert.equal(neighbourStep(steps, last, -1), last - 1);
});
