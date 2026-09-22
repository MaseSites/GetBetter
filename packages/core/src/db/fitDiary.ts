import { fitCall, changedFor, idempotencyKey, q } from './fitEvents';
import type {
  FitDay,
  FitFood,
  FitGoals,
  FitMeal,
  Macros,
  MealAnalysis,
  MealSlot,
  NutritionLabel,
  UsualMeal,
} from './fitTypes';

/** Eine Zeile beim Eintragen: Lebensmittel mit Gramm (und dem gesuchten Wort), oder ein eigenes Rezept. */
export type MealItemInput =
  | { foodId: string; grams: number; term?: string }
  | { recipeId: string; portions: number }
  | { recipeId: string; grams: number };

/** Zuletzt gegessen: das Lebensmittel und die letzte Menge. */
export type RecentFood = { food: FitFood; grams: number; lastDay: string };

/** „Was passt noch?“: ein Rezept, eine Portion als Zeilen zum Eintragen. */
export type FitSuggestion = {
  id: string;
  title: string;
  servings: number;
  perServing: Macros;
  items: { foodId: string; grams: number }[];
};

/** Better Fit — Tagebuch: Lebensmittel, Mahlzeiten, Foto-Analyse, Verpackung. Teil von `fit` (`db/fit.ts`). */
const changed = changedFor('diary');

export const fitDiary = {
  searchFoods: (text: string, preparation = '') =>
    fitCall<{ foods: FitFood[] }>(
      `/v1/fit/foods/search?q=${q(text)}${preparation ? `&prep=${q(preparation)}` : ''}`,
    ),

  async addCustomFood(input: { name: string; per100: Macros; gramsPerPiece?: number }) {
    return changed(
      await fitCall<{ food: FitFood; warnings: string[] }>('/v1/fit/foods/custom', {
        method: 'POST',
        body: input,
      }),
    );
  },

  async logMeal(
    input: {
      day?: string;
      slot: MealSlot;
      name?: string;
      source?: FitMeal['source'];
      items: MealItemInput[];
      analysisId?: string;
      planEntryId?: string;
      confirmLarge?: boolean;
    },
    key = idempotencyKey('meal'),
  ) {
    return changed(
      await fitCall<{ meal: FitMeal; day: FitDay }>('/v1/fit/meals', {
        method: 'POST',
        body: input,
        headers: { 'Idempotency-Key': key },
      }),
    );
  },

  async updateMeal(
    id: string,
    patch: { slot?: MealSlot; items?: MealItemInput[]; name?: string; confirmLarge?: boolean },
  ) {
    return changed(
      await fitCall<{ meal: FitMeal; day: FitDay }>(`/v1/fit/meals/${q(id)}`, {
        method: 'PATCH',
        body: patch,
      }),
    );
  },

  /** Was die Person oft isst, die zur Mahlzeit passenden zuerst. */
  usualMeals: (slot: MealSlot) =>
    fitCall<{ meals: UsualMeal[] }>(`/v1/fit/meals/usual?slot=${q(slot)}`),

  /** Eine fruehere Mahlzeit nochmal eintragen — der Dienst rechnet neu. */
  async repeatMeal(
    id: string,
    input: { slot: MealSlot; day: string },
    key = idempotencyKey(`repeat-${id}`),
  ) {
    return changed(
      await fitCall<{ meal: FitMeal; day: FitDay }>(`/v1/fit/meals/${q(id)}/repeat`, {
        method: 'POST',
        body: input,
        headers: { 'Idempotency-Key': key },
      }),
    );
  },

  /** „Wie gestern“: Mahlzeiten von `from` auf `day`, auf Wunsch nur einzelne. */
  async copyDay(
    day: string,
    input: { from: string; slots?: MealSlot[] },
    key = idempotencyKey(`copy-${day}`),
  ) {
    return changed(
      await fitCall<{ meals: FitMeal[]; day: FitDay }>(`/v1/fit/days/${q(day)}/copy`, {
        method: 'POST',
        body: input,
        headers: { 'Idempotency-Key': key },
      }),
    );
  },

  /** Die leere Suche: zuletzt Gegessenes mit der letzten Menge. */
  recentFoods: () => fitCall<{ foods: RecentFood[] }>('/v1/fit/foods/recent'),

  /** Was noch in den Tag passt — hoechstens drei Rezepte, je eine Portion. */
  fits: (day: string, slot?: MealSlot) =>
    fitCall<{ remaining: Macros | null; fits: FitSuggestion[] }>(
      `/v1/fit/fits?day=${q(day)}${slot ? `&slot=${q(slot)}` : ''}`,
    ),

  async removeMeal(id: string) {
    return changed(await fitCall<{ day: FitDay }>(`/v1/fit/meals/${q(id)}`, { method: 'DELETE' }));
  },

  async confirmAdjustment(kcal: number) {
    return changed(
      await fitCall<{ goals: FitGoals; kcalAdjustment: number }>('/v1/fit/goals/adjustment', {
        method: 'POST',
        body: { kcal },
      }),
    );
  },

  startAnalysis: (input: {
    image: string;
    day: string;
    slot: MealSlot;
    language: string;
    mockFixture?: string;
    keepImage?: boolean;
  }) =>
    fitCall<{ analysis: MealAnalysis; budget: string }>('/v1/fit/meal-analysis/start', {
      method: 'POST',
      body: input,
    }),

  addAnalysisImage: (id: string, image: string, mockFixture?: string) =>
    fitCall<{ analysis: MealAnalysis }>(`/v1/fit/meal-analysis/${q(id)}/add-image`, {
      method: 'POST',
      body: { image, ...(mockFixture ? { mockFixture } : {}) },
    }),

  answerAnalysis: (id: string, questionId: string, optionId: string) =>
    fitCall<{ analysis: MealAnalysis }>(`/v1/fit/meal-analysis/${q(id)}/answer`, {
      method: 'POST',
      body: { questionId, optionId },
    }),

  async confirmAnalysis(
    id: string,
    input: {
      items: { foodId: string; grams: number }[];
      slot: MealSlot;
      day: string;
      confirmLarge?: boolean;
    },
    key = idempotencyKey('photo'),
  ) {
    return changed(
      await fitCall<{ meal: FitMeal; day: FitDay }>(`/v1/fit/meal-analysis/${q(id)}/confirm`, {
        method: 'POST',
        body: input,
        headers: { 'Idempotency-Key': key },
      }),
    );
  },

  cancelAnalysis: (id: string) =>
    fitCall<{ ok: true }>(`/v1/fit/meal-analysis/${q(id)}/cancel`, { method: 'POST' }),

  lookupBarcode: (code: string) =>
    fitCall<{ code: string; source: 'own' | 'off'; food: FitFood; warnings?: string[] }>(
      `/v1/fit/foods/barcode/${q(code)}`,
    ),

  scanLabel: (image: string, language: string) =>
    fitCall<{ label: NutritionLabel }>('/v1/fit/nutrition-label/scan', {
      method: 'POST',
      body: { image, language },
    }),

  async saveLabel(input: {
    name: string;
    brand?: string | null;
    barcode?: string | null;
    per100: Macros & { fiberG?: number; sugarG?: number; saltG?: number };
    gramsPerPiece?: number | null;
    allowDuplicate?: boolean;
  }) {
    return changed(
      await fitCall<{ food: FitFood; duplicate?: 'barcode'; warnings: string[] }>(
        '/v1/fit/foods/label',
        {
          method: 'POST',
          body: input,
        },
      ),
    );
  },
};
