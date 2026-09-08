import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useLiveQuery } from '@/db';
import { tasks as taskRepo } from '@/db/repositories';
import { useFavouriteAction } from '@/features/modules/useFavouriteAction';
import { formatShortDate, useI18n } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Badge, Card, Divider, EmptyState, Header, Icon, Input, Loading, Screen, Text } from '@/ui';

export function TasksView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const favouriteAction = useFavouriteAction(module.id);

  const [draft, setDraft] = useState('');
  const [showDone, setShowDone] = useState(false);

  const open = useLiveQuery(() => taskRepo.listOpen(account.id), [account.id]);
  const done = useLiveQuery(() => taskRepo.listDone(account.id), [account.id]);

  async function add() {
    const title = draft.trim();
    if (title.length === 0) return;
    setDraft('');
    await taskRepo.create({ accountId: account.id, title });
  }

  const openTasks = open.data ?? [];
  const doneTasks = done.data ?? [];

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={t('tasks.openCount', { count: openTasks.length })}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
          actions={[favouriteAction]}
        />
      }
      footer={
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Input
              value={draft}
              onChangeText={setDraft}
              placeholder={t('tasks.placeholder')}
              onSubmitEditing={add}
              returnKeyType="done"
              accessibilityLabel={t('tasks.placeholder')}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('tasks.add')}
            accessibilityState={{ disabled: draft.trim().length === 0 }}
            disabled={draft.trim().length === 0}
            onPress={add}
            style={({ pressed }) => [
              styles.addButton,
              {
                borderRadius: theme.radii.md,
                backgroundColor:
                  draft.trim().length === 0
                    ? theme.colors.disabledBackground
                    : pressed
                      ? theme.colors.accentStrong
                      : theme.colors.accent,
              },
            ]}
          >
            <Icon
              name="plus"
              size={22}
              color={
                draft.trim().length === 0 ? theme.colors.disabledText : theme.colors.textOnAccent
              }
            />
          </Pressable>
        </View>
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

      {openTasks.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: theme.spacing.lg }}>
          {openTasks.map((task, index) => (
            <View key={task.id}>
              {index > 0 ? <Divider /> : null}
              <TaskRow
                title={task.title}
                done={false}
                shared={task.shared}
                due={task.dueAt ? formatShortDate(language, task.dueAt) : undefined}
                onToggle={() => taskRepo.setDone(task.id, true)}
                onRemove={() => taskRepo.remove(task.id)}
                removeLabel={t('tasks.remove')}
                sharedLabel={t('today.household')}
              />
            </View>
          ))}
        </Card>
      ) : null}

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
                  <TaskRow
                    title={task.title}
                    done
                    shared={task.shared}
                    onToggle={() => taskRepo.setDone(task.id, false)}
                    onRemove={() => taskRepo.remove(task.id)}
                    removeLabel={t('tasks.remove')}
                    sharedLabel={t('today.household')}
                  />
                </View>
              ))}
            </Card>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

type TaskRowProps = {
  title: string;
  done: boolean;
  shared: boolean;
  due?: string;
  onToggle: () => void;
  onRemove: () => void;
  removeLabel: string;
  sharedLabel: string;
};

function TaskRow({
  title,
  done,
  shared,
  due,
  onToggle,
  onRemove,
  removeLabel,
  sharedLabel,
}: TaskRowProps) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { paddingVertical: theme.spacing.md, gap: theme.spacing.md }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={title}
        onPress={onToggle}
        hitSlop={8}
      >
        <Icon
          name={done ? 'checkCircle' : 'circle'}
          size={24}
          color={done ? theme.colors.accent : theme.colors.borderStrong}
        />
      </Pressable>

      <View style={{ flex: 1, gap: 2 }}>
        <Text
          variant="body"
          tone={done ? 'faint' : 'default'}
          style={done ? { textDecorationLine: 'line-through' } : undefined}
        >
          {title}
        </Text>
        <View style={[styles.meta, { gap: theme.spacing.sm }]}>
          {due ? (
            <Text variant="caption" tone="muted">
              {due}
            </Text>
          ) : null}
          {shared ? <Badge label={sharedLabel} icon="people" /> : null}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${removeLabel}: ${title}`}
        onPress={onRemove}
        hitSlop={8}
      >
        <Icon name="trash" size={18} color={theme.colors.textFaint} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  addButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  sectionToggle: { flexDirection: 'row', alignItems: 'center' },
});
