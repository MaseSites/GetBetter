/**
 * Der Dienst bietet dem Modell Funktionen an (`ai/tools.js`), die App fuehrt
 * sie aus (`packages/core/src/features/assistant/actions.ts`). Dieser Test liest
 * die Quelle der App und haelt beide gleich — Namen, Aufzaehlungen und was man
 * in welcher App oeffnen kann.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { APP_MODULES, TOOLS } = require('../ai/tools.js');

const CORE = path.join(__dirname, '..', '..', '..', 'packages', 'core', 'src');
const read = (...parts) => fs.readFileSync(path.join(CORE, ...parts), 'utf8');

/** Die Texte in `(export) const NAME = [ … ]` in der Reihenfolge der Quelle. */
function listOf(source, name) {
  const start = source.indexOf(`const ${name} = [`);
  assert.ok(start >= 0, name);
  const end = source.indexOf(']', start);
  return [...source.slice(start, end).matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

const toolNamed = (name) => TOOLS.find((tool) => tool.name === name);
const enumOf = (tool, field) => tool.parameters.properties[field].enum;

test('dieselben Funktionen in Dienst und App', () => {
  const actions = read('features', 'assistant', 'actions.ts');
  assert.deepEqual(listOf(actions, 'ACTION_NAMES').sort(), TOOLS.map((tool) => tool.name).sort());
});

test('dieselben Aufzaehlungen: Wochentage, Mahlzeiten, Kategorien, Aussehen', () => {
  const actions = read('features', 'assistant', 'actions.ts');
  assert.deepEqual(listOf(actions, 'ALARM_DAYS'), toolNamed('set_alarm').parameters.properties.days.items.enum);
  assert.deepEqual(listOf(actions, 'MEAL_SLOTS'), enumOf(toolNamed('log_meal'), 'slot'));
  assert.deepEqual(listOf(actions, 'EXPENSE_CATEGORIES'), enumOf(toolNamed('add_expense'), 'category'));
  assert.deepEqual(listOf(actions, 'THEME_MODES'), enumOf(toolNamed('set_theme'), 'mode'));
});

test('jede App hat in der App dieselben Funktionen wie im Dienst', () => {
  const actions = read('features', 'assistant', 'actions.ts');
  const start = actions.indexOf('export const APP_ACTIONS');
  const block = actions.slice(start, actions.indexOf('};', start));
  const groups = {
    EVERYWHERE: listOf(actions, 'EVERYWHERE'),
    CALENDAR: listOf(actions, 'CALENDAR'),
  };
  for (const app of Object.keys(APP_MODULES)) {
    const entry = new RegExp(`${app}: \\[([^\\]]*)\\]`).exec(block);
    assert.ok(entry, app);
    const named = [...entry[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
    const spread = [...entry[1].matchAll(/\.\.\.(\w+)/g)].flatMap((match) => groups[match[1]] ?? []);
    const inService = TOOLS.filter((tool) => tool.apps.includes(app)).map((tool) => tool.name);
    assert.deepEqual([...named, ...spread].sort(), inService.sort(), app);
  }
});

test('was man oeffnen kann, ist genau APP_MODULES der Apps', () => {
  const identity = read('app', 'identity.ts');
  const start = identity.indexOf('export const APP_MODULES');
  const block = identity.slice(start, identity.indexOf('};', start));
  for (const [app, modules] of Object.entries(APP_MODULES)) {
    const entry = new RegExp(`${app}: \\[([^\\]]*)\\]`).exec(block);
    assert.ok(entry, app);
    assert.deepEqual([...entry[1].matchAll(/'([^']+)'/g)].map((match) => match[1]), modules, app);
  }
});
