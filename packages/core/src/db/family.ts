import { notifyDataChanged } from './events';
import { dayKey } from './gym';
import { db, newId } from './store';
import type {
  PetEventKind,
  PetEventRow,
  PetKind,
  PetRow,
  PlantRow,
  RecipeRow,
  VehicleRow,
} from './types';

function now(): string {
  return new Date().toISOString();
}

function changed<T>(value: T): T {
  notifyDataChanged();
  return value;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Wer im Haushalt ist, sieht dessen Sachen; wer allein ist, nur die eigenen.
 * Dieselbe Regel wie bei der Einkaufsliste.
 */
function familyVisible(
  row: { accountId: string; householdId: string | null },
  viewerId: string,
  householdId: string | null,
): boolean {
  if (householdId !== null) return row.householdId === householdId;
  return row.accountId === viewerId && !row.householdId;
}

type Scope = { accountId: string; householdId: string | null };

// --------------------------------------------------------------- Rezepte

/** Rezepte, Pflanzen, Haustiere, Fahrzeuge — der Haushalt jenseits der Liste. */
export const recipes = {
  list(viewerId: string, householdId: string | null) {
    return db.recipes.list({
      where: (row) => familyVisible(row, viewerId, householdId),
      sort: (a, b) => a.title.localeCompare(b.title),
    });
  },

  async add(
    scope: Scope,
    input: {
      title: string;
      servings: number;
      ingredients: readonly string[];
      steps: string;
      tags: readonly string[];
    },
  ): Promise<RecipeRow> {
    const row: RecipeRow = {
      id: newId('rc'),
      accountId: scope.accountId,
      householdId: scope.householdId,
      title: input.title.trim(),
      servings: Math.max(1, Math.round(input.servings)),
      ingredients: input.ingredients.map((line) => line.trim()).filter((line) => line.length > 0),
      steps: input.steps.trim(),
      tags: [...input.tags],
      createdAt: now(),
    };
    return changed(await db.recipes.insert(row));
  },

  async update(
    id: string,
    patch: {
      title?: string;
      servings?: number;
      ingredients?: readonly string[];
      steps?: string;
      tags?: readonly string[];
    },
  ) {
    return changed(
      await db.recipes.update(id, {
        ...patch,
        ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
        ...(patch.ingredients !== undefined
          ? {
              ingredients: patch.ingredients
                .map((line) => line.trim())
                .filter((line) => line.length > 0),
            }
          : {}),
      }),
    );
  },

  async remove(id: string) {
    await db.recipes.remove(id);
    changed(null);
  },
};

// -------------------------------------------------------------- Pflanzen

/** Wann eine Pflanze das naechste Mal dran ist — nie gegossen heisst heute. */
export function plantDueDay(plant: PlantRow): string {
  if (!plant.lastWateredOn) return dayKey();
  const last = new Date(`${plant.lastWateredOn}T12:00:00`);
  last.setDate(last.getDate() + plant.intervalDays);
  return dayKey(last);
}

export const plants = {
  list(viewerId: string, householdId: string | null) {
    return db.plants.list({
      where: (row) => familyVisible(row, viewerId, householdId),
      sort: (a, b) => a.name.localeCompare(b.name),
    });
  },

  async add(
    scope: Scope,
    input: { name: string; location?: string | null; intervalDays: number },
  ): Promise<PlantRow> {
    const row: PlantRow = {
      id: newId('pl'),
      accountId: scope.accountId,
      householdId: scope.householdId,
      name: input.name.trim(),
      location: clean(input.location),
      intervalDays: Math.max(1, Math.round(input.intervalDays)),
      lastWateredOn: null,
      createdAt: now(),
    };
    return changed(await db.plants.insert(row));
  },

  async update(
    id: string,
    patch: { name?: string; location?: string | null; intervalDays?: number },
  ) {
    return changed(
      await db.plants.update(id, {
        ...patch,
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(patch.location !== undefined ? { location: clean(patch.location) } : {}),
      }),
    );
  },

  /** Heute gegossen — der Rhythmus laeuft von hier neu. */
  async water(id: string, day: string) {
    return changed(await db.plants.update(id, { lastWateredOn: day }));
  },

  async remove(id: string) {
    await db.plants.remove(id);
    changed(null);
  },
};

// ------------------------------------------------------------- Haustiere

export const pets = {
  list(viewerId: string, householdId: string | null) {
    return db.pets.list({
      where: (row) => familyVisible(row, viewerId, householdId),
      sort: (a, b) => a.createdAt.localeCompare(b.createdAt),
    });
  },

  /** Alle Termine der sichtbaren Tiere, nach Tag. */
  async events(viewerId: string, householdId: string | null) {
    const own = await db.pets.list({ where: (row) => familyVisible(row, viewerId, householdId) });
    const ids = new Set(own.map((pet) => pet.id));
    return db.petEvents.list({
      where: (row) => ids.has(row.petId),
      sort: (a, b) => a.day.localeCompare(b.day),
    });
  },

  async add(
    scope: Scope,
    input: { name: string; kind: PetKind; birthday?: string | null },
  ): Promise<PetRow> {
    const row: PetRow = {
      id: newId('pt'),
      accountId: scope.accountId,
      householdId: scope.householdId,
      name: input.name.trim(),
      kind: input.kind,
      birthday: input.birthday ?? null,
      createdAt: now(),
    };
    return changed(await db.pets.insert(row));
  },

  async addEvent(input: {
    petId: string;
    accountId: string;
    kind: PetEventKind;
    day: string;
    note?: string | null;
  }): Promise<PetEventRow> {
    const row: PetEventRow = {
      id: newId('pe'),
      petId: input.petId,
      accountId: input.accountId,
      kind: input.kind,
      day: input.day,
      note: clean(input.note),
      createdAt: now(),
    };
    return changed(await db.petEvents.insert(row));
  },

  async removeEvent(id: string) {
    await db.petEvents.remove(id);
    changed(null);
  },

  async remove(id: string) {
    const events = await db.petEvents.list({ where: (row) => row.petId === id });
    for (const event of events) await db.petEvents.remove(event.id);
    await db.pets.remove(id);
    changed(null);
  },
};

// ------------------------------------------------------------- Fahrzeuge

export const vehicles = {
  list(viewerId: string, householdId: string | null) {
    return db.vehicles.list({
      where: (row) => familyVisible(row, viewerId, householdId),
      sort: (a, b) => a.name.localeCompare(b.name),
    });
  },

  async add(
    scope: Scope,
    input: {
      name: string;
      plate?: string | null;
      serviceOn?: string | null;
      tyresOn?: string | null;
      vignetteYear?: number | null;
      mileage?: number | null;
    },
  ): Promise<VehicleRow> {
    const row: VehicleRow = {
      id: newId('vh'),
      accountId: scope.accountId,
      householdId: scope.householdId,
      name: input.name.trim(),
      plate: clean(input.plate)?.toUpperCase() ?? null,
      serviceOn: input.serviceOn ?? null,
      tyresOn: input.tyresOn ?? null,
      vignetteYear: input.vignetteYear ?? null,
      mileage: input.mileage ?? null,
      createdAt: now(),
    };
    return changed(await db.vehicles.insert(row));
  },

  async update(
    id: string,
    patch: {
      name?: string;
      plate?: string | null;
      serviceOn?: string | null;
      tyresOn?: string | null;
      vignetteYear?: number | null;
      mileage?: number | null;
    },
  ) {
    return changed(
      await db.vehicles.update(id, {
        ...patch,
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(patch.plate !== undefined ? { plate: clean(patch.plate)?.toUpperCase() ?? null } : {}),
      }),
    );
  },

  async remove(id: string) {
    await db.vehicles.remove(id);
    changed(null);
  },
};
