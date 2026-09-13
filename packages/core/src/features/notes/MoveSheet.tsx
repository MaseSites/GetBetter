import { useState } from 'react';
import { View } from 'react-native';

import type { NoteFolderRow } from '@/db';
import { noteFolders } from '@/db/noteFolders';
import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import { AddBar, Icon, PlainList, PlainRow, Sheet, useUndo } from '@/ui';

import { NOTE_ICONS } from './icons';

export type MoveSheetProps = {
  visible: boolean;
  accountId: string;
  folders: readonly NoteFolderRow[];
  /** Wo die Notiz jetzt liegt; `undefined` bei mehreren aus verschiedenen Ordnern. */
  current: string | null | undefined;
  onPick: (folderId: string | null) => void;
  onClose: () => void;
};

/** Wohin: kein Ordner, ein bestehender, oder gleich ein neuer. */
export function MoveSheet({
  visible,
  accountId,
  folders,
  current,
  onPick,
  onClose,
}: MoveSheetProps) {
  const t = useTranslate();
  const theme = useTheme();
  const undo = useUndo();
  const [name, setName] = useState('');

  function pick(folderId: string | null) {
    onClose();
    onPick(folderId);
  }

  async function createAndPick() {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    setName('');
    try {
      const folder = await noteFolders.save({ accountId, name: trimmed });
      pick(folder.id);
    } catch {
      undo.show({ message: t('notes.toast.failed') });
    }
  }

  const check = <Icon name="check" size={18} color={theme.colors.accentStrong} />;

  return (
    <Sheet visible={visible} onClose={onClose} title={t('notes.move.title')}>
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
        <PlainList>
          <PlainRow
            key="none"
            leading={<Icon name="inbox" size={20} color={theme.colors.textMuted} />}
            title={t('notes.move.noFolder')}
            trailing={current === null ? check : undefined}
            onPress={() => pick(null)}
          />
          {folders.map((folder) => (
            <PlainRow
              key={folder.id}
              leading={<Icon name={NOTE_ICONS.folder} size={20} color={theme.colors.textMuted} />}
              title={folder.name}
              trailing={current === folder.id ? check : undefined}
              onPress={() => pick(folder.id)}
            />
          ))}
        </PlainList>
        <AddBar
          value={name}
          onChangeText={setName}
          onSubmit={() => void createAndPick()}
          placeholder={t('notes.folders.new')}
          addLabel={t('notes.folders.add')}
        />
      </View>
    </Sheet>
  );
}
