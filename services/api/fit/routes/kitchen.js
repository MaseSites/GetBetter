/**
 * Kueche: Vorrat, Rezepte, Wochenplan, Einkaufsliste.
 *
 * Lesen geht direkt. Was Vorrat, Rezepte, Plan oder Liste aendert, wird ein
 * Vorschlag (`/v1/fit/actions`), den die Person bestaetigt. Direkt gehen nur
 * Handgriffe, die selbst schon die Bestaetigung sind: eine Mahlzeit
 * protokollieren, einen Posten abhaken oder seine Menge von Hand aendern, ein
 * Rezept als Favorit markieren.
 *
 * Gespeichert wird Deutsch; jede Antwort kommt in `language` (`kitchen/localize.js`).
 */
const { publicFood } = require('../catalog/index.js');
const { daySummary, mealLines, SLOTS } = require('../diary.js');
const { LIBRARY } = require('../kitchen/library.js');
const { localizeList, localizePantry, localizePlan, localizeRecipe, recipeTitle } = require('../kitchen/localize.js');
const { candidatesFor, mondayOf, optionsFor } = require('../kitchen/mealplan.js');
const { parsePantryText } = require('../kitchen/pantryText.js');
const { CATEGORY_ORDER } = require('../kitchen/shopping.js');
const { coverageOf, resolveRecipe, suggestRecipes } = require('../kitchen/suggest.js');
const { recipeNutrition, UNITS } = require('../recipes.js');
const { lookups, pantryOf } = require('../tools/kitchen.js');

let itemCounter = 0;
const itemId = () => `sli_${Date.now().toString(36)}${(itemCounter = (itemCounter + 1) % 1296).toString(36)}`;

function kitchenRoutes(ctx, engine) {
  const { ok, store, catalog } = ctx;
  const read = (auth, work) => store.read((tx) => work({ ctx, tx, own: tx.forOwner(auth.accountId), accountId: auth.accountId }));
  const envOf = (tx, auth) => ({ ctx, tx, own: tx.forOwner(auth.accountId), accountId: auth.accountId });
  const profileOf = (own) => own.list('profiles')[0]?.profile ?? {};
  const todayOf = (own) => ctx.todayIn(profileOf(own).timezone, ctx.now());

  function withNutrition(env, recipe, language) {
    const { find } = lookups(env);
    const nutrition = recipeNutrition(recipe, find);
    return { ...localizeRecipe(recipe, language, find), nutrition: nutrition.ok ? { perServing: nutrition.perServing, total: nutrition.total, portionG: nutrition.portionG } : null };
  }

  /** Eine Mahlzeit aus Zutaten: gleiche Zeilen wie im Rezept, skaliert auf die Portionen. */
  function ingredientItems(recipe, portions) {
    const factor = portions / recipe.servings;
    return recipe.items.filter((item) => !item.optional).map((item) => ({ foodId: item.foodId, grams: Math.max(1, Math.round(item.grams * factor)) }));
  }

  /** Nach dem Essen: was vom Vorrat abgehen koennte — als Vorschlag, nie still. */
  async function pantryProposal(auth, items, language) {
    const pantry = await store.read((tx) => tx.forOwner(auth.accountId).list('pantryItems'));
    if (pantry.length === 0) return null;
    const proposal = await engine.propose(auth.accountId, 'reduce_pantry', { deductions: items, reason: 'meal', language });
    return proposal.status === 201 ? proposal.body.action : null;
  }

  /** Bibliotheksvorlage oder eigenes Rezept fuer dieses Profil. */
  function templateOf(env, id) {
    const own = env.own.get('recipes', id);
    if (own) return { own, template: own };
    const template = LIBRARY.find((entry) => entry.id === id);
    return template ? { own: null, template } : null;
  }

  const listOut = (env, list, language) => localizeList(list, language, lookups(env).find);

  return [
    {
      method: 'GET',
      path: /^\/v1\/fit\/pantry$/,
      handler: ({ auth, language }) => read(auth, (env) => ok(200, { items: localizePantry(pantryOf(env), language, lookups(env).find) })),
    },
    {
      method: 'POST',
      path: /^\/v1\/fit\/pantry\/parse$/,
      body: true,
      handler: ({ auth, body, language }) =>
        read(auth, (env) => {
          const text = typeof body.text === 'string' ? body.text.slice(0, 500) : '';
          const { customFoods } = lookups(env);
          const parsed = parsePantryText(text, (term) => catalog.match(term, { customFoods }), language);
          return ok(200, { ...parsed, lines: parsed.lines.map((line) => ({ ...line, food: publicFood(catalog.find(line.foodId, { customFoods })) })) });
        }),
    },
    { method: 'POST', path: /^\/v1\/fit\/pantry\/items$/, body: true, handler: ({ auth, body, language }) => engine.propose(auth.accountId, 'add_to_pantry', { ...body, language }) },
    { method: 'POST', path: /^\/v1\/fit\/pantry\/changes$/, body: true, handler: ({ auth, body, language }) => engine.propose(auth.accountId, 'update_pantry', { ...body, language }) },

    {
      method: 'GET',
      path: /^\/v1\/fit\/recipes$/,
      handler: ({ auth, language }) =>
        read(auth, (env) =>
          ok(200, {
            // Favoriten zuoberst, sonst nach Titel.
            recipes: env.own
              .list('recipes')
              .sort((a, b) => Number(b.favorite === true) - Number(a.favorite === true) || a.title.localeCompare(b.title, language))
              .map((recipe) => withNutrition(env, recipe, language)),
          }),
        ),
    },
    {
      method: 'GET',
      path: /^\/v1\/fit\/recipes\/library$/,
      handler: ({ auth, language }) =>
        read(auth, (env) => {
          const { customFoods } = lookups(env);
          const profile = profileOf(env.own);
          // Schon gespeichert: dann steht es unter „Meine Rezepte“, nicht noch einmal hier.
          const saved = new Set(env.own.list('recipes').map((recipe) => recipe.basedOn).filter(Boolean));
          const recipes = [];
          const rejected = [];
          for (const template of LIBRARY) {
            if (saved.has(template.id)) continue;
            const resolved = resolveRecipe(template, { catalog, profile, customFoods, language });
            if (resolved.ok) recipes.push(withNutrition(env, resolved.recipe, language));
            else rejected.push({ id: template.id, title: recipeTitle(template.id, template.title, language), reason: resolved.reason, detail: resolved.detail ?? null });
          }
          return ok(200, { recipes, rejected, savedCount: saved.size });
        }),
    },
    {
      method: 'POST',
      path: /^\/v1\/fit\/recipes\/suggest$/,
      body: true,
      handler: ({ auth, body, language }) =>
        read(auth, (env) => {
          const { customFoods } = lookups(env);
          const today = todayOf(env.own);
          const summary = daySummary(ctx, env.own, today);
          const pantry = pantryOf(env);
          const slot = SLOTS.includes(body.slot) ? body.slot : null;
          const result = suggestRecipes({ catalog, profile: profileOf(env.own), pantry, remaining: summary.remaining, userRecipes: env.own.list('recipes'), customFoods, slot, today, language });
          return ok(200, { ...result, pantryCount: pantry.length, remaining: summary.remaining });
        }),
    },
    { method: 'POST', path: /^\/v1\/fit\/recipes$/, body: true, handler: ({ auth, body, language }) => engine.propose(auth.accountId, 'save_recipe', { ...body, language }) },
    {
      method: 'GET',
      path: /^\/v1\/fit\/recipes\/([^/]+)$/,
      handler: ({ auth, params: [id], language }) =>
        read(auth, (env) => {
          const found = templateOf(env, id);
          if (!found) return ok(404, { error: 'not_found' });
          const { find, customFoods } = lookups(env);
          const resolved = found.own ? { ok: true, recipe: found.own } : resolveRecipe(found.template, { catalog, profile: profileOf(env.own), customFoods, language });
          if (!resolved.ok) return ok(409, { error: resolved.reason, detail: resolved.detail ?? null });
          const recipe = withNutrition(env, resolved.recipe, language);
          const savedAs = found.own ? found.own : env.own.list('recipes', (row) => row.basedOn === id)[0] ?? null;
          const today = todayOf(env.own);
          const pantry = pantryOf(env);
          const soon = new Set(pantry.filter((row) => row.bestBefore && Date.parse(`${row.bestBefore}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`) <= 3 * 86400000).map((row) => row.foodId));
          return ok(200, {
            recipe,
            coverage: coverageOf(recipe, pantry, recipe.servings, find).map((line) => ({ ...line, expiring: soon.has(line.foodId) })),
            saved: Boolean(found.own),
            savedId: savedAs?.id ?? null,
            favorite: found.own?.favorite === true,
          });
        }),
    },
    {
      // Favorit: ein Merkzeichen, keine Aenderung am Rezept — darum direkt.
      method: 'POST',
      path: /^\/v1\/fit\/recipes\/([^/]+)\/favorite$/,
      body: true,
      handler: ({ auth, params: [id], body }) =>
        store.transact((tx) => {
          const own = tx.forOwner(auth.accountId);
          const recipe = own.get('recipes', id);
          if (!recipe) return ok(404, { error: 'not_found' });
          if (typeof body.favorite !== 'boolean') return ok(400, { error: 'favorite_invalid' });
          own.update('recipes', id, { favorite: body.favorite }, { reason: 'recipe_favorite' });
          return ok(200, { recipeId: id, favorite: body.favorite });
        }),
    },
    {
      // Eine Rezeptportion direkt ins Tagebuch — eigenes Rezept oder aus der Bibliothek („Gekocht & gegessen“).
      method: 'POST',
      path: /^\/v1\/fit\/recipes\/([^/]+)\/log$/,
      body: true,
      handler: async ({ auth, params: [id], body, idempotencyKey, language }) => {
        const portions = Number(body.portions ?? 1);
        if (!Number.isFinite(portions) || portions <= 0 || portions > 10) return ok(400, { error: 'portions_invalid' });
        const logged = await ctx.once(auth.accountId, idempotencyKey, () =>
          store.transact((tx) => {
            const env = envOf(tx, auth);
            const { own } = env;
            const found = templateOf(env, id);
            if (!found) return ok(404, { error: 'not_found' });
            let recipe = found.own;
            if (!recipe) {
              const resolved = resolveRecipe(found.template, { catalog, profile: profileOf(own), customFoods: lookups(env).customFoods });
              if (!resolved.ok) return ok(409, { error: resolved.reason, detail: resolved.detail ?? null });
              recipe = resolved.recipe;
            }
            const day = ctx.isDay(body.day) ? body.day : todayOf(own);
            const deductions = ingredientItems(recipe, portions);
            // Eigenes Rezept als Portion (bleibt verknuepft), Bibliothek aus den Zutaten.
            const built = found.own ? mealLines(ctx, tx, own, [{ recipeId: id, portions }], language) : mealLines(ctx, tx, own, deductions, language);
            if (built.error) return ok(400, built);
            const name = recipeTitle(id, recipe.title, language);
            const meal = own.insert('meals', { day, slot: SLOTS.includes(body.slot) ? body.slot : 'lunch', name, source: 'recipe', items: built.lines, total: built.total, range: built.range, recipeId: found.own ? id : null, libraryId: found.own ? null : id, portions, createdAt: ctx.now().toISOString() });
            return ok(201, { meal, day: daySummary(ctx, own, day), deductions });
          }),
        );
        if (logged.status !== 201) return logged;
        const proposal = await pantryProposal(auth, logged.body.deductions, language);
        return ok(201, { meal: logged.body.meal, day: logged.body.day, pantryAction: proposal });
      },
    },

    {
      method: 'GET',
      path: /^\/v1\/fit\/meal-plans\/current$/,
      handler: ({ auth, url, language }) =>
        read(auth, (env) => {
          const week = mondayOf(ctx.isDay(url.searchParams.get('week')) ? url.searchParams.get('week') : todayOf(env.own));
          const plan = env.own.list('mealPlans', (row) => row.status === 'confirmed' && row.weekStart === week)[0] ?? null;
          const list = plan ? env.own.list('shoppingLists', (row) => row.planId === plan.id && row.status === 'open')[0] ?? null : null;
          return ok(200, { weekStart: week, today: todayOf(env.own), plan: localizePlan(plan, language, lookups(env).find), shoppingListId: list?.id ?? null, shoppingListStale: list?.stale ?? false });
        }),
    },
    { method: 'POST', path: /^\/v1\/fit\/meal-plans\/generate$/, body: true, handler: ({ auth, body }) => engine.propose(auth.accountId, 'create_weekly_meal_plan', body) },
    {
      // Was statt dieser Mahlzeit passt: erlaubt, entdoppelt, mit kcal fuer ihr Ziel.
      method: 'GET',
      path: /^\/v1\/fit\/meal-plans\/([^/]+)\/entries\/([^/]+)\/options$/,
      handler: ({ auth, params: [planId, entryId], language }) =>
        read(auth, (env) => {
          const plan = env.own.get('mealPlans', planId);
          if (!plan || plan.status !== 'confirmed') return ok(404, { error: 'not_found' });
          const { customFoods } = lookups(env);
          const candidates = candidatesFor({ catalog, profile: profileOf(env.own), userRecipes: env.own.list('recipes'), customFoods });
          const options = optionsFor(plan, entryId, candidates);
          if (!options) return ok(404, { error: 'not_found' });
          return ok(200, { options: options.map((option) => ({ ...option, title: recipeTitle(option.recipeId, option.title, language) })) });
        }),
    },
    {
      method: 'PATCH',
      path: /^\/v1\/fit\/meal-plans\/([^/]+)\/entries\/([^/]+)$/,
      body: true,
      handler: ({ auth, params: [planId, entryId], body, language }) => engine.propose(auth.accountId, 'swap_meal_plan_entry', { planId, entryId, change: body.change ?? body, language }),
    },
    {
      // Gegessen: die Mahlzeit aus den Zutaten ins Tagebuch, der Eintrag gilt als gegessen.
      method: 'POST',
      path: /^\/v1\/fit\/meal-plans\/([^/]+)\/entries\/([^/]+)\/log$/,
      handler: async ({ auth, params: [planId, entryId], idempotencyKey, language }) => {
        const logged = await ctx.once(auth.accountId, idempotencyKey, () =>
          store.transact((tx) => {
            const own = tx.forOwner(auth.accountId);
            const plan = own.get('mealPlans', planId);
            const day = plan?.days.find((entry) => entry.entries.some((candidate) => candidate.id === entryId));
            const entry = day?.entries.find((candidate) => candidate.id === entryId);
            if (!entry) return ok(404, { error: 'not_found' });
            if (entry.status === 'eaten') return ok(409, { error: 'entry_eaten', mealId: entry.eatenMealId });
            const recipe = plan.recipes[entry.recipeId];
            if (!recipe) return ok(409, { error: 'recipe_missing' });
            const items = ingredientItems(recipe, entry.portions);
            const built = mealLines(ctx, tx, own, items, language);
            if (built.error) return ok(400, built);
            const meal = own.insert('meals', { day: day.day, slot: entry.slot, name: recipeTitle(entry.recipeId, entry.title, language), source: 'plan', items: built.lines, total: built.total, range: built.range, planEntryId: entryId, createdAt: ctx.now().toISOString() });
            const days = plan.days.map((candidate) => ({ ...candidate, entries: candidate.entries.map((other) => (other.id === entryId ? { ...other, status: 'eaten', eatenMealId: meal.id } : other)) }));
            own.update('mealPlans', planId, { days }, { reason: 'plan_entry_eaten' });
            return ok(201, { meal, day: daySummary(ctx, own, day.day), deductions: items });
          }),
        );
        if (logged.status !== 201) return logged;
        const proposal = await pantryProposal(auth, logged.body.deductions, language);
        return ok(201, { meal: logged.body.meal, day: logged.body.day, pantryAction: proposal });
      },
    },

    {
      method: 'POST',
      path: /^\/v1\/fit\/shopping-lists\/from-meal-plan$/,
      body: true,
      handler: async ({ auth, body, language }) => {
        const proposed = await engine.propose(auth.accountId, 'generate_shopping_list', { ...body, language });
        if (proposed.status !== 409 || proposed.body.error !== 'no_changes') return proposed;
        // Nichts hat sich geaendert: dann ist die Liste auch nicht veraltet.
        await store.transact((tx) => {
          const own = tx.forOwner(auth.accountId);
          for (const list of own.list('shoppingLists', (row) => row.planId === body.planId && row.status === 'open' && row.stale)) own.update('shoppingLists', list.id, { stale: false }, { reason: 'shopping_up_to_date' });
        });
        return ok(409, { error: 'no_changes', upToDate: true });
      },
    },
    {
      method: 'GET',
      path: /^\/v1\/fit\/shopping-lists\/current$/,
      handler: ({ auth, language }) =>
        read(auth, (env) => {
          const lists = env.own.list('shoppingLists', (row) => row.status === 'open').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          return ok(200, { list: listOut(env, lists[0] ?? null, language) });
        }),
    },
    {
      // Von Hand: „2 Bananen“ — Menge und Einheit aus der App, Lebensmittel und Abteilung aus dem Katalog.
      method: 'POST',
      path: /^\/v1\/fit\/shopping-lists\/([^/]+)\/items$/,
      body: true,
      handler: ({ auth, params: [listId], body, language }) =>
        store.transact((tx) => {
          const env = envOf(tx, auth);
          const list = env.own.get('shoppingLists', listId);
          if (!list) return ok(404, { error: 'not_found' });
          const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
          if (!name) return ok(400, { error: 'name_required' });
          const amount = Number(body.amount ?? 1);
          const { customFoods } = lookups(env);
          const found = catalog.match(name, { customFoods });
          const food = found && !found.uncertain ? found.food : null;
          const category = CATEGORY_ORDER.includes(body.category) ? body.category : null;
          const item = {
            id: itemId(),
            foodId: food?.id ?? null,
            name,
            amount: Number.isFinite(amount) && amount > 0 && amount <= 100000 ? amount : 1,
            unit: UNITS.includes(body.unit) ? body.unit : 'piece',
            shopCategory: food?.shopCategory && food.shopCategory !== 'other' ? food.shopCategory : (category ?? 'other'),
            basic: false,
            substituted: false,
            recipes: [],
            done: false,
            manual: true,
            typed: true,
          };
          const next = env.own.update('shoppingLists', listId, { items: [...list.items, item] }, { reason: 'shopping_manual' });
          return ok(201, { list: listOut(env, next, language), item });
        }),
    },
    {
      method: 'PATCH',
      path: /^\/v1\/fit\/shopping-lists\/([^/]+)\/items\/([^/]+)$/,
      body: true,
      handler: ({ auth, params: [listId, itemId], body, language }) =>
        store.transact((tx) => {
          const env = envOf(tx, auth);
          const list = env.own.get('shoppingLists', listId);
          const item = list?.items.find((entry) => entry.id === itemId);
          if (!item) return ok(404, { error: 'not_found' });
          const patch = {};
          if (typeof body.done === 'boolean') patch.done = body.done;
          if (body.amount !== undefined) {
            const amount = Number(body.amount);
            if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) return ok(400, { error: 'amount_invalid' });
            patch.amount = amount;
            patch.manual = true;
          }
          const next = { ...item, ...patch };
          const saved = env.own.update('shoppingLists', listId, { items: list.items.map((entry) => (entry.id === itemId ? next : entry)) }, { reason: 'shopping_edit' });
          return ok(200, { list: listOut(env, saved, language), item: next });
        }),
    },
    {
      method: 'DELETE',
      path: /^\/v1\/fit\/shopping-lists\/([^/]+)\/items\/([^/]+)$/,
      handler: ({ auth, params: [listId, itemId], language }) =>
        store.transact((tx) => {
          const env = envOf(tx, auth);
          const list = env.own.get('shoppingLists', listId);
          if (!list || !list.items.some((entry) => entry.id === itemId)) return ok(404, { error: 'not_found' });
          const saved = env.own.update('shoppingLists', listId, { items: list.items.filter((entry) => entry.id !== itemId) }, { reason: 'shopping_edit' });
          return ok(200, { list: listOut(env, saved, language) });
        }),
    },
  ];
}

module.exports = { kitchenRoutes };
