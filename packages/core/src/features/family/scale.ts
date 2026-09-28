/**
 * Rezepte für mehr oder weniger Personen — rein gerechnet (`scale.test.ts`).
 *
 * Eine Zutat ist eine Zeile wie „200 g Mehl“, „1/2 TL Salz“, „2 Eier“ oder
 * „1.5 dl Rahm“. Die Zahl vorne wird mit dem Faktor multipliziert und auf
 * sinnvolle Stufen gerundet: Gramm und Milliliter auf 5 bzw. 10, alles andere
 * auf Viertel (unter 2) oder Halbe. Zeilen ohne Zahl („Salz und Pfeffer“)
 * bleiben, wie sie sind.
 *
 * `fit/familyPlan.ts` hilft hier nicht: es rechnet mit Mengen, die Better Fit
 * schon als Zahl und Einheit kennt; ein Rezept ist freier Text.
 */

import { formatAmount, readAmount } from '@/features/shopping/quantity';

/** Einheiten, die als Teil der Menge gelten — der Rest der Zeile ist der Name. */
const UNITS = new Set([
  'g',
  'kg',
  'mg',
  'ml',
  'cl',
  'dl',
  'l',
  'tl',
  'el',
  'msp',
  'prise',
  'prisen',
  'bund',
  'dose',
  'dosen',
  'becher',
  'pack',
  'packung',
  'päckli',
  'stk',
  'stück',
  'zehe',
  'zehen',
  'scheibe',
  'scheiben',
  'tasse',
  'tassen',
  'glas',
  'x',
]);
const FINE_UNITS = new Set(['g', 'ml', 'mg']);

export type IngredientParts = {
  /** Die Zahl vorne, oder null ohne Zahl. */
  amount: ReturnType<typeof readAmount>;
  /** Die Einheit, wie sie dastand („TL“), oder leer. */
  unit: string;
  name: string;
};

/** „1/2 TL Salz“ → ½, „TL“, „Salz“. */
export function ingredientParts(line: string): IngredientParts {
  const text = line.trim();
  const amount = readAmount(text);
  if (!amount) return { amount: null, unit: '', name: text };
  const rest = text.slice(amount.length).trim();
  const [first = '', ...others] = rest.split(/\s+/);
  const normalized = first.toLocaleLowerCase('de-CH').replace(/\.$/, '');
  if (UNITS.has(normalized) && others.length > 0) {
    return { amount, unit: first, name: others.join(' ') };
  }
  return { amount, unit: '', name: rest };
}

function roundFor(value: number, unit: string): number {
  const fine = FINE_UNITS.has(unit.toLocaleLowerCase('de-CH').replace(/\.$/, ''));
  let step: number;
  if (fine) step = value < 20 ? 1 : value < 100 ? 5 : 10;
  else step = value < 2 ? 0.25 : 0.5;
  const rounded = Math.round(value / step) * step;
  return rounded > 0 ? rounded : step;
}

/** Die Menge einer Zeile nach dem Umrechnen, als Text („1½ TL“), oder null ohne Zahl. */
export function scaledQuantity(line: string, factor: number): string | null {
  const { amount, unit } = ingredientParts(line);
  if (!amount) return null;
  const value = factor === 1 ? amount.value : roundFor(amount.value * factor, unit);
  const number = formatAmount(value, amount.style);
  return unit ? `${number} ${unit}` : number;
}

/** Die ganze Zeile für `factor`-mal so viele Personen. Faktor 1 lässt sie unberührt. */
export function scaleIngredient(line: string, factor: number): string {
  if (factor === 1 || !(factor > 0)) return line;
  const { amount, name } = ingredientParts(line);
  if (!amount) return line;
  const quantity = scaledQuantity(line, factor);
  return name ? `${quantity} ${name}` : (quantity ?? line);
}

/** Für die Einkaufsliste: Name und (umgerechnete) Menge je Zeile. */
export function ingredientForShopping(
  line: string,
  factor: number,
): { name: string; quantity: string | null } {
  const { amount, name } = ingredientParts(line);
  if (!amount || !name) return { name: line.trim(), quantity: null };
  return { name, quantity: scaledQuantity(line, factor) };
}
