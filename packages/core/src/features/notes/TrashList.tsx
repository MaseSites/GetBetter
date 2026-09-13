import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { NoteRow } from '@/db';
import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import {
  Menu,
  measureAnchor,
  PlainList,
  SwipeRow,
  Text,
  type MenuAnchor,
  type MenuEntry,
} from '@/ui';

import { NOTE_ICONS } from './icons';
import { NOTE_ROW_HEIGHT } from './NoteRow';
import { trashDaysLeft } from './trash';

type TrashRowProps = {
  note: NoteRow;
  now: Date;
  onRestore: (note: NoteRow) => void;
  onPurge: (note: NoteRow) => void;
};

/** Ein Tipp zeigt, was geht; nach rechts wischen holt zurueck. */
function TrashRow({ note, now, onRestore, onPurge }: TrashRowProps) {
  const t = useTranslate();
  const theme = useTheme();
  const node = useRef<View>(null);
  const [menu, setMenu] = useState<{ anchor: MenuAnchor; open: boolean } | null>(null);

  const days = note.deletedAt ? trashDaysLeft(note.deletedAt, now) : 0;
  const title = note.title.trim() || t('notes.untitled');
  const items: MenuEntry[] = [
    {
      key: 'restore',
      label: t('notes.trash.restore'),
      icon: NOTE_ICONS.restore,
      onPress: () => onRestore(note),
    },
    {
      key: 'purge',
      label: t('notes.trash.purge'),
      icon: 'trash',
      destructive: true,
      onPress: () => onPurge(note),
    },
  ];

  async function open() {
    const anchor = await measureAnchor(node.current);
    if (anchor) setMenu({ anchor, open: true });
  }

  return (
    <>
      <SwipeRow
        backgroundColor={theme.colors.background}
        leading={{
          key: 'restore',
          label: t('notes.trash.restore'),
          icon: NOTE_ICONS.restore,
          tone: 'accent',
          onPress: () => onRestore(note),
        }}
        trailing={[
          {
            key: 'purge',
            label: t('notes.trash.purge'),
            icon: 'trash',
            tone: 'danger',
            onPress: () => onPurge(note),
          },
        ]}
      >
        <Pressable
          ref={node}
          accessibilityRole="button"
          accessibilityLabel={title}
          onPress={() => void open()}
          style={[
            styles.row,
            { minHeight: NOTE_ROW_HEIGHT, paddingVertical: theme.spacing.sm, gap: 2 },
          ]}
        >
          <Text variant="body" numberOfLines={1} style={{ fontWeight: theme.fontWeight.semibold }}>
            {title}
          </Text>
          <Text variant="label" tone="muted" numberOfLines={1}>
            {days === 1
              ? t('notes.trash.daysLeft.one')
              : t('notes.trash.daysLeft', { count: days })}
          </Text>
        </Pressable>
      </SwipeRow>
      <Menu
        visible={menu?.open ?? false}
        anchor={menu?.anchor ?? null}
        items={items}
        accessibilityLabel={title}
        onClose={() => setMenu((current) => (current ? { ...current, open: false } : null))}
      />
    </>
  );
}

export type TrashListProps = {
  notes: readonly NoteRow[];
  now: Date;
  onRestore: (note: NoteRow) => void;
  onPurge: (note: NoteRow) => void;
};

export function TrashList({ notes, now, onRestore, onPurge }: TrashListProps) {
  const t = useTranslate();
  if (notes.length === 0) {
    return (
      <Text variant="body" tone="muted" align="center">
        {t('notes.trash.empty')}
      </Text>
    );
  }
  return (
    <PlainList separatorInset="none">
      {notes.map((note) => (
        <TrashRow key={note.id} note={note} now={now} onRestore={onRestore} onPurge={onPurge} />
      ))}
    </PlainList>
  );
}

const styles = StyleSheet.create({
  row: { justifyContent: 'center' },
});
