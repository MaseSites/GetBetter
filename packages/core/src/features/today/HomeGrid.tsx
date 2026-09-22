import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { dayKey, notifications as notificationRepo, useLiveQuery } from '@/db';
import { notes as noteRepo } from '@/db/repositories';
import { homePreviewOf } from '@/features/notes/home';
import { QuickAccess } from '@/features/quick/QuickAccess';
import { useNow } from '@/features/weather/time';
import { formatNumber, useI18n } from '@/i18n';
import { MODULES } from '@/mocks/modules';
import { moduleName } from '@/mocks/moduleText';
import { useAccount } from '@/state/AppContext';
import { moduleBase, useTheme } from '@/theme';
import { Icon, Text, type IconName } from '@/ui';

import { DayTasks } from './DayTasks';
import { DayThread, type DayEntry } from './DayThread';
import { upcomingOf } from './homeView';
import { useDayThread } from './useDayThread';

/** So hoch ist eine halbe Kachel mindestens — sonst richtet sie sich nach dem Inhalt. */
const TILE_HEIGHT = 120;
/** So viele Eintraege stehen im Band der Uebersicht — alles andere im grossen Zeitstrahl. */
const BAND_LINES = 2;
const NOW_TICK_MS = 10_000;

type Timed = DayEntry & { at: string };

const iconOf = (moduleId: string, fallback: IconName): IconName =>
  MODULES.find((module) => module.id === moduleId)?.icon ?? fallback;

/**
 * Die Startseite als Uebersicht: dieselben Bausteine wie in der ersten
 * Ansicht, nur kuerzer und an einem Ort. Zuoberst **Heute** mit dem echten
 * Tagesstrahl — der braucht die ganze Breite, sonst bleibt von den Titeln
 * nichts uebrig —, darunter die **Aufgaben** als dasselbe Heft wie ueberall,
 * dann **Notizen** und **Neuigkeiten** nebeneinander, zuunterst der
 * Schnellzugriff.
 *
 * Anders als in der ersten Ansicht bleiben die Bereiche **immer** stehen, auch
 * leer: die Uebersicht soll ruhig sein und nicht bei jeder erledigten Aufgabe
 * anders aussehen.
 */
export function HomeGrid({ onAddTask }: { onAddTask: () => void }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const today = dayKey();
  const band = useDayThread(today);
  const now = new Date(useNow(NOW_TICK_MS));

  const pinnedNotes = useLiveQuery(() => noteRepo.listOnHome(account.id), [account.id]);
  const allNotes = useLiveQuery(() => noteRepo.list(account.id), [account.id]);
  const unread = useLiveQuery(() => notificationRepo.unread(account.id), [account.id]);

  // Im Band steht, was noch kommt oder gerade laeuft — nicht der ganze Tag.
  const timed = band.entries.filter((entry): entry is Timed => Boolean(entry.at));
  const upcoming = upcomingOf(timed, now, BAND_LINES);

  // Angeheftete Notizen zuerst — sonst die zuletzt bearbeiteten.
  const pinned = pinnedNotes.data ?? [];
  const noteRows = (pinned.length > 0 ? pinned : (allNotes.data ?? [])).slice(0, 2);
  const newsCount = unread.data?.length ?? 0;
  const openTimeline = (key?: string) =>
    router.push(`/timeline?day=${today}${key ? `&focus=${encodeURIComponent(key)}` : ''}`);

  return (
    <View style={{ gap: theme.spacing.md }}>
      {/* Der Tagesstrahl selbst: seine Karten sind eigene Knoepfe, darum ist die
          Kachel keiner — nur ihre Kopfzeile fuehrt in den grossen Zeitstrahl. */}
      <Tile
        headerOnly
        tone="muted"
        icon={iconOf('calendar', 'calendar')}
        color={moduleBase(theme, 'calendar')}
        title={t('day.today')}
        onPress={() => openTimeline()}
      >
        <DayThread entries={upcoming} allDay={band.allDay} now={now} onOpen={openTimeline} />
      </Tile>

      {/* Die Aufgaben sehen aus wie ueberall sonst — das Heft, nur immer da. */}
      <DayTasks day={today} onAdd={onAddTask} keepEmpty />

      <View style={[styles.tiles, { gap: theme.spacing.md }]}>
        <Tile
          half
          icon={iconOf('notes', 'note')}
          color={moduleBase(theme, 'notes')}
          title={moduleName(t, 'notes')}
          onPress={() => router.push('/run/notes')}
        >
          {noteRows.map((note) => (
            <View key={note.id}>
              <Text
                variant="label"
                numberOfLines={1}
                style={{ fontWeight: theme.fontWeight.semibold }}
              >
                {note.title.trim() || t('notes.untitled')}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {homePreviewOf(note.body) || t('notes.row.noText')}
              </Text>
            </View>
          ))}
          {noteRows.length === 0 ? (
            <Text variant="label" tone="faint">
              {t('notes.list.empty')}
            </Text>
          ) : null}
        </Tile>

        <Tile
          half
          icon="bell"
          color={theme.colors.danger}
          title={t('news.title')}
          count={newsCount > 0 ? formatNumber(language, newsCount) : undefined}
          onPress={() => router.push('/notifications')}
        >
          <Text variant="label" tone={newsCount > 0 ? 'muted' : 'faint'} numberOfLines={2}>
            {newsCount > 0 ? t('today.grid.unread') : t('news.empty')}
          </Text>
        </Tile>
      </View>

      {/* Der Schnellzugriff bleibt das Karussell der ersten Ansicht. */}
      <QuickAccess />
    </View>
  );
}

/**
 * Eine Kachel: oben Zeichen, Name und allenfalls die Zahl, darunter der Inhalt.
 * Meist ist die ganze Kachel der Knopf; traegt ihr Inhalt selbst Knoepfe
 * (`headerOnly`), fuehrt nur die Kopfzeile weiter — kein Knopf im Knopf.
 */
function Tile({
  icon,
  color,
  title,
  count,
  onPress,
  headerOnly = false,
  half = false,
  tone = 'surface',
  children,
}: {
  icon: IconName;
  color: string;
  title: string;
  count?: string | undefined;
  onPress: () => void;
  headerOnly?: boolean;
  /** In einer Reihe neben einer anderen Kachel — dann teilen sie sich die Breite. */
  half?: boolean;
  tone?: 'surface' | 'muted';
  children: ReactNode;
}) {
  const theme = useTheme();

  const face = [
    theme.elevation.card,
    {
      // `flex` nur in einer Reihe: allein fiele die Kachel sonst zusammen, und
      // ihr Inhalt stuende unten heraus.
      ...(half ? { flex: 1, minWidth: 0, minHeight: TILE_HEIGHT } : {}),
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: tone === 'muted' ? theme.colors.surfaceMuted : theme.colors.surface,
    },
  ];

  const head = (
    <View style={[styles.row, { gap: theme.spacing.xs }]}>
      <Icon name={icon} size={15} color={color} />
      <Text
        variant="label"
        numberOfLines={1}
        style={[styles.grow, { fontWeight: theme.fontWeight.semibold }]}
      >
        {title}
      </Text>
      {count ? (
        <Text variant="label" tone="muted" style={{ fontWeight: theme.fontWeight.semibold }}>
          {count}
        </Text>
      ) : null}
      {headerOnly ? <Icon name="forward" size={15} color={theme.colors.textFaint} /> : null}
    </View>
  );

  if (headerOnly) {
    return (
      <View style={face}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          onPress={onPress}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          {head}
        </Pressable>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count ? `${title}, ${count}` : title}
      onPress={onPress}
      style={({ pressed }) => [...face, { opacity: pressed ? 0.7 : 1 }]}
    >
      {head}
      <View style={[styles.grow, styles.clip, { gap: theme.spacing.xs }]}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  clip: { overflow: 'hidden' },
  // Die Kacheln einer Reihe sind gleich hoch, auch wenn eine mehr zeigt.
  tiles: { flexDirection: 'row', alignItems: 'stretch' },
});
