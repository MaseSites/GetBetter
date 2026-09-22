/**
 * Was auf die BetterFamily-Einkaufsliste soll — rein gerechnet, darum getestet.
 *
 * - gleiche Namen im selben Auftrag werden eine Zeile, Mengen derselben Einheit
 *   zusammengezaehlt;
 * - steht der Posten dort schon offen, kommt er nicht doppelt: reicht die Menge,
 *   bleibt alles; ist sie kleiner (gleiche Einheit), wird sie auf das Noetige
 *   angehoben — nie aufaddiert, damit zweimal senden nicht doppelt kauft.
 */

export type FamilyItem = {
  name: string;
  /** Menge in `unit`, oder null („Vorrat pruefen“, nur der Name). */
  amount: number | null;
  unit: string | null;
  category?: string;
};

export type OpenRow = { id: string; name: string; quantity: string | null };

export type FamilyPlan = {
  add: FamilyItem[];
  /** Bestehende Zeile mit zu kleiner Menge: ersetzen durch `item`. */
  raise: { row: OpenRow; item: FamilyItem }[];
  /** Schon genug da. */
  skipped: number;
};

const same = (text: string) => text.trim().toLocaleLowerCase('de-CH');

/** Gleiche Namen zusammen; unterschiedliche Einheiten behalten die erste. */
export function mergeFamilyItems(items: readonly FamilyItem[]): FamilyItem[] {
  const merged: FamilyItem[] = [];
  for (const item of items) {
    if (same(item.name).length === 0) continue;
    const index = merged.findIndex((entry) => same(entry.name) === same(item.name));
    const existing = index === -1 ? undefined : merged[index];
    if (!existing) {
      merged.push({ ...item });
      continue;
    }
    const amount =
      existing.amount !== null && item.amount !== null && existing.unit === item.unit
        ? existing.amount + item.amount
        : (existing.amount ?? item.amount);
    merged[index] = {
      ...existing,
      amount,
      unit: existing.amount !== null ? existing.unit : item.unit,
    };
  }
  return merged;
}

/**
 * Die Zahl einer Mengenangabe, wenn ihre Einheit (als Text, wie `format` sie
 * schreibt) passt: „250 g“ mit Einheit „g“ → 250. Tausendertrenner und Komma gehen.
 */
export function amountOf(quantity: string | null, unitLabel: string): number | null {
  if (!quantity) return null;
  const match = /^([\d'’\u00a0\u202f .,]+)\s*(.*)$/.exec(quantity.trim());
  if (!match?.[1] || (match[2] ?? '').trim() !== unitLabel.trim()) return null;
  const digits = match[1].replace(/['’\u00a0\u202f ]/g, '').replace(',', '.');
  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}

export function planFamilyUpdate(
  open: readonly OpenRow[],
  items: readonly FamilyItem[],
  unitLabel: (unit: string) => string,
): FamilyPlan {
  const add: FamilyItem[] = [];
  const raise: { row: OpenRow; item: FamilyItem }[] = [];
  let skipped = 0;
  for (const item of mergeFamilyItems(items)) {
    const row = open.find((entry) => same(entry.name) === same(item.name));
    if (!row) {
      add.push(item);
      continue;
    }
    const there = item.unit ? amountOf(row.quantity, unitLabel(item.unit)) : null;
    if (item.amount !== null && there !== null && there < item.amount) raise.push({ row, item });
    else skipped += 1;
  }
  return { add, raise, skipped };
}
