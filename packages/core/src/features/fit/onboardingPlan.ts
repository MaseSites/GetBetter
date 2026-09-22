import type { FitProfile } from '../../db/fitTypes';

/**
 * Das schnelle Einrichten von Better Fit: wenige Antworten -> Profil und
 * Trainingsplan. Rein, ohne App, getestet. Das letzte Wort hat der Dienst.
 */

/** Was die Person will — eine Antwort, daraus folgen Ernaehrungs- und Trainingsziel. */
export const AIMS = ['lose', 'fit', 'muscle'] as const;
export type Aim = (typeof AIMS)[number];

export const EVERYDAY = ['sedentary', 'light', 'active'] as const;
export type Everyday = (typeof EVERYDAY)[number];

/** 0 heisst: kein Training, dann faellt die Frage nach dem Studio weg. */
export const TRAINING_COUNTS = [0, 2, 3, 4, 5, 6] as const;

export const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type Level = (typeof LEVELS)[number];

export type QuickAnswers = {
  aim: Aim;
  birthYear: string;
  heightCm: string;
  weightKg: string;
  sex: FitProfile['sex'];
  everyday: Everyday;
  trainingDays: number;
  gym: string | null;
  equipment: string[];
  level: Level;
  weekdays: number[];
  diet: FitProfile['diet'];
  allergies: string[];
  flags: {
    pregnant: boolean;
    breastfeeding: boolean;
    eatingDisorder: boolean;
    medicalCondition: boolean;
  };
};

/** Wochentage (1 = Montag … 0 = Sonntag) je Anzahl — wie im Dienst (`dayKind.js`). */
export const WEEKDAY_PATTERNS: Record<number, number[]> = {
  0: [],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
};

export const EMPTY_ANSWERS: QuickAnswers = {
  aim: 'fit',
  birthYear: '',
  heightCm: '',
  weightKg: '',
  sex: 'unspecified',
  everyday: 'light',
  trainingDays: 3,
  gym: null,
  equipment: [],
  level: 'beginner',
  weekdays: WEEKDAY_PATTERNS[3] ?? [],
  diet: 'omnivore',
  allergies: [],
  flags: { pregnant: false, breastfeeding: false, eatingDisorder: false, medicalCondition: false },
};

/** Ernaehrungsziel und Trainingsziel zu einer Antwort. */
export function goalsOfAim(aim: Aim): {
  goal: FitProfile['goal'];
  training: 'fatloss' | 'fitness' | 'muscle';
} {
  if (aim === 'lose') return { goal: 'lose', training: 'fatloss' };
  if (aim === 'muscle') return { goal: 'gain', training: 'muscle' };
  return { goal: 'maintain', training: 'fitness' };
}

/** Umgekehrt, fuer ein bestehendes Profil. */
export function aimOfGoal(goal: FitProfile['goal']): Aim {
  return goal === 'lose' ? 'lose' : goal === 'gain' ? 'muscle' : 'fit';
}

function number(text: string): number | null {
  const cleaned = text.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : null;
}

export type BodyField = 'birthYear' | 'heightCm' | 'weightKg';

/** Welche Koerperangaben fehlen oder nicht passen. Jahrgang: 13 bis 100 Jahre. */
export function bodyErrors(answers: QuickAnswers, thisYear: number): BodyField[] {
  const errors: BodyField[] = [];
  const year = number(answers.birthYear);
  if (year === null || !Number.isInteger(year) || year > thisYear - 13 || year < thisYear - 100)
    errors.push('birthYear');
  const height = number(answers.heightCm);
  if (height === null || height < 120 || height > 230) errors.push('heightCm');
  const weight = number(answers.weightKg);
  if (weight === null || weight < 30 || weight > 350) errors.push('weightKg');
  return errors;
}

/**
 * Das Profil fuer den Dienst. Nur der Jahrgang ist gefragt — gerechnet wird mit
 * dem 1. Juli, das verschiebt das Alter hoechstens um ein halbes Jahr.
 * Was die kurze Einrichtung nicht fragt, bleibt wie im bisherigen Profil.
 */
export function answersToProfile(
  answers: QuickAnswers,
  previous: FitProfile | null,
): Partial<FitProfile> {
  const keepDay = previous && previous.birthDate.startsWith(`${answers.birthYear.trim()}-`);
  return {
    ...(previous ?? {}),
    birthDate: keepDay && previous ? previous.birthDate : `${answers.birthYear.trim()}-07-01`,
    heightCm: number(answers.heightCm) ?? 0,
    weightKg: number(answers.weightKg) ?? 0,
    sex: answers.sex,
    activity: answers.everyday,
    trainingDaysPerWeek: answers.trainingDays,
    goal: goalsOfAim(answers.aim).goal,
    pace: previous?.pace ?? 'gentle',
    diet: answers.diet,
    allergies: answers.allergies,
    excludedFoods: previous?.excludedFoods ?? [],
    ...answers.flags,
  };
}

/** Ein bestehendes Profil als Antworten, damit „Ziele ändern“ dort weitermacht. */
export function profileToAnswers(profile: FitProfile): QuickAnswers {
  const count = TRAINING_COUNTS.includes(
    profile.trainingDaysPerWeek as (typeof TRAINING_COUNTS)[number],
  )
    ? profile.trainingDaysPerWeek
    : 3;
  const everyday: Everyday =
    profile.activity === 'sedentary'
      ? 'sedentary'
      : profile.activity === 'light'
        ? 'light'
        : 'active';
  return {
    ...EMPTY_ANSWERS,
    aim: aimOfGoal(profile.goal),
    birthYear: profile.birthDate.slice(0, 4),
    heightCm: String(profile.heightCm),
    weightKg: String(profile.weightKg),
    sex: profile.sex,
    everyday,
    trainingDays: count,
    weekdays: WEEKDAY_PATTERNS[count] ?? [],
    diet: profile.diet,
    allergies: profile.allergies,
    flags: {
      pregnant: profile.pregnant,
      breastfeeding: profile.breastfeeding,
      eatingDisorder: profile.eatingDisorder,
      medicalCondition: profile.medicalCondition,
    },
  };
}

/** Anzahl Trainingstage waehlen: die Wochentage folgen dem ueblichen Muster, bis man sie aendert. */
export function withTrainingDays(answers: QuickAnswers, count: number): QuickAnswers {
  return { ...answers, trainingDays: count, weekdays: WEEKDAY_PATTERNS[count] ?? [] };
}

/** Einen Wochentag an- oder abwaehlen; die Anzahl zieht mit. */
export function toggleWeekday(answers: QuickAnswers, weekday: number): QuickAnswers {
  const weekdays = answers.weekdays.includes(weekday)
    ? answers.weekdays.filter((day) => day !== weekday)
    : [...answers.weekdays, weekday];
  return { ...answers, weekdays, trainingDays: weekdays.length };
}

/** Der Trainingsplan-Vorschlag an den Dienst, oder null ohne Training. */
export function planRequest(answers: QuickAnswers): {
  goal: string;
  experience: Level;
  equipment: string[];
  gym: string | null;
  weekdays: number[];
} | null {
  if (
    answers.trainingDays === 0 ||
    answers.weekdays.length < 2 ||
    answers.weekdays.length > 6 ||
    answers.equipment.length === 0
  )
    return null;
  return {
    goal: goalsOfAim(answers.aim).training,
    experience: answers.level,
    equipment: answers.equipment,
    gym: answers.gym,
    weekdays: [...answers.weekdays].sort(),
  };
}

/**
 * Nur die letzte Anfrage zaehlt: wer schnell mehrere Wochentage antippt,
 * schickt mehrere Vorschlaege los — eine spaetere Antwort einer frueheren
 * Anfrage darf den neueren Stand nicht ueberschreiben. Dazu merkt es sich den
 * gezeigten Vorschlag, damit der ersetzte verworfen werden kann.
 */
export class LatestRequest {
  private ticket = 0;
  private shown: string | null = null;

  /** Eine neue Anfrage beginnt; alle aelteren sind damit veraltet. */
  begin(): number {
    this.ticket += 1;
    return this.ticket;
  }

  isLatest(ticket: number): boolean {
    return ticket === this.ticket;
  }

  /** Den gezeigten Vorschlag wechseln; zurueck kommt der vorige, wenn es ein anderer war. */
  show(id: string | null): string | null {
    const previous = this.shown;
    this.shown = id;
    return previous !== null && previous !== id ? previous : null;
  }
}
