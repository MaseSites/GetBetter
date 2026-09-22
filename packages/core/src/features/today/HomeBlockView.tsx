import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { dayKey, notifications as notificationRepo, useLiveQuery } from '@/db';
import { notes as noteRepo, tasks as taskRepo } from '@/db/repositories';
import { AppFamily } from '@/features/apps/AppFamily';
import { homePreviewOf } from '@/features/notes/home';
import { HomeNotes } from '@/features/notes/HomeNotes';
import { NewsSection } from '@/features/notifications/NewsSection';
import { QuickAccess } from '@/features/quick/QuickAccess';
import { useQuickAccess } from '@/features/quick/useFavorites';
import { useNow } from '@/features/weather/time';
import { formatNumber, formatTime, useI18n, type TranslationKey } from '@/i18n';
import { MODULES } from '@/mocks/modules';
import { moduleName } from '@/mocks/moduleText';
import { useAccount, useApp } from '@/state/AppContext';
import { moduleBase, useTheme } from '@/theme';
import { Icon, ModuleIcon, Text, type IconName } from '@/ui';

import { DayTasks } from './DayTasks';
import { DayThread, type DayEntry } from './DayThread';
import { FocusNow } from './FocusNow';
import type { BlockKind, HomeBlock } from './homeLayout';
import { upcomingOf } from './homeView';
import { dayTaskGroups } from './taskGroups';
import { useDayThread } from './useDayThread';

const NOW_TICK_MS = 10_000;
/** Wie viele Zeilen ein kleiner und ein grosser Block zeigt. */
const LINES = { sm: 2, lg: 4 } as const;
/** Der Kreis vor einer Aufgabe — wie in den Aufgaben, nur kleiner. */
const CIRCLE = 16;
/** So viele Funktionen stehen im Schnellzugriff als Symbolreihe. */
const QUICK_ICONS = 5;

type Timed = DayEntry & { at: string };

const iconOf = (moduleId: string, fallback: IconName): IconName =>
  MODULES.find((module) => module.id === moduleId)?.icon ?? fallback;

/** Der Name eines Elements im Baukasten. */
export function blockName(t: ReturnType<typeof useI18n>['t'], kind: BlockKind): string {
  if (kind === 'band') return t('home.block.band');
  if (kind === 'news') return t('home.block.news');
  if (kind === 'quick') return t('quick.title');
  if (kind === 'apps') return t('home.block.apps');
  return moduleName(t, kind);
}

/** Das Zeichen eines Elements. */
export function blockIcon(kind: BlockKind): IconName {
  if (kind === 'band') return iconOf('calendar', 'calendar');
  if (kind === 'news') return 'bell';
  if (kind === 'quick') return 'star';
  if (kind === 'apps') return 'grid';
  return iconOf(kind, 'circle');
}

/** Die Stile heissen in jeder Sprache anders — hier steht, wie. */
const VARIANT_LABELS = {
  band: {
    thread: 'home.style.band.thread',
    now: 'home.style.band.now',
    compact: 'home.style.band.compact',
  },
  tasks: { page: 'home.style.tasks.page', list: 'home.style.tasks.list' },
  notes: { cards: 'home.style.notes.cards', list: 'home.style.notes.list' },
  news: { stack: 'home.style.news.stack', count: 'home.style.news.count' },
  quick: { carousel: 'home.style.quick.carousel', icons: 'home.style.quick.icons' },
  apps: { cards: 'home.style.apps.cards' },
} as const satisfies Record<BlockKind, Readonly<Record<string, TranslationKey>>>;

/** Der Name eines Stils. */
export function variantLabel(
  t: ReturnType<typeof useI18n>['t'],
  kind: BlockKind,
  variant: string,
): string {
  const labels: Readonly<Record<string, TranslationKey>> = VARIANT_LABELS[kind];
  const key = labels[variant];
  return key ? t(key) : variant;
}

/**
 * Ein Element der eigenen Ansicht in seinem Stil. Die grossen Stile sind
 * genau die Bausteine der anderen Ansichten (`DayThread`, `DayTasks`,
 * `HomeNotes`, `NewsSection`, `QuickAccess`, `AppFamily`); die kleinen sind
 * kurze Fassungen fuer halbe Breite.
 */
export function HomeBlockView({ block, onAddTask }: { block: HomeBlock; onAddTask: () => void }) {
  // Wie viel hineinpasst, sagt die Hoehe des Blocks.
  const size = block.h >= 4 ? 'lg' : 'sm';
  if (block.kind === 'band') {
    if (block.variant === 'now') return <FocusNow />;
    if (block.variant === 'compact') return <BandLines size={size} />;
    return <BandThread size={size} />;
  }
  if (block.kind === 'tasks') {
    if (block.variant === 'list') return <TaskLines size={size} />;
    return <DayTasks day={dayKey()} onAdd={onAddTask} keepEmpty />;
  }
  if (block.kind === 'notes') {
    if (block.variant === 'list') return <NoteLines size={size} />;
    return <HomeNotes />;
  }
  if (block.kind === 'news') {
    if (block.variant === 'count') return <NewsCount />;
    return <NewsSection />;
  }
  if (block.kind === 'quick') {
    if (block.variant === 'icons') return <QuickIcons />;
    return <QuickAccess />;
  }
  return <AppFamily />;
}

/** Eine Karte mit Kopfzeile — der Rahmen der kurzen Stile. */
function Panel({
  kind,
  count,
  onPress,
  children,
}: {
  kind: BlockKind;
  count?: string | undefined;
  onPress: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const title = blockName(t, kind);
  const color =
    kind === 'news' ? theme.colors.danger : moduleBase(theme, kind === 'band' ? 'calendar' : kind);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count ? `${title}, ${count}` : title}
      onPress={onPress}
      style={({ pressed }) => [
        theme.elevation.card,
        {
          gap: theme.spacing.sm,
          padding: theme.spacing.md,
          borderRadius: theme.radii.md,
          backgroundColor: theme.colors.surface,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={[styles.row, { gap: theme.spacing.xs }]}>
        <Icon name={blockIcon(kind)} size={15} color={color} />
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
      </View>
      <View style={{ gap: theme.spacing.xs }}>{children}</View>
    </Pressable>
  );
}

/** Stil „Band“: der Tagesstrahl selbst, nur mit weniger Eintraegen. */
function BandThread({ size }: { size: 'sm' | 'lg' }) {
  const router = useRouter();
  const today = dayKey();
  const band = useDayThread(today);
  const now = new Date(useNow(NOW_TICK_MS));
  const timed = band.entries.filter((entry): entry is Timed => Boolean(entry.at));
  const open = (key?: string) =>
    router.push(`/timeline?day=${today}${key ? `&focus=${encodeURIComponent(key)}` : ''}`);

  return (
    <DayThread
      entries={upcomingOf(timed, now, LINES[size])}
      allDay={band.allDay}
      now={now}
      onOpen={open}
    />
  );
}

/** Stil „Liste“: nur Uhrzeit und Titel, fuer die halbe Breite. */
function BandLines({ size }: { size: 'sm' | 'lg' }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const today = dayKey();
  const band = useDayThread(today);
  const now = new Date(useNow(NOW_TICK_MS));
  const timed = band.entries.filter((entry): entry is Timed => Boolean(entry.at));
  const upcoming = upcomingOf(timed, now, LINES[size]);

  return (
    <Panel kind="band" onPress={() => router.push(`/timeline?day=${today}`)}>
      {upcoming.map((entry) => (
        <View key={entry.key} style={[styles.row, { gap: theme.spacing.sm }]}>
          <Text variant="caption" tone="muted" style={{ fontWeight: theme.fontWeight.semibold }}>
            {formatTime(language, entry.at)}
          </Text>
          <Text variant="label" numberOfLines={1} style={styles.grow}>
            {entry.title}
          </Text>
        </View>
      ))}
      {upcoming.length === 0 ? (
        <Text variant="label" tone="faint">
          {t('today.grid.nothingLeft')}
        </Text>
      ) : null}
    </Panel>
  );
}

/** Stil „Liste“ der Aufgaben: Kreis und Titel, sonst nichts. */
function TaskLines({ size }: { size: 'sm' | 'lg' }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const { household } = useApp();
  const householdId = household?.id ?? null;
  const today = dayKey();
  const list = useLiveQuery(
    () => taskRepo.listOpen(account.id, householdId),
    [account.id, householdId],
  );
  const groups = dayTaskGroups(list.data ?? [], today, today);
  const overdue = new Set(groups.overdue.map((task) => task.id));
  const rows = [...groups.overdue, ...groups.due, ...groups.inbox];
  const shown = rows.slice(0, LINES[size]);

  return (
    <Panel
      kind="tasks"
      count={rows.length > 0 ? formatNumber(language, rows.length) : undefined}
      onPress={() => router.push('/run/tasks')}
    >
      {shown.map((task) => (
        <View key={task.id} style={[styles.row, { gap: theme.spacing.sm }]}>
          <View
            style={[
              styles.circle,
              { borderColor: overdue.has(task.id) ? theme.colors.danger : theme.colors.textFaint },
            ]}
          />
          <Text variant="label" numberOfLines={1} style={styles.grow}>
            {task.title}
          </Text>
        </View>
      ))}
      {rows.length === 0 ? (
        <Text variant="label" tone="faint">
          {t('today.tasks.empty')}
        </Text>
      ) : null}
    </Panel>
  );
}

/** Stil „Liste“ der Notizen: Titel und der Anfang des Textes. */
function NoteLines({ size }: { size: 'sm' | 'lg' }) {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const pinned = useLiveQuery(() => noteRepo.listOnHome(account.id), [account.id]);
  const all = useLiveQuery(() => noteRepo.list(account.id), [account.id]);
  const rows = ((pinned.data?.length ?? 0) > 0 ? (pinned.data ?? []) : (all.data ?? [])).slice(
    0,
    LINES[size],
  );

  return (
    <Panel kind="notes" onPress={() => router.push('/run/notes')}>
      {rows.map((note) => (
        <View key={note.id}>
          <Text variant="label" numberOfLines={1} style={{ fontWeight: theme.fontWeight.semibold }}>
            {note.title.trim() || t('notes.untitled')}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {homePreviewOf(note.body) || t('notes.row.noText')}
          </Text>
        </View>
      ))}
      {rows.length === 0 ? (
        <Text variant="label" tone="faint">
          {t('notes.list.empty')}
        </Text>
      ) : null}
    </Panel>
  );
}

/** Stil „Zahl“: wie viel ungelesen ist, mehr nicht. */
function NewsCount() {
  const { t, language } = useI18n();
  const router = useRouter();
  const account = useAccount();
  const unread = useLiveQuery(() => notificationRepo.unread(account.id), [account.id]);
  const count = unread.data?.length ?? 0;

  return (
    <Panel
      kind="news"
      count={count > 0 ? formatNumber(language, count) : undefined}
      onPress={() => router.push('/notifications')}
    >
      <Text variant="label" tone={count > 0 ? 'muted' : 'faint'} numberOfLines={1}>
        {count > 0 ? t('today.grid.unread') : t('news.empty')}
      </Text>
    </Panel>
  );
}

/** Stil „Symbole“: der Schnellzugriff als Reihe, ohne Karussell. */
function QuickIcons() {
  const { t } = useI18n();
  const theme = useTheme();
  const quick = useQuickAccess();
  const entries = quick.entries.slice(0, QUICK_ICONS);
  if (entries.length === 0) return null;

  return (
    <View
      style={[
        theme.elevation.card,
        {
          gap: theme.spacing.sm,
          padding: theme.spacing.md,
          borderRadius: theme.radii.md,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <Text variant="label" style={{ fontWeight: theme.fontWeight.semibold }}>
        {t('quick.title')}
      </Text>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        {entries.map((entry) => {
          const name = moduleName(t, entry.module.id);
          return (
            <Pressable
              key={`${entry.appId}:${entry.module.id}`}
              accessibilityRole="button"
              accessibilityLabel={name}
              onPress={() => quick.open(entry.appId, entry.module.id)}
              style={({ pressed }) => [
                styles.quick,
                { gap: theme.spacing.xs, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <ModuleIcon moduleId={entry.module.id} icon={entry.module.icon} size="md" />
              <Text variant="caption" align="center" numberOfLines={1}>
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  quick: { flex: 1, minWidth: 0, alignItems: 'center' },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, borderWidth: 1.5 },
});
