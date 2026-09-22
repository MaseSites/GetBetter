/**
 * Werkzeuge der Kueche. Jedes schreibende Werkzeug zeigt in `preview.changes`
 * genau, was sich aendern wird — die Bestaetigung speichert nur, wenn die
 * Vorschau beim Bestaetigen noch dieselbe ist.
 */
const { dayKindOf } = require('../dayKind.js');
const { activeMinutesOf } = require('../limits.js');
const { goalsOf } = require('../diary.js');
const { LANGUAGES, nameIn } = require('../lang.js');
const { amountIn, recipeNutrition, toGrams, UNITS, validateRecipe } = require('../recipes.js');
const { LIBRARY } = require('../kitchen/library.js');
const { foodName, recipeTitle } = require('../kitchen/localize.js');
const {
  candidatesFor,
  changeEntry,
  generatePlan,
  mondayOf,
  shiftDay,
} = require('../kitchen/mealplan.js');
const { buildShoppingList, diffLists } = require('../kitchen/shopping.js');
const { BASE_OF, conflictOf, resolveRecipe, yieldFactor } = require('../kitchen/suggest.js');

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const fail = (error, details) => ({ ok: false, error, details });
/** Sprache der Vorschau — gespeichert wird Deutsch, gezeigt in der Sprache der Person. */
const languageArg = (args) => (LANGUAGES.includes(args?.language) ? args.language : 'de');
/** Der fruehere von zwei Tagen (`YYYY-MM-DD`), oder der eine, der da ist. */
const earlier = (a, b) => (a && b ? (a < b ? a : b) : (a ?? b ?? null));

function lookups(env) {
  const customFoods = env.own.list('customFoods');
  const cacheRows = env.tx.shared('foodCache');
  return { customFoods, find: (id) => env.ctx.catalog.find(id, { customFoods, cacheRows }) };
}

/** Der Vorrat einer Person, mit Gramm, wo die Menge bekannt ist. */
function pantryOf(env) {
  return env.own.list('pantryItems').sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

function pantryLine(find, line, language = 'de') {
  const food = find(line.foodId);
  if (!food) return null;
  const amount = line.amount === null || line.amount === undefined ? null : Number(line.amount);
  const unit = UNITS.includes(line.unit) ? line.unit : amount === null ? null : 'g';
  const grams = amount === null ? null : toGrams(amount, unit, food);
  if (amount !== null && grams === null) return null;
  return {
    foodId: food.id,
    name: food.names?.de ?? line.foodId,
    label: nameIn(food, language) || line.foodId,
    amount,
    unit,
    grams: grams === null ? null : Math.round(grams),
    bestBefore:
      typeof line.bestBefore === 'string' && DAY.test(line.bestBefore) ? line.bestBefore : null,
    shopCategory: food.shopCategory ?? 'other',
  };
}

/** Trainingstage einer Woche — dieselbe Regel wie im Tagebuch (`dayKind.js`). */
function trainingDaysOf(env, weekStart) {
  const days = new Set();
  for (let offset = 0; offset < 7; offset += 1) {
    const day = shiftDay(weekStart, offset);
    if (dayKindOf(env.own, day) === 'training') days.add(day);
  }
  return days;
}

const confirmedPlan = (env, weekStart) =>
  env.own.list(
    'mealPlans',
    (row) => row.status === 'confirmed' && row.weekStart === weekStart,
  )[0] ?? null;

/** Eine Menge in der Einheit, in der die Zeile gefuehrt wird (Stueck bleibt Stueck), sonst Gramm. */
function keepUnit(grams, unit, food) {
  if (grams === null) return { amount: null, unit: null, grams: null };
  const amount = unit && unit !== 'g' ? amountIn(grams, unit, food) : null;
  return amount === null
    ? { amount: Math.round(grams), unit: 'g', grams: Math.round(grams) }
    : { amount, unit, grams: Math.round(grams) };
}

/** Zwei Zeilen desselben Lebensmittels in einem Vorschlag: eine, mit beiden Mengen. */
function mergeLines(a, b, find) {
  const grams = a.grams === null ? b.grams : b.grams === null ? a.grams : a.grams + b.grams;
  const kept = keepUnit(grams, a.unit ?? b.unit, find(a.foodId));
  return { ...a, ...kept, bestBefore: earlier(a.bestBefore, b.bestBefore) };
}

const kitchenTools = [
  {
    name: 'add_to_pantry',
    kind: 'write',
    validate(args) {
      if (!Array.isArray(args.lines) || args.lines.length === 0 || args.lines.length > 30)
        return fail('lines_invalid');
      if (args.lines.some((line) => typeof line?.foodId !== 'string')) return fail('lines_invalid');
      return {
        ok: true,
        args: {
          lines: args.lines.map((line) => ({
            foodId: line.foodId,
            amount: line.amount ?? null,
            unit: line.unit ?? null,
            bestBefore: line.bestBefore ?? null,
          })),
          source: ['text', 'voice', 'barcode', 'photo', 'manual', 'shopping'].includes(args.source)
            ? args.source
            : 'manual',
          language: languageArg(args),
        },
      };
    },
    preview(env, args) {
      const { find } = lookups(env);
      const current = pantryOf(env);
      const language = languageArg(args);
      // Dasselbe zweimal im selben Vorschlag („Reis … und noch Reis“) wird eine Zeile.
      const merged = [];
      for (const raw of args.lines) {
        const line = pantryLine(find, raw, language);
        if (!line) return fail('food_not_found', raw.foodId);
        const index = merged.findIndex((entry) => BASE_OF(entry.foodId) === BASE_OF(line.foodId));
        if (index === -1) merged.push(line);
        else merged[index] = mergeLines(merged[index], line, find);
      }
      const changes = [];
      for (const line of merged) {
        const existing = current.find((row) => row.foodId === line.foodId);
        const food = find(line.foodId);
        if (!existing) changes.push({ op: 'add', ...line });
        else if (existing.grams !== null && line.grams !== null) {
          const kept = keepUnit(existing.grams + line.grams, existing.unit, food);
          changes.push({
            op: 'increase',
            id: existing.id,
            foodId: line.foodId,
            name: line.name,
            label: line.label,
            fromGrams: existing.grams,
            toGrams: kept.grams,
            amount: kept.amount,
            unit: kept.unit,
            bestBefore: earlier(line.bestBefore, existing.bestBefore ?? null),
          });
        } else if (line.grams === null) {
          // Nur der Name („Eier“): die bekannte Menge bleibt, hoechstens das Datum ist neu.
          const bestBefore = line.bestBefore ?? existing.bestBefore ?? null;
          changes.push(
            bestBefore !== (existing.bestBefore ?? null)
              ? {
                  op: 'set',
                  id: existing.id,
                  foodId: line.foodId,
                  name: line.name,
                  label: line.label,
                  amount: existing.amount,
                  unit: existing.unit,
                  grams: existing.grams,
                  bestBefore,
                }
              : {
                  op: 'keep',
                  id: existing.id,
                  foodId: line.foodId,
                  name: line.name,
                  label: line.label,
                  grams: existing.grams,
                },
          );
        } else
          changes.push({
            op: 'set',
            id: existing.id,
            foodId: line.foodId,
            name: line.name,
            label: line.label,
            amount: line.amount,
            unit: line.unit,
            grams: line.grams,
            bestBefore: line.bestBefore ?? existing.bestBefore ?? null,
          });
      }
      return {
        ok: true,
        summary: {
          kind: 'pantry_add',
          count: changes.filter((change) => change.op !== 'keep').length,
        },
        changes,
      };
    },
    apply(env, args, preview) {
      const now = env.ctx.now().toISOString();
      const written = preview.changes.filter((change) => change.op !== 'keep');
      for (const change of written) {
        if (change.op === 'add')
          env.own.insert(
            'pantryItems',
            {
              foodId: change.foodId,
              name: change.name,
              amount: change.amount,
              unit: change.unit,
              grams: change.grams,
              bestBefore: change.bestBefore,
              shopCategory: change.shopCategory,
              confirmed: true,
              source: args.source,
              createdAt: now,
              updatedAt: now,
            },
            { reason: 'add_to_pantry' },
          );
        else if (change.op === 'increase')
          env.own.update(
            'pantryItems',
            change.id,
            {
              grams: change.toGrams,
              amount: change.amount,
              unit: change.unit,
              bestBefore: change.bestBefore,
              updatedAt: now,
            },
            { reason: 'add_to_pantry' },
          );
        else
          env.own.update(
            'pantryItems',
            change.id,
            {
              amount: change.amount,
              unit: change.unit,
              grams: change.grams,
              bestBefore: change.bestBefore,
              updatedAt: now,
            },
            { reason: 'add_to_pantry' },
          );
      }
      return {
        ok: true,
        result: {
          kind: 'pantry_saved',
          count: written.length,
          names: written.map((change) => change.name),
        },
      };
    },
  },
  {
    name: 'update_pantry',
    kind: 'write',
    validate(args) {
      if (!Array.isArray(args.changes) || args.changes.length === 0 || args.changes.length > 30)
        return fail('changes_invalid');
      return {
        ok: true,
        args: {
          changes: args.changes.map((change) => ({
            id: String(change.id ?? ''),
            remove: change.remove === true,
            amount: change.amount ?? null,
            unit: change.unit ?? null,
            ...(change.bestBefore !== undefined ? { bestBefore: change.bestBefore } : {}),
          })),
          language: languageArg(args),
        },
      };
    },
    preview(env, args) {
      const { find } = lookups(env);
      const language = languageArg(args);
      const changes = [];
      for (const change of args.changes) {
        const row = env.own.get('pantryItems', change.id);
        if (!row) return fail('pantry_item_not_found', change.id);
        const label = foodName(find, row.foodId, row.name, language);
        if (change.remove)
          changes.push({ op: 'remove', id: row.id, name: row.name, label, fromGrams: row.grams });
        else {
          // `bestBefore: null` loescht das Datum; fehlt es, bleibt das alte.
          const line = pantryLine(
            find,
            {
              foodId: row.foodId,
              amount: change.amount,
              unit: change.unit,
              bestBefore: change.bestBefore === undefined ? row.bestBefore : change.bestBefore,
            },
            language,
          );
          if (!line) return fail('amount_invalid', row.id);
          changes.push({
            op: 'set',
            id: row.id,
            name: row.name,
            label,
            fromGrams: row.grams,
            amount: line.amount,
            unit: line.unit,
            grams: line.grams,
            bestBefore: line.bestBefore,
          });
        }
      }
      return { ok: true, summary: { kind: 'pantry_update', count: changes.length }, changes };
    },
    apply(env, args, preview) {
      for (const change of preview.changes) {
        if (change.op === 'remove')
          env.own.remove('pantryItems', change.id, { reason: 'update_pantry' });
        else
          env.own.update(
            'pantryItems',
            change.id,
            {
              amount: change.amount,
              unit: change.unit,
              grams: change.grams,
              bestBefore: change.bestBefore,
              updatedAt: env.ctx.now().toISOString(),
            },
            { reason: 'update_pantry' },
          );
      }
      return {
        ok: true,
        result: {
          kind: 'pantry_saved',
          count: preview.changes.length,
          names: preview.changes.map((change) => change.name),
        },
      };
    },
  },
  {
    name: 'reduce_pantry',
    kind: 'write',
    validate(args) {
      if (
        !Array.isArray(args.deductions) ||
        args.deductions.length === 0 ||
        args.deductions.length > 40
      )
        return fail('deductions_invalid');
      return {
        ok: true,
        args: {
          deductions: args.deductions.map((entry) => ({
            foodId: String(entry.foodId),
            grams: Math.max(0, Number(entry.grams) || 0),
          })),
          reason: typeof args.reason === 'string' ? args.reason.slice(0, 40) : 'meal',
          language: languageArg(args),
        },
      };
    },
    preview(env, args) {
      const { find } = lookups(env);
      const language = languageArg(args);
      const rows = pantryOf(env);
      const left = new Map(rows.map((row) => [row.id, row.grams]));
      const unknown = new Set();
      for (const deduction of args.deductions) {
        // Zuerst, was am fruehesten ablaeuft; mehrere Zeilen desselben Lebensmittels teilen sich den Abzug.
        const matching = rows
          .filter((row) => BASE_OF(row.foodId) === BASE_OF(deduction.foodId))
          .sort(
            (a, b) =>
              (a.bestBefore ?? '9999').localeCompare(b.bestBefore ?? '9999') ||
              String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')),
          );
        if (matching.length === 0) continue;
        const known = matching.filter((row) => row.grams !== null);
        if (known.length === 0) {
          for (const row of matching) unknown.add(foodName(find, row.foodId, row.name, language));
          continue;
        }
        const eaten = find(deduction.foodId);
        let need = deduction.grams;
        for (const row of known) {
          if (need <= 0.5) break;
          // Gekocht gegessen, roh im Vorrat (oder umgekehrt): ueber die Energie umgerechnet.
          const factor = yieldFactor(eaten, find(row.foodId));
          const available = left.get(row.id) ?? 0;
          const take = Math.min(available, need * factor);
          left.set(row.id, available - take);
          need -= take / factor;
        }
      }
      const changes = [];
      for (const row of rows) {
        const rest = left.get(row.id);
        if (
          row.grams === null ||
          rest === undefined ||
          rest === null ||
          Math.abs(rest - row.grams) < 0.5
        )
          continue;
        const label = foodName(find, row.foodId, row.name, language);
        const grams = Math.max(0, Math.round(rest));
        if (grams === 0)
          changes.push({ op: 'remove', id: row.id, name: row.name, label, fromGrams: row.grams });
        else
          changes.push({
            op: 'set',
            id: row.id,
            name: row.name,
            label,
            fromGrams: row.grams,
            ...keepUnit(grams, row.unit, find(row.foodId)),
          });
      }
      if (changes.length === 0) return fail('nothing_to_reduce', { unknown: [...unknown] });
      return {
        ok: true,
        summary: { kind: 'pantry_reduce', count: changes.length, unknown: [...unknown] },
        changes,
      };
    },
    apply(env, args, preview) {
      for (const change of preview.changes) {
        if (change.op === 'remove')
          env.own.remove('pantryItems', change.id, { reason: 'reduce_pantry' });
        else
          env.own.update(
            'pantryItems',
            change.id,
            {
              grams: change.grams,
              amount: change.amount,
              unit: change.unit,
              updatedAt: env.ctx.now().toISOString(),
            },
            { reason: 'reduce_pantry' },
          );
      }
      return {
        ok: true,
        result: {
          kind: 'pantry_saved',
          count: preview.changes.length,
          names: preview.changes.map((change) => change.name),
        },
      };
    },
  },
  {
    name: 'save_recipe',
    kind: 'write',
    validate(args) {
      if (typeof args.fromLibrary === 'string')
        return { ok: true, args: { fromLibrary: args.fromLibrary, language: languageArg(args) } };
      if (!args.recipe || typeof args.recipe !== 'object') return fail('recipe_missing');
      return {
        ok: true,
        args: {
          recipe: args.recipe,
          recipeId: typeof args.recipeId === 'string' ? args.recipeId : null,
          language: languageArg(args),
        },
      };
    },
    preview(env, args) {
      const { find, customFoods } = lookups(env);
      let input = args.recipe;
      let basedOn = null;
      if (args.fromLibrary) {
        const template = LIBRARY.find((entry) => entry.id === args.fromLibrary);
        if (!template) return fail('recipe_not_found');
        // Einmal gespeichert heisst: ab jetzt das eigene Rezept, nie ein zweites Mal.
        const already = env.own.list('recipes', (row) => row.basedOn === template.id)[0];
        if (already) return fail('already_saved', { recipeId: already.id });
        const resolved = resolveRecipe(template, {
          catalog: env.ctx.catalog,
          profile: env.profile ?? {},
          customFoods,
        });
        if (!resolved.ok) return fail(resolved.reason, resolved.detail);
        input = {
          ...resolved.recipe,
          items: resolved.recipe.items.map((item) => ({
            foodId: item.foodId,
            amount: item.amount,
            unit: item.unit,
            optional: item.optional,
          })),
        };
        basedOn = template.id;
      }
      const checked = validateRecipe(input, find);
      if (!checked.ok) return fail('recipe_invalid', checked.errors);
      const previous = args.recipeId ? env.own.get('recipes', args.recipeId) : null;
      if (args.recipeId && !previous) return fail('recipe_not_found');
      // Bearbeiten behaelt, woher das Rezept kommt.
      if (previous) basedOn = previous.basedOn ?? null;
      const recipe = {
        ...checked.recipe,
        slots: Array.isArray(input.slots)
          ? input.slots.filter((slot) => ['breakfast', 'lunch', 'dinner', 'snack'].includes(slot))
          : ['lunch', 'dinner'],
        activeMinutes: activeMinutesOf(input.activeMinutes, checked.recipe.timeMinutes),
        basedOn,
      };
      const nutrition = recipeNutrition(recipe, find);
      const conflicts = env.profile
        ? recipe.items
            .map((item) => ({
              name: foodName(find, item.foodId, item.name, languageArg(args)),
              conflict: conflictOf(find(item.foodId), env.profile),
            }))
            .filter((entry) => entry.conflict)
        : [];
      return {
        ok: true,
        summary: {
          kind: args.recipeId ? 'recipe_update' : 'recipe_create',
          title: args.fromLibrary
            ? recipeTitle(args.fromLibrary, recipe.title, languageArg(args))
            : recipe.title,
          perServing: nutrition.ok ? nutrition.perServing : null,
          conflicts,
        },
        changes: [{ op: args.recipeId ? 'update' : 'add', id: args.recipeId ?? null, recipe }],
      };
    },
    apply(env, args, preview) {
      const [change] = preview.changes;
      const now = env.ctx.now().toISOString();
      const row =
        change.op === 'update'
          ? env.own.update(
              'recipes',
              change.id,
              { ...change.recipe, updatedAt: now },
              { reason: 'save_recipe' },
            )
          : env.own.insert(
              'recipes',
              { ...change.recipe, createdAt: now, updatedAt: now },
              { reason: 'save_recipe' },
            );
      return { ok: true, result: { kind: 'recipe_saved', recipeId: row.id, title: row.title } };
    },
  },
  {
    name: 'delete_recipe',
    kind: 'write',
    validate: (args) =>
      typeof args.recipeId === 'string'
        ? { ok: true, args: { recipeId: args.recipeId } }
        : fail('recipe_missing'),
    preview(env, args) {
      const recipe = env.own.get('recipes', args.recipeId);
      if (!recipe) return fail('recipe_not_found');
      return {
        ok: true,
        summary: { kind: 'recipe_delete', title: recipe.title },
        changes: [{ op: 'remove', id: recipe.id, title: recipe.title }],
      };
    },
    apply(env, args, preview) {
      env.own.remove('recipes', preview.changes[0].id, { reason: 'delete_recipe' });
      return { ok: true, result: { kind: 'recipe_deleted', title: preview.changes[0].title } };
    },
  },
  {
    name: 'create_weekly_meal_plan',
    kind: 'write',
    validate(args) {
      if (args.weekStart !== undefined && !DAY.test(String(args.weekStart)))
        return fail('week_invalid');
      return {
        ok: true,
        args: {
          weekStart: args.weekStart ? mondayOf(args.weekStart) : null,
          leftovers: args.leftovers !== false,
        },
      };
    },
    preview(env, args) {
      if (!env.profileRow) return fail('profile_required');
      const weekStart = args.weekStart ?? mondayOf(env.today);
      const { customFoods } = lookups(env);
      // Ein neueres Gewicht zaehlt wie in der Tagesuebersicht.
      const goals = goalsOf(env.ctx, env.profileRow, env.today, env.own);
      const plan = generatePlan({
        catalog: env.ctx.catalog,
        profile: env.profile,
        goals,
        weekStart,
        trainingDays: trainingDaysOf(env, weekStart),
        pantry: pantryOf(env),
        userRecipes: env.own.list('recipes'),
        customFoods,
        today: env.today,
        leftovers: args.leftovers,
      });
      // Schon Gegessenes aus einem alten Plan bleibt, wie es war.
      const previous = confirmedPlan(env, weekStart);
      if (previous) {
        for (const day of plan.days) {
          const eaten =
            previous.days
              .find((entry) => entry.day === day.day)
              ?.entries.filter((entry) => entry.status === 'eaten') ?? [];
          for (const entry of eaten) {
            day.entries = [
              ...day.entries.filter((candidate) => candidate.slot !== entry.slot),
              entry,
            ];
            plan.recipes[entry.recipeId] = previous.recipes[entry.recipeId];
          }
        }
      }
      return {
        ok: true,
        summary: {
          kind: 'meal_plan',
          weekStart,
          replaces: previous?.id ?? null,
          days: plan.days.map((day) => ({
            day: day.day,
            kind: day.kind,
            target: day.target.kcal,
            total: day.total.kcal,
            tolerance: day.tolerance,
          })),
        },
        changes: [{ op: previous ? 'replace' : 'add', previousId: previous?.id ?? null, plan }],
      };
    },
    apply(env, args, preview) {
      const [change] = preview.changes;
      const now = env.ctx.now().toISOString();
      if (change.previousId)
        env.own.update(
          'mealPlans',
          change.previousId,
          { status: 'archived', archivedAt: now },
          { reason: 'create_weekly_meal_plan' },
        );
      const row = env.own.insert(
        'mealPlans',
        { ...change.plan, status: 'confirmed', createdAt: now, confirmedAt: now },
        { reason: 'create_weekly_meal_plan' },
      );
      return {
        ok: true,
        result: { kind: 'meal_plan_saved', planId: row.id, weekStart: row.weekStart },
      };
    },
  },
  {
    name: 'swap_meal_plan_entry',
    kind: 'write',
    validate(args) {
      if (
        typeof args.planId !== 'string' ||
        typeof args.entryId !== 'string' ||
        !args.change ||
        typeof args.change !== 'object'
      )
        return fail('args_invalid');
      const change =
        args.change.skip === true
          ? { skip: true }
          : args.change.unskip === true
            ? { unskip: true }
            : typeof args.change.recipeId === 'string'
              ? { recipeId: args.change.recipeId }
              : typeof args.change.toDay === 'string' && DAY.test(args.change.toDay)
                ? { toDay: args.change.toDay, toSlot: args.change.toSlot ?? null }
                : null;
      if (!change) return fail('change_invalid');
      return {
        ok: true,
        args: { planId: args.planId, entryId: args.entryId, change, language: languageArg(args) },
      };
    },
    preview(env, args) {
      const plan = env.own.get('mealPlans', args.planId);
      if (!plan || plan.status !== 'confirmed') return fail('plan_not_found');
      const { customFoods } = lookups(env);
      const candidates = candidatesFor({
        catalog: env.ctx.catalog,
        profile: env.profile ?? {},
        userRecipes: env.own.list('recipes'),
        customFoods,
      });
      const changed = changeEntry(plan, args.entryId, args.change, { candidates });
      if (!changed.ok) return fail(changed.error);
      const days = changed.affectedDays.map((day) => {
        const before = plan.days.find((entry) => entry.day === day);
        const after = changed.plan.days.find((entry) => entry.day === day);
        return {
          day,
          before: before.total,
          after: after.total,
          target: after.target,
          tolerance: after.tolerance,
          entries: after.entries.map((entry) => ({
            slot: entry.slot,
            title: recipeTitle(entry.recipeId, entry.title, languageArg(args)),
            portions: entry.portions,
            status: entry.status,
          })),
        };
      });
      const list = env.own.list(
        'shoppingLists',
        (row) => row.planId === plan.id && row.status === 'open',
      )[0];
      return {
        ok: true,
        summary: { kind: 'meal_plan_change', days, shoppingListAffected: Boolean(list) },
        changes: [
          { op: 'update', id: plan.id, days: changed.plan.days, recipes: changed.plan.recipes },
        ],
      };
    },
    apply(env, args, preview) {
      const [change] = preview.changes;
      env.own.update(
        'mealPlans',
        change.id,
        { days: change.days, recipes: change.recipes, updatedAt: env.ctx.now().toISOString() },
        { reason: 'swap_meal_plan_entry' },
      );
      // Die Einkaufsliste passt sich nicht still an — sie wird als veraltet markiert und neu vorgeschlagen.
      for (const list of env.own.list(
        'shoppingLists',
        (row) => row.planId === change.id && row.status === 'open',
      ))
        env.own.update('shoppingLists', list.id, { stale: true });
      return {
        ok: true,
        result: {
          kind: 'meal_plan_saved',
          planId: change.id,
          shoppingListStale: preview.summary.shoppingListAffected,
        },
      };
    },
  },
  {
    name: 'generate_shopping_list',
    kind: 'write',
    validate: (args) =>
      typeof args.planId === 'string'
        ? { ok: true, args: { planId: args.planId, language: languageArg(args) } }
        : fail('plan_missing'),
    preview(env, args) {
      const plan = env.own.get('mealPlans', args.planId);
      if (!plan || plan.status !== 'confirmed') return fail('plan_not_found');
      const { find } = lookups(env);
      const label = (item) => foodName(find, item.foodId, item.name, languageArg(args));
      const built = buildShoppingList(plan, pantryOf(env), find);
      const existing = env.own.list(
        'shoppingLists',
        (row) => row.planId === plan.id && row.status === 'open',
      )[0];
      if (!existing)
        return {
          ok: true,
          summary: {
            kind: 'shopping_create',
            count: built.items.length,
            covered: built.covered.map(label),
          },
          changes: [{ op: 'add', planId: plan.id, items: built.items, covered: built.covered }],
        };
      const diff = diffLists(existing.items, built.items);
      if (diff.added.length + diff.changed.length + diff.removed.length === 0)
        return fail('no_changes');
      return {
        ok: true,
        summary: {
          kind: 'shopping_update',
          added: diff.added.map(label),
          changed: diff.changed.map((entry) => ({
            name: label(entry.after),
            from: `${entry.before.amount} ${entry.before.unit}`,
            to: `${entry.after.amount} ${entry.after.unit}`,
            fromAmount: entry.before.amount,
            toAmount: entry.after.amount,
            fromUnit: entry.before.unit,
            toUnit: entry.after.unit,
          })),
          removed: diff.removed.map(label),
        },
        changes: [{ op: 'update', id: existing.id, diff, covered: built.covered }],
      };
    },
    apply(env, args, preview) {
      const [change] = preview.changes;
      const now = env.ctx.now().toISOString();
      let counter = 0;
      const withId = (item) => ({
        ...item,
        id: item.id ?? `sli_${Date.now().toString(36)}${(counter += 1)}`,
      });
      if (change.op === 'add') {
        const row = env.own.insert(
          'shoppingLists',
          {
            planId: change.planId,
            status: 'open',
            stale: false,
            items: change.items.map(withId),
            covered: change.covered,
            createdAt: now,
          },
          { reason: 'generate_shopping_list' },
        );
        return {
          ok: true,
          result: { kind: 'shopping_saved', listId: row.id, count: row.items.length },
        };
      }
      const { diff } = change;
      const items = [
        ...diff.kept,
        ...diff.changed.map((entry) => entry.after),
        ...diff.added.map(withId),
      ];
      env.own.update(
        'shoppingLists',
        change.id,
        { items, covered: change.covered, stale: false, updatedAt: now },
        { reason: 'confirm_shopping_list_update' },
      );
      return {
        ok: true,
        result: { kind: 'shopping_saved', listId: change.id, count: items.length },
      };
    },
  },
];

module.exports = { kitchenTools, pantryOf, trainingDaysOf, confirmedPlan, lookups };
