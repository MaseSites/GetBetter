/**
 * Das Tagebuch ohne Routen: Mahlzeiten rechnen, Tagesuebersicht, uebliche und
 * zuletzt gegessene Lebensmittel, Serie. `routes/diary.js` haengt es ein;
 * Kueche, Foto, Coach und Werkzeuge nutzen dieselben Funktionen.
 */
const { ATTRIBUTION, normalize } = require('./catalog/index.js');
const { dayKindOf } = require('./dayKind.js');
const { computeGoals, currentWeightKg } = require('./goals.js');
const { nameIn } = require('./lang.js');
const { sessionTitle } = require('./training/texts.js');
const { gramRange } = require('./limits.js');
const { computeMeal, nutrientsFor, remaining, sum, sumOptional } = require('./nutrition.js');
const { recipePortionFood } = require('./recipes.js');

const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
const MAX_ITEMS = 30;
const DAY_MS = 86400000;

const shift = (day, delta) =>
  new Date(Date.parse(`${day}T12:00:00Z`) + delta * DAY_MS).toISOString().slice(0, 10);

/** Der Name aus den Zeilen, wie beim Anlegen — so erkennt man spaeter, ob er von Hand war. */
const joinedName = (lines) =>
  lines
    .map((line) => line.name)
    .join(', ')
    .slice(0, 80);

/**
 * Zeilen einer Mahlzeit: nachschlagen, rechnen, pruefen. `items` =
 * [{ foodId | recipeId, grams | portions, term?, minGrams?, maxGrams? }].
 * `term` ist das gesuchte Wort — daraus lernt die Suche (normalisiert).
 */
function mealLines(ctx, tx, own, items, language = 'de') {
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS)
    return { error: 'items_invalid' };
  const customFoods = own.list('customFoods');
  const cacheRows = tx.shared('foodCache');
  const recipes = own.list('recipes');
  const resolved = [];
  for (const item of items) {
    let grams = Number(item?.grams);
    let food = null;
    if (typeof item?.recipeId === 'string') {
      const recipe = recipes.find((row) => row.id === item.recipeId);
      food = recipe ? recipePortionFood(ctx, recipe, { customFoods, cacheRows }) : null;
    } else if (typeof item?.foodId === 'string') {
      food = ctx.catalog.find(item.foodId, { customFoods, cacheRows });
    }
    if (!food) return { error: 'food_not_found', foodId: item?.foodId ?? item?.recipeId ?? null };
    // „1.5 Portionen“ oder „2 Stueck“: Gramm rechnet der Dienst.
    const portions = Number(item?.portions);
    if (
      !Number.isFinite(grams) &&
      Number.isFinite(portions) &&
      portions > 0 &&
      food.gramsPerPiece
    ) {
      grams = portions * food.gramsPerPiece;
    }
    const term = typeof item?.term === 'string' ? normalize(item.term).slice(0, 80) : '';
    resolved.push({
      food,
      grams,
      term,
      // Spannen einer Schaetzung: in 0–3000 g und nie verkehrt herum (`limits.js`).
      ...gramRange(grams, item.minGrams, item.maxGrams),
    });
  }
  const meal = computeMeal(resolved);
  if (!meal.ok) return { error: 'meal_invalid', details: meal.errors };
  const lines = resolved.map((entry, index) => {
    const values = meal.lines[index];
    return {
      foodId: entry.food.id,
      name: entry.food.recipeId
        ? (entry.food.names?.de ?? entry.food.name ?? '')
        : nameIn(entry.food, language),
      grams: Math.round(entry.grams * 10) / 10,
      source: entry.food.source,
      attribution: ATTRIBUTION[entry.food.source] ?? null,
      per100: entry.food.per100,
      kcal: values.kcal,
      proteinG: values.proteinG,
      carbsG: values.carbsG,
      fatG: values.fatG,
      ...(values.fiberG !== undefined ? { fiberG: values.fiberG } : {}),
      ...(values.sugarG !== undefined ? { sugarG: values.sugarG } : {}),
      ...(values.saltG !== undefined ? { saltG: values.saltG } : {}),
      ...(entry.term ? { term: entry.term } : {}),
      ...(entry.food.recipeId ? { recipeId: entry.food.recipeId } : {}),
    };
  });
  return {
    lines,
    total: { ...meal.total, ...sumOptional(meal.lines.filter(Boolean)) },
    range: meal.range,
    warnings: meal.warnings,
  };
}

/** Der Name einer Mahlzeit: der eigene, sonst aus den Zeilen. */
function mealName(body, lines) {
  return typeof body?.name === 'string' && body.name.trim()
    ? { name: body.name.trim().slice(0, 80), nameAuto: false }
    : { name: joinedName(lines), nameAuto: true };
}

/** War der Name gebaut (neu: `nameAuto`, alt: gleich wie die Zeilen)? */
const isAutoName = (meal) =>
  meal.nameAuto === true || (meal.nameAuto === undefined && meal.name === joinedName(meal.items));

/**
 * Wie viele Tage die Woche wirklich Training hat. Steht ein Plan, zaehlt er —
 * `dayKindOf` entscheidet ja auch nach dem Plan, **welcher** Tag Training ist.
 *
 * Sonst laufen zwei Zahlen auseinander: Das Profil sagte „4 Tage“, der Plan
 * hatte drei (Mo/Mi/Sa). `computeGoals` verteilte die Woche auf vier
 * Trainingstage, bekommen hat sie drei — und damit fehlten **620 kcal je
 * Woche**. Bei jemandem, der gar kein Defizit haben darf, ist das keine
 * Kleinigkeit.
 */
function trainingDaysOf(own, fallback) {
  const plan = own ? (own.list('workoutPlans').at(-1) ?? null) : null;
  const days = Array.isArray(plan?.weekdays) ? plan.weekdays.length : null;
  return days !== null && days > 0 && days <= 7 ? days : fallback;
}

function goalsOf(ctx, profileRow, _day, own = null) {
  if (!profileRow) return null;
  // Ein neueres Gewicht passt Grundumsatz und Eiweiss an.
  const weightKg = currentWeightKg(profileRow, own ? own.list('weightEntries') : []);
  const trainingDaysPerWeek = trainingDaysOf(own, profileRow.profile.trainingDaysPerWeek);
  return computeGoals(
    { ...profileRow.profile, weightKg, trainingDaysPerWeek },
    ctx.todayIn(profileRow.profile.timezone, ctx.now()),
    profileRow.kcalAdjustment ?? 0,
  );
}

/**
 * Trinkziel: 35 ml je kg (die uebliche Faustregel), auf 250 ml gerundet,
 * an Trainingstagen einen halben Liter mehr. Ohne Gewicht 2 Liter.
 */
function waterTargetMl(weightKg, kind) {
  const base =
    Number.isFinite(weightKg) && weightKg > 0 ? Math.round((weightKg * 35) / 250) * 250 : 2000;
  return Math.min(4500, Math.max(1500, base)) + (kind === 'training' ? 500 : 0);
}

/** Namen der Zeilen in der Sprache der Person, soweit der Katalog sie kennt. */
function localize(ctx, own, meal, language) {
  if (!ctx?.catalog) return meal;
  const customFoods = own.list('customFoods');
  const items = meal.items.map((line) => {
    if (line.recipeId) return line;
    const food = ctx.catalog.find(line.foodId, { customFoods });
    const name = food ? nameIn(food, language) : '';
    return name ? { ...line, name } : line;
  });
  return { ...meal, items, ...(isAutoName(meal) ? { name: joinedName(items) } : {}) };
}

const USUAL_DAYS = 60;
const USUAL_LIMIT = 6;

/**
 * Die ueblichen Mahlzeiten: gleiche Lebensmittel (Gramm auf 10 g gerundet) zaehlen
 * als eine. Sortiert nach: passt zur Mahlzeit, wie oft, wie kuerzlich. Heute schon
 * Gegessenes bleibt drin — ein zweiter Kaffee ist normal.
 */
function usualMeals(own, today, slot, ctx = null, language = 'de') {
  const from = shift(today, -USUAL_DAYS);
  const groups = new Map();
  for (const meal of own.list('meals', (row) => row.day >= from && row.day <= today)) {
    const key = meal.items
      .map((line) => `${line.recipeId ?? line.foodId}:${Math.round(line.grams / 10) * 10}`)
      .sort()
      .join('|');
    const group = groups.get(key) ?? { meal, count: 0, slots: {} };
    group.count += 1;
    group.slots[meal.slot] = (group.slots[meal.slot] ?? 0) + 1;
    if (meal.createdAt > group.meal.createdAt) group.meal = meal;
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort(
      (a, b) =>
        (b.slots[slot] ?? 0) - (a.slots[slot] ?? 0) ||
        b.count - a.count ||
        b.meal.createdAt.localeCompare(a.meal.createdAt),
    )
    .slice(0, USUAL_LIMIT)
    .map(({ meal, count }) => ({
      id: meal.id,
      name: ctx ? localize(ctx, own, meal, language).name : meal.name,
      slot: meal.slot,
      kcal: meal.total.kcal,
      count,
      lastDay: meal.day,
    }));
}

const RECENT_LIMIT = 10;

/** Die zuletzt gegessenen Lebensmittel, je eines mit der letzten Menge — fuer die leere Suche. */
function recentFoods(ctx, own, tx) {
  const customFoods = own.list('customFoods');
  const cacheRows = tx ? tx.shared('foodCache') : [];
  const seen = new Set();
  const result = [];
  const meals = own.list('meals').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const meal of meals) {
    for (const line of meal.items) {
      if (line.recipeId || seen.has(line.foodId)) continue;
      seen.add(line.foodId);
      const food = ctx.catalog.find(line.foodId, { customFoods, cacheRows });
      if (!food) continue;
      result.push({ food, grams: line.grams, lastDay: meal.day });
      if (result.length >= RECENT_LIMIT) return result;
    }
  }
  return result;
}

/**
 * Was die Suche gelernt hat: je Wort das Lebensmittel, das dazu am oeftesten
 * gewaehlt wurde (bei Gleichstand das neuere).
 */
function searchHistory(own) {
  const counts = new Map();
  const meals = own.list('meals').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const meal of meals) {
    for (const line of meal.items) {
      if (!line.term || !line.foodId) continue;
      const key = normalize(line.term);
      const perTerm = counts.get(key) ?? new Map();
      perTerm.set(line.foodId, (perTerm.get(line.foodId) ?? 0) + 1);
      counts.set(key, perTerm);
    }
  }
  const history = {};
  for (const [term, perTerm] of counts) {
    let best = null;
    for (const [foodId, count] of perTerm)
      if (!best || count >= best.count) best = { foodId, count };
    if (best) history[term] = best.foodId;
  }
  return history;
}

/** Tage in Folge mit mindestens einer Mahlzeit, bis `day` — ist `day` noch leer, ab dem Vortag. */
function streakOf(own, day) {
  const days = new Set(own.list('meals', (row) => row.day <= day).map((row) => row.day));
  let cursor = days.has(day) ? day : shift(day, -1);
  let count = 0;
  while (days.has(cursor) && count < 3650) {
    count += 1;
    cursor = shift(cursor, -1);
  }
  return count;
}

/** Ballaststoffe, Zucker, Salz eines Tages — auch aus aelteren Zeilen, die nur `per100` kennen. */
function extrasOf(meals) {
  const values = meals.flatMap((meal) =>
    meal.items.map((line) => {
      const fromLine = { fiberG: line.fiberG, sugarG: line.sugarG, saltG: line.saltG };
      const fromPer100 = line.per100 ? nutrientsFor(line.per100, line.grams) : {};
      return {
        fiberG: fromLine.fiberG ?? fromPer100.fiberG,
        sugarG: fromLine.sugarG ?? fromPer100.sugarG,
        saltG: fromLine.saltG ?? fromPer100.saltG,
      };
    }),
  );
  const total = sumOptional(values);
  return { fiberG: total.fiberG ?? 0, sugarG: total.sugarG ?? 0, saltG: total.saltG ?? 0 };
}

/**
 * Die Kalorien je Tag, wie sie im Tagebuch stehen — die Grundlage fuer die
 * Verbrauchsschaetzung (`energy.js`). Tage ohne Mahlzeit fehlen; sie duerfen
 * nicht als 0 kcal gelten.
 */
function intakeByDay(own) {
  const byDay = {};
  for (const meal of own.list('meals')) {
    const kcal = Number(meal?.total?.kcal);
    if (!Number.isFinite(kcal) || typeof meal.day !== 'string') continue;
    byDay[meal.day] = (byDay[meal.day] ?? 0) + kcal;
  }
  return byDay;
}

function daySummary(ctx, own, day, language = 'de') {
  const profileRow = own.list('profiles')[0] ?? null;
  const goals = goalsOf(ctx, profileRow, day, own);
  const kind = dayKindOf(own, day);
  const target = goals ? (kind === 'training' ? goals.trainingDay : goals.restDay) : null;
  const meals = own
    .list('meals', (row) => row.day === day)
    .sort(
      (a, b) =>
        SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || a.createdAt.localeCompare(b.createdAt),
    )
    .map((meal) => localize(ctx, own, meal, language));
  const total = sum(meals.map((meal) => meal.total));
  const weights = own.list('weightEntries').sort((a, b) => b.day.localeCompare(a.day));
  // Das Training des Tages, damit die Ernaehrung zeigen kann, warum das Ziel hoeher ist.
  const workout =
    own.list('scheduledWorkouts', (row) => row.day === day && row.status !== 'skipped')[0] ?? null;
  const weightKg = profileRow ? currentWeightKg(profileRow, weights) : null;
  return {
    day,
    kind,
    target,
    meals,
    total,
    nutrients: extrasOf(meals),
    remaining: target ? remaining(target, total) : null,
    latestWeight: weights[0] ?? null,
    hasProfile: profileRow !== null,
    streak: streakOf(own, day),
    workout: workout
      ? {
          id: workout.id,
          title: sessionTitle(workout.title, language),
          status: workout.status,
          exercises: workout.exercises.length,
        }
      : null,
    // Wie viel mehr ein Trainingstag bringt — 0 ohne Unterschied.
    trainingBonusKcal: goals ? Math.max(0, goals.trainingDay.kcal - goals.restDay.kcal) : 0,
    waterTargetMl: waterTargetMl(weightKg, kind),
  };
}

/** Eine gespeicherte Zeile als Eingabe fuer `mealLines` — gleiche Lebensmittel, gleiche Gramm. */
const lineInput = (line) =>
  line.recipeId
    ? { recipeId: line.recipeId, grams: line.grams }
    : { foodId: line.foodId, grams: line.grams };

module.exports = {
  MAX_ITEMS,
  SLOTS,
  daySummary,
  goalsOf,
  intakeByDay,
  isAutoName,
  joinedName,
  lineInput,
  mealLines,
  mealName,
  recentFoods,
  searchHistory,
  shift,
  streakOf,
  trainingDaysOf,
  usualMeals,
  waterTargetMl,
};
