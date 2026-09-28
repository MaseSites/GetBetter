/**
 * Gleiche Posten zusammenführen — rein gerechnet, darum getestet (`merge.test.ts`).
 *
 * Steht „Milch“ schon offen auf der Liste, wird aus einem zweiten „Milch“ keine
 * zweite Zeile, sondern die Menge wächst: „Milch“ + „Milch“ → „2“,
 * „500 g Mehl“ + „1 kg Mehl“ → „1.5 kg“. Passen die Einheiten nicht zusammen,
 * stehen beide da („1 Pack + 200 g“) — lieber ehrlich als falsch umgerechnet.
 *
 * Anders als `fit/familyPlan.ts` (`planFamilyUpdate`), das nur auf das Nötige
 * *anhebt*, damit zweimal Senden aus dem Wochenplan nicht doppelt kauft: wer
 * hier von Hand zweimal „Milch“ schreibt, will zwei.
 */

import { formatAmount, readAmount } from './quantity';

/** Die Endungen, die für den Vergleich wegfallen — Einzahl/Mehrzahl, einfach gehalten. */
const ENDINGS = ['en', 'n', 'e', 's'] as const;
/** Was sich nicht über Endungen fangen lässt. */
const IRREGULAR: Readonly<Record<string, string>> = { eier: 'ei', äpfel: 'apfel' };

/**
 * Der Vergleichsschlüssel eines Namens: klein, Leerraum zusammengezogen und
 * ohne einfache Mehrzahl-Endung — „Bananen“, „ banane “ und „Banane“ sind eins.
 */
export function itemKey(name: string): string {
  const words = name.trim().toLocaleLowerCase('de-CH').split(/\s+/).filter(Boolean);
  const last = words.pop();
  if (last === undefined) return '';
  let stem = IRREGULAR[last] ?? last;
  for (const ending of ENDINGS) {
    if (stem.endsWith(ending) && stem.length - ending.length >= 3) {
      stem = stem.slice(0, -ending.length);
      break;
    }
  }
  return [...words, stem].join(' ');
}

/** Einheiten, die sich ineinander umrechnen lassen, mit ihrem Faktor zur Grundeinheit. */
const FAMILIES: readonly Readonly<Record<string, number>>[] = [
  { g: 1, kg: 1000 },
  { ml: 1, cl: 10, dl: 100, l: 1000 },
];
/** Stück zählt wie keine Einheit. */
const COUNT_UNITS = new Set(['', 'x', 'stk', 'stück']);

type Parsed = { value: number; unit: string; label: string };

/** „500 g“ → 500, „g“; ohne Menge ein Stück; ohne Zahl vorne `null`. */
function parse(quantity: string | null): Parsed | null {
  const text = (quantity ?? '').trim();
  if (text.length === 0) return { value: 1, unit: '', label: '' };
  const amount = readAmount(text);
  if (!amount) return null;
  const label = text.slice(amount.length).trim();
  const unit = label.toLocaleLowerCase('de-CH').replace(/\.$/, '');
  return { value: amount.value, unit: COUNT_UNITS.has(unit) ? '' : unit, label };
}

function factorOf(unit: string): { family: number; factor: number } | null {
  for (let family = 0; family < FAMILIES.length; family += 1) {
    const factor = FAMILIES[family]?.[unit];
    if (factor !== undefined) return { family, factor };
  }
  return null;
}

/**
 * Zwei Mengen zusammenzählen. `null` heisst ein Stück. Das Ergebnis steht in
 * der Einheit der bestehenden Zeile.
 */
export function addQuantities(existing: string | null, added: string | null): string {
  const a = parse(existing);
  const b = parse(added);
  if (a && b) {
    if (a.unit === b.unit) {
      const sum = formatAmount(a.value + b.value);
      return a.label ? `${sum} ${a.label}` : sum;
    }
    const fa = factorOf(a.unit);
    const fb = factorOf(b.unit);
    if (fa && fb && fa.family === fb.family) {
      const sum = formatAmount((a.value * fa.factor + b.value * fb.factor) / fa.factor);
      return `${sum} ${a.label}`;
    }
  }
  const left = existing?.trim() || '1';
  const right = added?.trim() || '1';
  return `${left} + ${right}`;
}

export type OpenItem = { id: string; name: string; quantity: string | null; done: boolean };

export type AddPlan<Row extends OpenItem> =
  | { kind: 'new' }
  | { kind: 'merge'; row: Row; quantity: string };

/** Neu anlegen oder in eine offene Zeile gleichen Namens einrechnen? */
export function planAdd<Row extends OpenItem>(
  rows: readonly Row[],
  input: { name: string; quantity?: string | null },
): AddPlan<Row> {
  const key = itemKey(input.name);
  if (key.length === 0) return { kind: 'new' };
  const row = rows.find((entry) => !entry.done && itemKey(entry.name) === key);
  if (!row) return { kind: 'new' };
  return { kind: 'merge', row, quantity: addQuantities(row.quantity, input.quantity ?? null) };
}

/** Mehrere Posten eines Auftrags vorab zusammenziehen (Rezept mit zweimal Butter). */
export function mergeBatch(
  items: readonly { name: string; quantity: string | null }[],
): { name: string; quantity: string | null }[] {
  const merged: { name: string; quantity: string | null }[] = [];
  for (const item of items) {
    const key = itemKey(item.name);
    if (key.length === 0) continue;
    const index = merged.findIndex((entry) => itemKey(entry.name) === key);
    const existing = index === -1 ? undefined : merged[index];
    if (!existing) merged.push({ name: item.name.trim(), quantity: item.quantity });
    else merged[index] = { ...existing, quantity: addQuantities(existing.quantity, item.quantity) };
  }
  return merged;
}
