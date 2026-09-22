import { fitCall, changedFor, idempotencyKey, q } from './fitEvents';
import type { CoachMessage, FitAction, FitGym, WeightData, WeightEntry } from './fitTypes';

/** Better Fit — Training, Fortschritt, Gewicht und Coach. Teil von `fit` (`db/fit.ts`). */
const changed = changedFor('training');
/** Verschieben, abschliessen, auslassen aendern auch das Tagesziel — dann laedt alles neu. */
const changedDay = changedFor('all');

// ------------------------------------------------------------------ Typen des Trainings

export type WorkoutStatus = 'planned' | 'done' | 'skipped';

/** Ein Termin in der Liste. `sets` zaehlt nur Arbeitssaetze (ohne Aufwaermen). */
export type TrainingSummary = {
  id: string;
  day: string;
  title: string;
  status: WorkoutStatus;
  movedFrom: string | null;
  exercises: number;
  deload: boolean;
  sets: number;
};

/** `weighted` mit Gewicht, `bodyweight` nur Wiederholungen, `timed` in Sekunden. */
export type ExerciseKind = 'weighted' | 'bodyweight' | 'timed';

export type TrainingTarget = {
  weightKg: number | null;
  reps: number | null;
  seconds: number | null;
  reason: 'repeat' | 'progress' | 'reduce' | 'reps' | 'time' | 'deload';
};

export type TrainingRecord = {
  exerciseId: string;
  kind: 'weight' | 'reps' | 'seconds';
  value: number;
  weightKg: number | null;
  reps: number | null;
  seconds: number | null;
  e1rm: number | null;
  day: string;
};

export type TrainingExercise = {
  exerciseId: string;
  name: string;
  sets: number;
  reps: string;
  restSeconds: number;
  replaced: string | null;
  hint: string | null;
  kind: ExerciseKind;
  timed: boolean;
  bodyweight: boolean;
  /** Langhantel — dann rechnet die App die Scheiben aus. */
  barbell: boolean;
  swaps: { exerciseId: string; name: string }[];
  target: TrainingTarget | null;
  /** Die Arbeitssaetze der letzten Einheit mit dieser Uebung. */
  last: {
    day: string;
    sets: { weightKg: number | null; reps: number | null; seconds: number | null }[];
  } | null;
  warmup: { weightKg: number; reps: number }[];
  record: TrainingRecord | null;
};

export type TrainingSet = {
  id: string;
  exerciseId: string;
  reps: number | null;
  weightKg: number | null;
  seconds: number | null;
  rir: number | null;
  warmup: boolean;
  /** Schlaegt die Bestleistung von vor diesem Training. */
  isRecord: boolean;
};

export type TrainingWorkout = {
  id: string;
  day: string;
  title: string;
  status: WorkoutStatus;
  movedFrom: string | null;
  deload: boolean;
  exercises: TrainingExercise[];
  sets: TrainingSet[];
  workSets: number;
};

export type TrainingPlan = {
  id: string;
  name: string;
  weekdays: number[];
  equipment: string | string[];
  gym?: string | null;
  goal: string;
  experience: string;
};

/** Je Muskelgruppe: Arbeitssaetze und Volumen (kg × Wiederholungen). */
export type MuscleWeek = Record<string, { sets: number; volumeKg: number }>;

export type TrainingProgress = {
  records: (TrainingRecord & {
    name: string;
    history: { day: string; e1rm: number }[];
    change: number | null;
  })[];
  week: {
    start: string;
    groups: MuscleWeek;
    lastGroups: MuscleWeek;
    workouts: number;
    lastWorkouts: number;
  };
  workoutsDone28: number;
  weight: { day: string; weightKg: number; trendKg: number }[];
};

/** Ein Hinweis des Tages vom Coach, nach festen Regeln. */
export type CoachCard =
  | {
      kind: 'missed';
      workoutId: string;
      title: string;
      day: string;
      tomorrow: string;
      tomorrowFree: boolean;
    }
  | { kind: 'protein'; proteinG: number }
  | { kind: 'water'; extraMl: number; targetMl: number };

export type SetInput = {
  exerciseId: string;
  reps?: number | null;
  seconds?: number | null;
  weightKg?: number | null;
  rir?: number | null;
  warmup?: boolean;
};

// ------------------------------------------------------------------ Aufrufe

export const fitTraining = {
  weights: () => fitCall<WeightData>('/v1/fit/weights'),

  async logWeight(weightKg: number, day?: string) {
    return changed(
      await fitCall<{ entry: WeightEntry }>('/v1/fit/weights', {
        method: 'POST',
        body: { weightKg, ...(day ? { day } : {}) },
      }),
    );
  },

  async removeWeight(id: string) {
    return changed(await fitCall<{ ok: true }>(`/v1/fit/weights/${q(id)}`, { method: 'DELETE' }));
  },

  /** Termine von–bis (Standard: eine Woche zurueck, drei voraus), dazu die verpassten. */
  workouts: (from?: string, to?: string) =>
    fitCall<{
      from: string;
      to: string;
      today: string;
      plan: TrainingPlan | null;
      workouts: TrainingSummary[];
      missed: TrainingSummary[];
    }>(`/v1/fit/workouts${from ? `?from=${q(from)}${to ? `&to=${q(to)}` : ''}` : ''}`),

  workout: (id: string) => fitCall<{ workout: TrainingWorkout }>(`/v1/fit/workouts/${q(id)}`),

  proposeWorkoutPlan: (input: {
    goal: string;
    experience: string;
    equipment: string | string[];
    gym?: string | null;
    weekdays: number[];
  }) => fitCall<{ action: FitAction }>('/v1/fit/workout-plans', { method: 'POST', body: input }),

  gyms: () => fitCall<{ gyms: FitGym[]; equipment: string[] }>('/v1/fit/gyms'),

  async swapExercise(workoutId: string, from: string, to: string) {
    return changed(
      await fitCall<{ workout: TrainingWorkout }>(`/v1/fit/workouts/${q(workoutId)}/swap`, {
        method: 'POST',
        body: { from, to },
      }),
    );
  },

  proposeReschedule: (workoutId: string, toDay: string) =>
    fitCall<{ action: FitAction }>('/v1/fit/actions', {
      method: 'POST',
      body: { tool: 'reschedule_workout', args: { workoutId, toDay } },
    }),

  /**
   * Ein Tipp: „Heute machen“ oder „Heute nachholen“. Derselbe Weg wie jedes
   * Verschieben (Vorschlag, dann Bestaetigung), nur ohne Zwischenschritt —
   * die Person hat den Tag selbst gewaehlt.
   */
  async moveNow(workoutId: string, toDay: string) {
    const proposal = await fitTraining.proposeReschedule(workoutId, toDay);
    if (!proposal.ok) return proposal;
    return changedDay(
      await fitCall<{ action: FitAction }>(
        `/v1/fit/actions/${q(proposal.data.action.id)}/confirm`,
        { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey('move') } },
      ),
    );
  },

  proposeSkip: (workoutId: string) =>
    fitCall<{ action: FitAction }>('/v1/fit/actions', {
      method: 'POST',
      body: { tool: 'skip_workout', args: { workoutId } },
    }),

  async logSet(workoutId: string, set: SetInput) {
    return changed(
      await fitCall<{ workout: TrainingWorkout; set: TrainingSet | null }>(
        `/v1/fit/workouts/${q(workoutId)}/sets`,
        { method: 'POST', body: set },
      ),
    );
  },

  async removeSet(workoutId: string, setId: string) {
    return changed(
      await fitCall<{ workout: TrainingWorkout }>(
        `/v1/fit/workouts/${q(workoutId)}/sets/${q(setId)}`,
        { method: 'DELETE' },
      ),
    );
  },

  async setWorkoutStatus(workoutId: string, action: 'complete' | 'skip' | 'reopen') {
    return changedDay(
      await fitCall<{ workout: TrainingWorkout }>(`/v1/fit/workouts/${q(workoutId)}/${action}`, {
        method: 'POST',
      }),
    );
  },

  progress: () => fitCall<TrainingProgress>('/v1/fit/progress'),

  coachMessages: () =>
    fitCall<{ messages: CoachMessage[]; actions: FitAction[] }>('/v1/fit/coach/messages'),

  coachToday: () => fitCall<{ day: string; cards: CoachCard[] }>('/v1/fit/coach/today'),

  async sendCoach(text: string, voice = false) {
    return changed(
      await fitCall<{ messages: CoachMessage[] }>('/v1/fit/coach/message', {
        method: 'POST',
        body: { text, voice },
      }),
    );
  },
};
