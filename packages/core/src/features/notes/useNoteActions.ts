import { Share } from 'react-native';

import type { NoteRow } from '@/db';
import { notes as noteRepo } from '@/db/repositories';
import { useTranslate } from '@/i18n';
import { useUndo } from '@/ui';

import { removeNoteImages } from './images';

/**
 * Was man mit Notizen tut — aus der Liste, dem Kontextmenue und dem Editor
 * gleich: Loeschen mit Rueckgaengig, Anheften, Verschieben, Teilen.
 */
export function useNoteActions() {
  const t = useTranslate();
  const undo = useUndo();

  function failed() {
    undo.show({ message: t('notes.toast.failed') });
  }

  function run(work: Promise<unknown>) {
    work.catch(failed);
  }

  return {
    setPinned(ids: readonly string[], pinned: boolean) {
      run(noteRepo.setPinned(ids, pinned));
    },

    togglePin(note: Pick<NoteRow, 'id' | 'pinned'>) {
      run(noteRepo.setPinned([note.id], !note.pinned));
    },

    move(ids: readonly string[], folderId: string | null, previous: string | null | undefined) {
      run(
        noteRepo.moveToFolder(ids, folderId).then(() =>
          undo.show({
            message: t('notes.toast.moved'),
            onUndo:
              previous === undefined
                ? undefined
                : () => run(noteRepo.moveToFolder(ids, previous ?? null)),
          }),
        ),
      );
    },

    /** Nach „Zuletzt gelöscht“, fuenf Sekunden lang rueckgaengig. */
    trash(ids: readonly string[]) {
      if (ids.length === 0) return;
      run(
        noteRepo.moveToTrash(ids).then(() =>
          undo.show({
            message:
              ids.length === 1
                ? t('notes.toast.deleted')
                : t('notes.toast.deletedMany', { count: ids.length }),
            onUndo: () => run(noteRepo.restore(ids)),
          }),
        ),
      );
    },

    restore(ids: readonly string[]) {
      run(noteRepo.restore(ids));
    },

    /** Endgueltig — die Rueckfrage kommt vorher. */
    purge(rows: readonly NoteRow[]) {
      run(
        Promise.all(rows.map((row) => noteRepo.remove(row.id))).then(() => removeNoteImages(rows)),
      );
    },

    share(message: string, title?: string) {
      if (message.trim().length === 0) return;
      // Abbrechen ist kein Fehler; nur wo es gar kein Teilen gibt (manche Browser), sagt es das.
      Share.share({ message, title }).catch(() =>
        undo.show({ message: t('notes.toast.shareUnavailable') }),
      );
    },
  };
}
