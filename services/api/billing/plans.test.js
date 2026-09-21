/** Abo, Budget und Monat — reine Rechnung, ohne Dateien. */
const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { affordableTokens, aiChfOf, estimatePromptTokens, monthSums, speechChfOf, speechSettings, worstCaseChf } =
  require('./costs.js');
const { readFromOf, readToOf, resetsOnOf, zurichMonthOf } = require('./month.js');
const {
  budgetOf,
  monthlyPriceOf,
  netRevenueChf,
  paidBudgetChf,
  planOf,
  planSettings,
  priceOf,
  termOf,
  yearPriceOf,
} = require('./plans.js');

const DEFAULT = planSettings({});

describe('Abo und Budget', () => {
  test('Budget = Preis / 1.081 × 0.85 × 0.75 fuer jede App', () => {
    const expected = { betterai: 4.72, bettergym: 2.95, betterfamily: 1.77, getbetter: 0.59 };
    for (const [app, rounded] of Object.entries(expected)) {
      const price = priceOf(app, DEFAULT);
      const exact = (price / 1.081) * 0.85 * 0.75;
      assert.equal(Math.round(paidBudgetChf(price, DEFAULT) * 100) / 100, rounded, app);
      assert.ok(paidBudgetChf(price, DEFAULT) <= exact, `${app}: nie mehr als gerechnet`);
      assert.ok(exact - paidBudgetChf(price, DEFAULT) < 1e-6, app);
    }
    assert.deepEqual(
      ['betterai', 'bettergym', 'betterfamily', 'getbetter'].map((app) => priceOf(app, DEFAULT)),
      [8, 5, 3, 1],
    );
    // Dem Betreiber bleiben immer mindestens 25 % der Nettoeinnahmen.
    for (const price of [1, 3, 5, 8]) {
      assert.ok(paidBudgetChf(price, DEFAULT) <= netRevenueChf(price, DEFAULT) * 0.75 + 1e-9);
    }
  });

  test('Jahresabo: zehn Monatspreise, kleineres Budget, Marge bleibt', () => {
    for (const app of ['getbetter', 'betterfamily', 'bettergym', 'betterai']) {
      const price = priceOf(app, DEFAULT);
      assert.equal(yearPriceOf(app, DEFAULT), price * 10, app);
      assert.equal(monthlyPriceOf(app, DEFAULT, 'year'), (price * 10) / 12, app);
      assert.equal(monthlyPriceOf(app, DEFAULT, 'month'), price, app);
      const yearBudget = budgetOf('paid', app, DEFAULT, 'year');
      assert.ok(yearBudget < budgetOf('paid', app, DEFAULT, 'month'), app);
      // Auch jaehrlich bleiben dem Betreiber mindestens 25 % der Nettoeinnahmen.
      assert.ok(yearBudget <= netRevenueChf((price * 10) / 12, DEFAULT) * 0.75 + 1e-9, app);
    }
    assert.equal(yearPriceOf('bettermoney', DEFAULT), null);
    assert.equal(termOf({ planTerms: { getbetter: 'year' } }, 'getbetter'), 'year');
    assert.equal(termOf({ planTerms: { getbetter: 'jahr' } }, 'getbetter'), 'month');
    assert.equal(termOf({}, 'getbetter'), 'month');
    // Eine andere Laufzeit laesst sich einstellen.
    const custom = planSettings({ BETTER_YEAR_MONTHS: '11' });
    assert.equal(yearPriceOf('getbetter', custom), 11);
  });

  test('BetterMoney hat noch keinen Preis: immer Gratis, auch mit paidApps', () => {
    assert.equal(priceOf('bettermoney', DEFAULT), null);
    assert.equal(netRevenueChf(null, DEFAULT), 0);
    const account = { id: 'acc_a', paidApps: ['bettermoney', 'betterai'] };
    assert.equal(planOf(account, 'bettermoney', DEFAULT), 'trial');
    assert.equal(budgetOf('paid', 'bettermoney', DEFAULT), 0.1);
    assert.equal(planOf(account, 'betterai', DEFAULT), 'paid');
  });

  test('planOf: nur paidApps zaehlt, alles andere ist Gratis', () => {
    assert.equal(planOf({ paidApps: ['bettergym'] }, 'bettergym', DEFAULT), 'paid');
    assert.equal(planOf({ paidApps: ['bettergym'] }, 'getbetter', DEFAULT), 'trial');
    assert.equal(planOf({}, 'getbetter', DEFAULT), 'trial');
    assert.equal(planOf(null, 'getbetter', DEFAULT), 'trial');
    assert.equal(planOf({ paidApps: 'getbetter' }, 'getbetter', DEFAULT), 'trial');
    assert.equal(planOf({ paidApps: ['getbetter'] }, 'betterx', DEFAULT), 'trial');
    assert.equal(budgetOf('trial', 'betterai', DEFAULT), 0.1);
    assert.equal(budgetOf('paid', 'betterai', DEFAULT), paidBudgetChf(8, DEFAULT));
  });

  test('Umgebung uebersteuert Preise und Anteile — Unsinn gilt nicht', () => {
    const custom = planSettings({
      BETTER_PRICE_BETTERMONEY_CHF: '4',
      BETTER_PRICE_GETBETTER_CHF: 'gratis',
      BETTER_PRICE_BETTERAI_CHF: '-1',
      BETTER_VAT: '0.077',
      BETTER_STORE_FEE: '1.5',
      BETTER_USER_SHARE: '0.5',
      BETTER_TRIAL_BUDGET_CHF: '0.2',
    });
    assert.deepEqual(custom.prices, { getbetter: 1, betterfamily: 3, bettergym: 5, betterai: 8, bettermoney: 4 });
    assert.deepEqual([custom.vat, custom.storeFee, custom.userShare, custom.trialBudgetChf], [0.077, 0.15, 0.5, 0.2]);
    assert.equal(planOf({ paidApps: ['bettermoney'] }, 'bettermoney', custom), 'paid');
    assert.equal(budgetOf('trial', 'getbetter', custom), 0.2);
  });
});

describe('Monat in Zuerich', () => {
  test('die Grenze liegt um Mitternacht in Zuerich, nicht in UTC', () => {
    assert.equal(zurichMonthOf('2026-09-30T22:30:00.000Z'), '2026-10');
    assert.equal(zurichMonthOf('2026-09-30T21:59:59.000Z'), '2026-09');
    // Winterzeit: eine Stunde vor UTC.
    assert.equal(zurichMonthOf('2026-12-31T23:00:00.000Z'), '2027-01');
    assert.equal(zurichMonthOf('2026-12-31T22:59:59.000Z'), '2026-12');
    assert.equal(zurichMonthOf('kaputt'), null);
  });

  test('wann es wieder voll ist, und was gelesen werden muss', () => {
    assert.equal(resetsOnOf('2026-09'), '2026-10-01');
    assert.equal(resetsOnOf('2026-12'), '2027-01-01');
    assert.equal(resetsOnOf('2026-13'), null);
    assert.equal(readFromOf('2026-10'), '2026-09-30T22:00:00.000Z');
    assert.equal(readToOf('2026-10'), '2026-11-01T02:00:00.000Z');
  });
});

describe('Kosten', () => {
  const speech = speechSettings({});

  test('Stimme: Credits × 0.10 USD je 1000 × 0.92, aus dem Speicher nichts', () => {
    assert.deepEqual(speech, { usdPer1kChars: 0.1, usdChf: 0.92, monthlyFixedUsd: 0 });
    assert.equal(speechChfOf(1000, speech), 0.092);
    assert.equal(speechChfOf(0, speech), 0);
    assert.equal(speechChfOf(undefined, speech), 0);
    const tuned = speechSettings({ BETTER_SPEECH_USD_PER_1K_CHARS: '0.3', BETTER_USD_CHF: '0', BETTER_SPEECH_MONTHLY_FIXED_USD: '22' });
    assert.deepEqual(tuned, { usdPer1kChars: 0.3, usdChf: 0.92, monthlyFixedUsd: 22 });
  });

  test('KI: costChf, sonst Tokens zum teuersten Preis', () => {
    assert.equal(aiChfOf({ costChf: 0.25 }), 0.25);
    assert.equal(aiChfOf({ costChf: null, promptTokens: null, completionTokens: null }), 0);
    const unknown = aiChfOf({ costChf: null, model: 'geheim', promptTokens: 1_000_000, completionTokens: 0 });
    assert.equal(unknown, 0.805);
  });

  test('schlimmster Fall und was noch hineinpasst', () => {
    const messages = [
      { role: 'system', content: 'x'.repeat(100) },
      { role: 'user', content: [{ type: 'text', text: 'abcd' }, { type: 'image_url', image_url: { url: 'data:' } }] },
    ];
    assert.equal(estimatePromptTokens(messages), 8 + 50 + 8 + 2 + 2000);
    const worst = worstCaseChf({ model: 'gemma4-31b', promptTokens: 1000, maxTokens: 500 });
    assert.equal(Math.round(worst * 1e9), Math.round(((1000 * 0.136 + 500 * 0.374) / 1e6) * 1e9));
    const tokens = affordableTokens({ model: 'gemma4-31b', promptTokens: 1000, remainingChf: worst });
    assert.ok(tokens >= 499 && tokens <= 500, String(tokens));
    assert.equal(affordableTokens({ model: 'gemma4-31b', promptTokens: 1000, remainingChf: 0.0001 }), 0);
  });

  test('Summen je App und Konto nur fuer den Monat in Zuerich', () => {
    const ai = [
      { at: '2026-09-30T22:30:00.000Z', accountId: 'acc_a', app: 'betterai', costChf: 1 },
      { at: '2026-09-30T21:00:00.000Z', accountId: 'acc_a', app: 'betterai', costChf: 5 },
      { at: '2026-10-02T10:00:00.000Z', accountId: 'acc_a', app: 'getbetter', costChf: 0.5 },
    ];
    const spoken = [
      { at: '2026-10-03T10:00:00.000Z', accountId: 'acc_a', app: 'betterai', credits: 1000, cached: false },
      { at: '2026-10-03T10:00:00.000Z', accountId: 'acc_a', app: 'betterai', credits: 0, cached: true },
      { at: '2026-10-03T10:00:00.000Z', accountId: null, app: null, credits: 500, cached: false },
    ];
    const { sums, unassignedChf } = monthSums(ai, spoken, '2026-10', speech);
    assert.deepEqual(sums.get('betterai|acc_a'), { aiChf: 1, speechChf: 0.092 });
    assert.deepEqual(sums.get('getbetter|acc_a'), { aiChf: 0.5, speechChf: 0 });
    assert.equal(unassignedChf, 0.046);
  });
});
