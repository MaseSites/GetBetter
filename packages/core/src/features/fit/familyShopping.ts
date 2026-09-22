import { shopping as shoppingRepo } from '@/db/repositories';
import { guessCategory, isShoppingCategory } from '@/features/shopping/categories';

import { planFamilyUpdate, type FamilyItem } from './familyPlan';

export type { FamilyItem } from './familyPlan';

/** Wie eine Menge auf der Liste steht — die App schreibt sie mit `Intl` und dem Einheiten-Kuerzel. */
export type QuantityFormat = {
  quantity: (amount: number, unit: string) => string;
  unit: (unit: string) => string;
};

export type FamilyResult = { added: number; raised: number; skipped: number };

/**
 * Posten auf die gemeinsame Einkaufsliste von BetterFamily legen — die des
 * Haushalts, ohne Haushalt die eigene. Gleiche Namen werden eins, was dort
 * schon offen steht, kommt nicht doppelt; eine zu kleine Menge wird auf das
 * Noetige angehoben (`familyPlan.ts`). Wirft, wenn der Speicher scheitert.
 */
export async function sendToFamilyList(
  scope: { accountId: string; householdId: string | null },
  items: readonly FamilyItem[],
  format: QuantityFormat,
): Promise<FamilyResult> {
  const open = (await shoppingRepo.list(scope.accountId, scope.householdId)).filter(
    (row) => !row.done,
  );
  const plan = planFamilyUpdate(open, items, format.unit);
  const write = async (item: FamilyItem) => {
    await shoppingRepo.add({
      accountId: scope.accountId,
      householdId: scope.householdId,
      name: item.name,
      quantity: item.amount !== null && item.unit ? format.quantity(item.amount, item.unit) : null,
      category: isShoppingCategory(item.category) ? item.category : guessCategory(item.name),
    });
  };
  for (const item of plan.add) await write(item);
  // Die Liste kennt kein Aendern der Menge: die alte Zeile geht, die neue kommt.
  for (const { row, item } of plan.raise) {
    await write(item);
    await shoppingRepo.remove(row.id);
  }
  return { added: plan.add.length, raised: plan.raise.length, skipped: plan.skipped };
}
