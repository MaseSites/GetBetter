import { useLocalSearchParams } from 'expo-router';

import { useLiveQuery } from '@/db';
import { notes as noteRepo } from '@/db/repositories';
import { useTranslate } from '@/i18n';
import { moduleName } from '@/mocks/moduleText';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount } from '@/state/AppContext';
import { EmptyState, Header, Loading, Screen } from '@/ui';

import { NoteEditor } from './NoteEditor';
import { NotesList } from './NotesList';

type Param = string | string[] | undefined;

type NotesParams = {
  /** `1`: neue Notiz, Tastatur offen. */
  new?: Param;
  /** Diese Notiz oeffnen. */
  note?: Param;
  /** Ordner der Liste, oder wohin eine neue Notiz kommt. */
  folder?: Param;
  tag?: Param;
  /** Suchwort: der Editor springt zur ersten Fundstelle. */
  q?: Param;
};

function single(value: Param): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  return first && first.length > 0 ? first : null;
}

/**
 * `/run/notes` zeigt die Liste, `/run/notes?new=1` eine neue Notiz und
 * `/run/notes?note=<id>` eine bestehende — der Editor ist damit ein eigener
 * Ort im Stapel, mit Zurueck und Randwisch.
 */
export function NotesView({ module }: { module: ModuleDefinition }) {
  const params = useLocalSearchParams<NotesParams>();
  const account = useAccount();
  const noteId = single(params.note);
  const folderId = single(params.folder);

  if (single(params.new) === '1') {
    return (
      <NoteEditor
        key="new"
        accountId={account.id}
        note={null}
        folderId={folderId}
        initialQuery=""
      />
    );
  }
  if (noteId) {
    return (
      <ExistingNote
        key={noteId}
        module={module}
        noteId={noteId}
        accountId={account.id}
        query={single(params.q) ?? ''}
      />
    );
  }
  return <NotesList initialFolderId={folderId} initialTag={single(params.tag)} />;
}

function ExistingNote({
  module,
  noteId,
  accountId,
  query,
}: {
  module: ModuleDefinition;
  noteId: string;
  accountId: string;
  query: string;
}) {
  const t = useTranslate();
  const found = useLiveQuery(() => noteRepo.find(noteId), [noteId]);
  const note = found.data;

  if (note && note.accountId === accountId) {
    return (
      <NoteEditor
        accountId={accountId}
        note={note}
        folderId={note.folderId ?? null}
        initialQuery={query}
      />
    );
  }
  if (found.loading) {
    return (
      <Screen header={<Header showBack />}>
        <Loading />
      </Screen>
    );
  }
  return (
    <Screen header={<Header showBack title={moduleName(t, module.id)} />} scroll={false}>
      <EmptyState title={t('notes.missing.title')} body={t('notes.missing.body')} />
    </Screen>
  );
}
