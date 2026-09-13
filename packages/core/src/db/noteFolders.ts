import { notifyDataChanged } from './events';
import { db, newId } from './store';
import type { NoteFolderRow } from './types';

function now(): string {
  return new Date().toISOString();
}

function changed<T>(value: T): T {
  notifyDataChanged();
  return value;
}

/** Ohne `id` wird angelegt, mit einer bekannten `id` aktualisiert. */
export type NoteFolderInput = {
  id?: string;
  accountId: string;
  name: string;
  parentId?: string | null;
  order?: number;
  view?: 'list' | 'grid';
};

/** Was beim Loeschen eines Ordners mitging — genug, um es rueckgaengig zu machen. */
export type RemovedNoteFolder = {
  folder: NoteFolderRow;
  noteIds: readonly string[];
  children: readonly NoteFolderRow[];
};

export const noteFolders = {
  /** Alle Ordner eines Kontos, in ihrer Reihenfolge. */
  list(accountId: string) {
    return db.noteFolders.list({
      where: (row) => row.accountId === accountId,
      sort: (a, b) => a.order - b.order || a.name.localeCompare(b.name),
    });
  },

  find(id: string) {
    return db.noteFolders.find(id);
  },

  async save(input: NoteFolderInput): Promise<NoteFolderRow> {
    const existing = input.id ? await db.noteFolders.find(input.id) : undefined;
    if (existing) {
      const updated = await db.noteFolders.update(existing.id, {
        name: input.name.trim(),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
        ...(input.order !== undefined ? { order: input.order } : {}),
        ...(input.view !== undefined ? { view: input.view } : {}),
      });
      return changed(updated ?? existing);
    }

    const order =
      input.order ?? (await db.noteFolders.count((row) => row.accountId === input.accountId));
    const row: NoteFolderRow = {
      id: input.id ?? newId('nf'),
      accountId: input.accountId,
      name: input.name.trim(),
      parentId: input.parentId ?? null,
      order,
      ...(input.view ? { view: input.view } : {}),
      createdAt: now(),
    };
    return changed(await db.noteFolders.insert(row));
  },

  /**
   * Loescht den Ordner. Seine Notizen — auch die im Papierkorb — liegen danach
   * ganz oben, Unterordner eine Ebene hoeher. Die Rueckgabe macht es mit
   * `restore` rueckgaengig; null, wenn es den Ordner nicht gab.
   */
  async remove(id: string): Promise<RemovedNoteFolder | null> {
    const folder = await db.noteFolders.find(id);
    if (!folder) return null;
    const moved = await db.notes.list({ where: (row) => row.folderId === id });
    const children = await db.noteFolders.list({ where: (row) => row.parentId === id });
    for (const note of moved) await db.notes.update(note.id, { folderId: null });
    for (const child of children) await db.noteFolders.update(child.id, { parentId: null });
    await db.noteFolders.remove(id);
    return changed({ folder, noteIds: moved.map((note) => note.id), children });
  },

  /** Holt einen geloeschten Ordner samt Notizen und Unterordnern zurueck. */
  async restore(removed: RemovedNoteFolder): Promise<void> {
    if (!(await db.noteFolders.find(removed.folder.id))) {
      await db.noteFolders.insert(removed.folder);
    }
    for (const noteId of removed.noteIds) {
      await db.notes.update(noteId, { folderId: removed.folder.id });
    }
    for (const child of removed.children) {
      await db.noteFolders.update(child.id, { parentId: child.parentId ?? null });
    }
    changed(null);
  },
};
