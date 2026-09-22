/**
 * Rezepte rechnen: Mengen in Gramm, Naehrwerte je Rezept, je Portion und je
 * 100 g — alles aus Katalogwerten, nie aus einer KI-Antwort.
 */
const { checkPer100, sum } = require('./nutrition.js');

/** Einheiten der Zutaten. Loeffel und Tassen sind Milliliter. */
const UNITS = ['g', 'kg', 'ml', 'l', 'piece', 'tbsp', 'tsp', 'pinch'];
const ML_PER_UNIT = { ml: 1, l: 1000, tbsp: 15, tsp: 5 };

const MAX_ITEMS = 40;
const MAX_STEPS = 30;

const round1 = (value) => Math.round(value * 10) / 10;

/** Eine Menge in Gramm, oder null, wenn die Einheit fuer dieses Lebensmittel nichts sagt. */
function toGrams(amount, unit, food) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (unit === 'g') return value;
  if (unit === 'kg') return value * 1000;
  if (unit === 'pinch') return value * 0.5;
  if (unit === 'piece') return food?.gramsPerPiece ? value * food.gramsPerPiece : null;
  if (unit in ML_PER_UNIT) return value * ML_PER_UNIT[unit] * (food?.gramsPerMl ?? 1);
  return null;
}

/**
 * Die Umkehrung von `toGrams`: Gramm in `unit` fuer dieses Lebensmittel —
 * Stueck bleibt Stueck (auf eine Nachkommastelle), sonst null.
 */
function amountIn(grams, unit, food) {
  const value = Number(grams);
  if (!Number.isFinite(value) || value < 0) return null;
  const one = toGrams(1, unit, food);
  if (one === null || one <= 0) return null;
  return Math.round((value / one) * 10) / 10;
}

/**
 * Prueft ein Rezept aus der App und loest jede Zutat im Katalog auf.
 * `find(foodId)` liefert den Datensatz. Gibt `{ ok, recipe }` oder `{ ok: false, errors }`.
 */
function validateRecipe(input, find) {
  const errors = [];
  const title = typeof input?.title === 'string' ? input.title.trim().slice(0, 100) : '';
  if (title.length === 0) errors.push('title');
  const servings = Number(input?.servings);
  if (!Number.isInteger(servings) || servings < 1 || servings > 20) errors.push('servings');
  const rawItems = Array.isArray(input?.items) ? input.items : [];
  if (rawItems.length === 0 || rawItems.length > MAX_ITEMS) errors.push('items');

  const items = [];
  rawItems.slice(0, MAX_ITEMS).forEach((entry, index) => {
    const food = typeof entry?.foodId === 'string' ? find(entry.foodId) : null;
    const unit = UNITS.includes(entry?.unit) ? entry.unit : 'g';
    const grams = food ? toGrams(entry.amount, unit, food) : null;
    if (!food) errors.push(`items.${index}.food`);
    else if (grams === null || grams > 5000) errors.push(`items.${index}.amount`);
    else
      items.push({
        foodId: food.id,
        name: food.names?.de ?? '',
        amount: Number(entry.amount),
        unit,
        grams: round1(grams),
        optional: entry.optional === true,
      });
  });

  const steps = (Array.isArray(input?.steps) ? input.steps : [])
    .filter((step) => typeof step === 'string' && step.trim().length > 0)
    .map((step) => step.trim().slice(0, 500))
    .slice(0, MAX_STEPS);
  const cookedWeightG = input?.cookedWeightG === null || input?.cookedWeightG === undefined ? null : Number(input.cookedWeightG);
  if (cookedWeightG !== null && (!Number.isFinite(cookedWeightG) || cookedWeightG < 10 || cookedWeightG > 20000)) errors.push('cookedWeightG');
  const timeMinutes = Number(input?.timeMinutes ?? 30);
  if (!Number.isFinite(timeMinutes) || timeMinutes < 1 || timeMinutes > 1440) errors.push('timeMinutes');

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    recipe: {
      title,
      servings,
      items,
      steps,
      cookedWeightG,
      timeMinutes: Math.round(timeMinutes),
      difficulty: ['easy', 'medium', 'hard'].includes(input.difficulty) ? input.difficulty : 'easy',
      equipment: (Array.isArray(input.equipment) ? input.equipment : []).filter((entry) => typeof entry === 'string').slice(0, 10),
      tags: (Array.isArray(input.tags) ? input.tags : []).filter((entry) => typeof entry === 'string').slice(0, 10),
      notes: typeof input.notes === 'string' ? input.notes.slice(0, 1000) : '',
    },
  };
}

/**
 * Naehrwerte eines Rezepts. Optionale Zutaten („nach Wunsch Parmesan“) zaehlen
 * nur mit `withOptional` — wie beim Einkauf, im Wochenplan und beim Vorratsabzug.
 * `find(foodId)` wie oben. Gewicht: nach dem Kochen, wenn erfasst, sonst roh.
 */
function recipeNutrition(recipe, find, { withOptional = false } = {}) {
  const lines = [];
  let rawWeight = 0;
  for (const item of recipe.items) {
    if (item.optional && !withOptional) continue;
    const food = find(item.foodId);
    if (!food || !checkPer100(food.per100).ok) return { ok: false, error: 'food_missing', foodId: item.foodId };
    rawWeight += item.grams;
    const factor = item.grams / 100;
    lines.push({
      kcal: food.per100.kcal * factor,
      proteinG: food.per100.proteinG * factor,
      carbsG: food.per100.carbsG * factor,
      fatG: food.per100.fatG * factor,
    });
  }
  const total = sum(lines);
  const weight = recipe.cookedWeightG ?? rawWeight;
  const perServing = {
    kcal: Math.round(total.kcal / recipe.servings),
    proteinG: round1(total.proteinG / recipe.servings),
    carbsG: round1(total.carbsG / recipe.servings),
    fatG: round1(total.fatG / recipe.servings),
  };
  const per100 =
    weight > 0
      ? {
          kcal: Math.round((total.kcal / weight) * 100),
          proteinG: round1((total.proteinG / weight) * 100),
          carbsG: round1((total.carbsG / weight) * 100),
          fatG: round1((total.fatG / weight) * 100),
        }
      : null;
  return { ok: true, total, perServing, per100, weightG: round1(weight), portionG: round1(weight / recipe.servings) };
}

/** Ein Rezept als „Lebensmittel“ fuer das Tagebuch: je 100 g und eine Portion als Stueck. */
function recipePortionFood(ctx, recipe, { customFoods = [], cacheRows = [] } = {}) {
  const find = (id) => ctx.catalog.find(id, { customFoods, cacheRows });
  const nutrition = recipeNutrition(recipe, find);
  if (!nutrition.ok || !nutrition.per100) return null;
  return {
    id: `recipe:${recipe.id}`,
    recipeId: recipe.id,
    source: 'recipe',
    names: { de: recipe.title },
    state: 'prepared',
    per100: nutrition.per100,
    gramsPerPiece: nutrition.portionG,
    allergens: [],
  };
}

module.exports = { UNITS, amountIn, recipeNutrition, recipePortionFood, toGrams, validateRecipe };
