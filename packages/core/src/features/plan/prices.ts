import type { AppId } from '../../app/identity';

/**
 * Was ein Abo im Monat kostet, inklusive MwSt — `null` heisst: noch keins.
 *
 * Dieselben Zahlen stehen im Dienst (`DEFAULT_PRICES_CHF` in
 * `services/api/billing/plans.js`); `services/api/test/plan-client.test.js`
 * haelt beide gleich. Was wirklich gilt, sagt der Dienst (`GET /v1/plans`) —
 * diese Zahlen gelten nur, bis er geantwortet hat.
 */
export const PLAN_PRICES_CHF: Readonly<Record<AppId, number | null>> = {
  getbetter: 1,
  betterfamily: 3,
  bettergym: 5,
  betterai: 8,
  bettermoney: null,
};

/** Die Apps mit Preis: ein Abo irgendeiner davon schaltet das Aussehen frei. */
export const DEFAULT_PRICED_APPS: readonly AppId[] = (Object.keys(PLAN_PRICES_CHF) as AppId[]).filter(
  (app) => PLAN_PRICES_CHF[app] !== null,
);

/**
 * Ein Jahresabo kostet so viele Monatspreise — zehn, also zwei Monate
 * geschenkt. Dieselbe Zahl steht im Dienst (`DEFAULTS.yearMonths`).
 */
export const PLAN_YEAR_MONTHS = 10;

/** Der Jahrespreis einer App, solange der Dienst noch nicht geantwortet hat. */
export function yearPriceOf(priceChf: number | null): number | null {
  return priceChf === null ? null : Math.round(priceChf * PLAN_YEAR_MONTHS * 100) / 100;
}
