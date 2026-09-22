import { fitCall, changedFor, idempotencyKey, q } from './fitEvents';
import type {
  CoverageLine,
  FitAction,
  FitDay,
  FitMeal,
  FitRecipe,
  Macros,
  MealPlan,
  MealSlot,
  PantryItem,
  ParsedPantryLine,
  RecipeSuggestion,
  ShoppingList,
} from './fitTypes';

/** Better Fit — Küche: Vorrat, Rezepte, Wochenplan, Einkaufsliste. Teil von `fit` (`db/fit.ts`). */
const changed = changedFor('kitchen');

/** Was statt einer Plan-Mahlzeit passt — mit Portionen und kcal fuer ihr Ziel. */
export type PlanOption = {
  recipeId: string;
  title: string;
  portions: number;
  kcal: number;
  proteinG: number;
  own: boolean;
};

/** Eine Aenderung an einer Plan-Mahlzeit. */
export type PlanChange =
  { recipeId: string } | { toDay: string; toSlot?: MealSlot } | { skip: true } | { unskip: true };

/** Eine Aenderung an einer Vorratszeile; `bestBefore: null` loescht das Datum. */
export type PantryChange = {
  id: string;
  remove?: boolean;
  amount?: number | null;
  unit?: string | null;
  bestBefore?: string | null;
};

export const fitKitchen = {
  pantry: () => fitCall<{ items: PantryItem[] }>('/v1/fit/pantry'),

  parsePantry: (text: string) =>
    fitCall<{ lines: ParsedPantryLine[]; unknown: string[] }>('/v1/fit/pantry/parse', {
      method: 'POST',
      body: { text },
    }),

  proposePantry: (
    lines: {
      foodId: string;
      amount: number | null;
      unit: string | null;
      bestBefore?: string | null;
    }[],
    source: string,
  ) =>
    fitCall<{ action: FitAction }>('/v1/fit/pantry/items', {
      method: 'POST',
      body: { lines, source },
    }),

  recipes: () => fitCall<{ recipes: FitRecipe[] }>('/v1/fit/recipes'),

  library: () =>
    fitCall<{
      recipes: FitRecipe[];
      rejected: { id: string; title: string; reason: string; detail: string | null }[];
    }>('/v1/fit/recipes/library'),

  recipe: (id: string) =>
    fitCall<{
      recipe: FitRecipe;
      coverage: CoverageLine[];
      saved: boolean;
      /** Die Bibliotheksvorlage ist schon als eigenes Rezept gespeichert. */
      savedId: string | null;
      favorite: boolean;
    }>(`/v1/fit/recipes/${q(id)}`),

  /** Ein Merkzeichen, keine Aenderung am Rezept — darum direkt, ohne Vorschlag. */
  async favoriteRecipe(id: string, favorite: boolean) {
    return changed(
      await fitCall<{ recipeId: string; favorite: boolean }>(`/v1/fit/recipes/${q(id)}/favorite`, {
        method: 'POST',
        body: { favorite },
      }),
    );
  },

  proposePantryChanges: (changes: PantryChange[]) =>
    fitCall<{ action: FitAction }>('/v1/fit/pantry/changes', {
      method: 'POST',
      body: { changes },
    }),

  suggest: (slot?: MealSlot) =>
    fitCall<{ suggestions: RecipeSuggestion[]; pantryCount: number; remaining: Macros | null }>(
      '/v1/fit/recipes/suggest',
      { method: 'POST', body: slot ? { slot } : {} },
    ),

  proposeRecipe: (
    body: { fromLibrary: string } | { recipe: Partial<FitRecipe>; recipeId?: string },
  ) => fitCall<{ action: FitAction }>('/v1/fit/recipes', { method: 'POST', body }),

  async logRecipe(
    id: string,
    input: { portions: number; slot: MealSlot; day?: string },
    key = idempotencyKey('recipe'),
  ) {
    return changed(
      await fitCall<{ meal: FitMeal; day: FitDay; pantryAction: FitAction | null }>(
        `/v1/fit/recipes/${q(id)}/log`,
        { method: 'POST', body: input, headers: { 'Idempotency-Key': key } },
      ),
    );
  },

  currentPlan: (week?: string) =>
    fitCall<{
      weekStart: string;
      /** Heute beim Konto (Zeitzone des Profils) — fuer „Diese Woche“. */
      today?: string;
      plan: MealPlan | null;
      shoppingListId: string | null;
      shoppingListStale: boolean;
    }>(`/v1/fit/meal-plans/current${week ? `?week=${q(week)}` : ''}`),

  proposePlan: (weekStart?: string) =>
    fitCall<{ action: FitAction }>('/v1/fit/meal-plans/generate', {
      method: 'POST',
      body: weekStart ? { weekStart } : {},
    }),

  planOptions: (planId: string, entryId: string) =>
    fitCall<{ options: PlanOption[] }>(
      `/v1/fit/meal-plans/${q(planId)}/entries/${q(entryId)}/options`,
    ),

  proposePlanChange: (planId: string, entryId: string, change: PlanChange) =>
    fitCall<{ action: FitAction }>(`/v1/fit/meal-plans/${q(planId)}/entries/${q(entryId)}`, {
      method: 'PATCH',
      body: { change },
    }),

  async logPlanEntry(planId: string, entryId: string, key = idempotencyKey(`plan-${entryId}`)) {
    return changed(
      await fitCall<{ meal: FitMeal; day: FitDay; pantryAction: FitAction | null }>(
        `/v1/fit/meal-plans/${q(planId)}/entries/${q(entryId)}/log`,
        { method: 'POST', headers: { 'Idempotency-Key': key } },
      ),
    );
  },

  shoppingList: () => fitCall<{ list: ShoppingList | null }>('/v1/fit/shopping-lists/current'),

  proposeShoppingList: (planId: string) =>
    fitCall<{ action: FitAction }>('/v1/fit/shopping-lists/from-meal-plan', {
      method: 'POST',
      body: { planId },
    }),

  async editShoppingItem(
    listId: string,
    itemId: string,
    patch: { done?: boolean; amount?: number },
  ) {
    return changed(
      await fitCall<{ list: ShoppingList; pantryAction?: FitAction | null }>(
        `/v1/fit/shopping-lists/${q(listId)}/items/${q(itemId)}`,
        { method: 'PATCH', body: patch },
      ),
    );
  },

  async addShoppingItem(
    listId: string,
    input: { name: string; amount?: number; unit?: string; category?: string },
  ) {
    return changed(
      await fitCall<{ list: ShoppingList }>(`/v1/fit/shopping-lists/${q(listId)}/items`, {
        method: 'POST',
        body: input,
      }),
    );
  },

  async removeShoppingItem(listId: string, itemId: string) {
    return changed(
      await fitCall<{ list: ShoppingList }>(
        `/v1/fit/shopping-lists/${q(listId)}/items/${q(itemId)}`,
        { method: 'DELETE' },
      ),
    );
  },
};
