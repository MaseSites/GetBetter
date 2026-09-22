/**
 * Roh gegen gekocht: der stille Fehler, der aus 200 g Reis auf dem Teller
 * 200 g trockenen Reis macht — rund 700 statt 270 kcal.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, test } = require('node:test');

const { cookedVariant, expectsCooking, kindOf, rawGramsOf } = require('./cooking.js');
const { createCatalog } = require('./index.js');
const { nutrientsFor } = require('../nutrition.js');

const per100 = (kcal, proteinG, carbsG, fatG) => ({ kcal, proteinG, carbsG, fatG });
const food = (id, de, en, state, values, category = '') => ({
  id: `swiss:${id}`,
  source: 'swiss',
  names: { de, en },
  synonyms: [],
  category,
  state,
  per100: values,
});

/** Eine Datenbank, die nur rohe und trockene Datensaetze kennt — wie die echte oft auch. */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fit-cooking-'));
fs.writeFileSync(
  path.join(dir, 'fit-catalog-swiss.json'),
  JSON.stringify({
    version: 'test',
    foods: [
      food(1, 'Reis, poliert, roh', 'Rice, polished, raw', 'raw', per100(356, 7, 78, 0.6)),
      food(2, 'Teigwaren ohne Ei, roh', 'Pasta, dry', 'raw', per100(358, 12.5, 70, 1.5)),
      food(
        3,
        'Rind, Gehacktes, roh',
        'Beef, mince, raw',
        'raw',
        per100(215, 18.5, 0, 15.5),
        'Fleisch und Innereien',
      ),
      food(4, 'Karotte, roh', 'Carrot, raw', 'raw', per100(36, 0.9, 7, 0.2)),
      food(5, 'Kartoffel, roh', 'Potato, raw', 'raw', per100(77, 2, 15.6, 0.1)),
    ],
  }),
);
const catalog = createCatalog({ dataDir: dir, mode: 'live' });

describe('Gekocht statt roh', () => {
  test('200 g gekochter Reis sind nie die Naehrwerte von 200 g trockenem Reis', () => {
    const found = catalog.match('Reis', { preparation: 'gekocht' });
    assert.equal(found.food.id, 'cooked:swiss:1');
    assert.equal(found.stateMismatch, false);
    assert.equal(found.uncertain, false);
    const cooked = nutrientsFor(found.food.per100, 200).kcal;
    const dry = nutrientsFor(catalog.find('swiss:1').per100, 200).kcal;
    assert.equal(dry, 712);
    assert.ok(cooked < dry / 2, `gekocht ${cooked} kcal muss deutlich unter ${dry} liegen`);
    // 200 g gekocht ≈ 77 g trocken.
    assert.equal(rawGramsOf(200, 2.6), 77);
  });

  test('ohne Angabe gilt Reis, Teigwaren und Fleisch als gekocht — Foto zeigt keinen Vorrat', () => {
    assert.equal(expectsCooking('Reis'), true);
    assert.equal(expectsCooking('Spaghetti'), true);
    assert.equal(expectsCooking('Rindshackfleisch'), true);
    assert.equal(expectsCooking('Kartoffeln'), true);
    // Fisch nicht: Sushi, Tatar und Rauchlachs liegen roh auf dem Teller.
    assert.equal(expectsCooking('Lachs'), false);
    assert.equal(expectsCooking('Apfel'), false);
  });

  test('Fleisch wird schwerer je 100 g, nicht leichter', () => {
    const raw = catalog.find('swiss:3');
    const cooked = cookedVariant(raw);
    assert.equal(cooked.yieldFactor, 0.72);
    assert.ok(cooked.per100.kcal > raw.per100.kcal);
    // 100 g gebraten kommen aus rund 139 g roh.
    assert.equal(rawGramsOf(100, 0.72), 139);
  });

  test('Kartoffeln und Gemuese bleiben, was sie sind — der Faktor ist kleiner als die Schaetzung', () => {
    assert.equal(kindOf(catalog.find('swiss:4')).factor, 0.9);
    assert.equal(cookedVariant(catalog.find('swiss:4')), null);
    assert.equal(cookedVariant(catalog.find('swiss:5')), null);
    assert.equal(catalog.match('Karotte', { preparation: 'gekocht' }).food.id, 'swiss:4');
  });

  test('Der umgerechnete Datensatz laesst sich aus seiner Id wieder herstellen', () => {
    const again = catalog.find('cooked:swiss:2');
    assert.equal(again.derivedFrom, 'swiss:2');
    assert.equal(again.state, 'cooked');
    assert.equal(again.cookingKind, 'pasta');
    assert.match(again.names.de, /umgerechnet/);
    assert.equal(again.per100.kcal, Math.round(358 / 2.3));
    // Zweimal umrechnen gibt es nicht.
    assert.equal(cookedVariant(again), null);
  });

  test('Gibt es den gekochten Datensatz wirklich, gewinnt er vor der Umrechnung', () => {
    const mock = createCatalog({ dataDir: path.join(dir, 'leer'), mode: 'mock' });
    assert.equal(mock.match('Reis', { preparation: 'gekocht' }).food.id, 'mock:rice_cooked');
    assert.equal(mock.match('Spaghetti', { preparation: 'gekocht' }).food.id, 'mock:pasta_cooked');
  });
});
