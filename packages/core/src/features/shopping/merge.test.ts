import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addQuantities, itemKey, mergeBatch, planAdd } from './merge';

test('Gross/klein, Leerraum und einfache Mehrzahl zählen nicht', () => {
  assert.equal(itemKey('Milch'), itemKey('  milch '));
  assert.equal(itemKey('Bananen'), itemKey('Banane'));
  assert.equal(itemKey('Tomaten'), itemKey('tomate'));
  assert.equal(itemKey('Eier'), itemKey('Ei'));
  assert.equal(itemKey('Rote  Peperoni'), itemKey('rote peperoni'));
  assert.notEqual(itemKey('Milch'), itemKey('Mehl'));
  assert.equal(itemKey('   '), '');
});

test('Mengen wachsen statt neuer Zeilen', () => {
  assert.equal(addQuantities(null, null), '2');
  assert.equal(addQuantities('2', null), '3');
  assert.equal(addQuantities('500 g', '200 g'), '700 g');
  assert.equal(addQuantities('1 kg', '500 g'), '1.5 kg');
  assert.equal(addQuantities('5 dl', '1 l'), '15 dl');
  assert.equal(addQuantities('2 x', '1'), '3 x');
  assert.equal(addQuantities('½ TL', '½ TL'), '1 TL');
});

test('Unpassendes bleibt ehrlich nebeneinander', () => {
  assert.equal(addQuantities('1 Pack', '200 g'), '1 Pack + 200 g');
  assert.equal(addQuantities(null, '500 g'), '1 + 500 g');
});

test('planAdd führt nur mit offenen Zeilen zusammen', () => {
  const rows = [
    { id: 'a', name: 'Milch', quantity: null, done: false },
    { id: 'b', name: 'Brot', quantity: null, done: true },
  ];
  const milk = planAdd(rows, { name: 'milch' });
  assert.equal(milk.kind, 'merge');
  if (milk.kind === 'merge') {
    assert.equal(milk.row.id, 'a');
    assert.equal(milk.quantity, '2');
  }
  assert.equal(planAdd(rows, { name: 'Brot' }).kind, 'new');
  assert.equal(planAdd(rows, { name: 'Käse' }).kind, 'new');
});

test('mergeBatch zieht gleiche Posten eines Auftrags zusammen', () => {
  assert.deepEqual(
    mergeBatch([
      { name: 'Butter', quantity: '50 g' },
      { name: 'Mehl', quantity: '200 g' },
      { name: 'butter', quantity: '30 g' },
      { name: ' ', quantity: null },
    ]),
    [
      { name: 'Butter', quantity: '80 g' },
      { name: 'Mehl', quantity: '200 g' },
    ],
  );
});
