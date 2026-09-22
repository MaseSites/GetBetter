/**
 * Aus dem bestaetigten Wochenplan eine Einkaufsliste:
 * - gleiche Zutaten ueber alle Rezepte zusammengefasst;
 * - Gramm, Milliliter und Stueck sinnvoll (aufgerundet, wie man einkauft);
 * - bestaetigter Vorrat abgezogen, „Menge offen“ als „Vorrat pruefen“;
 * - nach Ladenabteilung geordnet, Grundzutaten und Ersatz markiert.
 * Gegessenes, Ausgelassenes und Reste vom Vorabend kaufen nichts dazu.
 */
const { BASE_OF, pantryAmount } = require('./suggest.js');

const CATEGORY_ORDER = ['produce', 'bakery', 'dairy', 'meat', 'pantry', 'drinks', 'household', 'other'];

/** Wie viel eine Zutat braucht, wie man sie kauft. */
function displayOf(grams, food, unitHint) {
  if (unitHint === 'piece' && food?.gramsPerPiece) {
    return { amount: Math.max(1, Math.ceil(grams / food.gramsPerPiece - 0.05)), unit: 'piece' };
  }
  if ((unitHint === 'ml' || unitHint === 'l') && food?.gramsPerMl) {
    return { amount: Math.ceil(grams / food.gramsPerMl / 50) * 50, unit: 'ml' };
  }
  return { amount: Math.max(10, Math.ceil(grams / 10) * 10), unit: 'g' };
}

/**
 * `plan`: gespeicherter Plan (mit `recipes`). `find(foodId)` liefert den
 * Datensatz. Gibt `{ items, covered }` — was zu kaufen ist, und was der
 * Vorrat schon deckt.
 */
function buildShoppingList(plan, pantry, find) {
  const needs = new Map();
  for (const day of plan.days) {
    for (const entry of day.entries) {
      if (entry.status !== 'planned' || entry.fromEntryId) continue;
      const recipe = plan.recipes[entry.recipeId];
      if (!recipe) continue;
      const portions = entry.cookPortions ?? entry.portions;
      const factor = portions / recipe.servings;
      for (const item of recipe.items) {
        if (item.optional) continue;
        const key = item.foodId;
        const current = needs.get(key) ?? { foodId: key, name: item.name, grams: 0, units: new Set(), basic: false, substituted: false, recipes: new Set() };
        current.grams += item.grams * factor;
        current.units.add(item.unit);
        current.basic ||= item.basic;
        current.substituted ||= item.substituted === true;
        current.recipes.add(recipe.title);
        needs.set(key, current);
      }
    }
  }

  const items = [];
  const covered = [];
  for (const need of needs.values()) {
    const food = find(need.foodId);
    const have = pantryAmount(pantry, need.foodId);
    const unitHint = need.units.has('piece') ? 'piece' : need.units.has('ml') || need.units.has('l') ? 'ml' : 'g';
    const base = {
      foodId: need.foodId,
      name: need.name,
      shopCategory: food?.shopCategory ?? 'other',
      basic: need.basic,
      substituted: need.substituted,
      recipes: [...need.recipes].sort(),
    };
    if (have !== null && have >= need.grams) {
      covered.push({ ...base, neededGrams: Math.round(need.grams), fromPantry: true });
      continue;
    }
    const toBuy = have === null ? need.grams : need.grams - have;
    const display = displayOf(toBuy, food, unitHint);
    items.push({
      ...base,
      key: BASE_OF(need.foodId),
      grams: Math.round(toBuy),
      amount: display.amount,
      unit: display.unit,
      pantryCheck: have === null,
      pantryGrams: have === null ? null : Math.round(have),
      done: false,
      manual: false,
    });
  }
  items.sort((a, b) => CATEGORY_ORDER.indexOf(a.shopCategory) - CATEGORY_ORDER.indexOf(b.shopCategory) || a.name.localeCompare(b.name, 'de'));
  return { items, covered };
}

/**
 * Was sich an einer bestehenden Liste aendert. Abgehaktes und von Hand
 * Geaendertes bleibt; nur Mengen, die der Plan setzt, werden neu. Handposten
 * (auch mehrere ohne Lebensmittel) bleiben immer, jeder fuer sich; steht ein
 * Lebensmittel schon von Hand auf der Liste, kommt es nicht doppelt dazu.
 */
function diffLists(current, next) {
  const fromPlan = new Map(current.filter((item) => !item.manual && item.foodId).map((item) => [item.foodId, item]));
  const manualFoods = new Set(current.filter((item) => item.manual && item.foodId).map((item) => item.foodId));
  const added = [];
  const changed = [];
  const kept = [];
  for (const item of next) {
    const old = fromPlan.get(item.foodId);
    fromPlan.delete(item.foodId);
    if (!old) {
      if (!manualFoods.has(item.foodId)) added.push(item);
    } else if (old.done) kept.push(old);
    else if (old.amount !== item.amount || old.unit !== item.unit) changed.push({ before: old, after: { ...item, id: old.id } });
    else kept.push(old);
  }
  const leftover = [...fromPlan.values()];
  const removed = leftover.filter((item) => !item.done);
  const keptOther = [...leftover.filter((item) => item.done), ...current.filter((item) => item.manual || !item.foodId)];
  return { added, changed, removed, kept: [...kept, ...keptOther] };
}

module.exports = { CATEGORY_ORDER, buildShoppingList, diffLists, displayOf };
