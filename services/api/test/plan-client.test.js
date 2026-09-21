/**
 * Die Apps kennen die Preise und die gesperrten Felder, bevor der Dienst
 * antwortet (`packages/core/src/features/plan/`). Dieser Test liest die Quelle
 * der Apps und haelt sie gleich mit dem Dienst — wie beim Avatar.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { LOCKED_FIELDS } = require('../billing/entitlement.js');
const { DEFAULT_PRICES_CHF, DEFAULTS } = require('../billing/plans.js');

const PLAN_DIR = path.join(__dirname, '..', '..', '..', 'packages', 'core', 'src', 'features', 'plan');
const read = (name) => fs.readFileSync(path.join(PLAN_DIR, name), 'utf8');

function blockOf(source, name, close) {
  const start = source.indexOf(`export const ${name}`);
  assert.ok(start >= 0, name);
  const end = source.indexOf(close, start);
  assert.ok(end > start, name);
  return source.slice(start, end);
}

test('die Preise der Apps stimmen mit billing/plans.js ueberein', () => {
  const block = blockOf(read('prices.ts'), 'PLAN_PRICES_CHF', '};');
  const prices = Object.fromEntries(
    [...block.matchAll(/\n\s+(\w+): (null|\d+(?:\.\d+)?),/g)].map((match) => [
      match[1],
      match[2] === 'null' ? null : Number(match[2]),
    ]),
  );
  assert.deepEqual(prices, { ...DEFAULT_PRICES_CHF });
});

test('die gesperrten Felder der Apps stimmen mit billing/entitlement.js ueberein', () => {
  const block = blockOf(read('entitlement.ts'), 'LOCKED_FIELDS', ']');
  const fields = [...block.matchAll(/'(\w+)'/g)].map((match) => match[1]);
  assert.deepEqual(fields, LOCKED_FIELDS);
});

test('die Apps rechnen mit derselben Jahreslaenge wie der Dienst', () => {
  const match = /PLAN_YEAR_MONTHS = (\d+)/.exec(read('prices.ts'));
  assert.ok(match, 'PLAN_YEAR_MONTHS');
  assert.equal(Number(match[1]), DEFAULTS.yearMonths);
});
