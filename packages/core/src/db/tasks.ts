import { notifyDataChanged } from './events';
import { db, newId } from './store';
import { priorityOf } from './taskFields';
import type { TaskRow } from './types';

function now(): string {
  return new Date().toISOString();
}

/** Nach jeder Aenderung laden offene Abfragen neu. */
function changed<T>(value: T): T {
  notifyDataChanged();
  return value;
}

/** Nur die Felder, die wirklich mitgegeben wurden — sonst stuenden ueberall `undefined`. */
function definedOnly<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

/** Eigene Aufgaben plus die, die im Haushalt geteilt sind. */
function taskVisible(row: TaskRow, viewerId: string, householdId: string | null): boolean {
  if (row.accountId === viewerId) return true;
  return row.shared && householdId !== null && row.householdId === householdId;
}

/** Tiefer verschachtelt ist nie Absicht — eher eine Schleife in kaputten Daten. */
const MAX_DEPTH = 20;

/** Die Aufgabe und alle Teilaufgaben darunter, die Aufgabe zuerst. */
function treeFrom(all: readonly TaskRow[], id: string): TaskRow[] {
  const root = all.find((row) => row.id === id);
  if (!root) return [];
  const below = (parentId: string, depth: number): TaskRow[] =>
    depth > MAX_DEPTH
      ? []
      : all
          .filter((row) => row.parentId === parentId)
          .flatMap((child) => [child, ...below(child.id, depth + 1)]);
  return [root, ...below(id, 0)];
}

/** Was sich an einer Aufgabe nachtraeglich aendern laesst. */
export type TaskPatch = Partial<
  Pick<
    TaskRow,
    | 'title'
    | 'dueAt'
    | 'dueTime'
    | 'priority'
    | 'notes'
    | 'shared'
    | 'projectId'
    | 'section'
    | 'tags'
    | 'parentId'
    | 'repeat'
    | 'reminderOffsetMinutes'
    | 'order'
    | 'attachmentIds'
  >
>;

export type TaskInput = TaskPatch & {
  accountId: string;
  householdId: string | null;
  title: string;
};

export const tasks = {
  /** Offene Aufgaben ohne Teilaufgaben — die stehen bei ihrer Aufgabe. */
  listOpen(viewerId: string, householdId: string | null) {
    return db.tasks.list({
      where: (row) => !row.done && !row.parentId && taskVisible(row, viewerId, householdId),
      sort: (a, b) => {
        // Was eine Frist hat, steht oben; bei gleicher Frist das Wichtigere
        // zuerst, danach das Aelteste.
        if (a.dueAt && b.dueAt && a.dueAt !== b.dueAt) return a.dueAt.localeCompare(b.dueAt);
        if (a.dueAt && !b.dueAt) return -1;
        if (b.dueAt && !a.dueAt) return 1;
        const weight = priorityOf(b.priority) - priorityOf(a.priority);
        if (weight !== 0) return weight;
        return a.createdAt.localeCompare(b.createdAt);
      },
    });
  },

  listDone(viewerId: string, householdId: string | null, limit = 30) {
    return db.tasks.list({
      where: (row) => row.done && !row.parentId && taskVisible(row, viewerId, householdId),
      sort: (a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''),
      limit,
    });
  },

  /** Alles, was dieses Konto sieht — offen, erledigt und Teilaufgaben. Die Ansichten sortieren selbst. */
  listVisible(viewerId: string, householdId: string | null) {
    return db.tasks.list({ where: (row) => taskVisible(row, viewerId, householdId) });
  },

  countOpen(viewerId: string, householdId: string | null) {
    return db.tasks.count(
      (row) => !row.done && !row.parentId && taskVisible(row, viewerId, householdId),
    );
  },

  find(id: string) {
    return db.tasks.find(id);
  },

  async create(input: TaskInput): Promise<TaskRow> {
    const { accountId, householdId, title, dueAt, shared, priority, notes, ...extra } = input;
    const row: TaskRow = {
      ...definedOnly(extra),
      id: newId('tk'),
      accountId,
      householdId,
      title: title.trim(),
      done: false,
      dueAt: dueAt ?? null,
      shared: shared ?? false,
      priority: priorityOf(priority),
      notes: notes?.trim() || null,
      createdAt: now(),
      completedAt: null,
    };
    return changed(await db.tasks.insert(row));
  },

  async setDone(id: string, done: boolean) {
    return changed(await db.tasks.update(id, { done, completedAt: done ? now() : null }));
  },

  async update(id: string, patch: TaskPatch) {
    return changed(
      await db.tasks.update(id, {
        ...definedOnly(patch),
        ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
        ...(patch.priority !== undefined ? { priority: priorityOf(patch.priority) } : {}),
      }),
    );
  },

  async setShared(id: string, shared: boolean) {
    return changed(await db.tasks.update(id, { shared }));
  },

  async remove(id: string) {
    await db.tasks.remove(id);
    changed(null);
  },

  /** Schreibt die Reihenfolge von Hand: `order` ist der Platz in `ids`. */
  async reorder(ids: readonly string[]) {
    const all = await db.tasks.list();
    const changes = ids
      .map((id, order) => ({ id, order }))
      .filter(({ id, order }) => {
        const row = all.find((entry) => entry.id === id);
        return row !== undefined && row.order !== order;
      });
    if (changes.length === 0) return;
    await Promise.all(changes.map(({ id, order }) => db.tasks.update(id, { order })));
    changed(null);
  },

  /** Loescht die Aufgabe samt Teilaufgaben und gibt alles zurueck — fuer Rückgängig. */
  async removeTree(id: string): Promise<TaskRow[]> {
    const rows = treeFrom(await db.tasks.list(), id);
    for (const row of rows) await db.tasks.remove(row.id);
    if (rows.length > 0) changed(null);
    return rows;
  },

  /** Legt geloeschte Zeilen unveraendert wieder an. Was es noch gibt, bleibt. */
  async restore(rows: readonly TaskRow[]) {
    const all = await db.tasks.list();
    const missing = rows.filter((row) => !all.some((existing) => existing.id === row.id));
    for (const row of missing) await db.tasks.insert(row);
    if (missing.length > 0) changed(null);
  },

  /** Nach dem Loeschen eines Projekts: seine Aufgaben stehen danach ohne Projekt da. */
  async clearProject(projectId: string): Promise<string[]> {
    const rows = await db.tasks.list({ where: (row) => row.projectId === projectId });
    await Promise.all(
      rows.map((row) => db.tasks.update(row.id, { projectId: null, section: null })),
    );
    if (rows.length > 0) changed(null);
    return rows.map((row) => row.id);
  },

  /**
   * Kopiert eine Aufgabe mit allen Teilaufgaben, offen und neu angelegt.
   * `patch` gilt nur fuer die oberste — so entsteht auch die naechste Instanz
   * einer wiederkehrenden Aufgabe.
   */
  async duplicate(id: string, patch: TaskPatch = {}): Promise<TaskRow | undefined> {
    const tree = treeFrom(await db.tasks.list(), id);
    const root = tree[0];
    if (!root) return undefined;
    const ids = new Map(tree.map((row) => [row.id, newId('tk')]));
    const createdAt = now();
    const copies = tree.map((row): TaskRow => ({
      ...row,
      ...(row.id === root.id ? definedOnly(patch) : {}),
      ...(row.id !== root.id && row.parentId
        ? { parentId: ids.get(row.parentId) ?? row.parentId }
        : {}),
      id: ids.get(row.id) ?? newId('tk'),
      priority: priorityOf(
        row.id === root.id && patch.priority !== undefined ? patch.priority : row.priority,
      ),
      done: false,
      completedAt: null,
      createdAt,
    }));
    for (const copy of copies) await db.tasks.insert(copy);
    changed(null);
    return copies[0];
  },
};
