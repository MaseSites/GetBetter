import { callService, type ServiceCall } from './service';

/**
 * Das Abo einer App (`/v1/plans`). Bis es den Kauf im Store gibt, fragt die App
 * das Abo nur an — freigeschaltet wird im Admin, und die App merkt es beim
 * naechsten Abgleich an `paidApps`.
 */
/** Monatlich oder jaehrlich. */
export type PlanTerm = 'month' | 'year';

export type PlanStatus = {
  app: string;
  /** CHF im Monat, oder null, solange es fuer diese App kein Abo gibt. */
  priceChf: number | null;
  /** CHF im Jahr — zehn Monatspreise, also zwei Monate geschenkt. */
  yearPriceChf?: number | null;
  /** Die Laufzeit des laufenden Abos. */
  term?: PlanTerm;
  plan: 'paid' | 'trial';
  /** Ein Abo irgendeiner App mit Preis genuegt fuers Aussehen. */
  canPersonalize: boolean;
  request: 'pending' | null;
  /** Auf welchen Tag gekuendigt ist (`YYYY-MM-DD`), oder null. */
  cancelsOn?: string | null;
  /** Die Apps mit Preis, wie sie der Dienst gerade kennt. */
  pricedApps: readonly string[];
};

export type PlanRequestOutcome = 'pending' | 'active' | 'unavailable' | 'readOnly' | 'failed';

export const plans = {
  status: (accountId: string, app: string): Promise<ServiceCall<PlanStatus>> =>
    callService<PlanStatus>(`/v1/plans?${new URLSearchParams({ accountId, app }).toString()}`),
};

/**
 * Das Abo anfragen. Das ist die eine Stelle, die spaeter der Kauf im Store
 * ersetzt — alles darueber fragt nur, wie es ausging.
 */
export async function requestPlan(
  accountId: string,
  app: string,
  term: PlanTerm = 'month',
): Promise<PlanRequestOutcome> {
  const result = await callService<{ request: { status: string } }>('/v1/plans/requests', {
    method: 'POST',
    body: { accountId, app, term },
  });
  if (result.ok) return 'pending';
  if (result.error === 'already_paid') return 'active';
  if (result.error === 'plan_unavailable') return 'unavailable';
  if (result.error === 'read_only') return 'readOnly';
  return 'failed';
}

/** Wie eine Kuendigung ausging. */
export type PlanCancelOutcome =
  | { ok: true; cancelsOn: string | null }
  | { ok: false; reason: 'readOnly' | 'notPaid' | 'failed' };

async function changeCancel(
  path: '/v1/plans/cancel' | '/v1/plans/resume',
  accountId: string,
  app: string,
): Promise<PlanCancelOutcome> {
  const result = await callService<{ cancelsOn: string | null }>(path, {
    method: 'POST',
    body: { accountId, app },
  });
  if (result.ok) return { ok: true, cancelsOn: result.data.cancelsOn ?? null };
  if (result.error === 'read_only') return { ok: false, reason: 'readOnly' };
  if (result.error === 'not_paid') return { ok: false, reason: 'notPaid' };
  return { ok: false, reason: 'failed' };
}

/** Kuendigen — es laeuft bis zum Stichtag weiter, den die Antwort nennt. */
export function cancelPlan(accountId: string, app: string): Promise<PlanCancelOutcome> {
  return changeCancel('/v1/plans/cancel', accountId, app);
}

/** Die Kuendigung zuruecknehmen, solange der Stichtag nicht da ist. */
export function resumePlan(accountId: string, app: string): Promise<PlanCancelOutcome> {
  return changeCancel('/v1/plans/resume', accountId, app);
}
