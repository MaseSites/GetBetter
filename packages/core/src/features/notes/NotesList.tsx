import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useLiveQuery, type NoteFolderRow, type NoteRow } from '@/db';
import { blocksOf } from '@/db/noteBlocks';
import { noteFolders } from '@/db/noteFolders';
import { notes as noteRepo } from '@/db/repositories';
import { useI18n } from '@/i18n';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  Button,
  FLOATING_BUTTON_SIZE,
  FloatingButton,
  Header,
  IconButton,
  Input,
  Loading,
  Screen,
  SectionHeader,
  Text,
  useUndo,
  type MenuEntry,
} from '@/ui';

import { ConfirmSheet } from './ConfirmSheet';
import { FoldersSheet } from './FoldersSheet';
import { sectionLabel } from './format';
import { sectionNotes, type NoteSort } from './grouping';
import { MenuButton, TextButton } from './HeaderButtons';
import { NOTE_ICONS } from './icons';
import { removeNoteImages } from './images';
import { MoveSheet } from './MoveSheet';
import { NoteListItem, NoteTile, useNoteCard, type NoteItemHandlers } from './NoteRow';
import { newNoteHref, noteHref } from './routes';
import { notesInScope, sameScope, type NoteScope } from './scope';
import { matchNote, type NoteMatch } from './search';
import { noteToText } from './share';
import { tagCounts } from './tags';
import { trashCutoff } from './trash';
import { TrashList } from './TrashList';
import { useNoteActions } from './useNoteActions';

/** So viele Angeheftete stehen oben, dann „Alle N“. */
const PINNED_PREVIEW = 3;
/** So viele Tags passen ins Titelmenue; alle stehen unter „Ordner verwalten“. */
const MENU_TAGS = 5;

type NoteView = 'list' | 'grid';

export type NotesListProps = {
  initialFolderId: string | null;
  initialTag: string | null;
};

function pairsOf<T>(rows: readonly T[]): T[][] {
  return rows.reduce<T[][]>((pairs, row, index) => {
    if (index % 2 === 0) return [...pairs, [row]];
    const last = pairs[pairs.length - 1] ?? [];
    return [...pairs.slice(0, -1), [...last, row]];
  }, []);
}

/** Die Notizliste: Titelmenue mit Ordnern und Tags, Suche, Abschnitte, „+“ unten rechts. */
export function NotesList({ initialFolderId, initialTag }: NotesListProps) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const card = useNoteCard();
  const router = useRouter();
  const account = useAccount();
  const undo = useUndo();
  const actions = useNoteActions();

  const [scope, setScope] = useState<NoteScope>(() =>
    initialFolderId
      ? { kind: 'folder', id: initialFolderId }
      : initialTag
        ? { kind: 'tag', tag: initialTag }
        : { kind: 'all' },
  );
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<NoteSort>('edited');
  const [groupByDate, setGroupByDate] = useState(true);
  const [rootView, setRootView] = useState<NoteView>('list');
  const [showAllPinned, setShowAllPinned] = useState(false);
  const [selection, setSelection] = useState<readonly string[] | null>(null);
  const [moving, setMoving] = useState<readonly NoteRow[] | null>(null);
  const [managing, setManaging] = useState(false);
  const [purging, setPurging] = useState<readonly NoteRow[] | null>(null);
  const [now] = useState(() => new Date());

  const list = useLiveQuery(() => noteRepo.list(account.id), [account.id]);
  const deleted = useLiveQuery(() => noteRepo.listDeleted(account.id), [account.id]);
  const folderQuery = useLiveQuery(() => noteFolders.list(account.id), [account.id]);

  useEffect(() => {
    // Abgelaufenes aus „Zuletzt gelöscht“ raeumen. Misslingt es, bleibt es bis zum naechsten Oeffnen.
    noteRepo
      .purgeDeletedBefore(account.id, trashCutoff(new Date()))
      .then(removeNoteImages)
      .catch(() => undefined);
  }, [account.id]);

  const notes = list.data ?? [];
  const trash = deleted.data ?? [];
  const folders: readonly NoteFolderRow[] = folderQuery.data ?? [];
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));

  // Ein Ordner, den es nicht mehr gibt, zeigt wieder alles.
  const folderMissing =
    scope.kind === 'folder' && !folderById.has(scope.id) && !folderQuery.loading;
  const current: NoteScope = folderMissing ? { kind: 'all' } : scope;
  const currentFolder = current.kind === 'folder' ? folderById.get(current.id) : undefined;

  const trimmed = query.trim();
  const scoped = notesInScope(notes, current);
  const matches = new Map<string, NoteMatch>();
  for (const note of scoped) {
    const match = trimmed ? matchNote(note, trimmed) : null;
    if (match) matches.set(note.id, match);
  }
  const visible = trimmed ? scoped.filter((note) => matches.has(note.id)) : scoped;
  const sections = sectionNotes(visible, { sort, groupByDate, now });
  const tags = tagCounts(notes);
  const view: NoteView = currentFolder ? (currentFolder.view ?? 'list') : rootView;
  const showFolder = current.kind !== 'folder';
  const selecting = selection !== null;
  const selectedNotes = visible.filter((note) => selection?.includes(note.id));

  const counts = new Map<string, number>();
  for (const note of notes) {
    if (note.folderId) counts.set(note.folderId, (counts.get(note.folderId) ?? 0) + 1);
  }

  function changeScope(next: NoteScope) {
    setScope(next);
    setShowAllPinned(false);
    setSelection(null);
  }

  function toggleView() {
    const next: NoteView = view === 'grid' ? 'list' : 'grid';
    if (!currentFolder) {
      setRootView(next);
      return;
    }
    noteFolders
      .save({ id: currentFolder.id, accountId: account.id, name: currentFolder.name, view: next })
      .catch(() => undo.show({ message: t('notes.toast.failed') }));
  }

  const handlers: NoteItemHandlers = {
    open: (note) => router.push(noteHref(note.id, trimmed)),
    toggleSelect: (note) =>
      setSelection((chosen) => {
        const ids = chosen ?? [];
        return ids.includes(note.id) ? ids.filter((id) => id !== note.id) : [...ids, note.id];
      }),
    startSelect: (note) => setSelection([note.id]),
    togglePin: (note) => actions.togglePin(note),
    toggleHome: (note) => actions.setOnHome([note.id], !note.homeAt),
    move: (note) => setMoving([note]),
    trash: (note) => actions.trash([note.id]),
    share: (note) => actions.share(noteToText(blocksOf(note)), note.title),
  };

  const title =
    current.kind === 'folder'
      ? (currentFolder?.name ?? t('notes.scope.all'))
      : current.kind === 'tag'
        ? `#${current.tag}`
        : current.kind === 'trash'
          ? t('notes.scope.trash')
          : t('notes.scope.all');

  const scopeItem = (key: string, label: string, next: NoteScope): MenuEntry => ({
    key,
    label,
    selected: sameScope(current, next),
    onPress: () => changeScope(next),
  });

  const titleMenu: MenuEntry[] = [
    scopeItem('all', t('notes.scope.all'), { kind: 'all' }),
    ...folders.map((folder) =>
      scopeItem(`folder-${folder.id}`, folder.name, { kind: 'folder', id: folder.id }),
    ),
    ...(tags.length > 0 ? [{ key: 'tags', divider: true as const }] : []),
    ...tags
      .slice(0, MENU_TAGS)
      .map(({ tag }) => scopeItem(`tag-${tag}`, `#${tag}`, { kind: 'tag', tag })),
    { key: 'end', divider: true },
    scopeItem('trash', t('notes.scope.trash'), { kind: 'trash' }),
    {
      key: 'manage',
      label: t('notes.menu.manageFolders'),
      icon: 'settings',
      onPress: () => setManaging(true),
    },
  ];

  const moreMenu: MenuEntry[] =
    current.kind === 'trash'
      ? [
          {
            key: 'emptyTrash',
            label: t('notes.menu.emptyTrash'),
            icon: 'trash',
            destructive: true,
            disabled: trash.length === 0,
            onPress: () => setPurging(trash),
          },
        ]
      : [
          {
            key: 'view',
            label: view === 'grid' ? t('notes.menu.asList') : t('notes.menu.asGrid'),
            icon: view === 'grid' ? 'lines' : 'grid',
            onPress: toggleView,
          },
          { key: 'sortDivider', divider: true },
          {
            key: 'sortEdited',
            label: t('notes.sort.edited'),
            selected: sort === 'edited',
            onPress: () => setSort('edited'),
          },
          {
            key: 'sortCreated',
            label: t('notes.sort.created'),
            selected: sort === 'created',
            onPress: () => setSort('created'),
          },
          {
            key: 'sortTitle',
            label: t('notes.sort.title'),
            selected: sort === 'title',
            onPress: () => setSort('title'),
          },
          { key: 'groupDivider', divider: true },
          {
            key: 'group',
            label: t('notes.menu.groupByDate'),
            selected: groupByDate,
            disabled: sort === 'title',
            onPress: () => setGroupByDate((value) => !value),
          },
          {
            key: 'select',
            label: t('notes.menu.select'),
            icon: NOTE_ICONS.select,
            disabled: visible.length === 0,
            onPress: () => setSelection([]),
          },
        ];

  const emptyLine = list.loading
    ? null
    : trimmed && visible.length === 0
      ? t('notes.list.noResults', { query: trimmed })
      : !trimmed && scoped.length === 0
        ? current.kind === 'folder'
          ? t('notes.list.emptyFolder', { name: currentFolder?.name ?? '' })
          : current.kind === 'tag'
            ? t('notes.list.emptyTag', { tag: current.tag })
            : t('notes.list.empty')
        : null;

  function renderRows(rows: readonly NoteRow[]) {
    const itemProps = (note: NoteRow) => ({
      note,
      folderName:
        showFolder && note.folderId ? (folderById.get(note.folderId)?.name ?? null) : null,
      match: matches.get(note.id) ?? null,
      now,
      selecting,
      selected: selection?.includes(note.id) ?? false,
      handlers,
    });

    if (view === 'grid') {
      return (
        <View style={{ gap: theme.spacing.md }}>
          {pairsOf(rows).map((pair) => (
            <View key={pair[0]?.id} style={[styles.pair, { gap: theme.spacing.md }]}>
              {pair.map((note) => (
                <NoteTile key={note.id} {...itemProps(note)} />
              ))}
              {pair.length === 1 ? <View style={styles.grow} /> : null}
            </View>
          ))}
        </View>
      );
    }
    return (
      <View style={card.list}>
        {rows.map((note) => (
          <NoteListItem key={note.id} {...itemProps(note)} />
        ))}
      </View>
    );
  }

  const selectedIds = selectedNotes.map((note) => note.id);
  const allPinned = selectedNotes.length > 0 && selectedNotes.every((note) => note.pinned);
  const selectionBar = selecting ? (
    <View style={[styles.pair, styles.center, { gap: theme.spacing.lg }]}>
      <Text variant="label" style={styles.grow}>
        {t('notes.select.count', { count: selectedIds.length })}
      </Text>
      <IconButton
        icon={allPinned ? 'pinFilled' : 'pin'}
        tone="default"
        size={22}
        label={allPinned ? t('notes.action.unpin') : t('notes.pin')}
        onPress={() => {
          if (selectedIds.length === 0) return;
          actions.setPinned(selectedIds, !allPinned);
          setSelection(null);
        }}
      />
      <IconButton
        icon={NOTE_ICONS.folder}
        tone="default"
        size={22}
        label={t('notes.action.move')}
        onPress={() => {
          if (selectedNotes.length > 0) setMoving(selectedNotes);
        }}
      />
      <IconButton
        icon="trash"
        tone="danger"
        size={22}
        label={t('common.delete')}
        onPress={() => {
          if (selectedIds.length === 0) return;
          actions.trash(selectedIds);
          setSelection(null);
        }}
      />
    </View>
  ) : undefined;

  const movingFolders = new Set((moving ?? []).map((note) => note.folderId ?? null));
  const [movingFrom] = [...movingFolders];

  return (
    <View style={styles.grow}>
      <Screen
        header={
          <Header
            title={title}
            titleMenu={titleMenu}
            showBack
            right={
              selecting ? (
                <TextButton label={t('common.done')} onPress={() => setSelection(null)} />
              ) : (
                <MenuButton icon={NOTE_ICONS.more} label={t('notes.menu.more')} items={moreMenu} />
              )
            }
          />
        }
        footer={selectionBar}
      >
        {current.kind === 'trash' ? (
          <TrashList
            notes={trash}
            now={now}
            onRestore={(note) => actions.restore([note.id])}
            onPurge={(note) => setPurging([note])}
          />
        ) : (
          <>
            <Input
              icon="search"
              placeholder={t('common.search')}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              accessibilityLabel={t('common.search')}
            />
            {list.loading && notes.length === 0 ? <Loading /> : null}
            {emptyLine ? (
              <Text variant="body" tone="muted" align="center">
                {emptyLine}
              </Text>
            ) : null}
            {trimmed && visible.length === 0 && current.kind !== 'all' ? (
              <Button
                label={t('notes.list.searchEverywhere')}
                variant="ghost"
                icon="search"
                onPress={() => changeScope({ kind: 'all' })}
              />
            ) : null}
            <View>
              {sections.map((section, index) => {
                const label = sectionLabel(t, language, section.group);
                const capped =
                  section.group.kind === 'pinned' &&
                  !showAllPinned &&
                  section.notes.length > PINNED_PREVIEW;
                const rows = capped ? section.notes.slice(0, PINNED_PREVIEW) : section.notes;
                return (
                  <View key={section.key}>
                    {label ? (
                      <SectionHeader
                        label={label}
                        first={index === 0}
                        actionLabel={
                          capped
                            ? t('notes.section.showAll', { count: section.notes.length })
                            : undefined
                        }
                        onAction={capped ? () => setShowAllPinned(true) : undefined}
                      />
                    ) : null}
                    {renderRows(rows)}
                  </View>
                );
              })}
            </View>
            <View style={{ height: FLOATING_BUTTON_SIZE + theme.spacing.xl }} />
          </>
        )}
      </Screen>

      {!selecting && current.kind !== 'trash' ? (
        <FloatingButton
          label={t('notes.new')}
          text={!list.loading && notes.length === 0 ? t('notes.new') : undefined}
          onPress={() => router.push(newNoteHref(currentFolder?.id ?? null))}
        />
      ) : null}

      <MoveSheet
        visible={moving !== null}
        accountId={account.id}
        folders={folders}
        current={movingFolders.size === 1 ? movingFrom : undefined}
        onClose={() => setMoving(null)}
        onPick={(folderId) => {
          const ids = (moving ?? []).map((note) => note.id);
          actions.move(ids, folderId, movingFolders.size === 1 ? movingFrom : undefined);
          setSelection(null);
        }}
      />

      <FoldersSheet
        visible={managing}
        onClose={() => setManaging(false)}
        accountId={account.id}
        folders={folders}
        counts={counts}
        allCount={notes.length}
        trashCount={trash.length}
        tags={tags}
        onSelect={changeScope}
      />

      <ConfirmSheet
        visible={purging !== null}
        title={
          (purging?.length ?? 0) > 1
            ? t('notes.trash.confirmAllTitle')
            : t('notes.trash.confirmTitle')
        }
        body={
          (purging?.length ?? 0) > 1
            ? t('notes.trash.confirmAllBody', { count: purging?.length ?? 0 })
            : t('notes.trash.confirmBody')
        }
        confirmLabel={t('notes.trash.purge')}
        onConfirm={() => actions.purge(purging ?? [])}
        onClose={() => setPurging(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  pair: { flexDirection: 'row' },
  center: { alignItems: 'center' },
});
