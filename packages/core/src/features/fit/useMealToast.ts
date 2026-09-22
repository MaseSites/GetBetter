import { fit, type FitMeal } from '@/db/fit';
import { useI18n } from '@/i18n';
import { useUndo } from '@/ui';

/**
 * Die eine Rueckmeldung nach dem Eintragen — auf jedem Weg gleich (Suche,
 * Verpackung, Foto, Wie immer, Plan, Rezept, Wie gestern): „… eingetragen ·
 * Rückgängig“. Rueckgaengig loescht, was eben angelegt wurde.
 */
export function useMealToast() {
  const { t, language } = useI18n();
  const undo = useUndo();
  const whole = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });

  return {
    logged(meal: Pick<FitMeal, 'id' | 'name' | 'total'>, name: string = meal.name) {
      undo.show({
        message: t('fit4.logged', { name, kcal: whole.format(meal.total.kcal) }),
        onUndo: () => void fit.removeMeal(meal.id),
      });
    },
    copied(meals: readonly Pick<FitMeal, 'id'>[]) {
      undo.show({
        message: t('fit4.copied', { count: meals.length }),
        onUndo: () => {
          for (const meal of meals) void fit.removeMeal(meal.id);
        },
      });
    },
  };
}
