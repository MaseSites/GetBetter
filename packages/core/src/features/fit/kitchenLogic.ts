/**
 * Die reinen Rechenteile der Kueche — ohne App und Dienst, darum getestet:
 * Ablaufdaten im Vorrat, Handposten der Einkaufsliste, Portionen skalieren,
 * Minuten im Kochschritt.
 */
import { guessCategory, splitQuantity, type ShoppingCategory } from '../shopping/categories';

const DAY_MS = 86400000;

/** `YYYY-MM-DD` plus `days` Tage. */
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Ganze Tage von `today` bis `day` (negativ: vorbei). */
export function daysBetween(today: string, day: string): number {
  return Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / DAY_MS);
}

/** Wie lange eine Vorratszeile noch haelt: abgelaufen, bald (bis 3 Tage) oder nichts Besonderes. */
export type Expiry = 'expired' | 'soon' | null;

export const SOON_DAYS = 3;

export function expiryOf(bestBefore: string | null, today: string): Expiry {
  if (!bestBefore) return null;
  const left = daysBetween(today, bestBefore);
  if (left < 0) return 'expired';
  return left <= SOON_DAYS ? 'soon' : null;
}

/** Oben, was bald ablaeuft (nach Datum), darunter der Rest in der Reihenfolge des Dienstes. */
export function splitPantry<T extends { bestBefore: string | null }>(
  items: readonly T[],
  today: string,
): { soon: T[]; rest: T[] } {
  const soon = items
    .filter((item) => expiryOf(item.bestBefore, today) !== null)
    .sort((a, b) => (a.bestBefore ?? '').localeCompare(b.bestBefore ?? ''));
  return { soon, rest: items.filter((item) => expiryOf(item.bestBefore, today) === null) };
}

/** Wie weit ein Tipp auf + oder − die Menge aendert — in der Einheit der Zeile. */
export function stepOf(unit: string | null): number {
  if (unit === 'piece' || unit === 'tbsp' || unit === 'tsp' || unit === 'pinch') return 1;
  if (unit === 'kg' || unit === 'l') return 0.5;
  return 100;
}

/** Einheiten der Einkaufsliste, wie der Dienst sie kennt. */
export type ShopUnit = 'g' | 'kg' | 'ml' | 'l' | 'piece';

/**
 * „2 Bananen“ → 2 Stueck Bananen in Fruechte & Gemuese; „500 g Mehl“ → 500 g;
 * „3 dl Rahm“ → 300 ml. Ohne Zahl ein Stueck.
 */
export function parseManualItem(text: string): {
  name: string;
  amount: number;
  unit: ShopUnit;
  category: ShoppingCategory;
} {
  const { name, quantity } = splitQuantity(text);
  const match = quantity ? /^(\d+(?:[.,]\d+)?)\s*([a-z.]*)$/i.exec(quantity) : null;
  const value = match?.[1] ? Number(match[1].replace(',', '.')) : 1;
  const word = (match?.[2] ?? '').toLowerCase().replace('.', '');
  const units: Record<string, [ShopUnit, number]> = {
    g: ['g', 1],
    kg: ['kg', 1],
    ml: ['ml', 1],
    cl: ['ml', 10],
    dl: ['ml', 100],
    l: ['l', 1],
  };
  const [unit, factor] = units[word] ?? ['piece', 1];
  return {
    name,
    amount: Math.round(value * factor * 100) / 100,
    unit,
    category: guessCategory(name),
  };
}

/** Eine Menge auf andere Portionen: Stueck in Vierteln, Loeffel und Prisen halb, Gramm ganz. */
export function scaleAmount(amount: number, factor: number, unit: string): number {
  const value = amount * factor;
  if (unit === 'piece') return Math.max(0.25, Math.round(value * 4) / 4);
  if (unit === 'tbsp' || unit === 'tsp' || unit === 'pinch')
    return Math.max(0.5, Math.round(value * 2) / 2);
  if (unit === 'kg' || unit === 'l') return Math.round(value * 100) / 100;
  return Math.max(1, Math.round(value));
}

type Coverage = {
  needed: number;
  have: number | null;
  status: 'have' | 'have_unknown' | 'short' | 'missing';
};

/** Vorhanden / zu wenig / fehlt neu — fuer mehr oder weniger Portionen (gleiche Regel wie im Dienst). */
export function scaleCoverage<T extends Coverage>(line: T, factor: number): T {
  const needed = Math.round(line.needed * factor);
  if (line.have === null) return { ...line, needed, status: 'have_unknown' };
  const status = line.have >= needed * 0.9 ? 'have' : line.have > 0 ? 'short' : 'missing';
  return { ...line, needed, status };
}

/** Was noch fehlt, in Gramm des Rezepts: zu wenig heisst nur den Rest. */
export function shortfallGrams(line: Coverage): number {
  if (line.status === 'missing') return line.needed;
  if (line.status === 'short' && line.have !== null) return Math.max(0, line.needed - line.have);
  return 0;
}

/**
 * Minuten in einem Kochschritt: „10 Minuten“, „50–55 Min.“, „cuis 20 minutes“,
 * „per 4 minuti“ — die erste Zahl, bei einer Spanne die kleinere. Sonst null.
 */
export function minutesIn(step: string): number | null {
  const match =
    /(\d+)(?:\s*[–-]\s*\d+)?\s*(?:min\b|min\.|minute|minuten|minutes|minuti|minuto)/i.exec(step);
  const value = match?.[1] ? Number(match[1]) : NaN;
  return Number.isFinite(value) && value > 0 && value <= 600 ? value : null;
}

/** 125 Sekunden → „2:05“. */
export function clockOf(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, '0')}`;
}
