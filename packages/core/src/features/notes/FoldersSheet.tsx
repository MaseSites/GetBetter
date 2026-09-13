import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { NoteFolderRow } from '@/db';
import { noteFolders } from '@/db/noteFolders';
import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import {
  AddBar,
  Chip,
  Icon,
  IconButton,
  Input,
  PlainList,
  PlainRow,
  SectionHeader,
  Sheet,
  Text,
  useUndo,
} from '@/ui';

import { NOTE_ICONS } from './icons';
import type { NoteScope } from './scope';
import type { TagCount } from './tags';

export type FoldersSheetProps = {
  visible: boolean;
  onClose: () => void;
  accountId: string;
  folders: readonly NoteFolderRow[];
  /** Notizen je Ordner-Id; unter `''` die ohne Ordner nicht mitgezaehlt. */
  counts: ReadonlyMap<string, number>;
  allCount: number;
  trashCount: number;
  tags: readonly TagCount[];
  onSelect: (scope: NoteScope) => void;
};

/** „Ordner verwalten“: Alle Notizen, Ordner anlegen, umbenennen, loeschen, Tags, Papierkorb. */
export function FoldersSheet({
  visible,
  onClose,
  accountId,
  folders,
  counts,
  allCount,
  trashCount,
  tags,
  onSelect,
}: FoldersSheetProps) {
  const t = useTranslate();
  const theme = useTheme();
  const undo = useUndo();
  const [draft, setDraft] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  function select(scope: NoteScope) {
    onClose();
    onSelect(scope);
  }

  function failed() {
    undo.show({ message: t('notes.toast.failed') });
  }

  function create() {
    const name = draft.trim();
    if (name.length === 0) return;
    setDraft('');
    noteFolders.save({ accountId, name }).catch(failed);
  }

  function rename() {
    if (!renaming) return;
    const name = renaming.name.trim();
    setRenaming(null);
    if (name.length === 0) return;
    noteFolders.save({ id: renaming.id, accountId, name }).catch(failed);
  }

  async function remove(folder: NoteFolderRow) {
    try {
      const removed = await noteFolders.remove(folder.id);
      if (!removed) return;
      undo.show({
        message: t('notes.toast.folderDeleted', { name: folder.name }),
        onUndo: () => void noteFolders.restore(removed).catch(failed),
      });
    } catch {
      failed();
    }
  }

  const count = (value: number) => (
    <Text variant="label" tone="faint">
      {String(value)}
    </Text>
  );

  return (
    <Sheet visible={visible} onClose={onClose} title={t('notes.folders.title')} detent="large">
      <View style={{ paddingBottom: theme.spacing.lg }}>
        <PlainList>
          <PlainRow
            key="all"
            leading={<Icon name="note" size={20} color={theme.colors.textMuted} />}
            title={t('notes.scope.all')}
            trailing={count(allCount)}
            onPress={() => select({ kind: 'all' })}
          />
          {folders.map((folder) =>
            renaming?.id === folder.id ? (
              <View key={folder.id} style={{ paddingVertical: theme.spacing.sm }}>
                <Input
                  value={renaming.name}
                  onChangeText={(name) => setRenaming({ id: folder.id, name })}
                  onSubmitEditing={rename}
                  returnKeyType="done"
                  accessibilityLabel={t('notes.folders.rename')}
                />
              </View>
            ) : (
              <PlainRow
                key={folder.id}
                leading={<Icon name={NOTE_ICONS.folder} size={20} color={theme.colors.textMuted} />}
                title={folder.name}
                onPress={() => select({ kind: 'folder', id: folder.id })}
                trailing={
                  <View style={[styles.actions, { gap: theme.spacing.md }]}>
                    {count(counts.get(folder.id) ?? 0)}
                    <IconButton
                      icon="note"
                      label={t('notes.folders.rename')}
                      onPress={() => setRenaming({ id: folder.id, name: folder.name })}
                    />
                    <IconButton
                      icon="trash"
                      tone="danger"
                      label={t('common.delete')}
                      onPress={() => void remove(folder)}
                    />
                  </View>
                }
              />
            ),
          )}
        </PlainList>

        <View style={{ paddingTop: theme.spacing.md }}>
          <AddBar
            value={draft}
            onChangeText={setDraft}
            onSubmit={create}
            placeholder={t('notes.folders.new')}
            addLabel={t('notes.folders.add')}
          />
        </View>

        {tags.length > 0 ? (
          <>
            <SectionHeader label={t('notes.folders.tags')} />
            <View style={[styles.chips, { gap: theme.spacing.sm }]}>
              {tags.map(({ tag }) => (
                <Chip key={tag} label={`#${tag}`} onPress={() => select({ kind: 'tag', tag })} />
              ))}
            </View>
          </>
        ) : null}

        <SectionHeader label={t('notes.scope.trash')} />
        <PlainList>
          <PlainRow
            leading={<Icon name="trash" size={20} color={theme.colors.textMuted} />}
            title={t('notes.scope.trash')}
            trailing={count(trashCount)}
            onPress={() => select({ kind: 'trash' })}
          />
        </PlainList>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
