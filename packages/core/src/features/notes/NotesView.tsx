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
import { Button, Card, EmptyState, Header, Icon, Input, Loading, Screen, Sheet, Text } from '@/ui';

export function NotesView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();

  const [editing, setEditing] = useState<NoteRow | null>(null);
  const list = useLiveQuery(() => noteRepo.list(account.id), [account.id]);
  const items = list.data ?? [];

  async function createAndOpen() {
    const created = await noteRepo.create({ accountId: account.id });
    setEditing(created);
  }

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={t('notes.count', { count: items.length })}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        />
      }
      footer={<Button label={t('notes.new')} icon="plus" onPress={createAndOpen} />}
    >
      {list.loading && items.length === 0 ? <Loading /> : null}

      {!list.loading && items.length === 0 ? (
        <EmptyState
          icon="note"
          title={t('notes.empty.title')}
          body={t('notes.empty.body')}
          actionLabel={t('notes.new')}
          onAction={createAndOpen}
        />
      ) : null}

      {items.map((note) => (
        <Card key={note.id} onPress={() => setEditing(note)} accessibilityLabel={note.title}>
          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="title" numberOfLines={1}>
              {note.title.trim().length > 0 ? note.title : t('notes.untitled')}
            </Text>
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
      ))}

      <NoteEditor note={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}

function NoteEditor({ note, onClose }: { note: NoteRow | null; onClose: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const noteId = note?.id ?? null;
  // Beim Oeffnen einer anderen Notiz die Felder neu fuellen.
  const loadedId = useRef<string | null>(null);

  useEffect(() => {
    if (noteId && loadedId.current !== noteId) {
      loadedId.current = noteId;
      setTitle(note?.title ?? '');
      setBody(note?.body ?? '');
    }
    if (!noteId) loadedId.current = null;
  }, [noteId, note?.title, note?.body]);

  async function save() {
    if (!noteId) return;
    await noteRepo.save(noteId, { title, body });
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
  removeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
