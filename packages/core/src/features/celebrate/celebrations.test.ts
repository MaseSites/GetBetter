import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { CELEBRATION_KINDS, celebrationOf } from './celebrations';

describe('Kleine Feiern', () => {
  // Dass nur bekannte Zeichen vorkommen, prueft schon der Typ (`IconName`).
  test('jede Art hat ein Ding und eins bis drei Kleinigkeiten', () => {
    for (const kind of CELEBRATION_KINDS) {
      const celebration = celebrationOf(kind);
      assert.ok(celebration.carrier.length > 0, kind);
      assert.ok(celebration.items.length >= 1 && celebration.items.length <= 3, kind);
    }
  });

  test('der neue Rekord im Training feiert mit Stern', () => {
    assert.ok(CELEBRATION_KINDS.includes('record'));
    assert.ok(celebrationOf('record').items.includes('starFilled'));
  });
});
