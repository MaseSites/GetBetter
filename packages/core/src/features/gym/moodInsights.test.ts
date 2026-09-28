import assert from 'node:assert/strict';
import { test } from 'node:test';

import { moodInsightsOf } from './moodInsights';

const days = (count: number, from = 1) =>
  Array.from({ length: count }, (_, index) => `2026-09-${String(from + index).padStart(2, '0')}`);

test('Training: zehn Tage, fuenf mit und fuenf ohne', () => {
  const all = days(10);
  const moods = all.map((day, index) => ({ day, mood: index < 5 ? 4 : 3 }));
  const workouts = all.slice(0, 5).map((day) => ({ day }));
  assert.deepEqual(moodInsightsOf(moods, [], workouts, []), [
    { factor: 'workout', withMood: 4, withoutMood: 3, withDays: 5, withoutDays: 5 },
  ]);
});

test('zu wenig Tage auf einer Seite: kein Satz', () => {
  const all = days(9);
  const moods = all.map((day, index) => ({ day, mood: index < 4 ? 5 : 2 }));
  const workouts = all.slice(0, 4).map((day) => ({ day }));
  assert.deepEqual(moodInsightsOf(moods, [], workouts, []), []);
});

test('kleiner Unterschied: kein Satz', () => {
  const all = days(10);
  const moods = all.map((day, index) => ({ day, mood: index % 2 === 0 ? 4 : 3 }));
  const workouts = all.slice(0, 5).map((day) => ({ day }));
  // mit: 4,3,4,3,4 = 3.6; ohne: 3,4,3,4,3 = 3.4
  assert.deepEqual(moodInsightsOf(moods, [], workouts, []), []);
});

test('Schlaf zaehlt nur Tage mit eingetragener Nacht', () => {
  const all = days(12);
  const moods = all.map((day, index) => ({ day, mood: index < 5 ? 4 : 2 }));
  const sleeps = all.slice(0, 10).map((day, index) => ({
    day,
    bedtime: '23:00',
    wakeTime: index < 5 ? '07:00' : '05:00',
  }));
  const [insight] = moodInsightsOf(moods, sleeps, [], []);
  assert.equal(insight?.factor, 'sleep');
  assert.equal(insight?.withDays, 5);
  assert.equal(insight?.withoutDays, 5);
});

test('Trinken summiert je Tag; ohne Eintrag weiss man nichts', () => {
  const all = days(10);
  const moods = [...all, ...days(5, 20)].map((day, index) => ({ day, mood: index < 5 ? 2 : 4 }));
  const drinks = all.flatMap((day, index) =>
    index < 5 ? [{ day, amountDl: 5 }] : [{ day, amountDl: 10 }, { day, amountDl: 10 }],
  );
  const [insight] = moodInsightsOf(moods, [], [], drinks);
  assert.deepEqual(insight, {
    factor: 'water',
    withMood: 4,
    withoutMood: 2,
    withDays: 5,
    withoutDays: 5,
  });
});

test('der groesste Unterschied steht zuerst', () => {
  const all = days(10);
  const moods = all.map((day, index) => ({ day, mood: index < 5 ? 5 : 2 }));
  const workouts = all.slice(0, 5).map((day) => ({ day }));
  const sleeps = all.map((day, index) => ({
    day,
    bedtime: '23:00',
    // gut geschlafen: 5,5,5,5,2 = 4.4 gegen 5,2,2,2,2 = 2.6
    wakeTime: index < 4 || index === 5 ? '07:00' : '05:00',
  }));
  const factors = moodInsightsOf(moods, sleeps, workouts, []).map((entry) => entry.factor);
  assert.deepEqual(factors, ['workout', 'sleep']);
});
