import type { TranslationKey } from '@/i18n';
import { DEFAULT_FAVOURITE_IDS, MODULES, highlightedModuleIds } from '@/mocks/modules';
import type { Area } from '@/mocks/types';

export type QuestionOption = {
  id: string;
  labelKey: TranslationKey;
  /** Was diese Antwort in die Favoriten legt. */
  modules: readonly string[];
};

export type OnboardingQuestion = {
  id: string;
  titleKey: TranslationKey;
  hintKey: TranslationKey;
  options: readonly QuestionOption[];
};

/** So viele Kacheln passen auf den Startbildschirm, ohne dass er zur Wand wird. */
export const MAX_START_FAVOURITES = 8;

/**
 * Ein paar Fragen beim Einrichten. Aus den Antworten entstehen die Favoriten —
 * mehr macht die Fragerei nicht, alle Apps sind ohnehin von Anfang an da.
 */
export const ONBOARDING_QUESTIONS: readonly OnboardingQuestion[] = [
  {
    id: 'day',
    titleKey: 'onboarding.questions.day.title',
    hintKey: 'onboarding.questions.multiple',
    options: [
      { id: 'dates', labelKey: 'onboarding.questions.day.dates', modules: ['calendar', 'alarm'] },
      { id: 'todo', labelKey: 'onboarding.questions.day.todo', modules: ['tasks'] },
      { id: 'notes', labelKey: 'onboarding.questions.day.notes', modules: ['notes', 'documents'] },
      { id: 'habits', labelKey: 'onboarding.questions.day.habits', modules: ['habits'] },
    ],
  },
  {
    id: 'home',
    titleKey: 'onboarding.questions.home.title',
    hintKey: 'onboarding.questions.multiple',
    options: [
      {
        id: 'together',
        labelKey: 'onboarding.questions.home.together',
        modules: ['shopping', 'chores'],
      },
      { id: 'alone', labelKey: 'onboarding.questions.home.alone', modules: ['shopping'] },
      { id: 'pets', labelKey: 'onboarding.questions.home.pets', modules: ['pets'] },
      { id: 'plants', labelKey: 'onboarding.questions.home.plants', modules: ['plants'] },
    ],
  },
  {
    id: 'health',
    titleKey: 'onboarding.questions.health.title',
    hintKey: 'onboarding.questions.multiple',
    options: [
      { id: 'move', labelKey: 'onboarding.questions.health.move', modules: ['fitness'] },
      { id: 'sleep', labelKey: 'onboarding.questions.health.sleep', modules: ['sleep'] },
      { id: 'water', labelKey: 'onboarding.questions.health.water', modules: ['water'] },
      { id: 'meds', labelKey: 'onboarding.questions.health.meds', modules: ['meds'] },
    ],
  },
  {
    id: 'food',
    titleKey: 'onboarding.questions.food.title',
    hintKey: 'onboarding.questions.multiple',
    options: [
      { id: 'plan', labelKey: 'onboarding.questions.food.plan', modules: ['meals'] },
      { id: 'recipes', labelKey: 'onboarding.questions.food.recipes', modules: ['recipes'] },
    ],
  },
  {
    id: 'money',
    titleKey: 'onboarding.questions.money.title',
    hintKey: 'onboarding.questions.multiple',
    options: [
      { id: 'budget', labelKey: 'onboarding.questions.money.budget', modules: ['budget'] },
      { id: 'bills', labelKey: 'onboarding.questions.money.bills', modules: ['bills'] },
      { id: 'subs', labelKey: 'onboarding.questions.money.subs', modules: ['subscriptions'] },
      { id: 'savings', labelKey: 'onboarding.questions.money.savings', modules: ['savings'] },
    ],
  },
];

const OPTIONS_BY_ID: Readonly<Record<string, QuestionOption>> = Object.fromEntries(
  ONBOARDING_QUESTIONS.flatMap((question) => question.options).map((option) => [option.id, option]),
);

/**
 * Aus den Antworten werden die Favoriten. Wer nichts anklickt, bekommt die
 * wichtigsten Apps seiner Bereiche — leer bleibt der Startbildschirm nie.
 */
export function favouritesFromAnswers(
  answers: readonly string[],
  areas: readonly Area[],
): readonly string[] {
  const wanted = new Set(answers.flatMap((id) => OPTIONS_BY_ID[id]?.modules ?? []));

  if (wanted.size === 0) {
    const fallback = highlightedModuleIds(areas);
    return (fallback.length > 0 ? fallback : DEFAULT_FAVOURITE_IDS).slice(0, MAX_START_FAVOURITES);
  }

  // Reihenfolge der Registry, damit die Kacheln nicht nach Klickreihenfolge liegen.
  return MODULES.filter((module) => wanted.has(module.id))
    .map((module) => module.id)
    .slice(0, MAX_START_FAVOURITES);
}
