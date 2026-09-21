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

const { resetsOnOf, zurichMonthOf } = require('./month.js');

const APP_IDS = ['getbetter', 'betterfamily', 'bettergym', 'betterai', 'bettermoney'];

/** CHF im Monat, inklusive MwSt. `null` heisst: noch kein Abo (BetterMoney). */
const DEFAULT_PRICES_CHF = Object.freeze({
  getbetter: 1,
  betterfamily: 3,
  bettergym: 5,
  betterai: 8,
  bettermoney: null,
});

const TERMS = ['month', 'year'];

const DEFAULTS = Object.freeze({
  yearMonths: 10,
  vat: 0.081,
  storeFee: 0.15,
  userShare: 0.75,
  trialBudgetChf: 0.1,
});

const PLANS = ['paid', 'trial'];
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Zurich',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Der Tag in Zuerich als `YYYY-MM-DD` — eine Kuendigung gilt nach Kalendertagen. */
function zurichDayOf(at = new Date()) {
  const date = at instanceof Date ? at : new Date(at);
  if (!Number.isFinite(date.getTime())) return null;
  const day = dayFormat.format(date);
  return DAY_PATTERN.test(day) ? day : null;
}

/** Auf welchen Tag das Abo dieser App gekuendigt ist (`planCancels`), oder null. */
function cancelsOn(account, appId) {
  const stored = account?.planCancels;
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return null;
  const day = stored[appId];
  return typeof day === 'string' && DAY_PATTERN.test(day) ? day : null;
}

/** Gekuendigt wird auf Monatsende: ab dem Ersten des naechsten Monats gilt Gratis. */
function cancelDayOf(at = new Date()) {
  return resetsOnOf(zurichMonthOf(at));
}
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
    yearMonths: numberFrom(env.BETTER_YEAR_MONTHS, DEFAULTS.yearMonths, (v) => v > 0 && v <= 12),
  };
}

/** Der Preis einer App im Monat, oder null ohne Abo. */
function priceOf(appId, settings) {
  if (!isAppId(appId)) return null;
  const price = settings.prices[appId];
  return typeof price === 'number' && price > 0 ? price : null;
}

/** Was ein Jahr kostet: zehn Monatspreise, also zwei Monate geschenkt. Auf Rappen gerundet. */
function yearPriceOf(appId, settings) {
  const price = priceOf(appId, settings);
  return price === null ? null : Math.round(price * settings.yearMonths * 100) / 100;
}

/** Monatlich oder jaehrlich — was am Konto steht (`planTerms`), sonst monatlich. */
function termOf(account, appId) {
  const stored = account?.planTerms;
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return 'month';
  return stored[appId] === 'year' ? 'year' : 'month';
}

/** Was dieses Abo je Monat einbringt — beim Jahresabo ein Zwoelftel des Jahrespreises. */
function monthlyPriceOf(appId, settings, term = 'month') {
  const price = priceOf(appId, settings);
  if (price === null) return null;
  return term === 'year' ? yearPriceOf(appId, settings) / 12 : price;
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
function planOf(account, appId, settings, at = new Date()) {
  if (priceOf(appId, settings) === null) return 'trial';
  const paid = Array.isArray(account?.paidApps) && account.paidApps.includes(appId);
  if (!paid) return 'trial';
  // Gekuendigt: bis zum Stichtag laeuft es weiter, ab dann zaehlt es als Gratis.
  const ends = cancelsOn(account, appId);
  const today = zurichDayOf(at);
  return ends !== null && today !== null && today >= ends ? 'trial' : 'paid';
}

/** Die Apps, fuer die es ein Abo gibt — in der Reihenfolge von `APP_IDS`. */
function pricedApps(settings) {
  return APP_IDS.filter((app) => priceOf(app, settings) !== null);
}

/**
 * Darf dieses Konto das Aussehen personalisieren? Ein Abo irgendeiner App mit
 * Preis genuegt — das Aussehen gilt ohnehin in allen Apps. Die KI bleibt je App.
 */
function canPersonalize(account, settings, at = new Date()) {
  if (!Array.isArray(account?.paidApps)) return false;
  return account.paidApps.some((app) => planOf(account, app, settings, at) === 'paid');
}

/** Das Budget eines Kontos in einer App: Abo oder Gratis-Kontingent. */
function budgetOf(plan, appId, settings, term = 'month') {
  if (plan === 'paid') {
    // Das Jahresabo bringt je Monat weniger ein — dann ist auch das Budget kleiner.
    const price = monthlyPriceOf(appId, settings, term);
    if (price !== null) return paidBudgetChf(price, settings);
  }
  return floorChf(settings.trialBudgetChf);
}

module.exports = {
  APP_IDS,
  DEFAULTS,
  DEFAULT_PRICES_CHF,
  PLANS,
  TERMS,
  budgetOf,
  cancelDayOf,
  canPersonalize,
  cancelsOn,
  floorChf,
  isAppId,
  netRevenueChf,
  paidBudgetChf,
  planOf,
  planSettings,
  priceEnvName,
  priceOf,
  pricedApps,
  monthlyPriceOf,
  termOf,
  yearPriceOf,
  zurichDayOf,
};
