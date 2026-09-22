import assert from 'node:assert/strict';
import { test } from 'node:test';

import { shortFoodName, shortFoodNames } from './foodLabel';

test('amtliche Namen werden kurz: Kopf vor dem Komma, ohne Klammern', () => {
  assert.equal(shortFoodName('Hühnerei, ganz, roh'), 'Hühnerei');
  assert.equal(shortFoodName('Mehl (Durchschnitt)'), 'Mehl');
  assert.equal(
    shortFoodName('Kichererbse, gekocht (ohne Zugabe von Fett und Salz)'),
    'Kichererbse',
  );
  assert.equal(shortFoodName('Teigwaren ohne Ei, trocken'), 'Teigwaren ohne Ei');
  assert.equal(shortFoodName('Banane'), 'Banane');
});

test('ohne Kopf bleibt der Name, wie er ist', () => {
  assert.equal(shortFoodName('(Durchschnitt)'), '(Durchschnitt)');
  assert.equal(shortFoodName('  Apfel  '), 'Apfel');
});

test('Listen ohne Doppelte, Reihenfolge bleibt', () => {
  assert.deepEqual(
    shortFoodNames(['Poulet, Brust, roh', 'Reis, gekocht', 'Poulet, Schenkel, roh']),
    ['Poulet', 'Reis'],
  );
});
