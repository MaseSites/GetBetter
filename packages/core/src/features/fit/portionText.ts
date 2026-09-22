import type { Translate } from '@/i18n';

/** „1 Portion“, „1,5 Portionen“ — nie „Portion(en)“; `format` macht die Zahl (Intl). */
export function portionText(
  t: Translate,
  value: number,
  format: (value: number) => string,
): string {
  return value === 1
    ? t('fit.count.portionOne')
    : t('fit.recipe.portions', { count: format(value) });
}
