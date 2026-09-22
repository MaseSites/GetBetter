import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  EMPTY_ANSWERS,
  answersToProfile,
  bodyErrors,
  goalsOfAim,
  planRequest,
  profileToAnswers,
  toggleWeekday,
  withTrainingDays,
} from './onboardingPlan';

const filled = {
  ...EMPTY_ANSWERS,
  birthYear: '2009',
  heightCm: '178',
  weightKg: '68,5',
  gym: 'activ',
  equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'bar'],
};

describe('Einrichten in einer Minute', () => {
  test('ein Ziel ergibt Ernaehrung und Training', () => {
    assert.deepEqual(goalsOfAim('lose'), { goal: 'lose', training: 'fatloss' });
    assert.deepEqual(goalsOfAim('muscle'), { goal: 'gain', training: 'muscle' });
    assert.deepEqual(goalsOfAim('fit'), { goal: 'maintain', training: 'fitness' });
  });

  test('Koerperangaben: Jahrgang ab 13, Komma geht', () => {
    assert.deepEqual(bodyErrors(filled, 2026), []);
    assert.deepEqual(
      bodyErrors({ ...filled, birthYear: '2015', heightCm: '90', weightKg: '' }, 2026),
      ['birthYear', 'heightCm', 'weightKg'],
    );
  });

  test('Profil: Jahrgang am 1. Juli, Nichtgefragtes bleibt', () => {
    const profile = answersToProfile(filled, null);
    assert.equal(profile.birthDate, '2009-07-01');
    assert.equal(profile.weightKg, 68.5);
    assert.equal(profile.activity, 'light');
    const previous = {
      ...profile,
      birthDate: '2009-03-14',
      excludedFoods: ['Koriander'],
      pace: 'moderate',
    } as Parameters<typeof answersToProfile>[1];
    const again = answersToProfile(filled, previous);
    assert.equal(again.birthDate, '2009-03-14');
    assert.deepEqual(again.excludedFoods, ['Koriander']);
    assert.equal(again.pace, 'moderate');
  });

  test('Trainingstage: Muster, dann eigene Tage', () => {
    const four = withTrainingDays(filled, 4);
    assert.deepEqual(four.weekdays, [1, 2, 4, 5]);
    const moved = toggleWeekday(toggleWeekday(four, 5), 6);
    assert.deepEqual(moved.weekdays, [1, 2, 4, 6]);
    assert.equal(moved.trainingDays, 4);
  });

  test('Planvorschlag nur mit Training und Ausstattung', () => {
    assert.deepEqual(planRequest(filled), {
      goal: 'fitness',
      experience: 'beginner',
      equipment: filled.equipment,
      gym: 'activ',
      weekdays: [1, 3, 5],
    });
    assert.equal(planRequest(withTrainingDays(filled, 0)), null);
    assert.equal(planRequest({ ...filled, equipment: [] }), null);
  });

  test('bestehendes Profil wieder als Antworten', () => {
    const answers = profileToAnswers(
      answersToProfile({ ...filled, aim: 'muscle', everyday: 'active' }, null) as Parameters<
        typeof profileToAnswers
      >[0],
    );
    assert.equal(answers.aim, 'muscle');
    assert.equal(answers.birthYear, '2009');
    assert.equal(answers.everyday, 'active');
  });
});

describe('Umplanen: nur die letzte Antwort zaehlt', () => {
  test('eine spaete Antwort einer frueheren Anfrage ist veraltet', async () => {
    const { LatestRequest } = await import('./onboardingPlan');
    const latest = new LatestRequest();
    const first = latest.begin();
    const second = latest.begin();
    assert.equal(latest.isLatest(first), false);
    assert.equal(latest.isLatest(second), true);
    assert.equal(latest.show('a'), null);
    assert.equal(latest.show('a'), null);
    assert.equal(latest.show('b'), 'a');
    assert.equal(latest.show(null), 'b');
  });
});
