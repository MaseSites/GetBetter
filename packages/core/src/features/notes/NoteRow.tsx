import { Image, Pressable, StyleSheet, View } from 'react-native';

import type { NoteRow } from '@/db';
import { blocksOf } from '@/db/noteBlocks';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { ContextMenu, Icon, SwipeRow, Text, type MenuEntry } from '@/ui';

import { formatRowStamp } from './format';
import { NOTE_ICONS } from './icons';
import { imageIdsOf, noteImageSource } from './images';
import { NoteThumb } from './NoteImage';
import type { NoteMatch } from './search';

/** Eine Zeile der Liste ist 64 hoch: Titel, Zeit und Textanfang, allenfalls der Ordner. */
export const NOTE_ROW_HEIGHT = 64;
/** Kacheln im Raster sind alle gleich hoch. */
const TILE_HEIGHT = 188;
const TILE_IMAGE_HEIGHT = 80;
/** Ohne Bild hat der Text einer Kachel so viele Zeilen, mit Bild die Haelfte. */
const TILE_LINES = 6;
/** Der Kreis zum Auswaehlen — derselbe wie in den Aufgaben. */
const CIRCLE_SIZE = 22;

export type NoteItemHandlers = {
  open: (note: NoteRow) => void;
  toggleSelect: (note: NoteRow) => void;
  startSelect: (note: NoteRow) => void;
  togglePin: (note: NoteRow) => void;
  move: (note: NoteRow) => void;
  trash: (note: NoteRow) => void;
  share: (note: NoteRow) => void;
};

export type NoteItemProps = {
  note: NoteRow;
  /** Nur in „Alle Notizen“, bei Tags und in der Suche. */
  folderName: string | null;
  match: NoteMatch | null;
  now: Date;
  selecting: boolean;
  selected: boolean;
  handlers: NoteItemHandlers;
};

function firstLine(text: string): string {
  return (
    text
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) ?? ''
  );
}

function useMenuItems({ note, handlers }: Pick<NoteItemProps, 'note' | 'handlers'>): MenuEntry[] {
  const { t } = useI18n();
  return [
    {
      key: 'pin',
      label: note.pinned ? t('notes.action.unpin') : t('notes.pin'),
      icon: note.pinned ? 'pinFilled' : 'pin',
      onPress: () => handlers.togglePin(note),
    },
    {
      key: 'share',
      label: t('notes.action.share'),
      icon: NOTE_ICONS.share,
      onPress: () => handlers.share(note),
    },
    {
      key: 'move',
      label: t('notes.action.move'),
      icon: NOTE_ICONS.folder,
      onPress: () => handlers.move(note),
    },
    { key: 'divider', divider: true },
    {
      key: 'delete',
      label: t('common.delete'),
      icon: 'trash',
      destructive: true,
      onPress: () => handlers.trash(note),
    },
  ];
}

function SelectCircle({ selected }: { selected: boolean }) {
  const theme = useTheme();
  return (
    <Icon
      name={selected ? 'checkCircle' : 'circle'}
      size={CIRCLE_SIZE}
      color={selected ? theme.colors.accentStrong : theme.colors.borderStrong}
    />
  );
}

/** Zweite Zeile: die Zeit, dann der Textanfang — oder die Fundstelle mit dem Suchwort halbfett. */
function Preview({ note, match, now }: Pick<NoteItemProps, 'note' | 'match' | 'now'>) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const snippet = match?.snippet ?? null;
  const start = firstLine(note.body);

  return (
    <View style={[styles.line, { gap: theme.spacing.sm }]}>
      <Text variant="label">{formatRowStamp(t, language, note.updatedAt, now)}</Text>
      <Text variant="label" tone="muted" numberOfLines={1} style={styles.grow}>
        {snippet ? (
          <>
            {snippet.before}
            <Text variant="label" style={{ fontWeight: theme.fontWeight.bold }}>
              {snippet.match}
            </Text>
            {snippet.after}
          </>
        ) : start.length > 0 ? (
          start
        ) : (
          t('notes.row.noText')
        )}
      </Text>
    </View>
  );
}

function RowContent({ note, folderName, match, now, selecting, selected }: NoteItemProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const [thumb] = imageIdsOf(blocksOf(note));

  return (
    <View
      style={[
        styles.row,
        { minHeight: NOTE_ROW_HEIGHT, paddingVertical: theme.spacing.sm, gap: theme.spacing.md },
      ]}
    >
      {selecting ? <SelectCircle selected={selected} /> : null}
      <View style={[styles.grow, { gap: 2 }]}>
        <Text variant="body" numberOfLines={1} style={{ fontWeight: theme.fontWeight.semibold }}>
          {note.title.trim() || t('notes.untitled')}
        </Text>
        <Preview note={note} match={match} now={now} />
        {folderName ? (
          <View style={[styles.line, { gap: theme.spacing.xs }]}>
            <Icon name={NOTE_ICONS.folder} size={12} color={theme.colors.textFaint} />
            <Text variant="caption" tone="faint" numberOfLines={1}>
              {folderName}
            </Text>
          </View>
        ) : null}
      </View>
      {thumb ? <NoteThumb uploadId={thumb} /> : null}
    </View>
  );
}

/** Eine Notiz als Zeile: Tipp oeffnet, Wischen heftet an, verschiebt und loescht. */
export function NoteListItem(props: NoteItemProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const { note, handlers, selecting, selected } = props;
  const items = useMenuItems(props);
  const title = note.title.trim() || t('notes.untitled');

  if (selecting) {
    return (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={title}
        onPress={() => handlers.toggleSelect(note)}
      >
        <RowContent {...props} />
      </Pressable>
    );
  }

  const trash = {
    key: 'delete',
    label: t('common.delete'),
    icon: 'trash' as const,
    tone: 'danger' as const,
    onPress: () => handlers.trash(note),
  };

  return (
    <SwipeRow
      backgroundColor={theme.colors.background}
      leading={{
        key: 'pin',
        label: note.pinned ? t('notes.action.unpin') : t('notes.pin'),
        icon: note.pinned ? 'pin' : 'pinFilled',
        tone: 'accent',
        onPress: () => handlers.togglePin(note),
      }}
      trailing={[
        {
          key: 'move',
          label: t('notes.action.move'),
          icon: NOTE_ICONS.folder,
          tone: 'default',
          onPress: () => handlers.move(note),
        },
        trash,
      ]}
      trailingFull={trash}
    >
      <ContextMenu
        items={items}
        onPress={() => handlers.open(note)}
        onSelectMode={() => handlers.startSelect(note)}
        accessibilityLabel={title}
      >
        <RowContent {...props} />
      </ContextMenu>
    </SwipeRow>
  );
}

/** Eine Kachel im Raster: oben das Bild, darunter der Text. */
export function NoteTile(props: NoteItemProps) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const { note, handlers, selecting, selected, now } = props;
  const items = useMenuItems(props);
  const [image] = imageIdsOf(blocksOf(note));
  const title = note.title.trim() || t('notes.untitled');

  const body = (
    <View
      style={[
        styles.tile,
        {
          height: TILE_HEIGHT,
          borderRadius: theme.radii.md,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      {image ? (
        <Image
          source={noteImageSource(image)}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          style={{ height: TILE_IMAGE_HEIGHT, backgroundColor: theme.colors.surfaceMuted }}
        />
      ) : null}
      <View style={[styles.grow, { padding: theme.spacing.md, gap: theme.spacing.xs }]}>
        <Text variant="body" numberOfLines={2} style={{ fontWeight: theme.fontWeight.semibold }}>
          {title}
        </Text>
        <Text
          variant="label"
          tone="muted"
          numberOfLines={image ? TILE_LINES / 2 : TILE_LINES}
          style={styles.grow}
        >
          {note.body}
        </Text>
        <Text variant="caption" tone="faint">
          {formatRowStamp(t, language, note.updatedAt, now)}
        </Text>
      </View>
      {selecting ? (
        <View style={[styles.tileCheck, { top: theme.spacing.sm, right: theme.spacing.sm }]}>
          <SelectCircle selected={selected} />
        </View>
      ) : null}
    </View>
  );

  if (selecting) {
    return (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={title}
        onPress={() => handlers.toggleSelect(note)}
        style={styles.grow}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <ContextMenu
      items={items}
      onPress={() => handlers.open(note)}
      onSelectMode={() => handlers.startSelect(note)}
      accessibilityLabel={title}
      style={styles.grow}
    >
      {body}
    </ContextMenu>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  line: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  tile: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  tileCheck: { position: 'absolute' },
});
