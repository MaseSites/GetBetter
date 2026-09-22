/**
 * Rezepte aufloesen und vorschlagen — aus Vorrat, Zielen und Einschraenkungen.
 *
 * Regeln aus dem Masterplan (§17):
 * - vorhandene und fehlende Zutaten klar getrennt, Grundzutaten (Oel, Salz,
 *   Backpulver …) nie still vorausgesetzt, nur als „Grundzutat“ markiert;
 * - Allergien, Ernaehrungsform und ausgeschlossene Lebensmittel tauchen nie
 *   ungekennzeichnet auf: optionale Zutaten fallen weg, sonst ein
 *   gekennzeichneter Ersatz, sonst kein Vorschlag;
 * - Zeit, Geraete und Budget zaehlen; Naehrwerte kommen aus dem Katalog.
 */
const { normalize } = require('../catalog/index.js');
const { recipeNutrition, toGrams } = require('../recipes.js');
const { nameIn } = require('../lang.js');
const { BASIC_FOODS, LIBRARY } = require('./library.js');
const { localizedTemplate } = require('./libraryText.js');

const MEAT_WORDS = ['fleisch', 'poulet', 'huhn', 'speck', 'schinken', 'wurst', 'rind', 'schwein', 'kalb', 'lamm', 'truten', 'hackfleisch', 'chicken', 'beef', 'pork', 'bacon', 'ham', 'viande', 'poulet', 'jambon', 'carne', 'pollo', 'prosciutto'];
const FISH_ALLERGENS = ['fish', 'crustaceans', 'molluscs'];
const ANIMAL_ALLERGENS = ['milk', 'egg', ...FISH_ALLERGENS];
const BUDGET_RANK = { low: 0, medium: 1, high: 2 };

/** Dieselbe Sache in einem anderen Zustand zaehlt im Vorrat mit (Reis roh / gekocht). */
const BASE_OF = (id) => String(id).replace(/^mock:/, '').replace(/_cooked$/, '');

/** Warum ein Lebensmittel fuer dieses Profil nicht geht — oder null. */
function conflictOf(food, profile) {
  const allergens = food.allergens ?? [];
  const hit = allergens.find((entry) => (profile.allergies ?? []).includes(entry));
  if (hit) return { reason: 'allergy', detail: hit };
  const name = normalize(Object.values(food.names ?? {}).join(' '));
  const excluded = (profile.excludedFoods ?? []).find((word) => normalize(word).length > 2 && name.includes(normalize(word)));
  if (excluded) return { reason: 'excluded', detail: excluded };
  const diet = profile.diet ?? 'omnivore';
  if (diet === 'omnivore') return null;
  const meat = food.diet ? !food.diet.pescetarian : MEAT_WORDS.some((word) => name.split(' ').includes(word));
  const fish = food.diet ? !food.diet.vegetarian && food.diet.pescetarian : allergens.some((entry) => FISH_ALLERGENS.includes(entry));
  const animal = food.diet ? !food.diet.vegan : allergens.some((entry) => ANIMAL_ALLERGENS.includes(entry)) || /honig|honey|miel|miele/.test(name);
  if (meat || (diet !== 'pescetarian' && fish) || (diet === 'vegan' && animal)) return { reason: 'diet', detail: diet };
  return null;
}

/**
 * Eine Bibliotheks- oder eigene Rezeptvorlage -> konkretes Rezept fuer dieses
 * Profil: Zutaten mit Datensatz und Gramm, Ersatz und Weggelassenes markiert.
 * Gibt `{ ok: true, recipe }` oder `{ ok: false, reason }`.
 */
function resolveRecipe(original, { catalog, profile, customFoods = [], language = 'de' }) {
  // Gespeichert wird Deutsch; in einer Antwort Titel, Schritte und Namen in der Sprache der Person.
  const template = localizedTemplate(original, language);
  const label = (food, fallback) => nameIn(food, language) || fallback;
  const lookup = (term, mockId) => {
    const local = catalog.match(term, { customFoods });
    if (local && !local.uncertain && local.food.source !== 'mock') return local.food;
    return catalog.find(`mock:${mockId}`) ?? local?.food ?? null;
  };
  const items = [];
  const substitutions = [];
  const omitted = [];
  for (const entry of template.items) {
    const food = entry.foodId ? catalog.find(entry.foodId, { customFoods }) : lookup(entry.term, entry.food);
    if (!food) return { ok: false, reason: 'food_missing' };
    const conflict = conflictOf(food, profile);
    let chosen = food;
    if (conflict) {
      if (entry.optional) {
        omitted.push({ name: label(food, entry.term), reason: conflict.reason, detail: conflict.detail });
        continue;
      }
      const alternative = (entry.alternatives ?? []).map((id) => catalog.find(`mock:${id}`)).find((candidate) => candidate && !conflictOf(candidate, profile));
      if (!alternative) return { ok: false, reason: conflict.reason, detail: conflict.detail };
      substitutions.push({ from: label(food, entry.term), to: label(alternative, ''), reason: conflict.reason, detail: conflict.detail });
      chosen = alternative;
    }
    // Ein Ersatz in Stueck ohne Stueckgewicht (Butter -> Oel) wird in Gramm uebernommen.
    let unit = entry.unit;
    let amount = entry.amount;
    let grams = toGrams(amount, unit, chosen);
    if (grams === null && chosen !== food) {
      grams = toGrams(amount, unit, food);
      unit = 'g';
      amount = grams;
    }
    if (grams === null) return { ok: false, reason: 'unit_unknown' };
    const baseId = BASE_OF(chosen.id);
    items.push({
      foodId: chosen.id,
      name: label(chosen, entry.term),
      amount,
      unit,
      grams: Math.round(grams * 10) / 10,
      optional: entry.optional === true,
      basic: entry.basic === true || BASIC_FOODS.has(baseId),
      substituted: chosen !== food,
    });
  }
  return {
    ok: true,
    recipe: {
      id: template.id,
      source: template.id.startsWith('lib:') ? 'library' : 'user',
      title: template.title,
      servings: template.servings,
      slots: template.slots ?? ['lunch', 'dinner'],
      timeMinutes: template.timeMinutes ?? 30,
      activeMinutes: template.activeMinutes ?? template.timeMinutes ?? 30,
      difficulty: template.difficulty ?? 'easy',
      equipment: template.equipment ?? [],
      cost: template.cost ?? 'medium',
      tags: template.tags ?? [],
      steps: template.steps ?? [],
      cookedWeightG: template.cookedWeightG ?? null,
      basedOn: template.basedOn ?? null,
      favorite: template.favorite === true,
      items,
      substitutions,
      omitted,
    },
  };
}

/**
 * Wie viel Gramm `to` aus einem Gramm `from` werden (roh ↔ gekocht). Die
 * Energie bleibt beim Kochen, nur das Wasser aendert sich: 100 g roher Reis
 * (350 kcal) sind etwa 270 g gekochter (130 kcal je 100 g). Ohne Werte 1.
 */
function yieldFactor(from, to) {
  if (!from || !to || from.id === to.id) return 1;
  const a = from.per100?.kcal;
  const b = to.per100?.kcal;
  if (!(a > 0) || !(b > 0) || from.state === to.state) return 1;
  return Math.min(4, Math.max(0.25, a / b));
}

/**
 * Wie viel Gramm eines Lebensmittels der Vorrat hat — `null` heisst „vorhanden,
 * Menge offen“. Mit `find` wird roh/gekocht umgerechnet (Reis roh im Vorrat,
 * gekocht im Rezept).
 */
function pantryAmount(pantry, foodId, find = null) {
  const matching = pantry.filter((row) => row.confirmed !== false && (row.foodId === foodId || BASE_OF(row.foodId) === BASE_OF(foodId)));
  if (matching.length === 0) return 0;
  if (matching.some((row) => row.grams === null || row.grams === undefined)) return null;
  const wanted = find ? find(foodId) : null;
  return matching.reduce((total, row) => total + row.grams * (find && row.foodId !== foodId ? yieldFactor(find(row.foodId), wanted) : 1), 0);
}

/** Vorhanden / zu wenig / fehlt, je Zutat, fuer eine Anzahl Portionen. */
function coverageOf(recipe, pantry, portions = recipe.servings, find = null) {
  const factor = portions / recipe.servings;
  return recipe.items.map((item) => {
    const needed = Math.round(item.grams * factor);
    const raw = pantryAmount(pantry, item.foodId, find);
    const have = raw === null ? null : Math.round(raw);
    const status = have === null ? 'have_unknown' : have >= needed * 0.9 ? 'have' : have > 0 ? 'short' : 'missing';
    return { foodId: item.foodId, name: item.name, needed, have, status, basic: item.basic, optional: item.optional };
  });
}

/** Tage bis zum Ablauf, oder null. */
const daysLeft = (bestBefore, today) => (bestBefore ? Math.round((Date.parse(`${bestBefore}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000) : null);

/**
 * Vorschlaege. `remaining` sind die Restmakros des Tages (oder null), `slot`
 * grenzt auf Fruehstueck/Mittag/Abend/Snack ein. Rueckgabe sortiert.
 */
function suggestRecipes({ catalog, profile, pantry = [], remaining = null, userRecipes = [], customFoods = [], slot = null, today, limit = 6, language = 'de' }) {
  const find = (id) => catalog.find(id, { customFoods });
  // Wer ein Bibliotheksrezept gespeichert hat, sieht es einmal — als eigenes.
  const saved = new Set(userRecipes.map((recipe) => recipe.basedOn).filter(Boolean));
  const templates = [...userRecipes.map((recipe) => ({ ...recipe, items: recipe.items.map((entry) => ({ ...entry })) })), ...LIBRARY.filter((template) => !saved.has(template.id))];
  const pantryIds = new Set(pantry.map((row) => BASE_OF(row.foodId)));
  const expiring = new Set(pantry.filter((row) => (daysLeft(row.bestBefore, today) ?? 99) <= 3).map((row) => BASE_OF(row.foodId)));
  const results = [];
  const rejected = [];

  for (const template of templates) {
    if (slot && template.slots && !template.slots.includes(slot)) continue;
    const resolved = resolveRecipe(template, { catalog, profile, customFoods, language });
    if (!resolved.ok) {
      rejected.push({ id: template.id, title: localizedTemplate(template, language).title, reason: resolved.reason, detail: resolved.detail ?? null });
      continue;
    }
    const recipe = resolved.recipe;
    const equipment = new Set(profile.equipment ?? ['stove', 'oven']);
    if (recipe.equipment.some((entry) => !equipment.has(entry))) {
      rejected.push({ id: recipe.id, title: recipe.title, reason: 'equipment' });
      continue;
    }
    // Gezaehlt wird, wie lange man selbst in der Kueche steht — nicht die Zeit im Ofen.
    const maxMinutes = profile.maxCookMinutes ?? 45;
    if (recipe.activeMinutes > maxMinutes * 1.5) {
      rejected.push({ id: recipe.id, title: recipe.title, reason: 'time' });
      continue;
    }
    const nutrition = recipeNutrition(recipe, find);
    if (!nutrition.ok) continue;

    const coverage = coverageOf(recipe, pantry, recipe.servings, find);
    const main = coverage.filter((entry) => !entry.basic && !entry.optional);
    const used = main.filter((entry) => entry.status === 'have' || entry.status === 'have_unknown' || entry.status === 'short');
    if (pantry.length > 0 && used.length === 0) continue;

    const share = main.length > 0 ? used.length / main.length : 0;
    const perServing = nutrition.perServing;
    let macroFit = 0.5;
    if (remaining && remaining.kcal > 0) {
      const slotShare = slot === 'breakfast' ? 0.3 : slot === 'snack' ? 0.15 : 0.4;
      const wanted = remaining.kcal * slotShare;
      macroFit = Math.max(0, 1 - Math.abs(perServing.kcal - wanted) / Math.max(wanted, 200));
      const proteinDensity = perServing.kcal > 0 ? (perServing.proteinG * 4) / perServing.kcal : 0;
      if (remaining.proteinG > 30) macroFit = macroFit * 0.7 + Math.min(1, proteinDensity / 0.3) * 0.3;
    }
    const usesExpiring = recipe.items.some((item) => expiring.has(BASE_OF(item.foodId)));
    const budgetPenalty = BUDGET_RANK[recipe.cost] > BUDGET_RANK[profile.budget ?? 'medium'] ? 0.15 : 0;
    const timePenalty = recipe.activeMinutes > maxMinutes ? 0.1 : 0;
    const score = share * 0.6 + macroFit * 0.25 + (usesExpiring ? 0.15 : 0) - budgetPenalty - timePenalty + (template.id.startsWith('lib:') ? 0 : 0.05);

    results.push({
      recipe,
      nutrition: { perServing, total: nutrition.total, portionG: nutrition.portionG },
      have: coverage.filter((entry) => entry.status === 'have' || entry.status === 'have_unknown'),
      short: coverage.filter((entry) => entry.status === 'short'),
      missing: coverage.filter((entry) => entry.status === 'missing'),
      usesExpiring,
      expiring: recipe.items.filter((item) => expiring.has(BASE_OF(item.foodId))).map((item) => item.name),
      usesPantry: [...pantryIds].some((id) => recipe.items.some((item) => BASE_OF(item.foodId) === id)),
      score: Math.round(score * 1000) / 1000,
    });
  }
  results.sort((a, b) => b.score - a.score || a.recipe.timeMinutes - b.recipe.timeMinutes);
  return { suggestions: results.slice(0, limit), rejected };
}

module.exports = { BASE_OF, conflictOf, coverageOf, daysLeft, pantryAmount, resolveRecipe, suggestRecipes, yieldFactor };
