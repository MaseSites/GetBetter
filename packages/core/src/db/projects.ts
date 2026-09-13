import { notifyDataChanged } from './events';
import { db, newId } from './store';
import type { ProjectRow } from './types';

function now(): string {
  return new Date().toISOString();
}

function changed<T>(value: T): T {
  notifyDataChanged();
  return value;
}

/** Ohne `id` wird angelegt, mit einer bekannten `id` aktualisiert. */
export type ProjectInput = {
  id?: string;
  accountId: string;
  householdId?: string | null;
  name: string;
  order?: number;
  sections?: readonly string[];
};

export const projects = {
  /** Die eigenen Projekte und die des Haushalts, in ihrer Reihenfolge. */
  list(accountId: string, householdId: string | null = null) {
    return db.projects.list({
      where: (row) =>
        row.accountId === accountId || (householdId !== null && row.householdId === householdId),
      sort: (a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt),
    });
  },

  find(id: string) {
    return db.projects.find(id);
  },

  async save(input: ProjectInput): Promise<ProjectRow> {
    const existing = input.id ? await db.projects.find(input.id) : undefined;
    if (existing) {
      const updated = await db.projects.update(existing.id, {
        name: input.name.trim(),
        ...(input.householdId !== undefined ? { householdId: input.householdId } : {}),
        ...(input.order !== undefined ? { order: input.order } : {}),
        ...(input.sections !== undefined ? { sections: input.sections } : {}),
      });
      return changed(updated ?? existing);
    }

    const order =
      input.order ?? (await db.projects.count((row) => row.accountId === input.accountId));
    const row: ProjectRow = {
      id: input.id ?? newId('pj'),
      accountId: input.accountId,
      householdId: input.householdId ?? null,
      name: input.name.trim(),
      order,
      sections: input.sections ?? [],
      createdAt: now(),
    };
    return changed(await db.projects.insert(row));
  },

  async remove(id: string) {
    await db.projects.remove(id);
    changed(null);
  },

  /** Legt ein geloeschtes Projekt unveraendert wieder an — fuer Rückgängig. */
  async restore(row: ProjectRow): Promise<ProjectRow> {
    const existing = await db.projects.find(row.id);
    if (existing) return existing;
    return changed(await db.projects.insert(row));
  },
};
