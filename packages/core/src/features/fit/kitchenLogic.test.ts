import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { amountOf, mergeFamilyItems, planFamilyUpdate } from './familyPlan';
import {
  addDays,
  clockOf,
  expiryOf,
  minutesIn,
  parseManualItem,
  scaleAmount,
  scaleCoverage,
  shortfallGrams,
  splitPantry,
} from './kitchenLogic';

const TODAY = '2026-09-22';

describe('Ablaufdaten', () => {
  test('abgelaufen, bald (bis 3 Tage), sonst nichts', () => {
    assert.equal(expiryOf('2026-09-21', TODAY), 'expired');
    assert.equal(expiryOf(TODAY, TODAY), 'soon');
    assert.equal(expiryOf(addDays(TODAY, 3), TODAY), 'soon');
    assert.equal(expiryOf(addDays(TODAY, 4), TODAY), null);
    assert.equal(expiryOf(null, TODAY), null);
  });

  test('bald Ablaufendes oben, nach Datum', () => {
    const items = [
      { id: 'a', bestBefore: null },
      { id: 'b', bestBefore: '2026-09-24' },
      { id: 'c', bestBefore: '2026-09-20' },
      { id: 'd', bestBefore: '2026-12-01' },
    ];
    const { soon, rest } = splitPantry(items, TODAY);
    assert.deepEqual(
      soon.map((item) => item.id),
      ['c', 'b'],
    );
    assert.deepEqual(
      rest.map((item) => item.id),
      ['a', 'd'],
    );
  });
});

describe('Handposten', () => {
  test('„2 Bananen“, „500 g Mehl“, „3 dl Rahm“, ohne Zahl', () => {
    assert.deepEqual(parseManualItem('2 Bananen'), {
      name: 'Bananen',
      amount: 2,
      unit: 'piece',
      category: 'produce',
    });
    assert.deepEqual(parseManualItem('500 g Mehl'), {
      name: 'Mehl',
      amount: 500,
      unit: 'g',
      category: 'pantry',
    });
    assert.deepEqual(parseManualItem('3 dl Rahm'), {
      name: 'Rahm',
      amount: 300,
      unit: 'ml',
      category: 'dairy',
    });
    assert.equal(parseManualItem('Servietten').amount, 1);
  });
});

describe('Portionen', () => {
  test('Stueck in Vierteln, Gramm ganz', () => {
    assert.equal(scaleAmount(3, 1.5, 'piece'), 4.5);
    assert.equal(scaleAmount(1, 0.3, 'piece'), 0.25);
    assert.equal(scaleAmount(250, 1.5, 'g'), 375);
    assert.equal(scaleAmount(1, 1.5, 'tbsp'), 1.5);
  });

  test('Vorrat reicht fuer 2, nicht fuer 4', () => {
    const line = { needed: 200, have: 250, status: 'have' as const };
    assert.equal(scaleCoverage(line, 1).status, 'have');
    const double = scaleCoverage(line, 2);
    assert.equal(double.status, 'short');
    assert.equal(shortfallGrams(double), 150);
    assert.equal(
      shortfallGrams(scaleCoverage({ needed: 100, have: 0, status: 'missing' }, 1)),
      100,
    );
  });
});

describe('Kochmodus', () => {
  test('Minuten im Schritt, in vier Sprachen', () => {
    assert.equal(minutesIn('Unter Rühren 4 Minuten köcheln lassen.'), 4);
    assert.equal(minutesIn('In die Form füllen und 50–55 Minuten backen.'), 50);
    assert.equal(minutesIn('Laisse mijoter 20 minutes.'), 20);
    assert.equal(minutesIn('Cuoci per 25 minuti.'), 25);
    assert.equal(minutesIn('Bake for 12 min.'), 12);
    assert.equal(minutesIn('Backofen auf 180 °C vorheizen.'), null);
  });

  test('Uhr m:ss', () => {
    assert.equal(clockOf(125), '2:05');
    assert.equal(clockOf(0), '0:00');
  });
});

describe('BetterFamily: kein Doppeltes', () => {
  const unit = (value: string) => ({ g: 'g', piece: 'Stk.' })[value] ?? value;

  test('gleiche Namen im Auftrag werden eine Zeile, Mengen zusammen', () => {
    const merged = mergeFamilyItems([
      { name: 'Mehl', amount: 200, unit: 'g' },
      { name: 'mehl ', amount: 100, unit: 'g' },
      { name: 'Eier', amount: 2, unit: 'piece' },
    ]);
    assert.deepEqual(merged, [
      { name: 'Mehl', amount: 300, unit: 'g' },
      { name: 'Eier', amount: 2, unit: 'piece' },
    ]);
  });

  test('schon offen: genug bleibt, zu wenig wird angehoben, nie aufaddiert', () => {
    const open = [
      { id: '1', name: 'Mehl', quantity: '500 g' },
      { id: '2', name: 'Eier', quantity: '2 Stk.' },
      { id: '3', name: 'Salz', quantity: null },
    ];
    const plan = planFamilyUpdate(
      open,
      [
        { name: 'Mehl', amount: 300, unit: 'g' },
        { name: 'Eier', amount: 6, unit: 'piece' },
        { name: 'Salz', amount: 1, unit: 'g' },
        { name: 'Milch', amount: 500, unit: 'ml' },
      ],
      unit,
    );
    assert.deepEqual(
      plan.add.map((item) => item.name),
      ['Milch'],
    );
    assert.deepEqual(
      plan.raise.map((entry) => [entry.row.id, entry.item.amount]),
      [['2', 6]],
    );
    assert.equal(plan.skipped, 2);
  });

  test('Mengen mit Tausendertrenner lesen', () => {
    assert.equal(amountOf('1’200 g', 'g'), 1200);
    assert.equal(amountOf('1,5 kg', 'kg'), 1.5);
    assert.equal(amountOf('2 Stk.', 'g'), null);
  });
});
