import assert from 'node:assert/strict';
import { test } from 'node:test';

import { canLeave, neighbourStep, setupSteps } from './steps';

test('fragt den Vornamen nur, wenn er fehlt', () => {
  assert.deepEqual(setupSteps(false), ['name', 'assistant', 'style', 'ready']);
  assert.deepEqual(setupSteps(true), ['assistant', 'style', 'ready']);
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
});

test('bleibt beim Wischen innerhalb der Schritte', () => {
  const steps = setupSteps(false);
  assert.equal(neighbourStep(steps, 0, -1), null);
  assert.equal(neighbourStep(steps, 0, 1), 1);
  assert.equal(neighbourStep(steps, 3, 1), null);
  assert.equal(neighbourStep(steps, 3, -1), 2);
});
