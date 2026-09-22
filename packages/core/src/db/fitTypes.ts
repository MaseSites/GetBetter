/**
 * Die Formen von Better Fit, wie der Dienst sie liefert (`/v1/fit/…`).
 * Nur Typen und feste Listen — die Aufrufe stehen in `fit.ts`.
 */
export type Macros = { kcal: number; proteinG: number; carbsG: number; fatG: number };

export type FoodSource =
  'swiss' | 'usda' | 'off' | 'mock' | 'label' | 'barcode' | 'custom' | 'recipe';

export type FitFood = {
  id: string;
  name: string;
  brand: string | null;
  source: FoodSource;
  attribution: string | null;
  state: 'raw' | 'cooked' | 'prepared' | null;
  per100: Macros & { fiberG?: number; sugarG?: number; saltG?: number };
  gramsPerPiece: number | null;
  gramsPerMl: number | null;
  allergens: string[];
  shopCategory: string;
  score?: number;
  stateMismatch?: boolean;
};

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export type FitMealItem = Macros & {
  foodId: string;
  name: string;
  grams: number;
  source: FoodSource;
  attribution: string | null;
  /** Nur wo der Datensatz sie fuehrt. */
  fiberG?: number;
  sugarG?: number;
  saltG?: number;
  /** Zeile aus einem eigenen Rezept (Gramm einer Portion). */
  recipeId?: string;
  /** Die gespeicherte Abschrift der Werte je 100 g — fuer die Vorschau beim Bearbeiten. */
  per100?: Macros;
};

/** Eine uebliche Mahlzeit: zuletzt gegessen als `id`, wie oft in 60 Tagen. */
export type UsualMeal = {
  id: string;
  name: string;
  slot: MealSlot;
  kcal: number;
  count: number;
  lastDay: string;
};

export type FitMeal = {
  id: string;
  day: string;
  slot: MealSlot;
  name: string;
  source: 'manual' | 'photo' | 'barcode' | 'recipe' | 'plan' | 'label';
  items: FitMealItem[];
  total: Macros;
  range: { kcalMin: number; kcalMax: number } | null;
  createdAt: string;
  /** Wahr, wenn der Name aus den Zeilen gebaut ist (er folgt ihnen beim Bearbeiten). */
  nameAuto?: boolean;
};

export type FitDay = {
  day: string;
  kind: 'training' | 'rest';
  target: Macros | null;
  meals: FitMeal[];
  total: Macros;
  remaining: Macros | null;
  latestWeight: { day: string; weightKg: number } | null;
  hasProfile: boolean;
  /** Das Training dieses Tages, falls eins geplant ist. */
  workout: {
    id: string;
    title: string;
    status: 'planned' | 'done' | 'skipped';
    exercises: number;
  } | null;
  /** Wie viele kcal ein Trainingstag mehr bringt (0 ohne Unterschied). */
  trainingBonusKcal: number;
  /** Trinkziel des Tages in ml, an Trainingstagen hoeher. */
  waterTargetMl: number;
  /** Ballaststoffe, Zucker, Salz des Tages in g. */
  nutrients?: { fiberG: number; sugarG: number; saltG: number };
  /** Tage in Folge mit mindestens einem Eintrag, bis zu diesem Tag. */
  streak?: number;
};

export const ACTIVITIES = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const;
export const FIT_GOALS = ['lose', 'maintain', 'gain'] as const;
export const DIETS = ['omnivore', 'vegetarian', 'vegan', 'pescetarian'] as const;
export const ALLERGENS = [
  'gluten',
  'crustaceans',
  'egg',
  'fish',
  'peanut',
  'soy',
  'milk',
  'nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
] as const;
export const EQUIPMENT = ['stove', 'oven', 'microwave', 'blender', 'airfryer'] as const;

export type FitProfile = {
  birthDate: string;
  heightCm: number;
  weightKg: number;
  sex: 'female' | 'male' | 'unspecified';
  activity: (typeof ACTIVITIES)[number];
  trainingDaysPerWeek: number;
  goal: (typeof FIT_GOALS)[number];
  pace: 'gentle' | 'moderate';
  diet: (typeof DIETS)[number];
  allergies: string[];
  excludedFoods: string[];
  pregnant: boolean;
  breastfeeding: boolean;
  eatingDisorder: boolean;
  medicalCondition: boolean;
  householdSize: number;
  budget: 'low' | 'medium' | 'high';
  maxCookMinutes: number;
  equipment: string[];
  timezone: string;
  units: 'metric';
};

export type FitGoals = Macros & {
  trainingDay: Macros;
  restDay: Macros;
  bmr: number;
  tdee: number;
  goal: FitProfile['goal'];
  safety: { mode: 'normal' | 'maintain_only'; reasons: string[] };
  adjustment: number;
  isEstimate: true;
};

export type WeightEntry = { id: string; day: string; weightKg: number };
export type WeightData = {
  entries: WeightEntry[];
  trend: { day: string; weightKg: number; trendKg: number }[];
  suggestion: {
    kcal: number;
    actualKgPerWeek: number;
    plannedKgPerWeek: number;
    days: number;
  } | null;
  kcalAdjustment: number;
};

export type FitStatus = {
  mode: 'mock' | 'live';
  vision: boolean;
  usda: boolean;
  openFoodFacts: boolean;
  storeOriginalImages: boolean;
  maxImagesPerAnalysis: number;
  maxAnalysesPerDay: number;
  catalog: { foods: number; swissVersion: string | null };
};

export type ChangeRow = {
  id: string;
  at: string;
  table: string;
  rowId: string;
  action: 'insert' | 'update' | 'remove';
  reason: string | null;
  undoneAt: string | null;
};

export type AnalysisLevel = 'green' | 'orange' | 'red';

export type AnalysisQuestion = {
  id: string;
  kind: 'fat' | 'portion';
  subject: string;
  fat?: 'oil' | 'butter';
  options: string[];
};

export type AnalysisItem = {
  term: string;
  preparation: string;
  grams: number;
  minGrams: number;
  maxGrams: number;
  confidence: number;
  matchUncertain: boolean;
  stateMismatch: boolean;
  added: boolean;
  food: FitFood | null;
  nutrients: (Macros & { kcalMin: number; kcalMax: number }) | null;
};

export type MealAnalysis = {
  id: string;
  status: 'open' | 'confirmed' | 'cancelled' | 'failed';
  day: string;
  slot: MealSlot;
  images: number;
  provider: 'mock' | 'gemini';
  mealName: string;
  mealClass: 'simple' | 'mixed' | 'hidden_ingredients' | 'packaged';
  overallConfidence: number;
  level: AnalysisLevel;
  reviewRequired: boolean;
  secondImageRecommended: boolean;
  warnings: string[];
  items: AnalysisItem[];
  total: Macros;
  range: { kcalMin: number; kcalMax: number };
  questions: AnalysisQuestion[];
  confirmedMealId: string | null;
};

export type NutritionLabel = {
  productName: string | null;
  brand: string | null;
  basis: '100g' | '100ml';
  per100: {
    kcal: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    fiberG?: number;
    sugarG?: number;
    saltG?: number;
  };
  portionGrams: number | null;
  plausible: boolean;
  problems: string[];
};

// ------------------------------------------------------------------ Kueche, Training, Coach

export type FitAction = {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  preview: { summary: Record<string, unknown> & { kind: string }; changes: unknown[] };
  status: 'proposed' | 'confirmed' | 'rejected' | 'expired' | 'failed';
  origin: 'app' | 'coach';
  result: (Record<string, unknown> & { kind?: string; error?: string }) | null;
  createdAt: string;
};

export type PantryItem = {
  id: string;
  foodId: string;
  name: string;
  amount: number | null;
  unit: string | null;
  grams: number | null;
  bestBefore: string | null;
  shopCategory: string;
};

export type ParsedPantryLine = {
  said: string;
  foodId: string;
  name: string;
  amount: number | null;
  unit: string | null;
  certain: boolean;
  food: FitFood;
};

export type RecipeItem = {
  foodId: string;
  name: string;
  amount: number;
  unit: string;
  grams: number;
  optional: boolean;
  basic?: boolean;
  substituted?: boolean;
};

export type FitRecipe = {
  id: string;
  title: string;
  servings: number;
  timeMinutes: number;
  activeMinutes?: number;
  difficulty: string;
  equipment: string[];
  tags: string[];
  steps: string[];
  items: RecipeItem[];
  slots?: string[];
  cookedWeightG?: number | null;
  substitutions?: { from: string; to: string; reason: string; detail: string }[];
  omitted?: { name: string; reason: string; detail: string }[];
  nutrition?: { perServing: Macros; total: Macros; portionG: number } | null;
  /** Aus welcher Vorlage der Bibliothek ein eigenes Rezept stammt. */
  basedOn?: string | null;
  /** Mit Stern markiert — steht unter „Meine Rezepte“ zuoberst. */
  favorite?: boolean;
};

export type CoverageLine = {
  foodId: string;
  name: string;
  needed: number;
  have: number | null;
  status: 'have' | 'have_unknown' | 'short' | 'missing';
  basic: boolean;
  optional: boolean;
  /** Im Vorrat mit Ablaufdatum in den naechsten drei Tagen. */
  expiring?: boolean;
};

export type RecipeSuggestion = {
  recipe: FitRecipe;
  nutrition: { perServing: Macros; total: Macros; portionG: number };
  have: CoverageLine[];
  short: CoverageLine[];
  missing: CoverageLine[];
  usesExpiring: boolean;
  /** Namen der Zutaten, die bald ablaufen. */
  expiring?: string[];
  score: number;
};

export type PlanEntry = {
  id: string;
  day: string;
  slot: MealSlot;
  recipeId: string;
  title: string;
  portions: number;
  nutrients: Macros;
  fromEntryId: string | null;
  /** Wer kocht, kocht fuer die Reste mit: eigene Portionen plus Reste. */
  cookPortions?: number;
  status: 'planned' | 'eaten' | 'skipped';
  eatenMealId: string | null;
};
export type PlanDay = {
  day: string;
  kind: 'training' | 'rest';
  target: Macros;
  total: Macros;
  tolerance: { kcalOk: boolean; proteinOk: boolean };
  entries: PlanEntry[];
};
export type MealPlan = {
  id: string;
  weekStart: string;
  status: string;
  days: PlanDay[];
  recipes: Record<string, FitRecipe>;
};

export type ShoppingItem = {
  id: string;
  foodId: string | null;
  name: string;
  amount: number;
  unit: string;
  shopCategory: string;
  basic: boolean;
  substituted: boolean;
  pantryCheck?: boolean;
  pantryGrams?: number | null;
  recipes: string[];
  done: boolean;
  manual: boolean;
  /** Von Hand eingetippt (nicht aus dem Plan). */
  typed?: boolean;
};
export type ShoppingList = {
  id: string;
  planId: string;
  items: ShoppingItem[];
  covered: { name: string }[];
  stale: boolean;
};

export type WorkoutSummary = {
  id: string;
  day: string;
  title: string;
  status: 'planned' | 'done' | 'skipped';
  movedFrom: string | null;
  exercises: number;
};
/** Ein Studio oder Ort mit typischer Ausstattung; `name` null heisst: Text der App (Zuhause, Draussen, anderes Studio). */
export type FitGym = {
  id: string;
  name: string | null;
  kind: 'gym' | 'home' | 'outdoor';
  equipment: string[];
};
export type WorkoutExercise = {
  exerciseId: string;
  name: string;
  sets: number;
  reps: string;
  restSeconds: number;
  replaced: string | null;
  /** Ein Satz, wie die Uebung geht. */
  hint: string | null;
  /** Wogegen sie sich tauschen laesst, mit der Ausstattung des Plans. */
  swaps: { exerciseId: string; name: string }[];
  target: { weightKg: number; reason: string } | null;
  warmup: { weightKg: number; reps: number }[];
  record: { weightKg: number; reps: number; e1rm: number } | null;
};
export type WorkoutSet = {
  id: string;
  exerciseId: string;
  reps: number;
  weightKg: number | null;
  rir: number | null;
  warmup: boolean;
};
export type Workout = {
  id: string;
  day: string;
  title: string;
  status: WorkoutSummary['status'];
  movedFrom: string | null;
  exercises: WorkoutExercise[];
  sets: WorkoutSet[];
};

export type CoachMessage = {
  id: string;
  role: 'user' | 'coach';
  kind: string;
  text?: string;
  tool?: string;
  actionId?: string;
  data: Record<string, unknown> | null;
  createdAt: string;
};

/** Die Beispielbilder des Mock-Modus — nur dort wirksam. */
export const MOCK_FIXTURES = [
  'rice_chicken_veg',
  'pasta_tomato_bacon',
  'lasagne',
  'packaged',
  'blurry',
  'no_food',
  'low_confidence',
  'api_error',
] as const;
