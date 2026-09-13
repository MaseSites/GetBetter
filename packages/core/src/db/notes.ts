import { notifyDataChanged } from './events';
import { noteTextOf } from './noteBlocks';
import { db, newId } from './store';
import type { NoteBlock, NoteRow } from './types';

function now(): string {
  return new Date().toISOString();
}

/** Nach jeder Aenderung laden offene Abfragen neu. */
function changed<T>(value: T): T {
  notifyDataChanged();
  return value;
}

/** Mit Bloecken sind Titel und Text abgeleitet, damit Suche und Vorschau stimmen. */
function textFields(blocks: readonly NoteBlock[] | undefined) {
  return blocks ? { blocks, ...noteTextOf(blocks) } : {};
}

/**
 * Aendert Zeilen, ohne `updatedAt` zu beruehren: Anheften, Verschieben und
 * Loeschen sind keine Bearbeitung — die Notiz soll nicht unter „Heute“ springen.
 */
async function patchQuietly(ids: readonly string[], patch: Partial<NoteRow>): Promise<void> {
  for (const id of ids) await db.notes.update(id, patch);
  changed(null);
}

export type NotePatch = {
  title?: string;
  body?: string;
  pinned?: boolean;
  blocks?: readonly NoteBlock[];
  folderId?: string | null;
};

export const notes = {
  /** Ohne den Papierkorb. */
  list(accountId: string) {
    return db.notes.list({
      where: (row) => row.accountId === accountId && !row.deletedAt,
      // Angeheftete zuerst, sonst das zuletzt Bearbeitete.
      sort: (a, b) =>
        Number(b.pinned ?? false) - Number(a.pinned ?? false) ||
        b.updatedAt.localeCompare(a.updatedAt),
    });
  },

  /** „Zuletzt gelöscht“: das zuletzt Geloeschte zuerst. */
  listDeleted(accountId: string) {
    return db.notes.list({
      where: (row) => row.accountId === accountId && Boolean(row.deletedAt),
      sort: (a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''),
    });
  },

  find(id: string) {
    return db.notes.find(id);
  },

  count(accountId: string) {
    return db.notes.count((row) => row.accountId === accountId && !row.deletedAt);
  },

  async create(input: {
    accountId: string;
    title?: string;
    body?: string;
    blocks?: readonly NoteBlock[];
    folderId?: string | null;
  }): Promise<NoteRow> {
    const timestamp = now();
    const row: NoteRow = {
      id: newId('nt'),
      accountId: input.accountId,
      title: input.title?.trim() ?? '',
      body: input.body ?? '',
      ...textFields(input.blocks),
      ...(input.folderId !== undefined ? { folderId: input.folderId } : {}),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    return changed(await db.notes.insert(row));
  },

  async save(id: string, patch: NotePatch) {
    const { blocks, ...rest } = patch;
    return changed(await db.notes.update(id, { ...rest, ...textFields(blocks), updatedAt: now() }));
  },

  setPinned(ids: readonly string[], pinned: boolean) {
    return patchQuietly(ids, { pinned });
  },

  moveToFolder(ids: readonly string[], folderId: string | null) {
    return patchQuietly(ids, { folderId });
  },

  /** Nach „Zuletzt gelöscht“ — zurueckholbar, bis `purgeDeletedBefore` sie abraeumt. */
  moveToTrash(ids: readonly string[]) {
    return patchQuietly(ids, { deletedAt: now() });
  },

  /** Zurueck aus dem Papierkorb. Gibt es ihren Ordner nicht mehr, liegt sie danach ganz oben. */
  async restore(ids: readonly string[]) {
    for (const id of ids) {
      const row = await db.notes.find(id);
      if (!row) continue;
      const folder = row.folderId ? await db.noteFolders.find(row.folderId) : undefined;
      await db.notes.update(id, {
        deletedAt: null,
        ...(row.folderId && !folder ? { folderId: null } : {}),
      });
    }
    changed(null);
  },

  /** Endgueltig. */
  async remove(id: string) {
    await db.notes.remove(id);
    changed(null);
  },

  /** Raeumt ab, was vor `cutoff` geloescht wurde, und gibt diese Zeilen zurueck (fuer ihre Bilder). */
  async purgeDeletedBefore(accountId: string, cutoff: string): Promise<NoteRow[]> {
    const expired = await db.notes.list({
      where: (row) =>
        row.accountId === accountId && Boolean(row.deletedAt) && (row.deletedAt ?? '') < cutoff,
    });
    if (expired.length === 0) return [];
    const ids = new Set(expired.map((row) => row.id));
    await db.notes.removeWhere((row) => ids.has(row.id));
    return changed(expired);
  },
};
