const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, test } = require('node:test');

const { createReference, createReferenceFrom } = require('./index.js');

/** Ein winziger Stand in der Form von `reference.json`. */
const DATA = {
  version: 1,
  builtAt: '2026-09-22T14:42:35.845Z',
  sources: [{ id: 'nutrition5k', name: 'Nutrition5k', attribution: 'Google Research', license: 'CC BY 4.0' }],
  nutrition5k: {
    dishes: [
      { id: 'dish_a', split: 'train', image: true, mass: 300, kcal: 400, ingredients: [{ name: 'white rice', grams: 150 }, { name: 'chicken breast', grams: 120 }] },
      { id: 'dish_b', split: 'train', image: false, mass: 200, kcal: 180, ingredients: [{ name: 'broccoli', grams: 200 }] },
      { id: 'dish_c', split: 'test', image: true, mass: 250, kcal: 300, ingredients: [{ name: 'white rice', grams: 250 }] },
    ],
  },
  ingredientPriors: {
    'white rice': { n: 40, p10: 60, p25: 96, median: 120, p75: 144, p90: 240 },
    'chicken breast': { n: 20, p10: 45, p25: 72, median: 90, p75: 108, p90: 180 },
    broccoli: { n: 50, p10: 30, p25: 48, median: 60, p75: 72, p90: 120 },
  },
  fndds: { foods: [{ code: 58130011, description: 'Lasagna with meat', category: 'Pasta mixed dishes', portions: [{ desc: '1 piece', grams: 206 }] }] },
  menuch: {
    categories: [{ name: 'Reis', nameEn: 'Rice', group: 'Getreide', perMeal: { breakfast: { mean: 0, median: 0, n: 0 }, lunch: { mean: 128, median: 112, n: 376 }, dinner: { mean: 146, median: 112, n: 294 }, snack: { mean: 0, median: 0, n: 0 } } }],
  },
};

const withData = (data) => createReferenceFrom(() => data);

describe('Referenzwissen', () => {
  test('priorFor gibt Schluessel, Anzahl und Quantile', () => {
    const reference = withData(DATA);
    assert.deepEqual(reference.priorFor('Grilled Chicken Breast'), { key: 'chicken breast', match: 'tokens', n: 20, p10: 45, p25: 72, median: 90, p75: 108, p90: 180 });
    assert.equal(reference.priorFor('Kaugummi'), null);
    assert.equal(reference.priorFor(''), null);
    assert.equal(reference.priorFor(null), null);
  });

  test('similarDishes nur ueber train, hoechstens k', () => {
    const reference = withData(DATA);
    const found = reference.similarDishes([{ term: 'white rice', grams: 150 }, { term: 'chicken breast', grams: 120 }]);
    assert.equal(found.length, 1, 'dish_c ist Test, dish_b hat nichts gemeinsam');
    assert.deepEqual([found[0].id, found[0].score, found[0].mass, found[0].kcal], ['dish_a', 1, 300, 400]);
    assert.equal(reference.similarDishes([{ term: 'broccoli' }], 3)[0].id, 'dish_b');
    assert.deepEqual(reference.similarDishes([]), []);
  });

  test('portionHint und fnddsPortions', () => {
    const reference = withData(DATA);
    assert.equal(reference.portionHint('lunch', 'Reis').median, 112);
    assert.equal(reference.portionHint('znacht', 'Risotto').slot, 'dinner');
    assert.equal(reference.portionHint('lunch', 'Kaugummi'), null);
    assert.equal(reference.portionHint('lunch', ''), null);
    assert.deepEqual(reference.fnddsPortions('lasagna'), [{ code: 58130011, description: 'Lasagna with meat', category: 'Pasta mixed dishes', portions: [{ desc: '1 piece', grams: 206 }] }]);
    assert.deepEqual(reference.fnddsPortions(''), []);
  });

  test('referenceStats zaehlt Gerichte, Splits und Quellen', () => {
    const stats = withData(DATA).referenceStats();
    assert.equal(stats.available, true);
    assert.deepEqual([stats.dishes, stats.train, stats.test, stats.withImage], [3, 2, 1, 2]);
    assert.deepEqual([stats.priors, stats.fnddsFoods, stats.menuchCategories], [3, 1, 1]);
    assert.equal(stats.builtAt, '2026-09-22T14:42:35.845Z');
    assert.deepEqual(stats.sources, [{ id: 'nutrition5k', attribution: 'Google Research', license: 'CC BY 4.0' }]);
  });
});

describe('Laden', () => {
  test('erst beim ersten Aufruf, und nur einmal', () => {
    let loads = 0;
    const reference = createReferenceFrom(() => {
      loads += 1;
      return DATA;
    });
    assert.equal(loads, 0, 'das Bauen laedt noch nichts');
    reference.priorFor('broccoli');
    reference.similarDishes([{ term: 'broccoli' }]);
    reference.referenceStats();
    assert.equal(loads, 1);
  });

  test('ohne Datei, mit kaputtem Inhalt und mit Fehler: leere Antworten, kein Wurf', () => {
    const broken = [
      createReference({ dataDir: path.join(os.tmpdir(), 'better-fit-gibt-es-nicht') }),
      withData(null),
      withData({ nutrition5k: 'kaputt', ingredientPriors: 7, fndds: null }),
      createReferenceFrom(() => {
        throw new Error('kaputt');
      }),
    ];
    for (const reference of broken) {
      assert.equal(reference.priorFor('white rice'), null);
      assert.deepEqual(reference.similarDishes([{ term: 'white rice' }]), []);
      assert.equal(reference.portionHint('lunch', 'Reis'), null);
      assert.deepEqual(reference.fnddsPortions('lasagna'), []);
      const stats = reference.referenceStats();
      assert.equal(stats.available, false);
      assert.deepEqual([stats.dishes, stats.priors, stats.fnddsFoods, stats.menuchCategories], [0, 0, 0, 0]);
    }
  });

  test('aus `<dataDir>/fit-reference/reference.json`', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'better-fit-reference-'));
    try {
      fs.mkdirSync(path.join(dir, 'fit-reference'));
      fs.writeFileSync(path.join(dir, 'fit-reference', 'reference.json'), JSON.stringify(DATA));
      assert.equal(createReference({ dataDir: dir }).priorFor('white rice').median, 120);
      assert.equal(createReference({ file: path.join(dir, 'fit-reference', 'reference.json') }).referenceStats().dishes, 3);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('kaputtes JSON auf der Platte wirft nicht', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'better-fit-reference-'));
    try {
      fs.mkdirSync(path.join(dir, 'fit-reference'));
      fs.writeFileSync(path.join(dir, 'fit-reference', 'reference.json'), '{ nicht wirklich JSON');
      assert.equal(createReference({ dataDir: dir }).referenceStats().available, false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
