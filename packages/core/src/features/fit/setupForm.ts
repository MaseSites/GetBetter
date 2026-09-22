import type { FitProfile } from '../../db/fit';

/**
 * Die Maske der Einrichtung: Texte aus den Feldern -> Profil fuer den Dienst.
 * Rein, ohne App, getestet. Das letzte Wort hat der Dienst (`validateProfile`).
 */

export type SetupDraft = {
  birthDate: string;
  heightCm: string;
  weightKg: string;
  sex: FitProfile['sex'];
  activity: FitProfile['activity'];
  trainingDaysPerWeek: number;
  goal: FitProfile['goal'];
  pace: FitProfile['pace'];
  diet: FitProfile['diet'];
  allergies: string[];
  excludedFoods: string;
  pregnant: boolean;
  breastfeeding: boolean;
  eatingDisorder: boolean;
  medicalCondition: boolean;
  householdSize: number;
  budget: FitProfile['budget'];
  maxCookMinutes: number;
  equipment: string[];
};

export const EMPTY_DRAFT: SetupDraft = {
  birthDate: '',
  heightCm: '',
  weightKg: '',
  sex: 'unspecified',
  activity: 'light',
  trainingDaysPerWeek: 3,
  goal: 'maintain',
  pace: 'gentle',
  diet: 'omnivore',
  allergies: [],
  excludedFoods: '',
  pregnant: false,
  breastfeeding: false,
  eatingDisorder: false,
  medicalCondition: false,
  householdSize: 1,
  budget: 'medium',
  maxCookMinutes: 45,
  equipment: ['stove', 'oven'],
};

/** „10.5.1994“, „10.05.94“ wird nicht geraten — nur vier Stellen fuers Jahr. Gibt ISO oder null. */
export function parseSwissDate(text: string): string | null {
  const match = /^\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\s*$/.exec(text);
  if (!match) return null;
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** ISO -> „10.05.1994“ fuer das Feld. */
export function toSwissDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : '';
}

/** Komma oder Punkt; leer oder Unsinn ist null. */
export function parseDecimal(text: string): number | null {
  const cleaned = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

export type DraftField = 'birthDate' | 'heightCm' | 'weightKg';

/** Welche Felder des ersten Schritts fehlen oder nicht passen. */
export function draftErrors(draft: SetupDraft): DraftField[] {
  const errors: DraftField[] = [];
  if (parseSwissDate(draft.birthDate) === null) errors.push('birthDate');
  const height = parseDecimal(draft.heightCm);
  if (height === null || height < 120 || height > 230) errors.push('heightCm');
  const weight = parseDecimal(draft.weightKg);
  if (weight === null || weight < 30 || weight > 350) errors.push('weightKg');
  return errors;
}

export function draftToProfile(draft: SetupDraft): Partial<FitProfile> {
  return {
    birthDate: parseSwissDate(draft.birthDate) ?? '',
    heightCm: parseDecimal(draft.heightCm) ?? 0,
    weightKg: parseDecimal(draft.weightKg) ?? 0,
    sex: draft.sex,
    activity: draft.activity,
    trainingDaysPerWeek: draft.trainingDaysPerWeek,
    goal: draft.goal,
    pace: draft.pace,
    diet: draft.diet,
    allergies: draft.allergies,
    excludedFoods: draft.excludedFoods
      .split(/[,;\n]/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
    pregnant: draft.pregnant,
    breastfeeding: draft.breastfeeding,
    eatingDisorder: draft.eatingDisorder,
    medicalCondition: draft.medicalCondition,
    householdSize: draft.householdSize,
    budget: draft.budget,
    maxCookMinutes: draft.maxCookMinutes,
    equipment: draft.equipment,
  };
}

export function profileToDraft(profile: FitProfile): SetupDraft {
  return {
    ...EMPTY_DRAFT,
    ...profile,
    birthDate: toSwissDate(profile.birthDate),
    heightCm: String(profile.heightCm),
    weightKg: String(profile.weightKg),
    excludedFoods: profile.excludedFoods.join(', '),
  };
}

/** Ein Wert in einer Liste an- oder abhaken, ohne die Liste zu veraendern. */
export function toggled(list: readonly string[], value: string): string[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}
