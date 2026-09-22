import assert from 'node:assert/strict';
import { test } from 'node:test';

import { minutesLeftOf, minutesUntilOf, nowIndexOf, progressOf, threadStates } from './threadState';

const at = (hours: number, minutes = 0) => new Date(2026, 8, 22, hours, minutes).toISOString();

const DAY = [
  { at: at(6, 40) }, // Wecker, ohne Ende
  { at: at(15), until: at(17) }, // Arzt
  { at: at(18), until: at(19) }, // Training
  { at: at(20), until: at(21) }, // Essen
];

test('um 15:05 läuft der Arzt: dran, die Linie steht über ihm, das Training ist das Nächste', () => {
  const states = threadStates(DAY, new Date(2026, 8, 22, 15, 5));
  assert.deepEqual(states, ['past', 'live', 'next', 'later']);
  assert.equal(nowIndexOf(states), 1);
});

test('dran erst genau ab Beginn — eine Minute vorher ist er nur der Nächste', () => {
  assert.deepEqual(threadStates(DAY, new Date(2026, 8, 22, 14, 59)), [
    'past',
    'next',
    'later',
    'later',
  ]);
  assert.deepEqual(threadStates(DAY, new Date(2026, 8, 22, 15, 0)), [
    'past',
    'live',
    'next',
    'later',
  ]);
  assert.equal(nowIndexOf(threadStates(DAY, new Date(2026, 8, 22, 14, 59))), 1);
});

test('erst am Ende ist er vorbei — dann rückt die Linie unter ihn', () => {
  const states = threadStates(DAY, new Date(2026, 8, 22, 17, 0));
  assert.deepEqual(states, ['past', 'past', 'next', 'later']);
  assert.equal(nowIndexOf(states), 2);
});

test('ohne Ende ist ein Eintrag mit seinem Zeitpunkt vorbei; am Abend steht die Linie ganz unten', () => {
  assert.deepEqual(threadStates([{ at: at(6, 40) }], new Date(2026, 8, 22, 6, 30)), ['next']);
  const late = threadStates(DAY, new Date(2026, 8, 22, 22, 0));
  assert.deepEqual(late, ['past', 'past', 'past', 'past']);
  assert.equal(nowIndexOf(late), 4);
});

test('progressOf: die Linie wandert von oben (Beginn) nach unten (Ende)', () => {
  const doctor = { at: at(15), until: at(17) };
  assert.equal(progressOf(doctor, new Date(2026, 8, 22, 15, 0)), 0);
  assert.equal(progressOf(doctor, new Date(2026, 8, 22, 15, 30)), 0.25);
  assert.equal(progressOf(doctor, new Date(2026, 8, 22, 16, 30)), 0.75);
  // Vorher, nachher und ohne Ende laeuft nichts.
  assert.equal(progressOf(doctor, new Date(2026, 8, 22, 14, 50)), null);
  assert.equal(progressOf(doctor, new Date(2026, 8, 22, 17, 0)), null);
  assert.equal(progressOf({ at: at(6, 40) }, new Date(2026, 8, 22, 6, 40)), null);
});

test('minutesLeftOf: wie lange er noch geht, aufgerundet', () => {
  const doctor = { at: at(15), until: at(17) };
  assert.equal(minutesLeftOf(doctor, new Date(2026, 8, 22, 15, 5)), 115);
  assert.equal(minutesLeftOf(doctor, new Date(2026, 8, 22, 16, 59, 30)), 1);
  assert.equal(minutesLeftOf(doctor, new Date(2026, 8, 22, 14, 0)), null);
});

test('minutesUntilOf: in wie vielen Minuten er beginnt — nie, wenn er schon laeuft', () => {
  const training = { at: at(18), until: at(19) };
  assert.equal(minutesUntilOf(training, new Date(2026, 8, 22, 15, 5)), 175);
  assert.equal(minutesUntilOf(training, new Date(2026, 8, 22, 17, 59, 30)), 1);
  assert.equal(minutesUntilOf(training, new Date(2026, 8, 22, 18, 0)), null);
  assert.equal(minutesUntilOf(training, new Date(2026, 8, 22, 18, 30)), null);
});
