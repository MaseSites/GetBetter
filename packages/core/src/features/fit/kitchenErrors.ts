import type { Translate, TranslationKey } from '@/i18n';

/** Fehler des Dienstes in der Kueche — je Schluessel ein ganzer Satz, sonst der allgemeine. */
const KEYS: Record<string, TranslationKey> = {
  offline: 'fit.kitchen.error.offline',
  no_changes: 'fit.kitchen.error.noChanges',
  already_saved: 'fit.recipe.alreadySaved',
  leftover_before_cook: 'fit.plan.leftoverBeforeCook',
  target_eaten: 'fit.plan.targetEaten',
  entry_eaten: 'fit.plan.eatenLocked',
  recipe_invalid: 'fit.recipe.editInvalid',
  recipe_not_allowed: 'fit.plan.noOptions',
  profile_required: 'fit.plan.needsGoals',
  amount_invalid: 'fit.shop.amountInvalid',
  nothing_to_reduce: 'fit.kitchen.error.noChanges',
};

export function kitchenError(t: Translate, error: string): string {
  return t(KEYS[error] ?? 'fit.error.body');
}
