/**
 * Die naechsten zwei Stunden in Viertelstunden: kommt Regen, und wann?
 */

const QUARTER_MS = 15 * 60_000;
const MINUTE_MS = 60_000;
/** Zwei Stunden. */
export const RAIN_SLOTS = 8;
/** Darunter ist es kein Regen, nur Messrauschen. */
export const RAIN_MM = 0.1;

export type Quarter = { ts: number; precip: number };

export type RainOutlook = {
  slots: readonly Quarter[];
  /** Die hoechste Viertelstunde, fuer den Massstab der Balken. */
  max: number;
  state: 'starts' | 'stops' | 'continues';
  /** Minuten bis Beginn oder Ende; bei `continues` 0. */
  minutes: number;
};

function minutesUntil(ts: number, now: number): number {
  return Math.max(0, Math.round((ts - now) / MINUTE_MS));
}

/** Nichts, wenn in den naechsten zwei Stunden kein Regen kommt. */
export function rainOutlook(quarters: readonly Quarter[], now: number): RainOutlook | null {
  const slots = quarters.filter((quarter) => quarter.ts + QUARTER_MS > now).slice(0, RAIN_SLOTS);
  const isWet = (quarter: Quarter) => quarter.precip >= RAIN_MM;
  if (!slots.some(isWet)) return null;

  const max = slots.reduce((highest, quarter) => Math.max(highest, quarter.precip), 0);
  const first = slots[0];
  if (first && isWet(first)) {
    const stop = slots.find((quarter) => !isWet(quarter));
    return stop
      ? { slots, max, state: 'stops', minutes: minutesUntil(stop.ts, now) }
      : { slots, max, state: 'continues', minutes: 0 };
  }
  const start = slots.find(isWet);
  return { slots, max, state: 'starts', minutes: start ? minutesUntil(start.ts, now) : 0 };
}
