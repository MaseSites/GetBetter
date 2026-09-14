/**
 * Abo und Kontingent: was eine App kostet und wie viel KI und Stimme ein Konto
 * darin im Monat verbrauchen darf. Rein und ohne Speicher — getestet.
 *
 * Ein zahlendes Konto darf 75 % dessen verbrauchen, was nach der
 * Mehrwertsteuer (8.1 %) und der Gebuehr des Stores (15 %) bleibt:
 *
 *   budget = preis / (1 + mwst) × (1 − storegebuehr) × anteil
 *
 * So bleiben von den Nettoeinnahmen immer mindestens 25 % fuer den Betreiber.
 * Wer nicht zahlt, bekommt ein kleines Gratis-Kontingent (0.10 CHF je App und
 * Monat) — nur die guenstige Stufe, keine Stimmen von ElevenLabs.
 *
 * Alle Zahlen lassen sich ueber die Umgebung uebersteuern:
 * `BETTER_PRICE_<APP>_CHF`, `BETTER_VAT`, `BETTER_STORE_FEE`,
 * `BETTER_USER_SHARE`, `BETTER_TRIAL_BUDGET_CHF`.
 */

const APP_IDS = ['getbetter', 'betterfamily', 'bettergym', 'betterai', 'bettermoney'];

/** CHF im Monat, inklusive MwSt. `null` heisst: noch kein Abo (BetterMoney). */
const DEFAULT_PRICES_CHF = Object.freeze({
  getbetter: 1,
  betterfamily: 3,
  bettergym: 5,
  betterai: 8,
  bettermoney: null,
});

const DEFAULTS = Object.freeze({
  vat: 0.081,
  storeFee: 0.15,
  userShare: 0.75,
  trialBudgetChf: 0.1,
});

const PLANS = ['paid', 'trial'];
const MICRO = 1e6;

/** Auf sechs Stellen abgerundet — ein Budget ist nie groesser als gerechnet. */
const floorChf = (value) => Math.floor(value * MICRO + 1e-6) / MICRO;

const isAppId = (value) => typeof value === 'string' && APP_IDS.includes(value);

/** Eine Zahl aus der Umgebung, sonst `fallback`. `accept` prueft den Bereich. */
function numberFrom(raw, fallback, accept) {
  if (typeof raw !== 'string' || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && accept(value) ? value : fallback;
}

const priceEnvName = (app) => `BETTER_PRICE_${app.toUpperCase()}_CHF`;

/**
 * Die Stellschrauben aus der Umgebung. Ein Preis gilt nur als Zahl ueber 0;
 * MwSt und Storegebuehr als Anteil von 0 bis unter 1, der Anteil fuer das
 * Konto ueber 0 bis 1, das Gratis-Kontingent ab 0.
 */
function planSettings(env = process.env) {
  const prices = Object.fromEntries(
    APP_IDS.map((app) => [app, numberFrom(env[priceEnvName(app)], DEFAULT_PRICES_CHF[app], (v) => v > 0)]),
  );
  return {
    prices,
    vat: numberFrom(env.BETTER_VAT, DEFAULTS.vat, (v) => v >= 0 && v < 1),
    storeFee: numberFrom(env.BETTER_STORE_FEE, DEFAULTS.storeFee, (v) => v >= 0 && v < 1),
    userShare: numberFrom(env.BETTER_USER_SHARE, DEFAULTS.userShare, (v) => v > 0 && v <= 1),
    trialBudgetChf: numberFrom(env.BETTER_TRIAL_BUDGET_CHF, DEFAULTS.trialBudgetChf, (v) => v >= 0),
  };
}

/** Der Preis einer App im Monat, oder null ohne Abo. */
function priceOf(appId, settings) {
  if (!isAppId(appId)) return null;
  const price = settings.prices[appId];
  return typeof price === 'number' && price > 0 ? price : null;
}

/** Was vom Preis bleibt: ohne MwSt, ohne Gebuehr des Stores. */
function netRevenueChf(priceChf, settings) {
  if (typeof priceChf !== 'number' || !(priceChf > 0)) return 0;
  return (priceChf / (1 + settings.vat)) * (1 - settings.storeFee);
}

/** Das Monatsbudget eines zahlenden Kontos fuer diesen Preis. */
function paidBudgetChf(priceChf, settings) {
  return floorChf(netRevenueChf(priceChf, settings) * settings.userShare);
}

/**
 * Zahlt dieses Konto fuer diese App? Nur der Admin setzt `paidApps` — spaeter
 * ein Kaufbeleg aus dem Store. Eine App ohne Preis ist immer `trial`.
 */
function planOf(account, appId, settings) {
  if (priceOf(appId, settings) === null) return 'trial';
  const paid = Array.isArray(account?.paidApps) && account.paidApps.includes(appId);
  return paid ? 'paid' : 'trial';
}

/** Das Budget eines Kontos in einer App: Abo oder Gratis-Kontingent. */
function budgetOf(plan, appId, settings) {
  if (plan === 'paid') {
    const price = priceOf(appId, settings);
    if (price !== null) return paidBudgetChf(price, settings);
  }
  return floorChf(settings.trialBudgetChf);
}

module.exports = {
  APP_IDS,
  DEFAULTS,
  DEFAULT_PRICES_CHF,
  PLANS,
  budgetOf,
  floorChf,
  isAppId,
  netRevenueChf,
  paidBudgetChf,
  planOf,
  planSettings,
  priceEnvName,
  priceOf,
};
