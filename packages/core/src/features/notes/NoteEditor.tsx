import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { useLiveQuery, type NoteRow } from '@/db';
import { blocksOf, noteTextOf } from '@/db/noteBlocks';
import { noteFolders } from '@/db/noteFolders';
import { notes as noteRepo } from '@/db/repositories';
import type { NoteBlock } from '@/db/types';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Header, Text, useUndo, type MenuEntry } from '@/ui';

import {
  appendTag,
  applyText,
  backspaceAtStart,
  canIndent,
  createBlockId,
  emptyBlocks,
  indentBlock,
  insertImage,
  isBlank,
  listNumber,
  removeBlock,
  setKind,
  shapeBlock,
  toggleChecked,
  toggleKind,
  wordCount,
  type Focus,
} from './blocks';
import { BlockView, type BlockHandlers } from './BlockView';
import { NoteDraft } from './draft';
import { EditorToolbar, FindBar } from './EditorBars';
import { EditorSession } from './EditorSession';
import { FormatSheet, NoteInfoSheet, NoteTagsSheet } from './EditorSheets';
import { formatEditorDate } from './format';
import { MenuButton, RoundButton, TextButton } from './HeaderButtons';
import { NOTE_ICONS } from './icons';
import { addNoteImage, canAddImage, IMAGE_ERROR_KEYS } from './images';
import { MoveSheet } from './MoveSheet';
import { ImagePreview } from './NoteImage';
import { NOTES_HREF, tagHref } from './routes';
import { findHits } from './search';
import { noteToText } from './share';
import { tagsOfNote } from './tags';
import { useNoteActions } from './useNoteActions';

/** So lange warten Sprung-zur-Fundstelle, bis die Bloecke vermessen sind. */
const LAYOUT_SETTLE_MS = 60;

type EditorSheet = 'format' | 'info' | 'tags' | 'move' | null;

export type NoteEditorProps = {
  accountId: string;
  /** Null bei einer neuen Notiz — sie entsteht erst mit dem ersten Zeichen. */
  note: NoteRow | null;
  /** Wohin eine neue Notiz kommt. */
  folderId: string | null;
  /** Aus der Suche: springt zur ersten Stelle und zeigt die Suchleiste. */
  initialQuery: string;
};

/**
 * Der Editor als eigener Ort mit Zurueck. Kein Titelfeld, keine Speichertaste:
 * die erste Zeile ist der Titel, gesichert wird fortlaufend.
 */
export function NoteEditor({ accountId, note, folderId, initialQuery }: NoteEditorProps) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const undo = useUndo();
  const actions = useNoteActions();
  const scroll = useRef<ScrollView>(null);

  const [session] = useState(
    () => new EditorSession(note ? blocksOf(note) : emptyBlocks(createBlockId)),
  );
  const [blocks, setBlocks] = useState<readonly NoteBlock[]>(() => session.blocks);
  const [noteId, setNoteId] = useState<string | null>(note?.id ?? null);
  const [draft] = useState(
    () =>
      new NoteDraft({
        noteId: note?.id ?? null,
        store: {
          create: async (next) => (await noteRepo.create({ accountId, blocks: next, folderId })).id,
          save: async (id, next) => {
            await noteRepo.save(id, { blocks: next });
          },
          discard: (id) => noteRepo.remove(id),
        },
        onCreated: setNoteId,
        onError: () => undo.show({ message: t('notes.toast.saveFailed') }),
      }),
  );
  const [keyboard, setKeyboard] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<EditorSheet>(null);
  const [findQuery, setFindQuery] = useState<string | null>(() =>
    initialQuery.trim().length > 0 ? initialQuery.trim() : null,
  );
  const [hitIndex, setHitIndex] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [openedAt] = useState(() => new Date().toISOString());

  const live = useLiveQuery(
    () => (noteId ? noteRepo.find(noteId) : Promise.resolve(undefined)),
    [noteId],
  );
  const folderQuery = useLiveQuery(() => noteFolders.list(accountId), [accountId]);
  const row = live.data ?? note;
  const folders = folderQuery.data ?? [];
  const folderName = row?.folderId
    ? (folders.find((folder) => folder.id === row.folderId)?.name ?? null)
    : null;

  // Wartet ein Cursor auf ein Feld, das eben erst entstanden ist, kommt er jetzt dorthin.
  useEffect(() => {
    session.flush();
  });

  // Verlassen sichert — und wirft eine neue, leer gebliebene Notiz weg.
  useEffect(
    () => () => {
      session.dispose();
      void draft.leave();
    },
    [session, draft],
  );

  const hits = findQuery !== null ? findHits(blocks, findQuery) : [];
  const currentHit = hits.length > 0 ? Math.min(hitIndex, hits.length - 1) : 0;
  const targetId = hits[currentHit]?.blockId ?? null;
  const scrollMargin = theme.spacing.xxl * 3;

  useEffect(() => {
    if (!targetId) return;
    const timer = setTimeout(() => {
      const y = session.offsetOf(targetId);
      if (y !== undefined)
        scroll.current?.scrollTo({ y: Math.max(0, y - scrollMargin), animated: true });
    }, LAYOUT_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [targetId, currentHit, session, scrollMargin]);

  function commit(next: readonly NoteBlock[], focus: Focus | null) {
    if (next !== session.blocks) {
      session.setBlocks(next);
      setBlocks(next);
      draft.change(next);
    }
    if (focus) session.request(focus);
  }

  function blockById(id: string | null): NoteBlock | undefined {
    return id ? session.blocks.find((block) => block.id === id) : undefined;
  }

  const handlers: BlockHandlers = {
    change: (id, text) => {
      const result = applyText(session.blocks, id, text, createBlockId);
      commit(result.blocks, result.focus);
    },
    backspace: (id) => {
      const block = blockById(id);
      if (!block || !session.isAtStart(id, block.text)) return;
      const result = backspaceAtStart(session.blocks, id);
      commit(result.blocks, result.focus);
    },
    focus: (id) => {
      session.focused();
      setActiveId(id);
      setKeyboard(true);
    },
    blur: () => session.blurred(() => setKeyboard(false)),
    toggleCheck: (id) => commit(toggleChecked(session.blocks, id), null),
    indent: (id, delta) => commit(indentBlock(session.blocks, id, delta), null),
    openImage: (uploadId) => {
      Keyboard.dismiss();
      setPreview(uploadId);
    },
    removeImage: (id) => commit(removeBlock(session.blocks, id), null),
    selection: (id, start, end) => session.select(id, start, end),
    register: (id, input) => session.register(id, input),
    layout: (id, y) => session.layout(id, y),
    exitFind: (id) => {
      setFindQuery(null);
      session.request({ id, cursor: blockById(id)?.text.length ?? 0 });
    },
  };

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace(NOTES_HREF);
  }

  function hideKeyboard() {
    session.release();
    Keyboard.dismiss();
    setKeyboard(false);
  }

  function openFormat() {
    hideKeyboard();
    setSheet('format');
  }

  function toggleChecklist() {
    session.release();
    const block = blockById(activeId);
    if (!block || !activeId) return;
    commit(toggleKind(session.blocks, activeId, 'check'), {
      id: activeId,
      cursor: block.text.length,
    });
  }

  async function addImage() {
    const after = activeId ?? session.blocks[session.blocks.length - 1]?.id ?? null;
    hideKeyboard();
    try {
      const result = await addNoteImage(accountId);
      if (!result) return;
      if (!result.ok) {
        undo.show({ message: t(IMAGE_ERROR_KEYS[result.error]) });
        return;
      }
      commit(insertImage(session.blocks, after, result.id, createBlockId), null);
    } catch {
      undo.show({ message: t('notes.image.error.failed') });
    }
  }

  /** Unter dem Text tippen: weiter am Ende schreiben. */
  function continueWriting() {
    const last = session.blocks[session.blocks.length - 1];
    if (last && last.kind !== 'image') {
      session.request({ id: last.id, cursor: last.text.length });
      return;
    }
    const line = shapeBlock({ id: createBlockId(), text: '' }, last ? 'text' : 'title');
    commit([...session.blocks, line], { id: line.id, cursor: 0 });
  }

  async function withSavedId(run: (id: string) => void) {
    const id = await draft.commit();
    if (id) run(id);
  }

  async function remove() {
    const id = await draft.commit();
    if (id) actions.trash([id]);
    leave();
  }

  const blank = isBlank(blocks);
  const saved = noteId !== null;
  const pinned = row?.pinned ?? false;
  const onHome = Boolean(row?.homeAt);
  const menu: MenuEntry[] = [
    {
      key: 'pin',
      label: pinned ? t('notes.action.unpin') : t('notes.pin'),
      icon: pinned ? 'pinFilled' : 'pin',
      disabled: blank && !saved,
      onPress: () => void withSavedId((id) => actions.setPinned([id], !pinned)),
    },
    {
      key: 'home',
      label: onHome ? t('notes.home.unpin') : t('notes.home.pin'),
      icon: 'home',
      disabled: blank && !saved,
      onPress: () => void withSavedId((id) => actions.setOnHome([id], !onHome)),
    },
    {
      key: 'move',
      label: t('notes.action.move'),
      icon: NOTE_ICONS.folder,
      disabled: blank && !saved,
      onPress: () => setSheet('move'),
    },
    {
      key: 'tags',
      label: t('notes.action.tags'),
      icon: NOTE_ICONS.tag,
      onPress: () => setSheet('tags'),
    },
    {
      key: 'find',
      label: t('notes.action.find'),
      icon: 'search',
      onPress: () => {
        hideKeyboard();
        setHitIndex(0);
        setFindQuery('');
      },
    },
    {
      key: 'info',
      label: t('notes.action.info'),
      icon: 'info',
      disabled: !saved,
      onPress: () => setSheet('info'),
    },
    { key: 'divider', divider: true },
    {
      key: 'delete',
      label: t('common.delete'),
      icon: 'trash',
      destructive: true,
      onPress: () => void remove(),
    },
  ];

  const active = blockById(activeId);
  const withCurrent = hits.map((hit, index) => ({ ...hit, current: index === currentHit }));

  return (
    <KeyboardAvoidingView
      style={[styles.fill, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header
        showBack
        onBack={leave}
        right={
          <View style={[styles.row, { gap: theme.spacing.sm }]}>
            {keyboard ? (
              <TextButton label={t('common.done')} onPress={hideKeyboard} />
            ) : (
              <RoundButton
                icon={NOTE_ICONS.share}
                label={t('notes.action.share')}
                onPress={() => actions.share(noteToText(session.blocks), row?.title)}
              />
            )}
            <MenuButton icon={NOTE_ICONS.more} label={t('notes.menu.more')} items={menu} />
          </View>
        }
      />
      <ScrollView
        ref={scroll}
        style={styles.fill}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.edge,
          paddingBottom: theme.spacing.xxl,
          gap: theme.spacing.xs,
        }}
      >
        <Text variant="caption" tone="faint" align="center">
          {formatEditorDate(language, row?.updatedAt ?? openedAt)}
        </Text>
        {blocks.map((block, index) => (
          <BlockView
            key={block.id}
            block={block}
            number={listNumber(blocks, index)}
            handlers={handlers}
            finding={findQuery !== null}
            hits={withCurrent.filter((hit) => hit.blockId === block.id)}
            autoFocus={note === null && index === 0}
          />
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('notes.editor.continue')}
          onPress={continueWriting}
          style={{ minHeight: theme.spacing.xxl * 4 }}
        />
      </ScrollView>

      {findQuery !== null ? (
        <FindBar
          query={findQuery}
          onChangeQuery={(query) => {
            setFindQuery(query);
            setHitIndex(0);
          }}
          current={currentHit}
          total={hits.length}
          onPrev={() =>
            setHitIndex(hits.length > 0 ? (currentHit - 1 + hits.length) % hits.length : 0)
          }
          onNext={() => setHitIndex(hits.length > 0 ? (currentHit + 1) % hits.length : 0)}
          onClose={() => setFindQuery(null)}
          autoFocus={findQuery === ''}
        />
      ) : keyboard ? (
        <EditorToolbar
          onHold={() => session.hold()}
          onFormat={openFormat}
          onChecklist={toggleChecklist}
          onImage={canAddImage() ? () => void addImage() : undefined}
          onHideKeyboard={hideKeyboard}
        />
      ) : null}

      <FormatSheet
        visible={sheet === 'format'}
        onClose={() => setSheet(null)}
        kind={active?.kind ?? null}
        canIndent={active ? canIndent(active.kind) : false}
        onKind={(kind) => {
          if (activeId) commit(setKind(session.blocks, activeId, kind), null);
        }}
        onIndent={(delta) => {
          if (activeId) commit(indentBlock(session.blocks, activeId, delta), null);
        }}
      />
      <NoteInfoSheet
        visible={sheet === 'info'}
        onClose={() => setSheet(null)}
        createdAt={row?.createdAt ?? openedAt}
        updatedAt={row?.updatedAt ?? openedAt}
        words={wordCount(blocks)}
        folderName={folderName}
      />
      <NoteTagsSheet
        visible={sheet === 'tags'}
        onClose={() => setSheet(null)}
        tags={tagsOfNote(noteTextOf(blocks))}
        onAdd={(tag) => commit(appendTag(session.blocks, tag, createBlockId), null)}
        onOpenTag={(tag) => {
          setSheet(null);
          router.push(tagHref(tag));
        }}
      />
      <MoveSheet
        visible={sheet === 'move'}
        accountId={accountId}
        folders={folders}
        current={row?.folderId ?? null}
        onClose={() => setSheet(null)}
        onPick={(target) =>
          void withSavedId((id) => actions.move([id], target, row?.folderId ?? null))
        }
      />
      <ImagePreview uploadId={preview} onClose={() => setPreview(null)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
