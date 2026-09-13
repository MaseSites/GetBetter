import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { NoteBlockKind } from '@/db/types';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { AddBar, Button, Chip, PlainList, PlainRow, Sheet, Text } from '@/ui';

import { KIND_LABEL_KEYS } from './BlockView';
import { formatEditorDate } from './format';
import { NOTE_ICONS } from './icons';
import { cleanTag } from './tags';

/** Die Stile im Blatt „Aa“, in dieser Reihenfolge. */
const FORMAT_KINDS: readonly NoteBlockKind[] = [
  'title',
  'heading',
  'text',
  'bullet',
  'number',
  'check',
  'quote',
];

export type FormatSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Die Art des Blocks, in dem zuletzt geschrieben wurde; null, wenn noch keiner. */
  kind: NoteBlockKind | null;
  canIndent: boolean;
  onKind: (kind: NoteBlockKind) => void;
  onIndent: (delta: number) => void;
};

/**
 * „Aa“: Stile fuer den ganzen Absatz. Fett und kursiv innerhalb einer Zeile
 * kann ein Textfeld ohne Zusatzpaket nicht — darum steht es hier nicht.
 */
export function FormatSheet({
  visible,
  onClose,
  kind,
  canIndent,
  onKind,
  onIndent,
}: FormatSheetProps) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('notes.format.title')}>
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
        <View style={[styles.wrap, { gap: theme.spacing.sm }]}>
          {FORMAT_KINDS.map((option) => (
            <Chip
              key={option}
              label={t(KIND_LABEL_KEYS[option])}
              selected={kind === option}
              disabled={kind === null}
              onPress={() => onKind(option)}
            />
          ))}
        </View>
        <View style={[styles.wrap, { gap: theme.spacing.sm }]}>
          <View style={styles.grow}>
            <Button
              label={t('notes.format.outdent')}
              icon={NOTE_ICONS.outdent}
              variant="secondary"
              disabled={!canIndent}
              onPress={() => onIndent(-1)}
            />
          </View>
          <View style={styles.grow}>
            <Button
              label={t('notes.format.indent')}
              icon={NOTE_ICONS.indent}
              variant="secondary"
              disabled={!canIndent}
              onPress={() => onIndent(1)}
            />
          </View>
        </View>
      </View>
    </Sheet>
  );
}

export type NoteInfoSheetProps = {
  visible: boolean;
  onClose: () => void;
  createdAt: string;
  updatedAt: string;
  words: number;
  folderName: string | null;
};

/** „Info“: erstellt, geaendert, Woerter, Ordner — was nicht in den Text gehoert. */
export function NoteInfoSheet({
  visible,
  onClose,
  createdAt,
  updatedAt,
  words,
  folderName,
}: NoteInfoSheetProps) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const value = (text: string) => (
    <Text variant="label" tone="muted">
      {text}
    </Text>
  );
  return (
    <Sheet visible={visible} onClose={onClose} title={t('notes.info.title')}>
      <View style={{ paddingBottom: theme.spacing.lg }}>
        <PlainList separatorInset="none">
          <PlainRow
            key="created"
            title={t('notes.info.created')}
            trailing={value(formatEditorDate(language, createdAt))}
          />
          <PlainRow
            key="edited"
            title={t('notes.info.edited')}
            trailing={value(formatEditorDate(language, updatedAt))}
          />
          <PlainRow key="words" title={t('notes.info.words')} trailing={value(String(words))} />
          <PlainRow
            key="folder"
            title={t('notes.info.folder')}
            trailing={value(folderName ?? t('notes.move.noFolder'))}
          />
        </PlainList>
      </View>
    </Sheet>
  );
}

export type NoteTagsSheetProps = {
  visible: boolean;
  onClose: () => void;
  tags: readonly string[];
  onAdd: (tag: string) => void;
  onOpenTag: (tag: string) => void;
};

/** „Tags“: die Tags dieser Notiz; ein neuer landet als `#wort` am Ende des Texts. */
export function NoteTagsSheet({ visible, onClose, tags, onAdd, onOpenTag }: NoteTagsSheetProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const [draft, setDraft] = useState('');

  function add() {
    const tag = cleanTag(draft);
    if (!tag) return;
    setDraft('');
    onAdd(tag);
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={t('notes.tags.title')}>
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
        {tags.length > 0 ? (
          <View style={[styles.wrap, { gap: theme.spacing.sm }]}>
            {tags.map((tag) => (
              <Chip key={tag} label={`#${tag}`} onPress={() => onOpenTag(tag)} />
            ))}
          </View>
        ) : (
          <Text variant="body" tone="muted">
            {t('notes.tags.none')}
          </Text>
        )}
        <AddBar
          value={draft}
          onChangeText={setDraft}
          onSubmit={add}
          placeholder={t('notes.tags.add')}
          addLabel={t('notes.tags.addAction')}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  grow: { flex: 1 },
});
