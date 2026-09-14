/**
 * Der Katalog des Admins spiegelt `identity.ts` und die Sammlungen der Apps.
 * Die Tests lesen die TypeScript-Dateien als Text und schlagen an, sobald eine
 * App eine Funktion bekommt, die hier fehlt.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, test } = require('node:test');

const { APPS, APP_IDS, APP_MODULES, MODULE_LIST, countItems } = require('./catalog.js');

const CORE = path.join(__dirname, '..', '..', '..', 'packages', 'core', 'src');
const IDENTITY = fs.readFileSync(path.join(CORE, 'app', 'identity.ts'), 'utf8');
const TYPES = fs.readFileSync(path.join(CORE, 'db', 'types.ts'), 'utf8');

const quoted = (text) => [...text.matchAll(/'([^']+)'/g)].map((match) => match[1]);

/** Der Text von `export const <name>` bis zum Ende seines Literals. */
function blockOf(text, name, closing) {
  const start = text.indexOf(`export const ${name}`);
  assert.notEqual(start, -1, `${name} fehlt`);
  return text.slice(start, text.indexOf(closing, start) + closing.length);
}

function appModulesInIdentity() {
  const block = blockOf(IDENTITY, 'APP_MODULES', '};');
  return Object.fromEntries(
    [...block.matchAll(/(\w+):\s*\[([^\]]*)\]/g)].map((match) => [match[1], quoted(match[2])]),
  );
}

describe('admin catalog', () => {
  test('knows every app of identity.ts with its name', () => {
    assert.deepEqual(APP_IDS, quoted(blockOf(IDENTITY, 'APP_IDS', ']')));
    const names = Object.fromEntries(
      [...blockOf(IDENTITY, 'APPS', '};').matchAll(/id: '(\w+)',\s*name: '([^']+)'/g)].map(
        (match) => [match[1], match[2]],
      ),
    );
    assert.deepEqual(Object.fromEntries(APPS.map((app) => [app.id, app.name])), names);
  });

  test('lists every module of APP_MODULES, in the same order', () => {
    const identity = appModulesInIdentity();
    assert.deepEqual(Object.keys(identity), APP_IDS);
    for (const app of APP_IDS) {
      const missing = identity[app].filter((id) => !APP_MODULES[app].includes(id));
      assert.deepEqual(missing, [], `${app}: im Admin-Katalog fehlen ${missing.join(', ')}`);
      assert.deepEqual(APP_MODULES[app], identity[app], app);
    }
  });

  test('uses only collections the apps actually have', () => {
    const collections = quoted(blockOf(TYPES, 'COLLECTION_NAMES', ']'));
    for (const module of MODULE_LIST) {
      assert.ok(module.name.length > 0, `${module.app}:${module.id} ohne Namen`);
      if (module.collection === null) continue;
      assert.ok(
        collections.includes(module.collection),
        `${module.app}:${module.id} -> ${module.collection} gibt es nicht`,
      );
    }
  });

  test('counts rows per module and account', () => {
    const find = (app, id) => MODULE_LIST.find((module) => module.app === app && module.id === id);
    const events = [
      { id: 'e1', accountId: 'acc_a', calendar: 'personal' },
      { id: 'e2', accountId: 'acc_a', calendar: 'family' },
      { id: 'e3', accountId: 'acc_b', calendar: 'custom' },
    ];
    assert.equal(countItems(find('getbetter', 'calendar'), events), 2);
    assert.equal(countItems(find('getbetter', 'calendar'), events, 'acc_a'), 1);
    assert.equal(countItems(find('betterfamily', 'calendar'), events, 'acc_a'), 1);

    const contacts = [
      { id: 'c1', accountId: 'acc_a', birthday: '1990-01-01' },
      { id: 'c2', accountId: 'acc_a', birthday: null },
    ];
    assert.equal(countItems(find('getbetter', 'birthdays'), contacts, 'acc_a'), 1);
    assert.equal(countItems(find('getbetter', 'contacts'), contacts, 'acc_a'), 2);

    const chores = [{ id: 'ch1', householdId: 'h1', assignedTo: 'acc_b' }, null];
    assert.equal(countItems(find('betterfamily', 'chores'), chores, 'acc_b'), 1);
    assert.equal(countItems(find('getbetter', 'weather'), events), 0);
  });
});
