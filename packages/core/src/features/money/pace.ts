/**
 * Budget-Tempo: aus Budget, Ausgaben und dem Tag im Monat die eine Antwort
 * auf „Darf ich noch?“ — „Noch CHF 23 pro Tag“ oder „CHF 40 über dem Plan“.
 *
 * Der Plan ist gleichmaessig: bis und mit heute darf so viel weg sein, wie
 * Tage vergangen sind. Gerechnet wird mit dem Tag in Zuerich, damit der
 * Monatswechsel um Mitternacht dort stattfindet und nicht in UTC.
 */

// Relative Pfade mit Absicht: so laeuft die Datei auch in den Tests unter Node.
import { zurichDayOf } from '../fit/zurichDay';

export type PaceStatus = 'ok' | 'ahead' | 'over';

export type BudgetPace = {
  /** `ok` im Plan, `ahead` schneller als der Plan, `over` schon ueber dem Budget. */
  status: PaceStatus;
  /** Was pro Tag noch geht, bis und mit heute — ganze Franken abgerundet, nie negativ. */
  perDayLeft: number;
  /** Tage bis Monatsende, heute mitgezaehlt. */
  daysLeft: number;
  /** Budget minus Ausgaben — negativ, wenn drueber. */
  left: number;
  /** Wie viel ueber dem Plan (bei `ahead`) bzw. ueber dem Budget (bei `over`), auf Rappen. */
  overBy: number;
  /** Wo der Monat landet, wenn es so weitergeht (linear), auf Rappen. */
  projected: number;
};

const rappen = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Wie viele Tage der Monat von `YYYY-MM-DD` hat — Februar im Schaltjahr inklusive. */
export function daysInMonthOf(day: string): number {
  const [year, month] = day.split('-').map(Number);
  // Tag 0 des Folgemonats ist der letzte dieses Monats; UTC, damit keine Zeitzone stoert.
  return new Date(Date.UTC(year ?? 1970, month ?? 1, 0)).getUTCDate();
}

/**
 * Das Tempo fuer den Monat von `today` (`YYYY-MM-DD`, Tag in Zuerich).
 * `null`, wenn es kein Budget gibt — dann gibt es auch keinen Plan.
 */
export function budgetPace(input: {
  spent: number;
  limit: number | null;
  today?: string;
}): BudgetPace | null {
  const { spent, limit } = input;
  if (limit === null || !(limit > 0)) return null;
  const today = input.today ?? zurichDayOf();
  const daysInMonth = daysInMonthOf(today);
  const dayOfMonth = Math.min(daysInMonth, Math.max(1, Number(today.slice(8, 10)) || 1));
  const daysLeft = daysInMonth - dayOfMonth + 1;
  const left = rappen(limit - spent);
  const projected = rappen((spent / dayOfMonth) * daysInMonth);

  if (left < 0) {
    return { status: 'over', perDayLeft: 0, daysLeft, left, overBy: rappen(-left), projected };
  }

  const perDay = left / daysLeft;
  // Ganze Franken abgerundet — lieber einen Franken zu vorsichtig; unter einem Franken auf Rappen.
  const perDayLeft = perDay >= 1 ? Math.floor(perDay) : Math.floor(perDay * 100) / 100;
  const planned = (limit * dayOfMonth) / daysInMonth;
  const ahead = rappen(spent - planned);
  // Ein Franken Spielraum, damit ein Kaffee zu frueh nicht gleich rot wird.
  const status: PaceStatus = ahead >= 1 ? 'ahead' : 'ok';
  return {
    status,
    perDayLeft,
    daysLeft,
    left,
    overBy: status === 'ahead' ? ahead : 0,
    projected,
  };
}
