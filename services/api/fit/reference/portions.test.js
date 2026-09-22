const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { germanCategoryOf, portionHint, indexFoods, fnddsPortions } = require('./portions.js');

/** Eine Mahlzeit-Zelle wie sie `buildMenuch` schreibt. */
const cell = (median, n, mean = median) => ({ mean, median, n });

const CATEGORIES = [
  {
    name: 'Reis',
    nameEn: 'Rice',
    group: 'Getreide',
    perMeal: { breakfast: cell(0, 0), lunch: cell(112, 376, 128), dinner: cell(112, 294, 146), snack: cell(90, 12) },
  },
  {
    name: 'Brot',
    nameEn: 'Bread',
    group: 'Getreide',
    perMeal: { breakfast: cell(64.5, 1936, 84.5), lunch: cell(50, 800), dinner: cell(60, 900), snack: cell(40, 300) },
  },
  {
    name: 'Kartoffelsalat',
    nameEn: 'Potato salad',
    group: 'Kartoffeln',
    perMeal: { breakfast: cell(0, 0), lunch: cell(100, 20), dinner: cell(90, 12), snack: cell(0, 0) },
  },
  {
    name: 'Hühnerfleisch',
    nameEn: 'Chicken',
    group: 'Fleisch',
    perMeal: { breakfast: cell(0, 0), lunch: cell(131.3, 314), dinner: cell(120, 200), snack: cell(0, 2) },
  },
  {
    name: 'Fondue',
    nameEn: 'Fondue',
    group: 'Käse',
    perMeal: { breakfast: cell(0, 0), lunch: cell(200, 3), dinner: cell(230, 60), snack: cell(0, 0) },
  },
  {
    name: 'Gekochtes Gemüse (nicht aus der Dose), total ',
    nameEn: 'Cooked vegetables, total',
    group: 'Gemüse',
    perMeal: { breakfast: cell(0, 0), lunch: cell(95, 500), dinner: cell(90, 450), snack: cell(0, 1) },
  },
];

describe('Deutsche Begriffe → menuCH-Kategorie', () => {
  test('der laengste Eintrag gewinnt', () => {
    assert.equal(germanCategoryOf('Kartoffelsalat'), 'Kartoffelsalat');
    assert.equal(germanCategoryOf('Kartoffeln'), 'Kartoffeln');
  });

  test('mitten im Wort, wenn das Wort lang genug ist', () => {
    assert.equal(germanCategoryOf('Vollkornbrot'), 'Brot');
    assert.equal(germanCategoryOf('Pouletbrust'), 'Hühnerfleisch');
    assert.equal(germanCategoryOf('Rösti'), 'Rösti');
  });

  test('Umlaute und Gross/klein sind egal', () => {
    assert.equal(germanCategoryOf('GEMÜSE'), 'Gekochtes Gemüse (nicht aus der Dose), total');
    assert.equal(germanCategoryOf('kase'), 'Halbhart- oder Hartkäse (ohne Fondue und Raclette)');
  });

  test('kurze Woerter nur als ganzes Wort', () => {
    assert.equal(germanCategoryOf('Ei'), 'Vollei');
    assert.equal(germanCategoryOf('Eiweisspulver'), null, '„ei“ steckt nur zufaellig darin');
  });

  test('nichts Passendes gibt null', () => {
    assert.equal(germanCategoryOf('Kaugummi'), null);
    assert.equal(germanCategoryOf(''), null);
  });

  test('gefragt ist ein Lebensmittel, nicht ein Satz', () => {
    // Stehen zwei darin, gewinnt das laengere Wort. Darum bekommt die Funktion
    // je Zutat einen Begriff, nie den ganzen Tellerinhalt.
    assert.equal(germanCategoryOf('Vollkornbrot mit Butter'), 'Butter');
  });
});

describe('Schweizer Portion je Mahlzeit', () => {
  test('Median der gefragten Mahlzeit', () => {
    const hint = portionHint(CATEGORIES, 'lunch', 'Reis');
    assert.deepEqual(hint, { category: 'Reis', nameEn: 'Rice', slot: 'lunch', requestedSlot: 'lunch', median: 112, mean: 128, n: 376, source: 'menuch' });
    assert.equal(portionHint(CATEGORIES, 'breakfast', 'Vollkornbrot').median, 64.5);
  });

  test('deutsche und englische Namen der Mahlzeit', () => {
    for (const slot of ['dinner', 'Abendessen', 'znacht']) assert.equal(portionHint(CATEGORIES, slot, 'Reis').slot, 'dinner', slot);
    for (const slot of ['snack', 'Znüni', 'zvieri']) assert.equal(portionHint(CATEGORIES, slot, 'Brot').slot, 'snack', slot);
    assert.equal(portionHint(CATEGORIES, 'quatsch', 'Reis').slot, 'lunch', 'ohne bekannte Mahlzeit gilt das Mittagessen');
  });

  test('zu duenne Mahlzeit → die haeufigste der Kategorie', () => {
    const hint = portionHint(CATEGORIES, 'breakfast', 'Reis');
    assert.equal(hint.slot, 'lunch');
    assert.equal(hint.requestedSlot, 'breakfast');
    assert.equal(portionHint(CATEGORIES, 'lunch', 'Fondue').slot, 'dinner', 'drei Nennungen sind zu wenig');
  });

  test('ohne Deutsch hilft der englische Name', () => {
    assert.equal(portionHint(CATEGORIES, 'lunch', 'rice').category, 'Reis');
    assert.equal(portionHint(CATEGORIES, 'lunch', 'chicken').category, 'Hühnerfleisch');
  });

  test('ohne Kategorie, ohne Daten und ohne Nennung: null', () => {
    assert.equal(portionHint(CATEGORIES, 'lunch', 'Kaugummi'), null);
    assert.equal(portionHint([], 'lunch', 'Reis'), null);
    assert.equal(portionHint([{ name: 'Leer', nameEn: null, group: '', perMeal: { breakfast: cell(0, 0), lunch: cell(0, 0), dinner: cell(0, 0), snack: cell(0, 0) } }], 'lunch', 'Leer'), null);
  });
});

const food = (code, description, ...portions) => ({ code, description, category: 'Test', portions: portions.map(([desc, grams]) => ({ desc, grams })) });

const FOODS = [
  food(58106200, 'Pizza, cheese, from frozen, thin crust', ['1 piece', 100]),
  food(58108050, 'Pizza rolls', ['1 pizza roll', 14]),
  food(58109000, 'Dessert pizza', ['1 piece', 80]),
  food(56205000, 'Rice, cooked, NFS', ['1 cup, cooked', 158]),
  food(11360000, 'Rice milk', ['1 cup', 244]),
  food(58131000, 'Spaghetti sauce', ['1 cup', 260]),
  food(58130990, 'Spaghetti and meatballs dinner, NFS, frozen meal', ['1 meal', 354]),
  food(58130011, 'Lasagna with meat', ['1 piece', 206], ['1 cup', 250]),
  food(58130013, 'Lasagna with meat, canned', ['1 cup', 252]),
  food(67160010, 'Baby food, pasta dinner', ['1 jar', 113]),
];

const INDEX = indexFoods(FOODS);
const portionsOf = (term, limit) => fnddsPortions(INDEX, term, limit).map((hit) => hit.description);

describe('FNDDS-Standardportionen', () => {
  test('das Gericht selbst, mit allen Portionen', () => {
    const [lasagna] = fnddsPortions(INDEX, 'Lasagna');
    assert.equal(lasagna.description, 'Lasagna with meat');
    assert.deepEqual(lasagna.portions, [{ desc: '1 piece', grams: 206 }, { desc: '1 cup', grams: 250 }]);
    assert.equal(lasagna.code, 58130011);
  });

  test('der Anfang der Beschreibung zaehlt: „Pizza, cheese“ vor „Dessert pizza“', () => {
    assert.equal(portionsOf('pizza')[0], 'Pizza, cheese, from frozen, thin crust');
  });

  test('der engste Kopf zuerst: „Spaghetti sauce“ vor dem Fertigmenu', () => {
    assert.equal(portionsOf('spaghetti')[0], 'Spaghetti sauce');
  });

  test('„NFS“ ist der allgemeine Eintrag', () => {
    assert.equal(portionsOf('rice')[0], 'Rice, cooked, NFS');
  });

  test('Zubereitung und Mehrzahl stoeren nicht, `limit` gibt mehrere', () => {
    assert.equal(portionsOf('baked lasagna')[0], 'Lasagna with meat');
    assert.deepEqual(portionsOf('lasagna', 2), ['Lasagna with meat', 'Lasagna with meat, canned']);
  });

  test('Babynahrung nur, wenn danach gefragt ist', () => {
    assert.deepEqual(portionsOf('pasta dinner'), []);
    assert.equal(portionsOf('baby pasta dinner')[0], 'Baby food, pasta dinner');
  });

  test('ohne Treffer und ohne Daten: []', () => {
    assert.deepEqual(portionsOf('unobtainium'), []);
    assert.deepEqual(portionsOf(''), []);
    assert.deepEqual(fnddsPortions(indexFoods([]), 'pizza'), []);
  });
});
