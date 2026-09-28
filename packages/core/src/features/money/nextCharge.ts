/**
 * Wann ein Abo das naechste Mal abgebucht wird. Verankert am ersten Abbuchungstag
 * (`startDay`, `YYYY-MM-DD`): monatlich am selben Tag, jaehrlich am selben Datum.
 * Hat ein Monat den Tag nicht (31., 30., 29. Februar), gilt sein letzter Tag —
 * und im Monat danach wieder der 31.
 *
 * Alles als Tagesschluessel, ohne Uhrzeit: so stimmt es auch an den Tagen der
 * Zeitumstellung.
 */

import type { SubscriptionInterval } from '../../db/types';

type Parts = { year: number; month: number; day: number };

function partsOf(key: string): Parts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > lastDayOf(year, month)) return null;
  return { year, month, day };
}

/** Der letzte Tag eines Monats (1–12). */
function lastDayOf(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const pad = (value: number) => String(value).padStart(2, '0');

/** Der Abbuchungstag in diesem Monat — der Ankertag, sonst der Monatsletzte. */
function chargeIn(year: number, month: number, anchorDay: number): string {
  return `${year}-${pad(month)}-${pad(Math.min(anchorDay, lastDayOf(year, month)))}`;
}

/** Ob `key` ein gueltiger Tag ist. */
export function isDayKey(key: string): boolean {
  return partsOf(key) !== null;
}

/**
 * Die naechste Abbuchung am oder nach `today`. Liegt der Anfang noch vorne,
 * ist er die naechste. `null` bei einem krummen Tag.
 */
export function nextChargeDay(
  startDay: string,
  interval: SubscriptionInterval,
  today: string,
): string | null {
  const start = partsOf(startDay);
  const now = partsOf(today);
  if (!start || !now) return null;
  if (startDay >= today) return startDay;

  if (interval === 'year') {
    const thisYear = chargeIn(now.year, start.month, start.day);
    return thisYear >= today ? thisYear : chargeIn(now.year + 1, start.month, start.day);
  }

  const thisMonth = chargeIn(now.year, now.month, start.day);
  if (thisMonth >= today) return thisMonth;
  const nextMonth = now.month === 12 ? 1 : now.month + 1;
  const nextYear = now.month === 12 ? now.year + 1 : now.year;
  return chargeIn(nextYear, nextMonth, start.day);
}

/** Ob an diesem Tag abgebucht wird. */
export function chargesOn(startDay: string, interval: SubscriptionInterval, day: string): boolean {
  return nextChargeDay(startDay, interval, day) === day;
}

/** Die Abos, die an `day` abgebucht werden — ohne Datum keins. */
export function subscriptionsChargedOn<
  T extends { startDay?: string | null; interval: SubscriptionInterval },
>(rows: readonly T[], day: string): T[] {
  return rows.filter((row) => row.startDay != null && chargesOn(row.startDay, row.interval, day));
}
