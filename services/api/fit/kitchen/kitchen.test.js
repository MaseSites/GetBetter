/**
 * Die Abnahme der Ernaehrungsplanung aus dem Masterplan (§26), rein gerechnet:
 * Vorschlaege aus „Bananen, Mehl und Eier“, Allergien nie ungekennzeichnet,
 * reproduzierbare Naehrwerte, Wochenplan im Ziel, Einkaufsliste mit Vorratsabzug.
 */
const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { createCatalog } = require('../catalog/index.js');
const { computeGoals, validateProfile } = require('../goals.js');
const { recipeNutrition } = require('../recipes.js');
const { LIBRARY } = require('./library.js');
const { candidatesFor, changeEntry, generatePlan, mondayOf } = require('./mealplan.js');
const { parsePantryText } = require('./pantryText.js');
const { buildShoppingList, diffLists } = require('./shopping.js');
const { conflictOf, resolveRecipe, suggestRecipes } = require('./suggest.js');

const catalog = createCatalog({ dataDir: 'kein-ordner', mode: 'mock' });
const find = (id) => catalog.find(id);
const TODAY = '2026-09-21';
const profileOf = (extra = {}) =>
  validateProfile(
    { birthDate: '1994-05-10', heightCm: 180, weightKg: 80, sex: 'male', activity: 'moderate', trainingDaysPerWeek: 3, goal: 'lose', maxCookMinutes: 45, equipment: ['stove', 'oven', 'blender'], ...extra },
    TODAY,
  ).profile;
const TRAINING = new Set(['2026-09-21', '2026-09-23', '2026-09-25']);

describe('Vorrat aus Text', () => {
  test('„Ich habe Bananen, Mehl und Eier zu Hause“ in vier Sprachen', () => {
    const ids = (text) => parsePantryText(text, (term) => catalog.match(term)).lines.map((line) => line.foodId);
    assert.deepEqual(ids('Ich habe Bananen, Mehl und Eier zu Hause.'), ['mock:banana', 'mock:flour', 'mock:egg']);
    assert.deepEqual(ids("J'ai des bananes, de la farine et des oeufs"), ['mock:banana', 'mock:flour', 'mock:egg']);
    assert.deepEqual(ids('Ho banane, farina e uova'), ['mock:banana', 'mock:flour', 'mock:egg']);
    assert.deepEqual(ids('I have bananas, flour and eggs'), ['mock:banana', 'mock:flour', 'mock:egg']);
  });

  test('Mengen und Unbekanntes', () => {
    const { lines, unknown } = parsePantryText('6 Eier, 500 g Mehl, 1 l Milch, 2 dl Rahm und Xylophon', (term) => catalog.match(term));
    assert.deepEqual(lines.map((line) => [line.amount, line.unit]), [[6, 'piece'], [500, 'g'], [1000, 'ml'], [200, 'ml']]);
    assert.deepEqual(unknown, ['xylophon']);
  });

  // Gefunden beim Durchspielen: „3 Scheiben Brot“ wurde zu **3 g** Brot
  // (8 kcal statt 250), „1 Packung Backpulver“ zu 1 g. Ein Stueck, dessen
  // Gewicht niemand kennt, ist keine Grammzahl — dann bleibt die Menge offen.
  test('ein Stueck ohne bekanntes Gewicht laesst die Menge offen', () => {
    const parse = (text) => parsePantryText(text, (term) => catalog.match(term)).lines[0];
    // „Scheibe“ ist keine bekannte Einheit, also zaehlt es als Stueck — und
    // Mehl hat kein Stueckgewicht.
    const slices = parse('3 Scheiben Mehl');
    assert.equal(slices.amount, null);
    assert.equal(slices.unit, null);
    const pack = parse('1 Packung Backpulver');
    assert.equal(pack.amount, null);
    assert.equal(pack.unit, null);
    // Was ein Stueckgewicht hat, zaehlt weiter als Stueck.
    assert.deepEqual([parse('6 Eier').amount, parse('6 Eier').unit], [6, 'piece']);
    // Und eine bekannte Packungsgroesse bleibt eine Menge.
    assert.deepEqual([parse('1 Dose Mais').amount, parse('1 Dose Mais').unit], [400, 'g']);
  });
});

describe('Rezeptvorschlaege', () => {
  const pantry = [
    { foodId: 'mock:banana', grams: 360 },
    { foodId: 'mock:flour', grams: 1000 },
    { foodId: 'mock:egg', grams: null },
  ];

  test('Bananen, Mehl, Eier -> Pancakes und Bananenkuchen, fehlende Grundzutaten markiert', () => {
    const { suggestions } = suggestRecipes({ catalog, profile: profileOf(), pantry, today: TODAY });
    const titles = suggestions.map((entry) => entry.recipe.title);
    assert.ok(titles.includes('Bananen-Pancakes'));
    assert.ok(titles.includes('Bananenkuchen'));
    const cake = suggestions.find((entry) => entry.recipe.title === 'Bananenkuchen');
    assert.deepEqual(cake.have.map((entry) => entry.name).sort(), ['Banane', 'Ei', 'Weissmehl']);
    const missing = Object.fromEntries(cake.missing.map((entry) => [entry.name, entry.basic]));
    assert.equal(missing.Backpulver, true, 'Grundzutat nicht still vorausgesetzt, sondern markiert');
    assert.equal(missing.Zucker, true);
    assert.equal(missing.Vollmilch, false);
    assert.ok(cake.recipe.timeMinutes > 0 && cake.recipe.servings === 8 && cake.recipe.steps.length > 0);
  });

  test('Allergien und Ernaehrungsform tauchen nie ungekennzeichnet auf', () => {
    for (const extra of [{ allergies: ['egg'] }, { allergies: ['milk', 'gluten'] }, { diet: 'vegan' }, { diet: 'vegetarian', allergies: ['nuts'] }, { excludedFoods: ['banane'] }]) {
      const profile = profileOf(extra);
      const { suggestions } = suggestRecipes({ catalog, profile, pantry, today: TODAY, limit: 50 });
      for (const suggestion of suggestions) {
        for (const item of suggestion.recipe.items) {
          const conflict = conflictOf(find(item.foodId), profile);
          assert.equal(conflict, null, `${JSON.stringify(extra)}: ${suggestion.recipe.title} enthaelt ${item.name}`);
        }
        for (const substitution of suggestion.recipe.substitutions) assert.ok(substitution.reason && substitution.to);
      }
    }
  });

  test('Naehrwerte sind reproduzierbar aus Menge, Katalogwert und Portionen', () => {
    for (const template of LIBRARY) {
      const { recipe } = resolveRecipe(template, { catalog, profile: profileOf() });
      const nutrition = recipeNutrition(recipe, find);
      // Freiwillige Zutaten zaehlen nicht mit — wie im Wochenplan, beim Einkauf und beim Vorratsabzug.
      const manual = recipe.items.filter((item) => !item.optional).reduce((sum, item) => sum + (find(item.foodId).per100.kcal * item.grams) / 100, 0);
      assert.equal(nutrition.total.kcal, Math.round(manual), template.id);
      assert.equal(nutrition.perServing.kcal, Math.round(Math.round(manual) / recipe.servings), template.id);
      assert.deepEqual(recipeNutrition(recipe, find), nutrition);
    }
  });
});

describe('Wochenplan', () => {
  const plan = (extra = {}, pantry = []) => {
    const profile = profileOf(extra);
    return generatePlan({ catalog, profile, goals: computeGoals(profile, TODAY), weekStart: '2026-09-21', trainingDays: TRAINING, pantry, today: TODAY });
  };

  test('sieben Tage, vier Mahlzeiten, Trainingstage mit eigenem Ziel, alles in der Toleranz', () => {
    const week = plan();
    assert.equal(week.days.length, 7);
    assert.equal(mondayOf('2026-09-24'), '2026-09-21');
    for (const day of week.days) {
      assert.equal(day.entries.length, 4);
      assert.equal(day.kind, TRAINING.has(day.day) ? 'training' : 'rest');
      assert.equal(day.tolerance.kcalOk, true, day.day);
      assert.equal(day.tolerance.proteinOk, true, day.day);
    }
    assert.ok(week.days[0].target.kcal > week.days[1].target.kcal);
  });

  test('derselbe Input gibt denselben Plan', () => {
    assert.deepEqual(plan(), plan());
  });

  test('ersetzen, verschieben, auslassen — Gegessenes bleibt', () => {
    const week = plan();
    const profile = profileOf();
    const candidates = candidatesFor({ catalog, profile });
    const entry = week.days[0].entries.find((candidate) => candidate.slot === 'dinner');
    const other = candidates.find((candidate) => candidate.recipe.slots.includes('dinner') && candidate.recipe.id !== entry.recipeId);
    const replaced = changeEntry(week, entry.id, { recipeId: other.recipe.id }, { candidates });
    assert.equal(replaced.ok, true);
    assert.equal(replaced.plan.days[0].entries.find((candidate) => candidate.id === entry.id).recipeId, other.recipe.id);
    assert.equal(week.days[0].entries.find((candidate) => candidate.id === entry.id).recipeId, entry.recipeId, 'das Original bleibt unveraendert');

    const moved = changeEntry(week, entry.id, { toDay: '2026-09-22', toSlot: 'dinner' }, { candidates });
    assert.deepEqual(moved.affectedDays.sort(), ['2026-09-21', '2026-09-22']);
    assert.equal(moved.plan.days[1].entries.filter((candidate) => candidate.slot === 'dinner').length, 1);
    assert.equal(moved.plan.days[0].entries.length, 4, 'der verdraengte Eintrag tauscht den Platz');

    const skipped = changeEntry(week, entry.id, { skip: true }, { candidates });
    assert.ok(skipped.plan.days[0].total.kcal < week.days[0].total.kcal);

    const eaten = structuredClone(week);
    eaten.days[0].entries[0].status = 'eaten';
    assert.equal(changeEntry(eaten, eaten.days[0].entries[0].id, { skip: true }, { candidates }).error, 'entry_eaten');
    assert.equal(changeEntry(week, entry.id, { recipeId: 'lib:gibtsnicht' }, { candidates }).error, 'recipe_not_allowed');
  });
});

describe('Einkaufsliste', () => {
  const profile = profileOf();
  const week = generatePlan({ catalog, profile, goals: computeGoals(profile, TODAY), weekStart: '2026-09-21', trainingDays: TRAINING, today: TODAY });

  test('gleiche Zutaten zusammengefasst, Einheiten wie im Laden, nach Abteilung', () => {
    const { items } = buildShoppingList(week, [], find);
    const ids = items.map((item) => item.foodId);
    assert.equal(new Set(ids).size, ids.length, 'keine Zutat doppelt');
    for (const item of items) {
      if (item.unit === 'piece') assert.ok(Number.isInteger(item.amount));
      if (item.unit === 'g') assert.equal(item.amount % 10, 0);
      if (item.unit === 'ml') assert.equal(item.amount % 50, 0);
    }
    const order = ['produce', 'bakery', 'dairy', 'meat', 'pantry', 'drinks', 'household', 'other'];
    const positions = items.map((item) => order.indexOf(item.shopCategory));
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
    assert.ok(items.some((item) => item.basic));
  });

  test('Vorrat wird abgezogen; genug Vorrat heisst nichts kaufen, Menge offen heisst pruefen', () => {
    const without = buildShoppingList(week, [], find).items;
    const rice = without.find((item) => item.foodId === 'mock:rice');
    assert.ok(rice);
    const partial = buildShoppingList(week, [{ foodId: 'mock:rice', grams: rice.grams - 50 }], find);
    assert.equal(partial.items.find((item) => item.foodId === 'mock:rice').grams, 50);
    const full = buildShoppingList(week, [{ foodId: 'mock:rice', grams: 5000 }], find);
    assert.equal(full.items.some((item) => item.foodId === 'mock:rice'), false);
    assert.ok(full.covered.some((item) => item.foodId === 'mock:rice'));
    const unknown = buildShoppingList(week, [{ foodId: 'mock:rice', grams: null }], find);
    assert.equal(unknown.items.find((item) => item.foodId === 'mock:rice').pantryCheck, true);
  });

  test('Aenderung am Plan: nur der Unterschied, Abgehaktes und Handarbeit bleiben', () => {
    const current = buildShoppingList(week, [], find).items.map((item, index) => ({ ...item, id: `sli${index}`, done: index === 0, manual: index === 1 }));
    // Fuer die dritte Zutat ist jetzt genug im Vorrat: sie faellt weg.
    const next = buildShoppingList(week, [{ foodId: current[2].foodId, grams: 100000 }], find).items;
    const diff = diffLists(current, next);
    assert.ok(diff.kept.some((item) => item.id === 'sli0'));
    assert.ok(diff.kept.some((item) => item.id === 'sli1'));
    assert.equal(diff.added.length, 0);
    assert.deepEqual(diff.removed.map((item) => item.id), ['sli2']);
  });
});
