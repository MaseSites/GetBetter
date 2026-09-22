const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { withSynonyms, familyOf, indexPriors, priorFor, shareVector, weightedJaccard, indexDishes, similarDishes } = require('./match.js');

/** Ein Prior wie ihn `buildPriors` schreibt; nur `n` und `median` zaehlen hier. */
const prior = (n, median) => ({ n, p10: median / 2, p25: median * 0.8, median, p75: median * 1.2, p90: median * 2 });

const PRIORS = {
  'white rice': prior(40, 120),
  'brown rice': prior(12, 100),
  'fried rice': prior(6, 180),
  'chicken breast': prior(20, 90),
  'grilled chicken': prior(15, 80),
  chicken: prior(30, 85),
  broccoli: prior(50, 60),
  spinach: prior(9, 40),
  'spinach raw': prior(7, 35),
  'olive oil': prior(80, 4),
  'mixed green': prior(25, 30),
  truffle: prior(2, 5),
};

const INDEX = indexPriors(PRIORS);
const find = (term) => priorFor(PRIORS, INDEX, term);

describe('Zutaten-Priors', () => {
  test('genauer Treffer mit allen Quantilen', () => {
    const found = find('White Rice');
    assert.deepEqual(found, { key: 'white rice', match: 'exact', n: 40, p10: 60, p25: 96, median: 120, p75: 144, p90: 240 });
  });

  test('Mehrzahl und Zubereitung stoeren nicht', () => {
    assert.equal(find('Grilled Chicken Breasts').key, 'chicken breast');
    assert.equal(find('Grilled Chicken Breasts').match, 'tokens');
    assert.equal(find('steamed broccoli').key, 'broccoli');
  });

  test('neutrale Zusaetze am Schluessel („spinach raw“ fuer „spinach“)', () => {
    const found = find('spinach');
    assert.equal(found.key, 'spinach');
    assert.equal(found.match, 'exact');
    assert.equal(find('fresh spinach').key, 'spinach');
  });

  test('sonst das letzte Inhaltswort: „jasmine rice“ findet den haeufigsten Reis', () => {
    const found = find('jasmine rice');
    assert.equal(found.key, 'white rice');
    assert.equal(found.match, 'head');
  });

  test('Synonyme: salad greens, prawns, penne, extra virgin olive oil', () => {
    assert.equal(withSynonyms('salad green'), 'mixed green');
    assert.equal(find('salad greens').key, 'mixed green');
    assert.equal(find('extra virgin olive oil').key, 'olive oil');
  });

  test('zu duenne Priors gewinnen nie ueber einen Umweg', () => {
    assert.equal(find('black truffle'), null, 'n = 2 liegt unter MIN_N');
    assert.equal(find('truffle').key, 'truffle', 'genau gefragt gilt er trotzdem');
  });

  test('nichts Passendes und leere Eingaben geben null', () => {
    assert.equal(find('unobtainium'), null);
    assert.equal(find(''), null);
    assert.equal(priorFor({}, indexPriors({}), 'rice'), null);
  });

  test('Familie eines Schluessels ist sein letztes Inhaltswort', () => {
    assert.equal(familyOf('white rice'), 'rice');
    assert.equal(familyOf('grilled chicken'), 'chicken');
  });
});

describe('Anteile', () => {
  test('Anteile summieren sich zu 1, doppelte Schluessel zusammengezaehlt', () => {
    const shares = shareVector([['rice', 100], ['chicken', 50], ['rice', 50]]);
    assert.equal(shares.get('rice'), 0.75);
    assert.equal(shares.get('chicken'), 0.25);
    assert.equal(shareVector([['rice', 0]]).size, 0);
  });

  test('gewichteter Jaccard: gleich ist 1, fremd ist 0', () => {
    const a = shareVector([['rice', 1], ['chicken', 1]]);
    assert.equal(weightedJaccard(a, a), 1);
    assert.equal(weightedJaccard(a, shareVector([['apple', 1]])), 0);
    assert.equal(weightedJaccard(a, shareVector([['rice', 1]])).toFixed(3), '0.333', 'halb so viel gemeinsam');
  });
});

const DISHES = [
  { id: 'dish_a', split: 'train', mass: 300, kcal: 400, ingredients: [{ name: 'white rice', grams: 150 }, { name: 'chicken breast', grams: 120 }, { name: 'broccoli', grams: 30 }] },
  { id: 'dish_b', split: 'train', mass: 200, kcal: 180, ingredients: [{ name: 'broccoli', grams: 100 }, { name: 'olive oil', grams: 5 }] },
  { id: 'dish_c', split: 'train', mass: 250, kcal: 300, ingredients: [{ name: 'brown rice', grams: 140 }, { name: 'grilled chicken', grams: 110 }] },
  { id: 'dish_test', split: 'test', mass: 300, kcal: 400, ingredients: [{ name: 'white rice', grams: 150 }, { name: 'chicken breast', grams: 120 }, { name: 'broccoli', grams: 30 }] },
];

const DISH_INDEX = indexDishes(DISHES);
const similar = (foods, k) => similarDishes(PRIORS, INDEX, DISH_INDEX, foods, k);

describe('Aehnliche Gerichte', () => {
  test('nur train — das gleiche Gericht aus dem Test bleibt draussen', () => {
    const found = similar([{ term: 'white rice', grams: 150 }, { term: 'chicken breast', grams: 120 }, { term: 'broccoli', grams: 30 }], 3);
    assert.equal(found[0].id, 'dish_a');
    assert.equal(found[0].score, 1);
    assert.ok(!found.some((dish) => dish.id === 'dish_test'));
  });

  test('gibt Masse, Kalorien und Zutaten mit', () => {
    const [first] = similar([{ term: 'broccoli', grams: 100 }, { term: 'olive oil', grams: 5 }], 1);
    assert.equal(first.id, 'dish_b');
    assert.deepEqual([first.mass, first.kcal], [200, 180]);
    assert.deepEqual(first.ingredients.map((ingredient) => ingredient.name), ['broccoli', 'olive oil']);
  });

  test('die Familie zaehlt mit: „jasmine rice“ und „roast chicken“ finden dish_c', () => {
    const found = similar([{ term: 'brown rice', grams: 140 }, { term: 'roast chicken', grams: 110 }], 3);
    assert.equal(found[0].id, 'dish_c');
    assert.ok(found[0].score > found[1].score);
  });

  test('verglichen wird die Zusammensetzung, nicht die Menge', () => {
    const half = similar([{ term: 'white rice', grams: 75 }, { term: 'chicken breast', grams: 60 }, { term: 'broccoli', grams: 15 }], 1);
    assert.equal(half[0].id, 'dish_a');
    assert.equal(half[0].score, 1);
  });

  test('ohne Gramm zaehlt der Median des Priors', () => {
    assert.equal(similar([{ term: 'broccoli' }, { term: 'olive oil' }], 1)[0].id, 'dish_b');
    assert.equal(similar(['broccoli', 'olive oil'], 1)[0].id, 'dish_b', 'blosse Texte gehen auch');
  });

  test('leere Eingabe, k = 0 und ein leerer Stand geben []', () => {
    assert.deepEqual(similar([], 3), []);
    assert.deepEqual(similar([{ term: 'white rice' }], 0), []);
    assert.deepEqual(similar([{ term: 'unobtainium' }], 3), []);
    assert.deepEqual(similarDishes({}, indexPriors({}), indexDishes([]), [{ term: 'rice' }], 3), []);
  });
});
