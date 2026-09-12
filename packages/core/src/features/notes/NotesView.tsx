import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useLiveQuery } from '@/db';
import type { NoteRow } from '@/db';
import { notes as noteRepo } from '@/db/repositories';
import { formatShortDate, useI18n } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Header,
  Icon,
  Input,
  Loading,
  Screen,
  Sheet,
  SwipeRow,
  Text,
} from '@/ui';

/** Ob eine Notiz zum Suchwort passt — Titel oder Text, ohne Gross und Klein. */
function matches(note: NoteRow, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return true;
  return note.title.toLowerCase().includes(needle) || note.body.toLowerCase().includes(needle);
}

export function NotesView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();

  const [editing, setEditing] = useState<NoteRow | null>(null);
  const [query, setQuery] = useState('');
  const list = useLiveQuery(() => noteRepo.list(account.id), [account.id]);
  const items = list.data ?? [];
  const visible = items.filter((note) => matches(note, query));
  const pinned = visible.filter((note) => note.pinned);
  const rest = visible.filter((note) => !note.pinned);

  async function createAndOpen() {
    const created = await noteRepo.create({ accountId: account.id });
    setEditing(created);
  }

  /** Loeschen: nach links wischen, oder im Blatt unten. */
  function card(note: NoteRow) {
    return (
      <SwipeRow
        key={note.id}
        radius={theme.radii.md}
        onDelete={() => void noteRepo.remove(note.id)}
      >
        <Card onPress={() => setEditing(note)} accessibilityLabel={note.title}>
          <View style={{ gap: theme.spacing.xs }}>
            <View style={[styles.titleRow, { gap: theme.spacing.xs }]}>
              {note.pinned ? <Icon name="pinFilled" size={14} color={theme.colors.accent} /> : null}
              <Text variant="title" numberOfLines={1}>
                {note.title.trim().length > 0 ? note.title : t('notes.untitled')}
              </Text>
            </View>
            {note.body.trim().length > 0 ? (
              <Text variant="label" tone="muted" numberOfLines={2}>
                {note.body}
              </Text>
            ) : null}
            <Text variant="caption" tone="faint">
              {formatShortDate(language, note.updatedAt)}
            </Text>
          </View>
        </Card>
      </SwipeRow>
    );
  }

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={t(items.length === 1 ? 'notes.count.one' : 'notes.count', {
            count: items.length,
          })}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        />
      }
      footer={<Button label={t('notes.new')} icon="plus" onPress={createAndOpen} />}
    >
      {items.length > 0 ? (
        <Input
          icon="search"
          placeholder={t('notes.search')}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          accessibilityLabel={t('notes.search')}
        />
      ) : null}

      {list.loading && items.length === 0 ? <Loading /> : null}

      {!list.loading && items.length === 0 ? (
        <EmptyState title={t('notes.empty.title')} body={t('notes.empty.body')} />
      ) : null}

      {items.length > 0 && visible.length === 0 ? (
        <Text variant="label" tone="faint" align="center">
          {t('notes.noMatch')}
        </Text>
      ) : null}

      {pinned.length > 0 ? (
        <Text variant="section" tone="muted">
          {t('notes.pinned')}
        </Text>
      ) : null}
      {pinned.map(card)}
      {rest.map(card)}

      <NoteEditor note={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}

function NoteEditor({ note, onClose }: { note: NoteRow | null; onClose: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const noteId = note?.id ?? null;
  // Beim Oeffnen einer anderen Notiz die Felder neu fuellen.
  const loadedId = useRef<string | null>(null);

  useEffect(() => {
    if (noteId && loadedId.current !== noteId) {
      loadedId.current = noteId;
      setTitle(note?.title ?? '');
      setBody(note?.body ?? '');
      setPinned(note?.pinned ?? false);
    }
    if (!noteId) loadedId.current = null;
  }, [noteId, note?.title, note?.body, note?.pinned]);

  async function save() {
    if (!noteId) return;
    await noteRepo.save(noteId, { title, body, pinned });
    onClose();
  }

  async function remove() {
    if (!noteId) return;
    await noteRepo.remove(noteId);
    onClose();
  }

  return (
    <Sheet visible={note !== null} onClose={save} title={t('notes.edit')} fullScreen>
      <View style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.sm }}>
        <Input
          label={t('notes.title')}
          placeholder={t('notes.titlePlaceholder')}
          value={title}
          onChangeText={setTitle}
          autoCapitalize="sentences"
        />
        <Input
          label={t('notes.body')}
          placeholder={t('notes.bodyPlaceholder')}
          value={body}
          onChangeText={setBody}
          multiline
          autoCapitalize="sentences"
        />
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Chip label={t('notes.pin')} selected={pinned} onPress={() => setPinned((v) => !v)} />
        </View>
        <View style={{ gap: theme.spacing.sm }}>
          <Button label={t('common.done')} icon="check" onPress={save} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('notes.remove')}
            onPress={remove}
            style={[styles.removeRow, { gap: theme.spacing.sm, paddingVertical: theme.spacing.md }]}
          >
            <Icon name="trash" size={18} color={theme.colors.danger} />
            <Text variant="label" tone="danger">
              {t('notes.remove')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  removeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
