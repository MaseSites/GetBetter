/**
 * Der Ende-zu-Ende-Ablauf aus dem Auftrag, gegen den echten Dienst im Mock-Modus:
 *
 *   Vorraete erfassen -> Rezept vorschlagen -> Rezept speichern -> Wochenplan
 *   erstellen -> Einkaufsliste generieren -> Mahlzeit protokollieren ->
 *   Tagesmakros aktualisiert
 *
 * Dazu der Coach: „Ich will heute nicht trainieren. Verschiebe das Training
 * auf morgen.“ — vorschlagen, bestaetigen, gespeichertes Ergebnis melden.
 * Jede Aenderung laeuft ueber einen bestaetigten Vorschlag.
 */
const assert = require('node:assert/strict');
const { after, before, describe, test } = require('node:test');

const { startFitServer } = require('./fitHarness.js');

const PROFILE = { birthDate: '1990-03-14', heightCm: 172, weightKg: 68, sex: 'female', activity: 'moderate', trainingDaysPerWeek: 3, goal: 'maintain', diet: 'omnivore', allergies: [], maxCookMinutes: 45, equipment: ['stove', 'oven', 'blender'] };

describe('Better Fit: Ende-zu-Ende', () => {
  let server;
  let user;
  let token;
  const call = (method, route, body, headers) => server.call(method, route, { token, ...(body === undefined ? {} : { body }), ...(headers ? { headers } : {}) });
  const confirm = (action) => call('POST', `/v1/fit/actions/${action.id}/confirm`);
  let today;
  let recipeId;
  let planId;

  before(async () => {
    server = await startFitServer();
    user = await server.signUp('ende');
    token = user.token;
    assert.equal((await call('PUT', '/v1/fit/profile', PROFILE)).status, 200);
    today = (await call('GET', '/v1/fit/day')).body.day;
  });
  after(() => server.stop());

  test('1. Vorraete aus Text: erst Vorschlag, gespeichert erst nach Bestaetigung', async () => {
    const parsed = await call('POST', '/v1/fit/pantry/parse', { text: 'Ich habe 3 Bananen, 1 kg Mehl und Eier zu Hause.' });
    assert.deepEqual(parsed.body.lines.map((line) => line.foodId), ['mock:banana', 'mock:flour', 'mock:egg']);
    const proposed = await call('POST', '/v1/fit/pantry/items', { lines: parsed.body.lines.map(({ foodId, amount, unit }) => ({ foodId, amount, unit })), source: 'text' });
    assert.equal(proposed.status, 201);
    assert.equal(proposed.body.action.status, 'proposed');
    assert.equal((await call('GET', '/v1/fit/pantry')).body.items.length, 0, 'vor der Bestaetigung ist nichts gespeichert');
    const confirmed = await confirm(proposed.body.action);
    assert.equal(confirmed.body.action.status, 'confirmed');
    assert.deepEqual(confirmed.body.action.result.names, ['Banane', 'Weissmehl', 'Ei']);
    const pantry = (await call('GET', '/v1/fit/pantry')).body.items;
    assert.deepEqual(pantry.map((item) => [item.name, item.grams]), [['Banane', 360], ['Ei', null], ['Weissmehl', 1000]]);
  });

  test('2. Rezeptvorschlaege mit klar getrennten fehlenden Zutaten', async () => {
    const result = await call('POST', '/v1/fit/recipes/suggest', {});
    const titles = result.body.suggestions.map((entry) => entry.recipe.title);
    assert.ok(titles.includes('Bananen-Pancakes'));
    assert.ok(titles.includes('Bananenkuchen'));
    const pancakes = result.body.suggestions.find((entry) => entry.recipe.title === 'Bananen-Pancakes');
    assert.deepEqual(pancakes.missing.map((entry) => [entry.name, entry.basic]), [['Backpulver', true], ['Rapsöl', true]]);
    assert.ok(pancakes.nutrition.perServing.kcal > 0);
  });

  test('3. Rezept speichern (Vorschlag mit Naehrwerten), dann bearbeiten', async () => {
    const proposed = await call('POST', '/v1/fit/recipes', { fromLibrary: 'lib:banana-pancakes' });
    assert.equal(proposed.body.action.preview.summary.title, 'Bananen-Pancakes');
    assert.ok(proposed.body.action.preview.summary.perServing.kcal > 0);
    const saved = await confirm(proposed.body.action);
    recipeId = saved.body.action.result.recipeId;
    const recipes = (await call('GET', '/v1/fit/recipes')).body.recipes;
    assert.equal(recipes.length, 1);
    const recipe = recipes[0];
    const edit = await call('POST', '/v1/fit/recipes', {
      recipeId,
      recipe: { ...recipe, title: 'Meine Bananen-Pancakes', servings: 3, items: recipe.items.map(({ foodId, amount, unit, optional }) => ({ foodId, amount, unit, optional })) },
    });
    assert.equal(edit.body.action.preview.summary.kind, 'recipe_update');
    await confirm(edit.body.action);
    const edited = (await call('GET', `/v1/fit/recipes/${recipeId}`)).body.recipe;
    assert.equal(edited.title, 'Meine Bananen-Pancakes');
    assert.equal(edited.nutrition.perServing.kcal, Math.round(edited.nutrition.total.kcal / 3));
  });

  test('4. Wochenplan: Vorschlag, Trainings- und Ruhetage, erst nach Bestaetigung gespeichert', async () => {
    const proposed = await call('POST', '/v1/fit/meal-plans/generate', {});
    assert.equal(proposed.status, 201);
    const summary = proposed.body.action.preview.summary;
    assert.equal(summary.days.length, 7);
    assert.ok(summary.days.some((day) => day.kind === 'training') && summary.days.some((day) => day.kind === 'rest'));
    for (const day of summary.days) assert.equal(day.tolerance.kcalOk, true, day.day);
    assert.equal((await call('GET', '/v1/fit/meal-plans/current')).body.plan, null);
    const saved = await confirm(proposed.body.action);
    planId = saved.body.action.result.planId;
    const plan = (await call('GET', '/v1/fit/meal-plans/current')).body.plan;
    assert.equal(plan.id, planId);
    assert.equal(plan.days.flatMap((day) => day.entries).length, 28);
  });

  test('5. Einkaufsliste: zusammengefasst, Vorrat abgezogen', async () => {
    const proposed = await call('POST', '/v1/fit/shopping-lists/from-meal-plan', { planId });
    const saved = await confirm(proposed.body.action);
    assert.equal(saved.body.action.result.kind, 'shopping_saved');
    const list = (await call('GET', '/v1/fit/shopping-lists/current')).body.list;
    const ids = list.items.map((item) => item.foodId);
    assert.equal(new Set(ids).size, ids.length);
    const flour = list.items.find((item) => item.foodId === 'mock:flour');
    assert.ok(!flour || flour.pantryGrams === 1000, 'Mehl ist im Vorrat und wird abgezogen');
    const egg = list.items.find((item) => item.foodId === 'mock:egg');
    if (egg) assert.equal(egg.pantryCheck, true, 'Eier ohne Menge: pruefen');
  });

  test('6. Mahlzeit ersetzen: nur nach Bestaetigung, die Liste wird als veraltet markiert und per Diff aktualisiert', async () => {
    const plan = (await call('GET', '/v1/fit/meal-plans/current')).body.plan;
    const entry = plan.days.flatMap((day) => day.entries).find((candidate) => candidate.slot === 'dinner' && !candidate.fromEntryId && candidate.day > today);
    const proposed = await call('PATCH', `/v1/fit/meal-plans/${planId}/entries/${entry.id}`, { change: { recipeId: 'lib:lentil-curry' } });
    assert.equal(proposed.status, 201, JSON.stringify(proposed.body));
    assert.equal(proposed.body.action.preview.summary.shoppingListAffected, true);
    const unchanged = (await call('GET', '/v1/fit/meal-plans/current')).body.plan;
    assert.equal(unchanged.days.flatMap((day) => day.entries).find((candidate) => candidate.id === entry.id).recipeId, entry.recipeId);
    await confirm(proposed.body.action);
    const current = await call('GET', '/v1/fit/meal-plans/current');
    assert.equal(current.body.shoppingListStale, true);
    const update = await call('POST', '/v1/fit/shopping-lists/from-meal-plan', { planId });
    assert.equal(update.body.action.preview.summary.kind, 'shopping_update');
    await confirm(update.body.action);
    const list = (await call('GET', '/v1/fit/shopping-lists/current')).body.list;
    assert.equal(list.stale, false);
    assert.equal(new Set(list.items.map((item) => item.foodId)).size, list.items.length, 'keine Duplikate nach dem Update');
  });

  test('7. Mahlzeit aus dem Plan protokollieren -> Tagesmakros; Vorratsabzug nur als Vorschlag', async () => {
    const before = (await call('GET', `/v1/fit/day?day=${today}`)).body;
    const plan = (await call('GET', '/v1/fit/meal-plans/current')).body.plan;
    const entry = plan.days.find((day) => day.day === today).entries.find((candidate) => candidate.slot === 'breakfast');
    const logged = await call('POST', `/v1/fit/meal-plans/${planId}/entries/${entry.id}/log`, undefined, { 'Idempotency-Key': 'plan-fruehstueck-1' });
    assert.equal(logged.status, 201);
    assert.equal(logged.body.meal.source, 'plan');
    assert.equal(logged.body.day.total.kcal, before.total.kcal + logged.body.meal.total.kcal);
    assert.equal(logged.body.day.remaining.kcal, logged.body.day.target.kcal - logged.body.day.total.kcal);
    const again = await call('POST', `/v1/fit/meal-plans/${planId}/entries/${entry.id}/log`, undefined, { 'Idempotency-Key': 'plan-fruehstueck-1' });
    assert.equal(again.body.meal.id, logged.body.meal.id, 'kein Duplikat');
    const eaten = (await call('GET', '/v1/fit/meal-plans/current')).body.plan.days.find((day) => day.day === today).entries.find((candidate) => candidate.id === entry.id);
    assert.equal(eaten.status, 'eaten');
    const swap = await call('PATCH', `/v1/fit/meal-plans/${planId}/entries/${entry.id}`, { change: { skip: true } });
    assert.equal(swap.body.error, 'entry_eaten', 'Gegessenes wird nicht rueckwirkend geaendert');

    // Eine gespeicherte Rezeptportion direkt ins Tagebuch.
    const portion = await call('POST', `/v1/fit/recipes/${recipeId}/log`, { portions: 1, slot: 'snack', day: today });
    assert.equal(portion.status, 201);
    assert.equal(portion.body.meal.source, 'recipe');
    const recipe = (await call('GET', `/v1/fit/recipes/${recipeId}`)).body.recipe;
    assert.ok(Math.abs(portion.body.meal.total.kcal - recipe.nutrition.perServing.kcal) <= 2);
    assert.equal(portion.body.pantryAction.status, 'proposed', 'Vorratsabzug nur als Vorschlag');
    const pantryBefore = (await call('GET', '/v1/fit/pantry')).body.items.find((item) => item.foodId === 'mock:banana').grams;
    assert.equal(pantryBefore, 360, 'vor der Bestaetigung unveraendert');
    await confirm(portion.body.pantryAction);
    const pantryAfter = (await call('GET', '/v1/fit/pantry')).body.items.find((item) => item.foodId === 'mock:banana')?.grams ?? 0;
    assert.equal(pantryAfter, 360 - 80, 'eine von drei Portionen: 2 Bananen × 120 g ÷ 3');
  });

  test('8. Coach: Training verschieben — Vorschlag, Bestaetigung, gespeichertes Ergebnis', async () => {
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
    const created = await call('POST', '/v1/fit/workout-plans', { goal: 'muscle', experience: 'beginner', equipment: 'dumbbells', weekdays: [weekday, (weekday + 2) % 7, (weekday + 4) % 7] });
    assert.equal(created.body.action.preview.summary.template, 'Ganzkörper, 3 Tage');
    await confirm(created.body.action);

    const reply = await call('POST', '/v1/fit/coach/message', { text: 'Ich will heute nicht trainieren. Verschiebe das Training auf morgen.' });
    const proposal = reply.body.messages.find((message) => message.kind === 'proposal');
    assert.equal(proposal.tool, 'reschedule_workout');
    assert.equal(proposal.data.fromDay, today);
    const workouts = (await call('GET', '/v1/fit/workouts')).body.workouts;
    assert.ok(workouts.some((workout) => workout.day === today), 'vor der Bestaetigung bleibt das Training, wo es war');

    const confirmed = await call('POST', `/v1/fit/coach/actions/${proposal.actionId}/confirm`);
    assert.equal(confirmed.body.action.result.kind, 'workout_moved');
    const moved = (await call('GET', '/v1/fit/workouts')).body.workouts.find((workout) => workout.id === confirmed.body.action.result.workoutId);
    assert.equal(moved.movedFrom, today);
    const history = (await call('GET', '/v1/fit/coach/messages')).body.messages;
    const last = history.at(-1);
    assert.equal(last.kind, 'confirmed');
    assert.equal(last.data.toDay, moved.day, 'der Coach meldet, was gespeichert ist');

    // Heute ist jetzt ein Ruhetag: das Tagesziel folgt.
    const day = (await call('GET', `/v1/fit/day?day=${today}`)).body;
    assert.equal(day.kind, 'rest');
  });

  test('9. veraltete Vorschlaege speichern nichts, fremde gibt es nicht', async () => {
    const first = await call('POST', '/v1/fit/actions', { tool: 'log_weight', args: { weightKg: 67.5, day: today } });
    await call('POST', '/v1/fit/weights', { day: today, weightKg: 67.9 });
    const stale = await confirm(first.body.action);
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error, 'stale');
    const other = await server.signUp('fremd');
    const foreign = await server.call('POST', `/v1/fit/actions/${first.body.action.id}/confirm`, { token: other.token });
    assert.equal(foreign.status, 404);
    const coach = await call('POST', '/v1/fit/coach/message', { text: 'Mein Knie tut weh' });
    assert.equal(coach.body.messages[0].kind, 'safety');
    const free = await call('POST', '/v1/fit/coach/message', { text: 'Warum ist Eiweiss wichtig?' });
    assert.equal(free.body.messages[0].kind, 'general_unavailable', 'ohne KI-Schluessel ehrlich statt erfunden');
  });

  test('10. Coach: „Ich habe Bananen, Mehl und Eier“ -> Vorrat als Vorschlag und passende Rezepte', async () => {
    const reply = await call('POST', '/v1/fit/coach/message', { text: 'Ich habe Bananen, Mehl und Eier.' });
    const kinds = reply.body.messages.map((message) => message.kind);
    assert.deepEqual(kinds, ['proposal', 'suggestions']);
    assert.equal(reply.body.messages[0].tool, 'add_to_pantry');
    const titles = reply.body.messages[1].data.items.map((item) => item.title);
    assert.ok(titles.includes('Bananen-Pancakes') || titles.includes('Meine Bananen-Pancakes'));
  });
});
