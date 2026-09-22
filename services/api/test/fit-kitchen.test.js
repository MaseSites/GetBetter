/**
 * Kueche gegen den echten Dienst (Paket C): Vorrat zusammenfuehren und in
 * seiner Einheit, Abzug ueber mehrere Zeilen, Bibliothek nie doppelt,
 * Favoriten, direkt eintragen, Handposten, „Liste veraltet“ und Sprachen.
 */
const assert = require('node:assert/strict');
const { after, before, describe, test } = require('node:test');

const { startFitServer } = require('./fitHarness.js');

const PROFILE = { birthDate: '1990-03-14', heightCm: 172, weightKg: 68, sex: 'female', activity: 'moderate', trainingDaysPerWeek: 3, goal: 'maintain', diet: 'omnivore', allergies: [], maxCookMinutes: 45, equipment: ['stove', 'oven', 'blender'] };

describe('Better Fit: Kueche', () => {
  let server;
  let token;
  const call = (method, route, body, headers) => server.call(method, route, { token, ...(body === undefined ? {} : { body }), ...(headers ? { headers } : {}) });
  const confirm = (action) => call('POST', `/v1/fit/actions/${action.id}/confirm`);
  const pantry = async () => (await call('GET', '/v1/fit/pantry')).body.items;

  before(async () => {
    server = await startFitServer();
    token = (await server.signUp('kueche')).token;
    assert.equal((await call('PUT', '/v1/fit/profile', PROFILE)).status, 200);
  });
  after(() => server.stop());

  test('Vorrat: dasselbe zweimal wird eine Zeile, Stueck bleibt Stueck, nur der Name aendert nichts', async () => {
    const first = await call('POST', '/v1/fit/pantry/items', { lines: [{ foodId: 'mock:rice', amount: 500, unit: 'g' }, { foodId: 'mock:rice', amount: 200, unit: 'g' }, { foodId: 'mock:egg', amount: 6, unit: 'piece' }], source: 'text' });
    assert.equal(first.body.action.preview.changes.length, 2);
    await confirm(first.body.action);
    const rice = (await pantry()).find((item) => item.foodId === 'mock:rice');
    assert.equal(rice.grams, 700);

    const more = await call('POST', '/v1/fit/pantry/items', { lines: [{ foodId: 'mock:egg', amount: 4, unit: 'piece' }, { foodId: 'mock:rice', amount: null, unit: null }], source: 'text' });
    const [eggs, keep] = more.body.action.preview.changes;
    assert.equal(eggs.op, 'increase');
    assert.equal(eggs.unit, 'piece');
    assert.equal(eggs.amount, 10);
    assert.equal(keep.op, 'keep', 'nur „Reis“ laesst die 700 g stehen');
    await confirm(more.body.action);
    const after = await pantry();
    assert.equal(after.find((item) => item.foodId === 'mock:egg').unit, 'piece');
    assert.equal(after.find((item) => item.foodId === 'mock:rice').grams, 700);
  });

  test('Abzug ueber mehrere Zeilen, zuerst was bald ablaeuft, gekocht in roh umgerechnet', async () => {
    const added = await call('POST', '/v1/fit/pantry/items', { lines: [{ foodId: 'mock:rice_cooked', amount: 100, unit: 'g', bestBefore: '2026-01-01' }], source: 'manual' });
    await confirm(added.body.action);
    const proposal = await call('POST', '/v1/fit/actions', { tool: 'reduce_pantry', args: { deductions: [{ foodId: 'mock:rice_cooked', grams: 370 }] } });
    assert.equal(proposal.status, 201, JSON.stringify(proposal.body));
    const changes = proposal.body.action.preview.changes;
    const cooked = changes.find((change) => change.name.includes('gekocht'));
    assert.equal(cooked.op, 'remove', 'die gekochten 100 g zuerst');
    const raw = changes.find((change) => change.op === 'set');
    assert.ok(raw.grams < 700 && raw.grams > 550, `270 g gekocht sind etwa 100 g roh: ${raw.grams}`);
  });

  test('Bibliothek: einmal speichern, dann als eigenes; Favorit zuoberst; direkt eintragen', async () => {
    const saved = await confirm((await call('POST', '/v1/fit/recipes', { fromLibrary: 'lib:banana-pancakes' })).body.action);
    const recipeId = saved.body.action.result.recipeId;
    const twice = await call('POST', '/v1/fit/recipes', { fromLibrary: 'lib:banana-pancakes' });
    assert.equal(twice.status, 409);
    assert.equal(twice.body.error, 'already_saved');
    assert.equal(twice.body.details.recipeId, recipeId);
    const detail = (await call('GET', '/v1/fit/recipes/lib:banana-pancakes')).body;
    assert.equal(detail.savedId, recipeId);
    const library = (await call('GET', '/v1/fit/recipes/library')).body.recipes;
    assert.equal(library.some((recipe) => recipe.id === 'lib:banana-pancakes'), false);

    await confirm((await call('POST', '/v1/fit/recipes', { fromLibrary: 'lib:apple-almonds' })).body.action);
    const star = await call('POST', `/v1/fit/recipes/${recipeId}/favorite`, { favorite: true });
    assert.equal(star.status, 200);
    const mine = (await call('GET', '/v1/fit/recipes')).body.recipes;
    assert.equal(mine[0].id, recipeId);
    assert.equal(mine[0].favorite, true);

    const logged = await call('POST', '/v1/fit/recipes/lib:porridge-banana/log', { portions: 1, slot: 'breakfast' }, { 'Idempotency-Key': 'lib-log-1' });
    assert.equal(logged.status, 201, JSON.stringify(logged.body));
    assert.equal(logged.body.meal.source, 'recipe');
    assert.ok(logged.body.meal.total.kcal > 0);
  });

  test('Einkauf: Handposten mit Lebensmittel, bleibt beim Aktualisieren; ohne Unterschied nicht mehr veraltet', async () => {
    const plan = await confirm((await call('POST', '/v1/fit/meal-plans/generate', {})).body.action);
    const planId = plan.body.action.result.planId;
    await confirm((await call('POST', '/v1/fit/shopping-lists/from-meal-plan', { planId })).body.action);
    const listId = (await call('GET', '/v1/fit/shopping-lists/current')).body.list.id;
    const added = await call('POST', `/v1/fit/shopping-lists/${listId}/items`, { name: 'Bananen', amount: 2, unit: 'piece', category: 'produce' });
    assert.equal(added.body.item.foodId, 'mock:banana');
    assert.equal(added.body.item.shopCategory, 'produce');
    await call('POST', `/v1/fit/shopping-lists/${listId}/items`, { name: 'Servietten' });
    await call('POST', `/v1/fit/shopping-lists/${listId}/items`, { name: 'Kerzen' });

    const current = (await call('GET', '/v1/fit/meal-plans/current')).body.plan;
    const entry = current.days.flatMap((day) => day.entries).find((candidate) => candidate.slot === 'snack' && candidate.status === 'planned');
    const options = await call('GET', `/v1/fit/meal-plans/${planId}/entries/${entry.id}/options`);
    assert.ok(options.body.options.length > 0 && options.body.options.every((option) => option.kcal > 0 && option.recipeId !== entry.recipeId));

    await confirm((await call('PATCH', `/v1/fit/meal-plans/${planId}/entries/${entry.id}`, { change: { skip: true } })).body.action);
    await confirm((await call('PATCH', `/v1/fit/meal-plans/${planId}/entries/${entry.id}`, { change: { unskip: true } })).body.action);
    assert.equal((await call('GET', '/v1/fit/meal-plans/current')).body.shoppingListStale, true);
    const update = await call('POST', '/v1/fit/shopping-lists/from-meal-plan', { planId });
    assert.equal(update.status, 409);
    assert.equal(update.body.error, 'no_changes');
    assert.equal((await call('GET', '/v1/fit/meal-plans/current')).body.shoppingListStale, false, 'ohne Unterschied nicht mehr veraltet');
    const items = (await call('GET', '/v1/fit/shopping-lists/current')).body.list.items;
    for (const name of ['Bananen', 'Servietten', 'Kerzen']) assert.ok(items.some((item) => item.name === name), name);
  });

  test('Sprachen: Bibliothek und Vorrat auf Franzoesisch, gespeichert bleibt Deutsch', async () => {
    const french = { 'Accept-Language': 'fr-CH' };
    const library = (await call('GET', '/v1/fit/recipes/library', undefined, french)).body.recipes;
    assert.ok(library.some((recipe) => recipe.title === 'Cake à la banane'));
    const items = (await call('GET', '/v1/fit/pantry', undefined, french)).body.items;
    assert.ok(items.some((item) => item.name === 'Œuf'));
    assert.ok((await pantry()).some((item) => item.name === 'Ei'));
  });
});
