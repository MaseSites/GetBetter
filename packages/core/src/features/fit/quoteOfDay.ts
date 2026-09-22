/**
 * Der Spruch des Tages: jeden Tag ein anderer, für alle derselbe, und erst
 * nach allen Sprüchen kommt einer wieder. Der Tag ist `YYYY-MM-DD` (Zürich),
 * gerechnet wird ohne Zufall, damit Start und Ernährung dasselbe zeigen.
 */
export const QUOTE_COUNT = 40;

/** Schritt, der zu 40 teilerfremd ist: Nachbartage liegen im Katalog weit auseinander. */
const STEP = 17;

const DAY_MS = 86_400_000;

/** Nummer des Spruchs (1 bis 40) für einen Tag. */
export function quoteNumberOf(day: string): number {
  const days = Math.floor(Date.parse(`${day}T12:00:00Z`) / DAY_MS);
  const safe = Number.isFinite(days) ? days : 0;
  const index = (((safe * STEP) % QUOTE_COUNT) + QUOTE_COUNT) % QUOTE_COUNT;
  return index + 1;
}
