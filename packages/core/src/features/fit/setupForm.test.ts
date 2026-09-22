import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { FitProfile } from '../../db/fit';

import {
  EMPTY_DRAFT,
  draftErrors,
  draftToProfile,
  parseDecimal,
  parseSwissDate,
  profileToDraft,
  toggled,
} from './setupForm';

describe('Einrichtung', () => {
  test('Schweizer Datum', () => {
    assert.equal(parseSwissDate('10.5.1994'), '1994-05-10');
    assert.equal(parseSwissDate('31.02.2000'), null);
    assert.equal(parseSwissDate('10.05.94'), null);
  });

  test('Komma oder Punkt', () => {
    assert.equal(parseDecimal('72,5'), 72.5);
    assert.equal(parseDecimal('abc'), null);
  });

  test('fehlende Felder des ersten Schritts', () => {
    assert.deepEqual(draftErrors(EMPTY_DRAFT), ['birthDate', 'heightCm', 'weightKg']);
    assert.deepEqual(
      draftErrors({ ...EMPTY_DRAFT, birthDate: '1.1.1990', heightCm: '175', weightKg: '70' }),
      [],
    );
  });

  test('hin und zurueck', () => {
    const draft = {
      ...EMPTY_DRAFT,
      birthDate: '01.01.1990',
      heightCm: '175',
      weightKg: '70,5',
      excludedFoods: 'Koriander, Rosenkohl',
    };
    const profile = draftToProfile(draft);
    assert.equal(profile.weightKg, 70.5);
    assert.deepEqual(profile.excludedFoods, ['Koriander', 'Rosenkohl']);
    const back = profileToDraft({
      ...profile,
      timezone: 'Europe/Zurich',
      units: 'metric',
    } as FitProfile);
    assert.equal(back.birthDate, '01.01.1990');
    assert.equal(back.excludedFoods, 'Koriander, Rosenkohl');
  });

  test('an- und abhaken', () => {
    assert.deepEqual(toggled(['milk'], 'egg'), ['milk', 'egg']);
    assert.deepEqual(toggled(['milk', 'egg'], 'milk'), ['egg']);
  });
});
