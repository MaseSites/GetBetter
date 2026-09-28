import assert from 'node:assert/strict';
import { test } from 'node:test';

import { daysLeftOf, openDueTakes, pickMedTake } from './medSupply';

test('Reichweite: Vorrat durch Einnahmen am Tag, abgerundet', () => {
  assert.equal(daysLeftOf({ stock: 9, slots: ['morning', 'evening'] }), 4);
  assert.equal(daysLeftOf({ stock: 30, slots: ['morning'] }), 30);
  assert.equal(daysLeftOf({ stock: 0, slots: ['morning'] }), 0);
  assert.equal(daysLeftOf({ stock: null, slots: ['morning'] }), null);
  assert.equal(daysLeftOf({ stock: 5, slots: [] }), null);
});

test('offen ist, was dran und nicht abgehakt ist', () => {
  const meds = [
    { id: 'a', slots: ['morning', 'evening'] as const },
    { id: 'b', slots: ['morning', 'noon', 'night'] as const },
  ];
  const takes = [{ medId: 'a', slot: 'morning' as const }];
  assert.deepEqual(openDueTakes(meds, takes, 12), [
    { medId: 'b', slot: 'morning' },
    { medId: 'b', slot: 'noon' },
  ]);
  assert.deepEqual(openDueTakes(meds, takes, 4), []);
  assert.equal(openDueTakes(meds, takes, 22).length, 4);
});

test('welche Einnahme gemeint ist: nach Name, sonst die einzige offene', () => {
  const meds = [
    { id: 'd', name: 'Vitamin D', slots: ['morning'] as const },
    { id: 'm', name: 'Magnesium', slots: ['evening'] as const },
  ];
  // Mittags ist nur Vitamin D dran; Magnesium kommt erst am Abend, ist aber auch offen.
  assert.deepEqual(pickMedTake(meds, [], { med: 'vitamin d', slot: null }, 12), {
    kind: 'take',
    medId: 'd',
    slot: 'morning',
  });
  assert.deepEqual(pickMedTake(meds, [], { med: null, slot: null }, 12), {
    kind: 'take',
    medId: 'd',
    slot: 'morning',
  });
  // Abends sind beide dran und offen: nachfragen statt raten.
  assert.deepEqual(pickMedTake(meds, [], { med: null, slot: null }, 20), {
    kind: 'which',
    names: ['Vitamin D', 'Magnesium'],
  });
  const tookD = [{ medId: 'd', slot: 'morning' as const }];
  assert.deepEqual(pickMedTake(meds, tookD, { med: null, slot: null }, 20), {
    kind: 'take',
    medId: 'm',
    slot: 'evening',
  });
  assert.deepEqual(pickMedTake(meds, tookD, { med: 'Vitamin', slot: null }, 20), {
    kind: 'already',
    medId: 'd',
    slot: 'morning',
  });
  assert.deepEqual(pickMedTake(meds, [], { med: 'Aspirin', slot: null }, 8), { kind: 'none' });
  assert.deepEqual(pickMedTake(meds, [], { med: null, slot: 'evening' }, 8), {
    kind: 'take',
    medId: 'm',
    slot: 'evening',
  });
});
