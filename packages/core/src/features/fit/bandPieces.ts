import type { FitMeal } from '../../db/fitTypes';

/** Die Abschnitte bis zum Ziel in der Akzentfarbe, was darueber liegt rot — rein gerechnet, in der Reihenfolge des Tages. */
export function bandPieces(
  meals: readonly Pick<FitMeal, 'id' | 'total'>[],
  targetKcal: number,
): { key: string; kcal: number; over: boolean }[] {
  const pieces: { key: string; kcal: number; over: boolean }[] = [];
  let running = 0;
  for (const meal of meals) {
    if (meal.total.kcal <= 0) continue;
    const from = running;
    running += meal.total.kcal;
    const within = Math.max(0, Math.min(running, targetKcal) - from);
    const over = meal.total.kcal - within;
    if (within > 0) pieces.push({ key: `${meal.id}-in`, kcal: within, over: false });
    if (over > 0) pieces.push({ key: `${meal.id}-over`, kcal: over, over: true });
  }
  return pieces;
}
