/**
 * Abo, Kontingent und Marge fuer den Admin. Gerechnet wird aus den
 * Protokollen (`ai-usage.jsonl`, `speech-usage.jsonl`) fuer einen Monat in
 * Zuerich — mit denselben Regeln wie im Dienst (`billing/`).
 *
 * Marge je App: Nettoeinnahmen (zahlende Konten × Preis ohne MwSt und
 * Storegebuehr) minus alle variablen Kosten (KI und Stimme) der App — die der
 * Gratis-Konten stehen zusaetzlich einzeln da. Die Fixkosten (Mindestgebuehr
 * von Safe Swiss Cloud, Plan von ElevenLabs) kommen nur in die Gesamtsumme.
 * Zahlende Konten zaehlen nach heutigem Stand von `paidApps`, auch fuer
 * fruehere Monate.
 */
const { readUsage } = require('../ai/usage.js');
const { readSpeechUsage } = require('../speech/usage.js');
const { keyOf, monthSums, roundChf, speechSettings } = require('../billing/costs.js');
const { readFromOf, readToOf, resetsOnOf } = require('../billing/month.js');
const {
  APP_IDS,
  budgetOf,
  monthlyPriceOf,
  netRevenueChf,
  planOf,
  planSettings,
  priceOf,
  termOf,
} = require('../billing/plans.js');

const EMPTY = Object.freeze({ aiChf: 0, speechChf: 0 });

/** Die Summen je App und Konto eines Monats, aus den Protokollen. */
async function readMonthSums(dataDir, month, { accountId } = {}) {
  const range = { from: readFromOf(month), to: readToOf(month), accountId };
  const [ai, spoken] = await Promise.all([readUsage(dataDir, range), readSpeechUsage(dataDir, range)]);
  return monthSums(ai, spoken, month, speechSettings());
}

/** Je App: Plan, Preis, Budget, Verbrauch und wie viel davon weg ist (0–1). */
function billingOf(account, sums, month, plans = planSettings()) {
  return APP_IDS.map((app) => {
    const plan = planOf(account, app, plans);
    const term = termOf(account, app);
    const budgetChf = budgetOf(plan, app, plans, term);
    const { aiChf, speechChf } = sums.get(keyOf(app, account.id)) ?? EMPTY;
    const spentChf = aiChf + speechChf;
    return {
      app,
      plan,
      term,
      priceChf: priceOf(app, plans),
      budgetChf,
      aiChf: roundChf(aiChf),
      speechChf: roundChf(speechChf),
      spentChf: roundChf(spentChf),
      usedShare: budgetChf > 0 ? Math.min(1, spentChf / budgetChf) : spentChf > 0 ? 1 : 0,
      resetsOn: resetsOnOf(month),
    };
  });
}

function appMarginOf(app, accounts, sums, plans) {
  const priceChf = priceOf(app, plans);
  const paidRows = accounts.filter((row) => planOf(row, app, plans) === 'paid');
  const paid = new Set(paidRows.map((row) => row.id));
  const totals = { aiChf: 0, speechChf: 0, paidCostChf: 0, trialCostChf: 0 };
  for (const [key, usage] of sums) {
    const [keyApp, accountId] = key.split('|');
    if (keyApp !== app) continue;
    const cost = usage.aiChf + usage.speechChf;
    totals.aiChf += usage.aiChf;
    totals.speechChf += usage.speechChf;
    if (paid.has(accountId)) totals.paidCostChf += cost;
    else totals.trialCostChf += cost;
  }
  const netRevenue = paidRows.reduce(
    (sum, row) => sum + netRevenueChf(monthlyPriceOf(app, plans, termOf(row, app)), plans),
    0,
  );
  const variableCostChf = totals.paidCostChf + totals.trialCostChf;
  const marginChf = netRevenue - variableCostChf;
  return {
    app,
    priceChf,
    paidAccounts: paid.size,
    netRevenueChf: roundChf(netRevenue),
    aiChf: roundChf(totals.aiChf),
    speechChf: roundChf(totals.speechChf),
    paidCostChf: roundChf(totals.paidCostChf),
    trialCostChf: roundChf(totals.trialCostChf),
    variableCostChf: roundChf(variableCostChf),
    marginChf: roundChf(marginChf),
    marginShare: netRevenue > 0 ? marginChf / netRevenue : null,
  };
}

/**
 * Die Marge eines Monats: je App und gesamt, gesamt auch mit Fixkosten.
 * `minimumChf` ist die Mindestgebuehr von Safe Swiss Cloud; sie gilt, wenn der
 * Verbrauch darunter bleibt (bezahlt wird `max(KI, Mindestgebuehr)`).
 */
function marginOf({ month, accounts, sums, unassignedChf = 0, minimumChf, plans = planSettings(), speech = speechSettings() }) {
  const byApp = APP_IDS.map((app) => appMarginOf(app, accounts, sums, plans));
  const add = (field) => byApp.reduce((total, row) => total + row[field], 0);
  const aiChf = add('aiChf');
  const netRevenue = add('netRevenueChf');
  const variableCostChf = add('variableCostChf') + unassignedChf;
  const marginChf = netRevenue - variableCostChf;
  const aiBillableChf = Math.max(aiChf, minimumChf);
  const speechFixedChf = speech.monthlyFixedUsd * speech.usdChf;
  const fixedChf = aiBillableChf - aiChf + speechFixedChf;
  const marginWithFixedChf = marginChf - fixedChf;
  return {
    month,
    vat: plans.vat,
    storeFee: plans.storeFee,
    userShare: plans.userShare,
    byApp,
    totals: {
      paidAccounts: add('paidAccounts'),
      netRevenueChf: roundChf(netRevenue),
      aiChf: roundChf(aiChf),
      speechChf: roundChf(add('speechChf') + unassignedChf),
      unassignedChf: roundChf(unassignedChf),
      trialCostChf: roundChf(add('trialCostChf')),
      variableCostChf: roundChf(variableCostChf),
      marginChf: roundChf(marginChf),
      marginShare: netRevenue > 0 ? marginChf / netRevenue : null,
      aiMinimumChf: minimumChf,
      aiBillableChf: roundChf(aiBillableChf),
      speechFixedChf: roundChf(speechFixedChf),
      fixedChf: roundChf(fixedChf),
      marginWithFixedChf: roundChf(marginWithFixedChf),
    },
  };
}

module.exports = { billingOf, marginOf, readMonthSums };
