import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { dayKey, useLiveQuery } from '@/db';
import { tasks as taskRepo } from '@/db/repositories';
import type { TaskRow } from '@/db/types';
import { useCelebrate } from '@/features/celebrate/CelebrationLayer';
import { useTaskActions } from '@/features/tasks/useTaskActions';
import { useNow } from '@/features/weather/time';
import { formatNumber, formatTime, useI18n } from '@/i18n';
import { useAccount, useApp } from '@/state/AppContext';
import { moduleBase, useTheme } from '@/theme';
import { Icon, Text } from '@/ui';

import { AllDayLane, type DayEntry } from './DayThread';
import { FocusNow } from './FocusNow';
import { focusOf } from './homeView';
import { dayTaskGroups } from './taskGroups';
import { useDayThread } from './useDayThread';

const NOW_TICK_MS = 10_000;
/** So viele Aufgaben stehen unter dem Jetzt — der Rest als „+N weitere“. */
const TASKS_SHOWN = 3;
const CIRCLE = 24;
const CIRCLE_BORDER = 2;

type Timed = DayEntry & { at: string };

/**
 * Die Startseite als **Jetzt**: ganz oben gross die Uhrzeit, darunter die
 * eine Karte mit dem, was gerade laeuft oder als Naechstes kommt
 * (`FocusNow`), in einer Zeile, was danach folgt, und drei Aufgaben zum
 * Abhaken — sonst nichts. Viel Luft, wenig Papier: ein Blick, und man weiss,
 * woran man ist.
 */
export function HomeFocus() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const today = dayKey();
  const band = useDayThread(today);
  const now = new Date(useNow(NOW_TICK_MS));

  const timed = band.entries.filter((entry): entry is Timed => Boolean(entry.at));
  const focus = focusOf(timed, now);
  // Was nach dem Jetzt kommt — der Eintrag hinter dem, der die Karte fuellt.
  const after = focus ? (timed[timed.indexOf(focus.entry) + 1] ?? null) : null;
  const openTimeline = (key?: string) =>
    router.push(`/timeline?day=${today}${key ? `&focus=${encodeURIComponent(key)}` : ''}`);

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('today.timeline.open')}
        onPress={() => openTimeline()}
        style={({ pressed }) => [styles.clock, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Text variant="hero" align="center">
          {formatTime(language, now.toISOString())}
        </Text>
      </Pressable>

      {band.allDay.length > 0 ? <AllDayLane entries={band.allDay} onOpen={openTimeline} /> : null}

      <FocusNow />

      {after ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('today.focus.after')}: ${formatTime(language, after.at)} ${after.title}`}
          onPress={() => openTimeline(after.key)}
          style={({ pressed }) => [
            styles.row,
            { gap: theme.spacing.md, paddingHorizontal: theme.spacing.sm, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text variant="caption" tone="faint" style={{ letterSpacing: theme.tracking.label }}>
            {t('today.focus.after')}
          </Text>
          <Icon name={after.icon} size={14} color={moduleBase(theme, after.moduleId)} />
          <Text variant="label" tone="muted">
            {formatTime(language, after.at)}
          </Text>
          <Text variant="label" numberOfLines={1} style={styles.grow}>
            {after.title}
          </Text>
        </Pressable>
      ) : null}

      <FocusTasks />
    </View>
  );
}

/**
 * Drei Aufgaben von heute, ueberfaellige zuerst, als schlichte Zeilen mit dem
 * Kreis zum Abhaken — kein Heft, keine Knoepfe. Mehr gibt es in den Aufgaben.
 */
function FocusTasks() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const { household } = useApp();
  const actions = useTaskActions();
  const celebrate = useCelebrate();
  const today = dayKey();
  const list = useLiveQuery(
    () => taskRepo.listOpen(account.id, household?.id ?? null),
    [account.id, household?.id],
  );
  const groups = dayTaskGroups(list.data ?? [], today, today);
  const all = [...groups.overdue, ...groups.due, ...groups.inbox];
  const shown = all.slice(0, TASKS_SHOWN);
  const hidden = all.length - shown.length;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text
        variant="caption"
        tone="faint"
        style={{ letterSpacing: theme.tracking.label, paddingHorizontal: theme.spacing.sm }}
      >
        {t('today.focus.tasks')}
      </Text>
      {shown.length === 0 ? (
        <Text variant="label" tone="muted" style={{ paddingHorizontal: theme.spacing.sm }}>
          {t('today.noTasks')}
        </Text>
      ) : null}
      {shown.map((task) => (
        <TaskLine
          key={task.id}
          task={task}
          overdue={groups.overdue.includes(task)}
          onComplete={() => {
            celebrate('done');
            void actions.complete(task);
          }}
          onOpen={() => router.push(`/run/tasks?task=${task.id}`)}
        />
      ))}
      {hidden > 0 ? (
        <Text
          variant="label"
          tone="accent"
          onPress={() => router.push('/run/tasks')}
          style={{ paddingHorizontal: theme.spacing.sm }}
        >
          {t('today.focus.more', { count: formatNumber(language, hidden) })}
        </Text>
      ) : null}
    </View>
  );
}

function TaskLine({
  task,
  overdue,
  onComplete,
  onOpen,
}: {
  task: TaskRow;
  overdue: boolean;
  onComplete: () => void;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <View
      style={[
        styles.row,
        {
          gap: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.border,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('tasks.a11y.complete', { title: task.title })}
        onPress={onComplete}
        hitSlop={theme.spacing.sm}
        style={({ pressed }) => [
          styles.circle,
          {
            borderColor: overdue ? theme.colors.danger : theme.colors.textFaint,
            opacity: pressed ? 0.5 : 1,
          },
        ]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={task.title}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.grow,
          styles.row,
          { gap: theme.spacing.sm, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Text variant="body" numberOfLines={1} style={styles.grow}>
          {task.title}
        </Text>
        {task.dueTime ? (
          <Text variant="label" tone={overdue ? 'danger' : 'muted'}>
            {task.dueTime}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  clock: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, borderWidth: CIRCLE_BORDER },
});
