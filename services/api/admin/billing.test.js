/** Die Marge je App im Admin — reine Rechnung mit festen Zahlen. */
const assert = require('node:assert/strict');
const { test } = require('node:test');

const { speechSettings } = require('../billing/costs.js');
const { planSettings } = require('../billing/plans.js');
const { billingOf, marginOf } = require('./billing.js');

const PLANS = planSettings({});
const SPEECH = speechSettings({ BETTER_SPEECH_MONTHLY_FIXED_USD: '10' });
const round = (value) => Math.round(value * 1e4) / 1e4;

const accounts = [
  { id: 'acc_a', paidApps: ['betterai', 'bettergym'] },
  { id: 'acc_b', paidApps: ['betterai', 'bettermoney'] },
  { id: 'acc_c' },
];
const sums = new Map([
  ['betterai|acc_a', { aiChf: 1, speechChf: 0.5 }],
  ['betterai|acc_b', { aiChf: 2, speechChf: 0 }],
  ['betterai|acc_c', { aiChf: 0.1, speechChf: 0 }],
  ['bettergym|acc_a', { aiChf: 4, speechChf: 0 }],
  ['bettermoney|acc_b', { aiChf: 0.05, speechChf: 0 }],
]);

test('Marge je App: Nettoeinnahmen minus KI und Stimme, Gratis-Kosten einzeln', () => {
  const margin = marginOf({ month: '2026-09', accounts, sums, unassignedChf: 0.2, minimumChf: 95, plans: PLANS, speech: SPEECH });
  const byApp = Object.fromEntries(margin.byApp.map((row) => [row.app, row]));

  // BetterAi: zwei Abos zu 8.– -> 2 × 8 / 1.081 × 0.85 = 12.5809
  const ai = byApp.betterai;
  assert.deepEqual([ai.priceChf, ai.paidAccounts, round(ai.netRevenueChf)], [8, 2, 12.5809]);
  assert.deepEqual([ai.aiChf, ai.speechChf, ai.paidCostChf, ai.trialCostChf, ai.variableCostChf], [3.1, 0.5, 3.5, 0.1, 3.6]);
  assert.equal(round(ai.marginChf), 8.9809);
  assert.equal(round(ai.marginShare), round(8.9809 / 12.5809));

  // BetterGym: ein Abo zu 5.– -> 3.9315 netto, 4.– KI: rot.
  const gym = byApp.bettergym;
  assert.deepEqual([gym.paidAccounts, round(gym.netRevenueChf), round(gym.marginChf)], [1, 3.9315, -0.0685]);
  assert.ok(gym.marginShare < 0);

  // BetterMoney ohne Preis: kein Abo, also alles Gratis-Kosten und keine Marge in Prozent.
  const money = byApp.bettermoney;
  assert.deepEqual([money.priceChf, money.paidAccounts, money.netRevenueChf, money.trialCostChf, money.marginShare], [null, 0, 0, 0.05, null]);
  assert.deepEqual([byApp.getbetter.variableCostChf, byApp.getbetter.marginShare], [0, null]);

  const { totals } = margin;
  assert.equal(totals.paidAccounts, 3);
  // 12.580944 + 3.931545
  assert.equal(totals.netRevenueChf, 16.512489);
  assert.equal(totals.aiChf, 7.15);
  assert.equal(totals.speechChf, 0.7);
  assert.equal(totals.unassignedChf, 0.2);
  assert.equal(totals.trialCostChf, 0.15);
  assert.equal(totals.variableCostChf, 7.85);
  assert.equal(totals.marginChf, 8.662489);
  // Fixkosten: was die Mindestgebuehr ueber dem KI-Verbrauch kostet, dazu der Plan von ElevenLabs.
  assert.deepEqual([totals.aiMinimumChf, totals.aiBillableChf, totals.speechFixedChf], [95, 95, 9.2]);
  assert.equal(totals.fixedChf, 97.05);
  assert.equal(totals.marginWithFixedChf, -88.387511);
  assert.ok(totals.marginWithFixedChf < 0, 'ohne genug Abos deckt die Marge die Fixkosten nicht');
  assert.deepEqual([margin.vat, margin.storeFee, margin.userShare], [0.081, 0.15, 0.75]);
});

test('ueber der Mindestgebuehr gibt es keine Fixkosten der KI mehr', () => {
  const big = new Map([['betterai|acc_a', { aiChf: 120, speechChf: 0 }]]);
  const { totals } = marginOf({ month: '2026-09', accounts, sums: big, minimumChf: 95, plans: PLANS, speech: speechSettings({}) });
  assert.deepEqual([totals.aiBillableChf, totals.fixedChf], [120, 0]);
});

test('Kontingent je App fuer ein Konto', () => {
  const rows = billingOf(accounts[0], sums, '2026-09', PLANS);
  const byApp = Object.fromEntries(rows.map((row) => [row.app, row]));
  assert.deepEqual(Object.keys(byApp), ['getbetter', 'betterfamily', 'bettergym', 'betterai', 'bettermoney']);
  assert.deepEqual(
    [byApp.betterai.plan, byApp.betterai.budgetChf, byApp.betterai.spentChf, byApp.betterai.resetsOn],
    ['paid', 4.717853, 1.5, '2026-10-01'],
  );
  assert.equal(round(byApp.betterai.usedShare), round(1.5 / 4.717853));
  // Mehr verbraucht als erlaubt: der Balken bleibt bei voll.
  assert.deepEqual([byApp.bettergym.plan, byApp.bettergym.usedShare], ['paid', 1]);
  assert.deepEqual([byApp.getbetter.plan, byApp.getbetter.budgetChf, byApp.getbetter.usedShare], ['trial', 0.1, 0]);
});
