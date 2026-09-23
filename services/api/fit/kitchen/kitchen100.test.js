/**
 * Kueche, Paket C der 100 Verbesserungen: Mengen-Erkennung, Handposten,
 * Reste im Wochenplan, Ersatz-Optionen, roh/gekocht und die Sprachen.
 */
const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { createCatalog } = require('../catalog/index.js');
const { computeGoals, validateProfile } = require('../goals.js');
const { LIBRARY } = require('./library.js');
const { LIBRARY_TEXT } = require('./libraryText.js');
const { localizePlan } = require('./localize.js');
const { candidatesFor, changeEntry, generatePlan, optionsFor } = require('./mealplan.js');
const { parsePantryText } = require('./pantryText.js');
const { buildShoppingList, diffLists } = require('./shopping.js');
const { covers, pantryAmount, resolveRecipe, suggestRecipes, yieldFactor } = require('./suggest.js');

const catalog = createCatalog({ dataDir: 'kein-ordner', mode: 'mock' });
const find = (id) => catalog.find(id);
const TODAY = '2026-09-21';
const profile = validateProfile(
  { birthDate: '1994-05-10', heightCm: 180, weightKg: 80, sex: 'male', activity: 'moderate', trainingDaysPerWeek: 3, goal: 'lose', maxCookMinutes: 45, equipment: ['stove', 'oven', 'blender'] },
  TODAY,
).profile;
const week = () => generatePlan({ catalog, profile, goals: computeGoals(profile, TODAY), weekStart: '2026-09-21', trainingDays: new Set(['2026-09-21']), today: TODAY });

describe('Mengen im Vorrat', () => {
  const parse = (text) => parsePantryText(text, (term) => catalog.match(term)).lines.map((line) => [line.foodId, line.amount, line.unit]);

  test('„500g“, Brueche, Komma, „6x“', () => {
    assert.deepEqual(parse('500g Mehl, 1,5 kg Kartoffeln, ½ Zitrone, 1½ l Milch, 6x Eier'), [
      ['mock:flour', 500, 'g'],
      ['mock:potato', 1500, 'g'],
      ['mock:lemon', 0.5, 'piece'],
      ['mock:milk', 1500, 'ml'],
      ['mock:egg', 6, 'piece'],
    ]);
  });

  test('EL, TL, Prise, Dose, Becher', () => {
    assert.deepEqual(parse('2 EL Olivenöl, 1 TL Zucker, eine Prise Salz, 1 Dose Kichererbsen, 1 Becher Joghurt'), [
      ['mock:olive_oil', 2, 'tbsp'],
      ['mock:sugar', 1, 'tsp'],
      ['mock:salt', 1, 'pinch'],
      ['mock:chickpeas', 400, 'g'],
      ['mock:yogurt', 180, 'g'],
    ]);
  });

  test('Namen kommen in der Sprache der Person', () => {
    const { lines } = parsePantryText('500 g de farine', (term) => catalog.match(term), 'fr');
    assert.equal(lines[0].name, find('mock:flour').names.fr);
  });
});

describe('Einkaufsliste: Handposten', () => {
  test('mehrere Handposten ohne Lebensmittel bleiben alle', () => {
    const plan = week();
    const items = buildShoppingList(plan, [], find).items.map((item, index) => ({ ...item, id: `p${index}` }));
    const manual = [
      { id: 'm1', foodId: null, name: 'Servietten', amount: 1, unit: 'piece', manual: true, done: false },
      { id: 'm2', foodId: null, name: 'Kerzen', amount: 2, unit: 'piece', manual: true, done: false },
      { id: 'm3', foodId: 'mock:banana', name: 'Bananen', amount: 2, unit: 'piece', manual: true, done: false },
    ];
    const diff = diffLists([...items, ...manual], buildShoppingList(plan, [], find).items);
    for (const id of ['m1', 'm2', 'm3']) assert.ok(diff.kept.some((item) => item.id === id), id);
    assert.equal(diff.added.filter((item) => item.foodId === 'mock:banana').length, 0, 'von Hand da heisst nicht doppelt');
  });
});

describe('Wochenplan: Reste', () => {
  const candidates = candidatesFor({ catalog, profile });
  const withLeftover = () => {
    const plan = week();
    const leftover = plan.days.flatMap((day) => day.entries).find((entry) => entry.fromEntryId);
    assert.ok(leftover, 'der Plan hat einen Rest vom Vorabend');
    const base = plan.days.flatMap((day) => day.entries).find((entry) => entry.id === leftover.fromEntryId);
    return { plan, leftover, base };
  };

  test('Kochmenge = eigene Portionen + Reste', () => {
    const { base, leftover } = withLeftover();
    assert.equal(base.cookPortions, base.portions + leftover.portions);
  });

  test('ersetzen loest den Rest und rechnet die Kochmenge neu', () => {
    const { plan, base, leftover } = withLeftover();
    const other = candidates.find((candidate) => candidate.recipe.slots.includes('dinner') && candidate.recipe.id !== base.recipeId);
    const changed = changeEntry(plan, base.id, { recipeId: other.recipe.id }, { candidates });
    const entries = changed.plan.days.flatMap((day) => day.entries);
    assert.equal(entries.find((entry) => entry.id === leftover.id).fromEntryId, null, 'der Rest kauft jetzt selbst ein');
    assert.equal(entries.find((entry) => entry.id === base.id).cookPortions, undefined);
    const bought = buildShoppingList(changed.plan, [], find).items.flatMap((item) => item.recipes);
    assert.ok(bought.includes(leftover.title), 'die Zutaten des Rests stehen auf der Liste');
  });

  test('auslassen des Kochens loest den Rest, zuruecknehmen geht', () => {
    const { plan, base, leftover } = withLeftover();
    const skipped = changeEntry(plan, base.id, { skip: true }, { candidates });
    assert.equal(skipped.plan.days.flatMap((day) => day.entries).find((entry) => entry.id === leftover.id).fromEntryId, null);
    const back = changeEntry(plan, leftover.id, { skip: true }, { candidates });
    const again = changeEntry(back.plan, leftover.id, { unskip: true }, { candidates });
    const entries = again.plan.days.flatMap((day) => day.entries);
    assert.equal(entries.find((entry) => entry.id === leftover.id).status, 'planned');
    assert.equal(entries.find((entry) => entry.id === base.id).cookPortions, base.portions + leftover.portions);
    assert.equal(changeEntry(plan, base.id, { unskip: true }, { candidates }).error, 'not_skipped');
  });

  test('ein Rest steht nie vor seinem Kochen', () => {
    const { plan, base, leftover } = withLeftover();
    assert.equal(changeEntry(plan, leftover.id, { toDay: base.day, toSlot: 'breakfast' }, { candidates }).error, 'leftover_before_cook');
    assert.equal(changeEntry(plan, base.id, { toDay: leftover.day, toSlot: 'snack' }, { candidates }).error, 'leftover_before_cook');
  });

  test('ersetzen nur durch Rezepte dieser Mahlzeit', () => {
    const plan = week();
    const breakfast = plan.days[0].entries.find((entry) => entry.slot === 'breakfast');
    const dinnerOnly = candidates.find((candidate) => !candidate.recipe.slots.includes('breakfast'));
    assert.equal(changeEntry(plan, breakfast.id, { recipeId: dinnerOnly.recipe.id }, { candidates }).error, 'recipe_not_allowed');
  });
});

describe('Ersatz-Optionen', () => {
  test('passend zur Mahlzeit, ohne das aktuelle, entdoppelt, mit kcal', () => {
    const plan = week();
    const entry = plan.days[0].entries.find((candidate) => candidate.slot === 'breakfast');
    const saved = { ...LIBRARY.find((template) => template.id === 'lib:porridge-banana'), id: 'r1', basedOn: 'lib:porridge-banana', items: undefined };
    const resolved = resolveRecipe(LIBRARY.find((template) => template.id === 'lib:porridge-banana'), { catalog, profile });
    const candidates = candidatesFor({ catalog, profile, userRecipes: [{ ...saved, items: resolved.recipe.items }] });
    const options = optionsFor(plan, entry.id, candidates);
    assert.ok(options.length > 0);
    assert.ok(options.every((option) => option.recipeId !== entry.recipeId && option.kcal > 0 && option.portions > 0));
    assert.equal(options.filter((option) => option.recipeId === 'lib:porridge-banana').length, 0, 'die Vorlage nicht neben dem gespeicherten');
    for (const option of options) assert.ok(candidates.find((candidate) => candidate.recipe.id === option.recipeId).recipe.slots.includes('breakfast'));
  });
});

describe('roh und gekocht', () => {
  test('roher Reis im Vorrat deckt gekochten im Rezept', () => {
    const factor = yieldFactor(find('mock:rice'), find('mock:rice_cooked'));
    assert.ok(factor > 2 && factor < 3.5, String(factor));
    const have = pantryAmount([{ foodId: 'mock:rice', grams: 100 }], 'mock:rice_cooked', find);
    assert.equal(Math.round(have), Math.round(100 * factor));
  });
});

// Gefunden beim Durchspielen: „Porridge · Fehlt: Milch“, obwohl ein Liter
// Vollmilch im Vorrat lag. Die Bibliothek nennt „Milch (Durchschnitt)“, der
// Vorrat fuehrt „Vollmilch, pasteurisiert“ — per Kennung treffen die sich nie.
describe('Durchschnitt und konkretes Produkt', () => {
  const average = { id: 'x:avg', names: { de: 'Milch (Durchschnitt)' }, category: 'Milch und Milchprodukte/Milch' };
  const whole = { id: 'x:whole', names: { de: 'Vollmilch, pasteurisiert' }, category: 'Milch und Milchprodukte/Milch' };
  const cheese = { id: 'x:cheese', names: { de: 'Emmentaler' }, category: 'Milch und Milchprodukte/Hartkaese' };
  const lookup = (id) => [average, whole, cheese].find((food) => food.id === id) ?? null;

  test('der konkrete Vorrat deckt die allgemeine Zutat', () => {
    assert.equal(covers('x:whole', 'x:avg', lookup), true);
    assert.equal(pantryAmount([{ foodId: 'x:whole', grams: 1000 }], 'x:avg', lookup), 1000);
  });

  test('aber nur in derselben Kategorie', () => {
    assert.equal(covers('x:cheese', 'x:avg', lookup), false);
  });

  test('und nie umgekehrt: allgemeine Milch ist keine Vollmilch', () => {
    assert.equal(covers('x:avg', 'x:whole', lookup), false);
  });
});

describe('Sprachen der Bibliothek', () => {
  test('jedes Rezept hat Titel und gleich viele Schritte auf FR/IT/EN', () => {
    for (const template of LIBRARY) {
      for (const language of ['fr', 'it', 'en']) {
        const text = LIBRARY_TEXT[template.id]?.[language];
        assert.ok(text?.title, `${template.id} ${language}`);
        assert.equal(text.steps.length, template.steps.length, `${template.id} ${language}`);
      }
    }
  });

  test('Vorschlaege auf Franzoesisch, gespeichert bleibt Deutsch', () => {
    const pantry = [{ foodId: 'mock:banana', grams: 360 }, { foodId: 'mock:flour', grams: 1000 }, { foodId: 'mock:egg', grams: null }];
    const { suggestions } = suggestRecipes({ catalog, profile, pantry, today: TODAY, language: 'fr' });
    const pancakes = suggestions.find((entry) => entry.recipe.id === 'lib:banana-pancakes');
    assert.equal(pancakes.recipe.title, 'Pancakes à la banane');
    assert.ok(pancakes.have.some((entry) => entry.name === find('mock:banana').names.fr));
    const plan = week();
    assert.ok(plan.days[0].entries.every((entry) => !/[àéè]/.test(entry.title) || entry.title === LIBRARY.find((template) => template.id === entry.recipeId)?.title));
    const french = localizePlan(plan, 'fr', find);
    const first = french.days[0].entries[0];
    assert.equal(first.title, LIBRARY_TEXT[first.recipeId]?.fr.title ?? first.title);
  });
});
