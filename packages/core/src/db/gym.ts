import { notifyDataChanged } from './events';
import { db, newId } from './store';
import type { DrinkRow, MealRow, RoutineRow, WorkoutRow, WorkoutSetRow } from './types';

function now(): string {
  return new Date().toISOString();
}

/** Der Tag als `YYYY-MM-DD` — danach wird gruppiert und gezaehlt. */
export function dayKey(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function changed<T>(value: T): T {
  notifyDataChanged();
  return value;
}

/** Trainings, Mahlzeiten und Getraenke — der Datenbestand von BetterGym. */
export const workouts = {
  listDay(accountId: string, day: string) {
    return db.workouts.list({
      where: (row) => row.accountId === accountId && row.day === day,
      sort: (a, b) => a.createdAt.localeCompare(b.createdAt),
    });
  },

  listRecent(accountId: string, limit = 20) {
    return db.workouts.list({
      where: (row) => row.accountId === accountId,
      sort: (a, b) => b.day.localeCompare(a.day) || b.createdAt.localeCompare(a.createdAt),
      limit,
    });
  },

  /** Minuten dieser Woche, fuer die Zusammenfassung. */
  async minutesSince(accountId: string, fromDay: string): Promise<number> {
    const rows = await db.workouts.list({
      where: (row) => row.accountId === accountId && row.day >= fromDay,
    });
    return rows.reduce((total, row) => total + row.minutes, 0);
  },

  async add(input: {
    accountId: string;
    day: string;
    kind: string;
    minutes: number;
    notes?: string | null;
  }): Promise<WorkoutRow> {
    const row: WorkoutRow = {
      id: newId('wo'),
      accountId: input.accountId,
      day: input.day,
      kind: input.kind.trim(),
      minutes: Math.max(0, Math.round(input.minutes)),
      notes: input.notes?.trim() || null,
      createdAt: now(),
    };
    return changed(await db.workouts.insert(row));
  },

  async update(id: string, patch: { kind?: string; minutes?: number; notes?: string | null }) {
    return changed(
      await db.workouts.update(id, {
        ...patch,
        ...(patch.kind !== undefined ? { kind: patch.kind.trim() } : {}),
        ...(patch.minutes !== undefined ? { minutes: Math.max(0, Math.round(patch.minutes)) } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
      }),
    );
  },

  async remove(id: string) {
    const sets = await db.workoutSets.list({ where: (row) => row.workoutId === id });
    for (const set of sets) await db.workoutSets.remove(set.id);
    await db.workouts.remove(id);
    changed(null);
  },
};

/** Die Saetze eines Trainings — Uebung, Gewicht, Wiederholungen, wie in Hevy. */
export const workoutSets = {
  listOf(workoutId: string) {
    return db.workoutSets.list({
      where: (row) => row.workoutId === workoutId,
      sort: (a, b) => a.createdAt.localeCompare(b.createdAt),
    });
  },

  /** Alle Saetze eines Kontos — fuer Bestleistungen und die Zahl je Training. */
  listAll(accountId: string) {
    return db.workoutSets.list({ where: (row) => row.accountId === accountId });
  },

  async add(input: {
    workoutId: string;
    accountId: string;
    exercise: string;
    weightKg: number | null;
    reps: number;
  }): Promise<WorkoutSetRow> {
    const row: WorkoutSetRow = {
      id: newId('ws'),
      workoutId: input.workoutId,
      accountId: input.accountId,
      exercise: input.exercise.trim(),
      weightKg: input.weightKg === null ? null : Math.max(0, Math.round(input.weightKg * 4) / 4),
      reps: Math.max(1, Math.round(input.reps)),
      createdAt: now(),
    };
    return changed(await db.workoutSets.insert(row));
  },

  async remove(id: string) {
    await db.workoutSets.remove(id);
    changed(null);
  },
};

/** Vorlagen: welche Uebungen zu einem Training gehoeren. */
export const routines = {
  list(accountId: string) {
    return db.routines.list({
      where: (row) => row.accountId === accountId,
      sort: (a, b) => a.createdAt.localeCompare(b.createdAt),
    });
  },

  async add(input: {
    accountId: string;
    name: string;
    exercises: readonly string[];
  }): Promise<RoutineRow> {
    const row: RoutineRow = {
      id: newId('rt'),
      accountId: input.accountId,
      name: input.name.trim(),
      exercises: input.exercises.map((entry) => entry.trim()).filter((entry) => entry.length > 0),
      createdAt: now(),
    };
    return changed(await db.routines.insert(row));
  },

  async remove(id: string) {
    await db.routines.remove(id);
    changed(null);
  },
};

export const meals = {
  listDay(accountId: string, day: string) {
    return db.meals.list({
      where: (row) => row.accountId === accountId && row.day === day,
      sort: (a, b) => a.createdAt.localeCompare(b.createdAt),
    });
  },

  async kcalOf(accountId: string, day: string): Promise<number> {
    const rows = await db.meals.list({
      where: (row) => row.accountId === accountId && row.day === day,
    });
    return rows.reduce((total, row) => total + row.kcal, 0);
  },

  async add(input: {
    accountId: string;
    day: string;
    name: string;
    kcal: number;
    slot: string;
  }): Promise<MealRow> {
    const row: MealRow = {
      id: newId('ml'),
      accountId: input.accountId,
      day: input.day,
      name: input.name.trim(),
      kcal: Math.max(0, Math.round(input.kcal)),
      slot: input.slot,
      createdAt: now(),
    };
    return changed(await db.meals.insert(row));
  },

  async remove(id: string) {
    await db.meals.remove(id);
    changed(null);
  },
};

export const drinks = {
  async ofDay(accountId: string, day: string): Promise<number> {
    const rows = await db.drinks.list({
      where: (row) => row.accountId === accountId && row.day === day,
    });
    return rows.reduce((total, row) => total + row.amountDl, 0);
  },

  async add(accountId: string, day: string, amountDl: number): Promise<DrinkRow> {
    const row: DrinkRow = {
      id: newId('dr'),
      accountId,
      day,
      amountDl,
      createdAt: now(),
    };
    return changed(await db.drinks.insert(row));
  },

  /** Der letzte Schluck laesst sich zuruecknehmen — sonst waere es ein Rateklick. */
  async undoLast(accountId: string, day: string): Promise<void> {
    const rows = await db.drinks.list({
      where: (row) => row.accountId === accountId && row.day === day,
      sort: (a, b) => b.createdAt.localeCompare(a.createdAt),
      limit: 1,
    });
    const last = rows[0];
    if (last) await db.drinks.remove(last.id);
    changed(null);
  },
};
