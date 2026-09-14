/**
 * Der Abrechnungsmonat ist der Kalendermonat in Zuerich — die Protokolle
 * speichern `at` in UTC. `2026-09-30T22:30Z` ist in Zuerich schon der
 * 1. Oktober und zaehlt darum zum Oktober. Rein, getestet.
 */

const TIME_ZONE = 'Europe/Zurich';
const HOUR_MS = 60 * 60 * 1000;
/** Zuerich liegt hoechstens zwei Stunden vor UTC (Sommerzeit). */
const MAX_OFFSET_MS = 2 * HOUR_MS;
const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

const monthFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
});

function timeOf(value) {
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

/** `YYYY-MM` des Monats in Zuerich, oder null fuer einen ungueltigen Zeitpunkt. */
function zurichMonthOf(value) {
  const time = timeOf(value);
  if (time === null) return null;
  const parts = Object.fromEntries(monthFormat.formatToParts(time).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}`;
}

function partsOf(month) {
  const match = MONTH_PATTERN.exec(String(month ?? ''));
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null;
}

/** Der erste Tag des Folgemonats als `YYYY-MM-DD` — dann ist das Kontingent wieder voll. */
function resetsOnOf(month) {
  const parts = partsOf(month);
  if (!parts) return null;
  const next = parts.month === 12 ? { year: parts.year + 1, month: 1 } : { year: parts.year, month: parts.month + 1 };
  return `${next.year}-${String(next.month).padStart(2, '0')}-01`;
}

/**
 * Ab wann die Protokolle fuer diesen Monat gelesen werden muessen (UTC,
 * grosszuegig). Genau eingegrenzt wird danach mit `zurichMonthOf`.
 */
function readFromOf(month) {
  const parts = partsOf(month);
  if (!parts) return null;
  return new Date(Date.UTC(parts.year, parts.month - 1, 1) - MAX_OFFSET_MS).toISOString();
}

/** Bis wann (ausschliesslich, UTC, grosszuegig). */
function readToOf(month) {
  const parts = partsOf(month);
  if (!parts) return null;
  return new Date(Date.UTC(parts.year, parts.month, 1) + MAX_OFFSET_MS).toISOString();
}

module.exports = { TIME_ZONE, readFromOf, readToOf, resetsOnOf, zurichMonthOf };
