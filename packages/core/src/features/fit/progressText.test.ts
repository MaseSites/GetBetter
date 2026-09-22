import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { paceOf, plannedKgPerWeek, shortExerciseName, shortExerciseNames } from './progressText';

describe('paceOf', () => {
  test('ohne Profil kein Plan', () => {
    assert.equal(paceOf(-0.4, plannedKgPerWeek(null)), 'none');
  });
  test('abnehmen: im Plan, schneller, langsamer', () => {
    const planned = plannedKgPerWeek({ goal: 'lose', pace: 'moderate' });
    assert.equal(planned, -0.5);
    assert.equal(paceOf(-0.45, planned), 'onTrack');
    assert.equal(paceOf(-0.8, planned), 'faster');
    assert.equal(paceOf(-0.1, planned), 'slower');
  });
  test('zunehmen andersherum', () => {
    const planned = plannedKgPerWeek({ goal: 'gain', pace: 'moderate' });
    assert.equal(paceOf(0.6, planned), 'faster');
    assert.equal(paceOf(0, planned), 'slower');
  });
  test('halten: nur im Plan oder daneben', () => {
    const planned = plannedKgPerWeek({ goal: 'maintain', pace: 'gentle' });
    assert.equal(paceOf(0.1, planned), 'onTrack');
    assert.equal(paceOf(-0.4, planned), 'off');
  });
});

describe('shortExerciseName', () => {
  test('ohne Geraet', () => {
    assert.equal(shortExerciseName('Kniebeuge mit Langhantel'), 'Kniebeuge');
    assert.equal(shortExerciseName('Latzug am Kabel'), 'Latzug');
    assert.equal(shortExerciseName('Kreuzheben'), 'Kreuzheben');
    assert.equal(shortExerciseName('Bankdrücken (Langhantel)'), 'Bankdrücken');
  });
  test('bleibt lang, wenn es sonst doppelt waere', () => {
    assert.deepEqual(shortExerciseNames(['Rudern mit Kurzhantel', 'Rudern am Kabel', 'Dips']), [
      'Rudern mit Kurzhantel',
      'Rudern am Kabel',
      'Dips',
    ]);
  });
});
