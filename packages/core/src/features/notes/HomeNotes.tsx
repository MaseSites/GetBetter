import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useLiveQuery, type NoteRow } from '@/db';
import { notes as noteRepo } from '@/db/repositories';
import { useI18n } from '@/i18n';
import { MODULES } from '@/mocks/modules';
import { moduleName } from '@/mocks/moduleText';
import { useAccount } from '@/state/AppContext';
import { moduleBase, useTheme } from '@/theme';
import { Icon, IconButton, SectionHead, Text } from '@/ui';

import { homePreviewOf } from './home';
import { useNoteActions } from './useNoteActions';

/** Mehrere Karten stehen nebeneinander, alle gleich gross — man schiebt sie seitlich. */
const CARD_WIDTH = 236;
const CARD_HEIGHT = 136;
/** So viele Zeilen Text zeigt eine Karte hoechstens. */
const PREVIEW_LINES = 4;
/** Platz rechts oben fuer das X, damit der Titel nicht darunter laeuft. */
const CLOSE_ROOM = 24;

/**
 * Die Notizen, die an die Startseite geheftet sind: eine allein ueber die ganze
 * Breite, mehrere nebeneinander zum Schieben. Ein Tipp oeffnet die ganze
 * Notiz, das X oben rechts nimmt sie wieder von der Startseite — mit
 * „Rückgängig“. Ohne angeheftete Notiz steht hier nichts.
 */
export function HomeNotes() {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const actions = useNoteActions();
  const list = useLiveQuery(() => noteRepo.listOnHome(account.id), [account.id]);
  const rows = list.data ?? [];
  if (rows.length === 0) return null;

  const single = rows.length === 1;
  const cards = rows.map((note) => (
    <HomeNoteCard
      key={note.id}
      note={note}
      fixed={!single}
      onOpen={() => router.push(`/run/notes?note=${encodeURIComponent(note.id)}`)}
      onRemove={() => actions.setOnHome([note.id], false)}
    />
  ));

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <SectionHead
        title={moduleName(t, 'notes')}
        count={single ? undefined : String(rows.length)}
        onPress={() => router.push('/run/notes')}
      />
      {single ? (
        cards
      ) : (
        // Die Reihe laeuft bis an den Rand, damit man sieht, dass es weitergeht.
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -theme.spacing.edge }}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.edge,
            paddingVertical: theme.spacing.xs,
            gap: theme.spacing.md,
          }}
        >
          {cards}
        </ScrollView>
      )}
    </View>
  );
}

/**
 * Eine Notiz als Karte: oben das Zeichen der Notizen und der Titel, darunter
 * der Anfang des Textes. Die Karte selbst und das X sind zwei Knoepfe
 * nebeneinander — keiner steckt im anderen.
 */
function HomeNoteCard({
  note,
  fixed,
  onOpen,
  onRemove,
}: {
  note: NoteRow;
  /** In der Reihe: feste Breite und Hoehe, damit alle Karten gleich stehen. */
  fixed: boolean;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const title = note.title.trim() || t('notes.untitled');
  const preview = homePreviewOf(note.body);
  const icon = MODULES.find((module) => module.id === 'notes')?.icon ?? 'note';

  return (
    <View
      style={[
        theme.elevation.card,
        {
          borderRadius: theme.radii.md,
          backgroundColor: theme.colors.surface,
          ...(fixed ? { width: CARD_WIDTH, height: CARD_HEIGHT } : {}),
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={preview ? `${title}, ${preview}` : title}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.grow,
          {
            padding: theme.spacing.md,
            paddingRight: theme.spacing.md + CLOSE_ROOM,
            gap: theme.spacing.xs,
            opacity: pressed ? 0.6 : 1,
          },
        ]}
      >
        <View style={[styles.row, { gap: theme.spacing.sm }]}>
          <Icon name={icon} size={16} color={moduleBase(theme, 'notes')} />
          <Text
            variant="label"
            numberOfLines={1}
            style={[
              styles.grow,
              {
                fontSize: theme.fontSize.md,
                lineHeight: theme.lineHeight.md,
                fontWeight: theme.fontWeight.semibold,
              },
            ]}
          >
            {title}
          </Text>
        </View>
        <Text variant="label" tone="muted" numberOfLines={PREVIEW_LINES}>
          {preview || t('notes.row.noText')}
        </Text>
      </Pressable>
      <View style={[styles.close, { top: theme.spacing.xs, right: theme.spacing.xs }]}>
        <IconButton icon="close" label={t('notes.home.unpin')} onPress={onRemove} size={16} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center' },
  close: { position: 'absolute' },
});
