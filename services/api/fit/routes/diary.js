/**
 * Profil, Ziele, Ernaehrungstagebuch, Tagesuebersicht, Gewicht und das
 * Aenderungsprotokoll. Das Rechnen steht in `../diary.js`.
 *
 * Die App schickt fuer eine Mahlzeit nur Lebensmittel-Ids und Gramm. Werte,
 * die sie mitschickt, zaehlen nicht: der Dienst schlaegt jeden Datensatz
 * nach, rechnet neu und speichert eine Abschrift der Werte je 100 g — so
 * aendert ein spaeterer Import nie, was schon gegessen ist.
 */
const { publicConfig } = require('../config.js');
const { validateProfile } = require('../goals.js');
const { publicFood } = require('../catalog/index.js');
const { checkPer100 } = require('../nutrition.js');
const { pick } = require('../lang.js');
const { validPieceGrams } = require('../limits.js');
const { suggestRecipes } = require('../kitchen/suggest.js');
const diary = require('../diary.js');
const { logRoutes } = require('./diaryLog.js');

const { SLOTS, daySummary, goalsOf, mealLines, mealName, lineInput } = diary;
const SOURCES = ['manual', 'photo', 'barcode', 'recipe', 'plan', 'label'];
const hasLarge = (built) => built.warnings.some((entry) => entry.warning === 'large_portion');
/** Ab so viel Rest lohnt sich ein Vorschlag „Was passt noch?“. */
const FITS_MIN_KCAL = 150;

function diaryRoutes(ctx) {
  const { ok, store, catalog, config } = ctx;
  const read = (auth, work) => store.read((tx) => work(tx.forOwner(auth.accountId), tx));
  const write = (auth, work) => store.transact((tx) => work(tx.forOwner(auth.accountId), tx));

  const dayOf = (auth, value, own) => {
    if (ctx.isDay(value)) return value;
    const profile = own?.list('profiles')[0]?.profile;
    return ctx.todayIn(profile?.timezone, ctx.now());
  };
  const profileBody = (own, row) => ({
    profile: row?.profile ?? null,
    goals: goalsOf(ctx, row ?? null, null, own),
    kcalAdjustment: row?.kcalAdjustment ?? 0,
  });

  return [
    {
      method: 'GET',
      path: /^\/v1\/fit\/status$/,
      handler: async () => ok(200, { ...publicConfig(config), catalog: catalog.info() }),
    },
    {
      method: 'GET',
      path: /^\/v1\/fit\/profile$/,
      handler: ({ auth }) =>
        read(auth, (own) => ok(200, profileBody(own, own.list('profiles')[0] ?? null))),
    },
    {
      method: 'PUT',
      path: /^\/v1\/fit\/profile$/,
      body: true,
      handler: ({ auth, body }) => {
        const today = ctx.todayIn(body?.timezone, ctx.now());
        const checked = validateProfile(body ?? {}, today);
        if (!checked.ok) return ok(400, { error: 'profile_invalid', fields: checked.errors });
        return write(auth, (own) => {
          const existing = own.list('profiles')[0];
          const at = ctx.now().toISOString();
          const row = existing
            ? own.update('profiles', existing.id, { profile: checked.profile, updatedAt: at })
            : own.insert('profiles', {
                profile: checked.profile,
                kcalAdjustment: 0,
                createdAt: at,
                updatedAt: at,
              });
          return ok(200, profileBody(own, row));
        });
      },
    },
    {
      method: 'GET',
      path: /^\/v1\/fit\/day$/,
      handler: ({ auth, url, language }) =>
        read(auth, (own) =>
          ok(200, daySummary(ctx, own, dayOf(auth, url.searchParams.get('day'), own), language)),
        ),
    },
    {
      method: 'GET',
      path: /^\/v1\/fit\/foods\/search$/,
      handler: ({ auth, url, language }) =>
        read(auth, (own) => {
          const q = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
          if (q.length < 2) return ok(200, { foods: [] });
          const results = catalog.search(q, {
            preparation: url.searchParams.get('prep') ?? '',
            customFoods: own.list('customFoods'),
            history: diary.searchHistory(own),
            limit: 20,
          });
          return ok(200, {
            foods: results.map((entry) => ({
              ...publicFood(entry.food, language),
              score: Math.round(entry.score * 100) / 100,
              stateMismatch: entry.stateMismatch,
            })),
          });
        }),
    },
    {
      // Die leere Suche: was zuletzt gegessen wurde, mit der letzten Menge.
      method: 'GET',
      path: /^\/v1\/fit\/foods\/recent$/,
      handler: ({ auth, language }) =>
        read(auth, (own, tx) =>
          ok(200, {
            foods: diary.recentFoods(ctx, own, tx).map((entry) => ({
              food: publicFood(entry.food, language),
              grams: entry.grams,
              lastDay: entry.lastDay,
            })),
          }),
        ),
    },
    {
      method: 'GET',
      path: /^\/v1\/fit\/foods\/([^/]+)$/,
      handler: ({ auth, params: [id], language }) =>
        read(auth, (own, tx) => {
          const food = catalog.find(id, {
            customFoods: own.list('customFoods'),
            cacheRows: tx.shared('foodCache'),
          });
          return food
            ? ok(200, { food: publicFood(food, language) })
            : ok(404, { error: 'not_found' });
        }),
    },
    {
      method: 'POST',
      path: /^\/v1\/fit\/foods\/custom$/,
      body: true,
      handler: ({ auth, body, language }) => {
        const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
        if (name.length === 0) return ok(400, { error: 'name_required' });
        const per100 = {
          kcal: Number(body.per100?.kcal),
          proteinG: Number(body.per100?.proteinG),
          carbsG: Number(body.per100?.carbsG),
          fatG: Number(body.per100?.fatG),
        };
        for (const key of ['fiberG', 'sugarG', 'saltG']) {
          if (body.per100?.[key] !== undefined && body.per100[key] !== null)
            per100[key] = Number(body.per100[key]);
        }
        const check = checkPer100(per100);
        if (!check.ok) return ok(400, { error: 'per100_invalid', details: check.errors });
        return write(auth, (own) => {
          const food = own.insert('customFoods', {
            source: 'custom',
            names: { de: name },
            synonyms: [],
            state: null,
            per100,
            allergens: [],
            gramsPerPiece: validPieceGrams(Number(body.gramsPerPiece)),
            shopCategory: 'other',
            createdAt: ctx.now().toISOString(),
          });
          return ok(201, { food: publicFood(food, language), warnings: check.warnings });
        });
      },
    },
    {
      method: 'POST',
      path: /^\/v1\/fit\/meals$/,
      body: true,
      handler: ({ auth, body, idempotencyKey, language }) =>
        ctx.once(auth.accountId, idempotencyKey, () =>
          write(auth, (own, tx) => {
            if (!SLOTS.includes(body.slot)) return ok(400, { error: 'slot_invalid' });
            const day = dayOf(auth, body.day, own);
            const built = mealLines(ctx, tx, own, body.items, language);
            if (built.error) return ok(400, built);
            if (hasLarge(built) && body.confirmLarge !== true)
              return ok(409, { error: 'confirm_large_portion', warnings: built.warnings });
            const meal = own.insert('meals', {
              day,
              slot: body.slot,
              ...mealName(body, built.lines),
              source: SOURCES.includes(body.source) ? body.source : 'manual',
              items: built.lines,
              total: built.total,
              range: built.range,
              analysisId: typeof body.analysisId === 'string' ? body.analysisId : null,
              planEntryId: typeof body.planEntryId === 'string' ? body.planEntryId : null,
              createdAt: ctx.now().toISOString(),
            });
            return ok(201, { meal, day: daySummary(ctx, own, day, language) });
          }),
        ),
    },
    {
      // Was die Person oft isst: gleiche Zusammenstellung in den letzten 60 Tagen, die der
      // gefragten Mahlzeit zuerst. Ein Tipp in der App traegt es wieder ein (`/repeat`).
      method: 'GET',
      path: /^\/v1\/fit\/meals\/usual$/,
      handler: ({ auth, url, language }) =>
        read(auth, (own) =>
          ok(200, {
            meals: diary.usualMeals(
              own,
              dayOf(auth, null, own),
              url.searchParams.get('slot'),
              ctx,
              language,
            ),
          }),
        ),
    },
    {
      // Eine fruehere Mahlzeit nochmal: gleiche Lebensmittel und Gramm, neu gerechnet.
      method: 'POST',
      path: /^\/v1\/fit\/meals\/([^/]+)\/repeat$/,
      body: true,
      handler: ({ auth, params: [id], body, idempotencyKey, language }) =>
        ctx.once(auth.accountId, idempotencyKey, () =>
          write(auth, (own, tx) => {
            const earlier = own.get('meals', id);
            if (!earlier) return ok(404, { error: 'not_found' });
            const slot = SLOTS.includes(body?.slot) ? body.slot : earlier.slot;
            const day = dayOf(auth, body?.day, own);
            const built = mealLines(ctx, tx, own, earlier.items.map(lineInput), language);
            if (built.error) return ok(400, built);
            const meal = own.insert('meals', {
              day,
              slot,
              name: diary.isAutoName(earlier) ? diary.joinedName(built.lines) : earlier.name,
              nameAuto: diary.isAutoName(earlier),
              source: earlier.source,
              items: built.lines,
              total: built.total,
              range: built.range,
              analysisId: null,
              planEntryId: null,
              repeatedFrom: earlier.id,
              createdAt: ctx.now().toISOString(),
            });
            return ok(201, { meal, day: daySummary(ctx, own, day, language) });
          }),
        ),
    },
    {
      // Nachtraeglich aendern: Gramm je Zeile, Zeilen weg, andere Mahlzeit. Grosse Portionen
      // fragen nach wie beim Eintragen; ein gebauter Name folgt den Zeilen.
      method: 'PATCH',
      path: /^\/v1\/fit\/meals\/([^/]+)$/,
      body: true,
      handler: ({ auth, params: [id], body, language }) =>
        write(auth, (own, tx) => {
          const meal = own.get('meals', id);
          if (!meal) return ok(404, { error: 'not_found' });
          const patch = {};
          if (body.slot !== undefined) {
            if (!SLOTS.includes(body.slot)) return ok(400, { error: 'slot_invalid' });
            patch.slot = body.slot;
          }
          if (body.items !== undefined) {
            const built = mealLines(ctx, tx, own, body.items, language);
            if (built.error) return ok(400, built);
            if (hasLarge(built) && body.confirmLarge !== true)
              return ok(409, { error: 'confirm_large_portion', warnings: built.warnings });
            Object.assign(patch, { items: built.lines, total: built.total, range: built.range });
            if (typeof body.name !== 'string' && diary.isAutoName(meal))
              Object.assign(patch, { name: diary.joinedName(built.lines), nameAuto: true });
          }
          if (typeof body.name === 'string' && body.name.trim())
            Object.assign(patch, { name: body.name.trim().slice(0, 80), nameAuto: false });
          const next = own.update('meals', id, { ...patch, updatedAt: ctx.now().toISOString() });
          return ok(200, { meal: next, day: daySummary(ctx, own, next.day, language) });
        }),
    },
    {
      method: 'DELETE',
      path: /^\/v1\/fit\/meals\/([^/]+)$/,
      handler: ({ auth, params: [id], language }) =>
        write(auth, (own) => {
          const meal = own.get('meals', id);
          if (!meal) return ok(404, { error: 'not_found' });
          own.remove('meals', id);
          return ok(200, { day: daySummary(ctx, own, meal.day, language) });
        }),
    },
    {
      // „Wie gestern“: die Mahlzeiten eines Tages (oder nur einzelner Mahlzeiten) auf einen
      // anderen Tag, neu gerechnet, in einem Schritt.
      method: 'POST',
      path: /^\/v1\/fit\/days\/([^/]+)\/copy$/,
      body: true,
      handler: ({ auth, params: [target], body, idempotencyKey, language }) => {
        if (!ctx.isDay(target) || !ctx.isDay(body?.from) || body.from === target)
          return ok(400, { error: 'day_invalid' });
        const slots = Array.isArray(body.slots) ? body.slots.filter((s) => SLOTS.includes(s)) : null;
        return ctx.once(auth.accountId, idempotencyKey, () =>
          write(auth, (own, tx) => {
            const source = own
              .list('meals', (row) => row.day === body.from && (!slots || slots.includes(row.slot)))
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
            if (source.length === 0) return ok(404, { error: 'nothing_to_copy' });
            const meals = [];
            for (const earlier of source) {
              const built = mealLines(ctx, tx, own, earlier.items.map(lineInput), language);
              if (built.error) continue;
              meals.push(
                own.insert('meals', {
                  day: target,
                  slot: earlier.slot,
                  name: diary.isAutoName(earlier) ? diary.joinedName(built.lines) : earlier.name,
                  nameAuto: diary.isAutoName(earlier),
                  source: earlier.source,
                  items: built.lines,
                  total: built.total,
                  range: built.range,
                  analysisId: null,
                  planEntryId: null,
                  copiedFrom: earlier.id,
                  createdAt: ctx.now().toISOString(),
                }),
              );
            }
            if (meals.length === 0) return ok(409, { error: 'nothing_to_copy' });
            return ok(201, { meals, day: daySummary(ctx, own, target, language) });
          }),
        );
      },
    },
    {
      // „Was passt noch?“: bis drei Rezepte fuer den Rest des Tages, je eine Portion als Zeilen.
      method: 'GET',
      path: /^\/v1\/fit\/fits$/,
      handler: ({ auth, url, language }) =>
        read(auth, (own, tx) => {
          const day = dayOf(auth, url.searchParams.get('day'), own);
          const slot = SLOTS.includes(url.searchParams.get('slot'))
            ? url.searchParams.get('slot')
            : null;
          const summary = daySummary(ctx, own, day, language);
          const left = summary.remaining;
          if (!left || left.kcal < FITS_MIN_KCAL) return ok(200, { remaining: left, fits: [] });
          const customFoods = own.list('customFoods');
          const { suggestions } = suggestRecipes({
            catalog,
            profile: own.list('profiles')[0]?.profile ?? {},
            pantry: [],
            remaining: left,
            userRecipes: own.list('recipes'),
            customFoods,
            slot,
            today: day,
            limit: 8,
          });
          const cacheRows = tx.shared('foodCache');
          const fits = suggestions
            .filter((entry) => entry.nutrition.perServing.kcal <= left.kcal + 50)
            .slice(0, 3)
            .map(({ recipe, nutrition }) => ({
              id: recipe.id,
              title: pick(recipe.title, language),
              servings: recipe.servings,
              perServing: nutrition.perServing,
              items: recipe.items
                .filter((item) => !item.optional && item.grams > 0)
                .filter((item) => catalog.find(item.foodId, { customFoods, cacheRows }))
                .map((item) => ({
                  foodId: item.foodId,
                  grams: Math.max(1, Math.round(item.grams / Math.max(1, recipe.servings))),
                })),
            }))
            .filter((entry) => entry.items.length > 0);
          return ok(200, { remaining: left, fits });
        }),
    },
    ...logRoutes(ctx),
  ];
}

// Kueche, Foto, Coach und Werkzeuge holen die Rechnung weiter von hier.
module.exports = {
  diaryRoutes,
  daySummary,
  goalsOf,
  mealLines,
  SLOTS,
  waterTargetMl: diary.waterTargetMl,
};
