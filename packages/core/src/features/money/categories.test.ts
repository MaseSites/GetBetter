import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EXPENSE_CATEGORIES, guessExpenseCategory } from './categories';

const cases: readonly (readonly [string, string | null])[] = [
  // Was der Assistent schon kannte
  ['Pizza', 'food'],
  ['Den Bus', 'transport'],
  ['Miete Oktober', 'home'],
  ['Kino mit Anna', 'fun'],
  ['Zahnarzt', 'health'],
  // Schweizer Namen
  ['Migros', 'food'],
  ['coop pronto', 'food'],
  ['Denner Wein', 'food'],
  ['Lidl', 'food'],
  ['ALDI', 'food'],
  ['Volg Dorfladen', 'food'],
  ['SBB Billett', 'transport'],
  ['Halbtax', 'transport'],
  ['GA Verlängerung', 'transport'],
  ['ZVV Monatsabo', 'transport'],
  ['Swisscom', 'home'],
  ['Salt Handy', 'home'],
  ['Sunrise Internet', 'home'],
  ['Galaxus Bestellung', 'home'],
  ['Helsana Prämie', 'health'],
  ['CSS', 'health'],
  ['Swica', 'health'],
  ['Krankenkasse', 'health'],
  ['Netflix', 'fun'],
  ['Spotify Family', 'fun'],
  ['Disney+', 'fun'],
  ['Uber Eats', 'food'],
  ['Uber in Genf', 'transport'],
  // Keine Regel: nichts raten
  ['Geschenk für Mami', null],
  ['', null],
];

for (const [text, expected] of cases) {
  test(`„${text}“ → ${expected ?? 'nichts'}`, () => {
    assert.equal(guessExpenseCategory(text), expected);
  });
}

test('nur an Wortgrenzen: ein Wort im Wort zaehlt nicht', () => {
  // "ga" steckt in "Garten", "bus" in "Busse", "spar" in "sparen"
  assert.equal(guessExpenseCategory('Garten'), null);
  assert.equal(guessExpenseCategory('Busse'), null);
  assert.equal(guessExpenseCategory('sparen'), null);
  assert.equal(guessExpenseCategory('Bargeld'), null);
});

test('die erste Regel gewinnt: Kaffee im Zug ist Essen', () => {
  assert.equal(guessExpenseCategory('Kaffee im Zug'), 'food');
});

test('jede geratene Kategorie steht in der Liste', () => {
  for (const [, expected] of cases) {
    if (expected) assert.ok((EXPENSE_CATEGORIES as readonly string[]).includes(expected));
  }
});
