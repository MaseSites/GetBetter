import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ContactGift } from '../../db/types';
import {
  addGift,
  editGift,
  firstOpenGift,
  giftFrom,
  givenGifts,
  openGifts,
  removeGift,
  setGiven,
} from './gifts';

const gifts: readonly ContactGift[] = [
  { id: 'g1', text: 'Keramikkurs', price: 'CHF 90' },
  { id: 'g2', text: 'Buch', givenYear: 2025 },
  { id: 'g3', text: 'Schal', givenYear: null },
  { id: 'g4', text: 'Konzert', givenYear: 2024 },
];

test('offen ist, was kein Jahr hat', () => {
  assert.deepEqual(
    openGifts(gifts).map((gift) => gift.id),
    ['g1', 'g3'],
  );
  assert.equal(firstOpenGift(gifts)?.text, 'Keramikkurs');
  assert.equal(firstOpenGift([]), null);
  assert.equal(firstOpenGift(undefined), null);
});

test('verschenkt: das juengste Jahr zuerst', () => {
  assert.deepEqual(
    givenGifts(gifts).map((gift) => [gift.givenYear, gift.text]),
    [
      [2025, 'Buch'],
      [2024, 'Konzert'],
    ],
  );
});

test('eine Idee ohne Text gibt es nicht; leere Felder fallen weg', () => {
  assert.equal(giftFrom('x', { text: '   ' }), null);
  assert.deepEqual(giftFrom('x', { text: ' Buch ', url: ' ', price: 'CHF 40 ' }), {
    id: 'x',
    text: 'Buch',
    price: 'CHF 40',
  });
});

test('anhaengen, aendern und loeschen veraendern die alte Liste nicht', () => {
  const added = addGift(gifts, 'g5', { text: 'Blumen', url: 'fleurop.ch' });
  assert.equal(added.length, 5);
  assert.equal(gifts.length, 4);
  assert.deepEqual(added[4], { id: 'g5', text: 'Blumen', url: 'fleurop.ch' });
  assert.equal(addGift(gifts, 'g6', { text: '' }).length, 4);

  const edited = editGift(gifts, 'g2', { text: 'Anderes Buch' });
  assert.deepEqual(edited[1], { id: 'g2', text: 'Anderes Buch', givenYear: 2025 });
  assert.equal(gifts[1]?.text, 'Buch');
  assert.equal(editGift(gifts, 'g2', { text: '' }).length, 3);

  assert.deepEqual(
    removeGift(gifts, 'g1').map((gift) => gift.id),
    ['g2', 'g3', 'g4'],
  );
});

test('abhaken setzt das Jahr, null macht wieder offen', () => {
  const given = setGiven(gifts, 'g1', 2026);
  assert.equal(given[0]?.givenYear, 2026);
  assert.equal(gifts[0]?.givenYear, undefined);
  assert.equal(openGifts(setGiven(given, 'g1', null)).length, 2);
});
