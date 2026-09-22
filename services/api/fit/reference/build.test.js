const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { singular, keyOf, quantile } = require('./normalize.js');
const { parseDishLine, buildDishes, buildPriors, buildFndds, buildMenuch } = require('./build.js');

const CSV = [
  'dish_1,300,200,10,30,20,ingr_1,white rice,100,130,0.3,28,2.7,ingr_2,chicken,80,150,3,0,28,ingr_3,olive oil,2,17.7,2,0,0',
  'dish_2,200,150,5,20,10,ingr_1,white rice,60,78,0.2,17,1.6,ingr_4,Broccoli,90,31,0.3,6,2.5',
  'dish_3,100,0,1,1,1,ingr_1,white rice,0,0,0,0,0',
  'dish_4,5000,900,1,1,1,ingr_1,white rice,900,5000,0,0,0',
  'dish_5,500,40,1,1,1,ingr_5,butter,40,500,40,0,0',
  'dish_6,150,120,2,25,5,ingr_1,white rice,120,156,0.3,34,3.2',
  'dish_7,90,80,1,10,2,ingr_6,onions,40,16,0,4,0.4,ingr_6,onions,40,16,0,4,0.4',
].join('\n');

describe('Namen', () => {
  test('Einzahl ohne Wortliste von aussen', () => {
    assert.equal(singular('onions'), 'onion');
    assert.equal(singular('potatoes'), 'potato');
    assert.equal(singular('berries'), 'berry');
    assert.equal(singular('hummus'), 'hummus');
    assert.equal(singular('asparagus'), 'asparagus');
    assert.equal(singular('rice'), 'rice');
    assert.equal(keyOf('Spinach (Cooked)'), 'spinach cooked');
    assert.equal(keyOf('Brussels Sprouts'), 'brussels sprout');
  });

  test('Quantile mit Interpolation', () => {
    assert.equal(quantile([10, 20, 30, 40], 0.5), 25);
    assert.equal(quantile([10], 0.9), 10);
    assert.equal(quantile([], 0.5), null);
  });
});

describe('Nutrition5k', () => {
  test('liest Gericht und Zutaten', () => {
    const dish = parseDishLine(CSV.split('\n')[0]);
    assert.equal(dish.id, 'dish_1');
    assert.equal(dish.mass, 200);
    assert.deepEqual(dish.ingredients.map((ingredient) => ingredient.name), ['white rice', 'chicken', 'olive oil']);
    assert.equal(dish.ingredients[1].grams, 80);
  });

  test('verwirft kaputte Gerichte und teilt nach Split', () => {
    const { dishes, broken, unsplit } = buildDishes([CSV], {
      trainIds: new Set(['dish_1', 'dish_2', 'dish_7']),
      testIds: new Set(['dish_6']),
      hasImage: (id) => id === 'dish_1',
    });
    assert.equal(broken, 3);
    assert.deepEqual(dishes.map((dish) => dish.id), ['dish_1', 'dish_2', 'dish_6', 'dish_7']);
    assert.equal(dishes.find((dish) => dish.id === 'dish_6').split, 'test');
    assert.equal(dishes.find((dish) => dish.id === 'dish_1').image, true);
    assert.equal(unsplit, 0);
  });

  test('Priors nur aus train, doppelte Zutat zusammengezaehlt', () => {
    const { dishes } = buildDishes([CSV], { trainIds: new Set(['dish_1', 'dish_2', 'dish_7']), testIds: new Set(['dish_6']) });
    const priors = buildPriors(dishes);
    assert.equal(priors['white rice'].n, 2);
    assert.equal(priors['white rice'].median, 80);
    assert.equal(priors.onion.median, 80);
    assert.equal(priors.broccoli.n, 1);
  });
});

describe('FNDDS', () => {
  test('ohne „Quantity not specified“, 0 g und Richtwerte', () => {
    const rows = [
      ['Portions and Weights'],
      ['Food code', 'Main food description', 'WWEIA Category number', 'WWEIA Category description', 'Seq num', 'Portion description', 'Portion weight (g)'],
      [58130011, 'Lasagna with meat', 3204, 'Pasta mixed dishes', 1, '1 piece', 206],
      [58130011, 'Lasagna with meat', 3204, 'Pasta mixed dishes', 2, 'Quantity not specified', 250],
      [58130011, 'Lasagna with meat', 3204, 'Pasta mixed dishes', 3, '1 cup', 250],
      [11000000, 'Milk, human', 9602, 'Human milk', 1, 'Quantity not specified', 0],
      [11100000, 'Milk, NFS', 1004, 'Milk', 1, 'Guideline amount per cup of hot cereal', 61],
    ];
    const foods = buildFndds(rows);
    assert.equal(foods.length, 1);
    assert.deepEqual(foods[0].portions, [{ desc: '1 piece', grams: 206 }, { desc: '1 cup', grams: 250 }]);
  });
});

describe('menuCH', () => {
  const row = (group, name, ...meals) => [null, group, name, ...meals.flatMap((meal) => [...meal, null])];
  const header = [null, 'Lebensmittelkategorien ', null, ...Array(6).fill(['Durschnitt', 'SEM', 'Median', 'Stichprobengrösse', null]).flat()];
  const rows = [
    [null, 'Portionsgrössen'],
    header,
    [null, null, null, 'g', 'g', 'g', 'n'],
    [null, 'Getreide '],
    row('', 'Reis', [75, 21, 45, 8], [128, 4, 112, 376], [146, 5, 112, 294], [0, 0, 0, 0], [120, 10, 100, 30], [80, 5, 60, 10]),
    row('', 'Tomatensauce', [40, 8, 53, 2], [91.2, 101.8, 5.2, 175], [105, 8, 68, 142], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]),
    [null, 'Quelle: BLV'],
  ];

  test('Mahlzeiten, Imbiss gewichtet und verschobene Zellen', () => {
    const english = [header.map((cell) => (cell === 'Durschnitt' ? 'Mean' : cell)), [], [null, 'Cereals'], row('', 'Rice', ...Array(6).fill([1, 0, 1, 1])), row('', 'Tomato sauce', ...Array(6).fill([1, 0, 1, 1]))];
    const { categories, shifted } = buildMenuch(rows, english);
    assert.equal(categories.length, 2);
    const rice = categories[0];
    assert.equal(rice.name, 'Reis');
    assert.equal(rice.nameEn, 'Rice');
    assert.equal(rice.group, 'Getreide');
    assert.deepEqual(rice.perMeal.lunch, { mean: 128, median: 112, n: 376 });
    assert.deepEqual(rice.perMeal.snack, { mean: 110, median: 90, n: 40 });
    assert.equal(shifted, 1);
    assert.deepEqual(categories[1].perMeal.lunch, { mean: 101.8, median: 91.2, n: 175 });
  });
});
