import { tagsOfNote } from './tags';

/** Was die Liste gerade zeigt — die Wahl im Titelmenue. */
export type NoteScope =
  | { kind: 'all' }
  | { kind: 'folder'; id: string }
  | { kind: 'tag'; tag: string }
  | { kind: 'trash' };

type ScopedNote = { title: string; body: string; folderId?: string | null };

/** Die Notizen dieser Auswahl. Der Papierkorb hat eine eigene Liste. */
export function notesInScope<T extends ScopedNote>(notes: readonly T[], scope: NoteScope): T[] {
  switch (scope.kind) {
    case 'all':
      return [...notes];
    case 'folder':
      return notes.filter((note) => note.folderId === scope.id);
    case 'tag':
      return notes.filter((note) => tagsOfNote(note).includes(scope.tag));
    default:
      return [];
  }
}

export function sameScope(a: NoteScope, b: NoteScope): boolean {
  if (a.kind === 'folder' && b.kind === 'folder') return a.id === b.id;
  if (a.kind === 'tag' && b.kind === 'tag') return a.tag === b.tag;
  return a.kind === b.kind;
}
