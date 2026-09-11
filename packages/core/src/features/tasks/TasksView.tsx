import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { dayKey, useLiveQuery, type TaskRow } from '@/db';
import { tasks as taskRepo } from '@/db/repositories';
import { DayPicker } from '@/features/shared/DayPicker';
import { parseDay, relativeDay } from '@/features/shared/days';
import { useI18n, type TranslationKey } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount, useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  AddBar,
  Badge,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  Header,
  Icon,
  Input,
  Loading,
  Screen,
  Sheet,
  Text,
} from '@/ui';

type SectionId = 'overdue' | 'today' | 'upcoming' | 'someday';

/** Der Tag einer Frist als Schluessel — die Uhrzeit spielt keine Rolle. */
function dueDayOf(task: TaskRow): string | null {
  return task.dueAt ? dayKey(new Date(task.dueAt)) : null;
}

/**
 * Aufgaben wie in Things: nach Frist in Abschnitte sortiert, nichts rot ausser
 * dem, was wirklich ueberfaellig ist. Schnell eintragen unten, Details per
 * Tipp auf den Titel.
 */
export function TasksView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const { household } = useApp();
  const householdId = household?.id ?? null;
  const today = dayKey();

  const [draft, setDraft] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<TaskRow | null>(null);

  const open = useLiveQuery(
    () => taskRepo.listOpen(account.id, householdId),
    [account.id, householdId],
  );
  const done = useLiveQuery(
    () => taskRepo.listDone(account.id, householdId),
    [account.id, householdId],
  );

  async function add() {
    const title = draft.trim();
    if (title.length === 0) return;
    setDraft('');
    await taskRepo.create({ accountId: account.id, householdId, title });
  }

  const openTasks = open.data ?? [];
  const doneTasks = done.data ?? [];

  const allSections: { id: SectionId; rows: TaskRow[] }[] = [
    {
      id: 'overdue',
      rows: openTasks.filter((task) => {
        const day = dueDayOf(task);
        return day !== null && day < today;
      }),
    },
    { id: 'today', rows: openTasks.filter((task) => dueDayOf(task) === today) },
    {
      id: 'upcoming',
      rows: openTasks.filter((task) => {
        const day = dueDayOf(task);
        return day !== null && day > today;
      }),
    },
    { id: 'someday', rows: openTasks.filter((task) => dueDayOf(task) === null) },
  ];
  const sections = allSections.filter((section) => section.rows.length > 0);

  const todayCount = openTasks.filter((task) => {
    const day = dueDayOf(task);
    return day !== null && day <= today;
  }).length;

  const subtitle =
    todayCount > 0
      ? `${t('tasks.openCount', { count: openTasks.length })} · ${t('tasks.today', { count: todayCount })}`
      : t('tasks.openCount', { count: openTasks.length });

  function dueLabel(task: TaskRow): { text: string; overdue: boolean } | null {
    const day = dueDayOf(task);
    if (!day) return null;
    return { text: relativeDay(t, language, day), overdue: day < today };
  }

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={subtitle}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        />
      }
      footer={
        <AddBar
          value={draft}
          onChangeText={setDraft}
          onSubmit={() => void add()}
          placeholder={t('tasks.placeholder')}
          addLabel={t('tasks.add')}
        />
      }
    >
      {open.loading && openTasks.length === 0 ? <Loading /> : null}

      {!open.loading && openTasks.length === 0 ? (
        <EmptyState
          icon="checkCircle"
          title={t('tasks.empty.title')}
          body={t('tasks.empty.body')}
        />
      ) : null}

      {sections.map((section) => (
        <View key={section.id} style={{ gap: theme.spacing.sm }}>
          <Text variant="section" tone={section.id === 'overdue' ? 'danger' : 'muted'}>
            {t(`tasks.section.${section.id}` as TranslationKey)}
          </Text>
          <Card padded={false} style={{ paddingHorizontal: theme.spacing.lg }}>
            {section.rows.map((task, index) => (
              <View key={task.id}>
                {index > 0 ? <Divider /> : null}
                <TaskRowView
                  task={task}
                  due={dueLabel(task)}
                  onToggle={() => void taskRepo.setDone(task.id, true)}
                  onOpen={() => setEditing(task)}
                  sharedLabel={t('today.household')}
                />
              </View>
            ))}
          </Card>
        </View>
      ))}

      {doneTasks.length > 0 ? (
        <View style={{ gap: theme.spacing.md }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showDone }}
            onPress={() => setShowDone((value) => !value)}
            style={[styles.sectionToggle, { gap: theme.spacing.sm }]}
          >
            <Icon name={showDone ? 'down' : 'forward'} size={16} color={theme.colors.textMuted} />
            <Text variant="section" tone="muted">
              {t('tasks.doneCount', { count: doneTasks.length })}
            </Text>
          </Pressable>

          {showDone ? (
            <Card padded={false} style={{ paddingHorizontal: theme.spacing.lg }}>
              {doneTasks.map((task, index) => (
                <View key={task.id}>
                  {index > 0 ? <Divider /> : null}
                  <TaskRowView
                    task={task}
                    due={null}
                    onToggle={() => void taskRepo.setDone(task.id, false)}
                    onOpen={() => setEditing(task)}
                    sharedLabel={t('today.household')}
                  />
                </View>
              ))}
            </Card>
          ) : null}
        </View>
      ) : null}

      <TaskEditor task={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}

type TaskRowProps = {
  task: TaskRow;
  due: { text: string; overdue: boolean } | null;
  onToggle: () => void;
  onOpen: () => void;
  sharedLabel: string;
};

function TaskRowView({ task, due, onToggle, onOpen, sharedLabel }: TaskRowProps) {
  const theme = useTheme();
  const done = task.done;

  return (
    <View style={[styles.row, { paddingVertical: theme.spacing.md, gap: theme.spacing.md }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={task.title}
        onPress={onToggle}
        hitSlop={8}
      >
        <Icon
          name={done ? 'checkCircle' : 'circle'}
          size={24}
          color={done ? theme.colors.accent : theme.colors.borderStrong}
        />
      </Pressable>

      {/* Der Titel fuehrt zu den Details — der Kreis daneben hakt nur ab. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={task.title}
        onPress={onOpen}
        style={({ pressed }) => ({ flex: 1, gap: 2, opacity: pressed ? 0.6 : 1 })}
      >
        <View style={[styles.meta, { gap: theme.spacing.xs }]}>
          {task.priority ? <Icon name="flagFilled" size={14} color={theme.colors.accent} /> : null}
          <Text
            variant="body"
            tone={done ? 'faint' : 'default'}
            style={done ? { textDecorationLine: 'line-through' } : undefined}
          >
            {task.title}
          </Text>
        </View>
        <View style={[styles.meta, { gap: theme.spacing.sm }]}>
          {due ? (
            <Text variant="caption" tone={due.overdue ? 'danger' : 'muted'}>
              {due.text}
            </Text>
          ) : null}
          {task.notes ? (
            <Text variant="caption" tone="faint" numberOfLines={1}>
              {task.notes}
            </Text>
          ) : null}
          {task.shared ? <Badge label={sharedLabel} icon="people" /> : null}
        </View>
      </Pressable>
    </View>
  );
}

/** Titel, Notiz, Frist und Fahne — alles, was eine Aufgabe sonst noch hat. */
function TaskEditor({ task, onClose }: { task: TaskRow | null; onClose: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [due, setDue] = useState<string | null>(null);
  const [priority, setPriority] = useState(false);
  const taskId = task?.id ?? null;
  const loadedId = useRef<string | null>(null);

  useEffect(() => {
    if (taskId && loadedId.current !== taskId) {
      loadedId.current = taskId;
      setTitle(task?.title ?? '');
      setNotes(task?.notes ?? '');
      setDue(task ? dueDayOf(task) : null);
      setPriority(task?.priority ?? false);
    }
    if (!taskId) loadedId.current = null;
  }, [taskId, task]);

  async function save() {
    if (!taskId) return;
    if (title.trim().length > 0) {
      await taskRepo.update(taskId, {
        title,
        notes,
        priority,
        dueAt: due ? parseDay(due).toISOString() : null,
      });
    }
    onClose();
  }

  async function remove() {
    if (!taskId) return;
    await taskRepo.remove(taskId);
    onClose();
  }

  return (
    <Sheet visible={task !== null} onClose={save} title={t('tasks.detail')}>
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
        <Input
          label={t('tasks.title')}
          value={title}
          onChangeText={setTitle}
          autoCapitalize="sentences"
        />
        <DayPicker label={t('tasks.due')} value={due} onChange={setDue} />
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Chip
            label={t('tasks.priority')}
            selected={priority}
            onPress={() => setPriority((v) => !v)}
          />
        </View>
        <Input
          label={t('tasks.notes')}
          placeholder={t('common.optional')}
          value={notes}
          onChangeText={setNotes}
          multiline
          autoCapitalize="sentences"
        />
        <View style={{ gap: theme.spacing.sm }}>
          <Button label={t('common.done')} icon="check" onPress={save} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('tasks.remove')}
            onPress={remove}
            style={[styles.removeRow, { gap: theme.spacing.sm, paddingVertical: theme.spacing.md }]}
          >
            <Icon name="trash" size={18} color={theme.colors.danger} />
            <Text variant="label" tone="danger">
              {t('tasks.remove')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  addButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  sectionToggle: { flexDirection: 'row', alignItems: 'center' },
  removeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
