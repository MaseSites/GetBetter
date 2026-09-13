import { Pressable, StyleSheet, View } from 'react-native';

import type { ProjectRow, TaskRow } from '@/db';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import {
  ContextMenu,
  HIT_TARGET,
  Icon,
  ListSeparator,
  PlainList,
  ROW_MIN_HEIGHT,
  Text,
  type MenuEntry,
} from '@/ui';

import { addDays } from './days';
import { ActionRow, ListHeader, QuietEmpty } from './fields';
import { formatMonthOf } from './format';
import { dayLabel } from './labels';
import {
  countOnDay,
  doneTasks,
  inboxTasks,
  listCounts,
  plannedGroups,
  projectGroups,
  todayGroups,
  type PlannedGroup,
  type TaskScope,
  type TaskSort,
} from './lists';
import { ReorderList } from './ReorderList';
import { useTaskList, type RowMode } from './TaskListContext';
import { taskSeparatorInset, TaskRowItem } from './TaskRowItem';

/** Ab so vielen ueberfaelligen Aufgaben steht zuerst nur eine Zeile. */
export const OVERDUE_COLLAPSE_AFTER = 3;

const TODAY_MODE: RowMode = { dateMode: 'timeOnly', showGroup: true };
const FULL_MODE: RowMode = { dateMode: 'full', showGroup: false };

export function TaskRows({
  rows,
  mode,
  leadingSeparator = false,
}: {
  rows: readonly TaskRow[];
  mode: RowMode;
  leadingSeparator?: boolean;
}) {
  const theme = useTheme();
  if (rows.length === 0) return null;
  const inset = taskSeparatorInset(theme);
  return (
    <View>
      {leadingSeparator ? <ListSeparator inset={inset} /> : null}
      <PlainList separatorInset={inset}>
        {rows.map((task) => (
          <TaskRowItem key={task.id} task={task} mode={mode} />
        ))}
      </PlainList>
    </View>
  );
}

export function ReorderRows({
  rows,
  mode,
  leadingSeparator = false,
}: {
  rows: readonly TaskRow[];
  mode: RowMode;
  leadingSeparator?: boolean;
}) {
  const env = useTaskList();
  const theme = useTheme();
  if (rows.length === 0) return null;
  return (
    <ReorderList
      rows={rows}
      inset={taskSeparatorInset(theme)}
      leadingSeparator={leadingSeparator}
      onReorder={env.reorder}
      onDragActive={env.setDragging}
      renderRow={(task, binding) => <TaskRowItem task={task} mode={mode} reorder={binding} />}
    />
  );
}

export function DoneSection({ rows, scope }: { rows: readonly TaskRow[]; scope: TaskScope }) {
  const { t } = useI18n();
  const done = doneTasks(rows, scope);
  if (done.length === 0) return null;
  return (
    <>
      <ListHeader label={t('tasks.section.done')} />
      <TaskRows rows={done} mode={FULL_MODE} />
    </>
  );
}

function CollapsedOverdue({ count, onPress }: { count: number; onPress: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const label = t('tasks.overdue.collapsed', { count });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: false }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: ROW_MIN_HEIGHT.one,
          paddingLeft: theme.spacing.xs,
          paddingRight: theme.spacing.lg,
          gap: theme.spacing.sm,
          backgroundColor: pressed ? theme.colors.surfaceMuted : undefined,
        },
      ]}
    >
      <View style={styles.leading}>
        <Icon name="warning" size={20} color={theme.colors.danger} />
      </View>
      <Text variant="body" tone="danger" style={styles.grow}>
        {label}
      </Text>
      <Icon name="down" size={18} color={theme.colors.textMuted} />
    </Pressable>
  );
}

export type TodayBodyProps = {
  rows: readonly TaskRow[];
  sort: TaskSort;
  showDone: boolean;
  overdueOpen: boolean;
  onExpandOverdue: () => void;
  onAllToToday: (tasks: readonly TaskRow[]) => void;
  onShowTomorrow: () => void;
};

export function TodayBody({
  rows,
  sort,
  showDone,
  overdueOpen,
  onExpandOverdue,
  onAllToToday,
  onShowTomorrow,
}: TodayBodyProps) {
  const env = useTaskList();
  const { t } = useI18n();
  const groups = todayGroups(rows, env.today, sort);
  const tomorrow = countOnDay(rows, addDays(env.today, 1));
  const hasOverdue = groups.overdue.length > 0;
  const collapsed = groups.overdue.length > OVERDUE_COLLAPSE_AFTER && !overdueOpen;
  const dueCount = groups.timed.length + groups.untimed.length;
  const tomorrowLabel =
    tomorrow === 0
      ? undefined
      : tomorrow === 1
        ? t('tasks.empty.tomorrowOne')
        : t('tasks.empty.tomorrow', { count: tomorrow });

  return (
    <>
      {hasOverdue ? (
        <>
          <ListHeader
            first
            tone="danger"
            label={t('tasks.section.overdue')}
            actionLabel={t('tasks.overdue.allToToday')}
            onAction={() => onAllToToday(groups.overdue)}
          />
          {collapsed ? (
            <CollapsedOverdue count={groups.overdue.length} onPress={onExpandOverdue} />
          ) : (
            <TaskRows rows={groups.overdue} mode={TODAY_MODE} />
          )}
        </>
      ) : null}

      {dueCount === 0 ? (
        <QuietEmpty
          title={t('tasks.empty.today')}
          actionLabel={tomorrowLabel}
          onAction={onShowTomorrow}
        />
      ) : (
        <>
          <ListHeader first={!hasOverdue} label={t('tasks.section.today')} />
          <TaskRows rows={groups.timed} mode={TODAY_MODE} />
          {groups.reorderable ? (
            <ReorderRows
              rows={groups.untimed}
              mode={TODAY_MODE}
              leadingSeparator={groups.timed.length > 0}
            />
          ) : (
            <TaskRows
              rows={groups.untimed}
              mode={TODAY_MODE}
              leadingSeparator={groups.timed.length > 0}
            />
          )}
        </>
      )}

      {showDone ? <DoneSection rows={rows} scope={{ kind: 'today', today: env.today }} /> : null}
    </>
  );
}

export function InboxBody({
  rows,
  sort,
  showDone,
}: {
  rows: readonly TaskRow[];
  sort: TaskSort;
  showDone: boolean;
}) {
  const { t } = useI18n();
  const inbox = inboxTasks(rows, sort);
  return (
    <>
      {inbox.length === 0 ? (
        <QuietEmpty title={t('tasks.empty.inbox')} />
      ) : sort === 'priority' ? (
        <TaskRows rows={inbox} mode={FULL_MODE} />
      ) : (
        <ReorderRows rows={inbox} mode={FULL_MODE} />
      )}
      {showDone ? <DoneSection rows={rows} scope={{ kind: 'inbox' }} /> : null}
    </>
  );
}

export function PlannedBody({ rows, showDone }: { rows: readonly TaskRow[]; showDone: boolean }) {
  const env = useTaskList();
  const { t, language } = useI18n();
  const groups = plannedGroups(rows, env.today);

  const labelOf = (group: PlannedGroup) => {
    if (group.kind === 'overdue' || group.day === null) return t('tasks.section.overdue');
    if (group.kind === 'month') return formatMonthOf(language, group.day);
    return dayLabel(t, language, group.day, env.today);
  };

  return (
    <>
      {groups.map((group, index) => {
        const day = group.kind === 'day' ? group.day : null;
        return (
          <View key={group.key}>
            <ListHeader
              first={index === 0}
              tone={group.kind === 'overdue' ? 'danger' : 'muted'}
              label={labelOf(group)}
              actionLabel={day ? t('tasks.planned.add') : undefined}
              onAction={
                day ? () => env.addWith({ day, projectId: null, section: null }) : undefined
              }
            />
            <TaskRows
              rows={group.rows}
              mode={group.kind === 'day' ? TODAY_MODE : { dateMode: 'full', showGroup: true }}
            />
          </View>
        );
      })}
      {showDone ? <DoneSection rows={rows} scope={{ kind: 'planned' }} /> : null}
    </>
  );
}

export type ProjectHandlers = {
  onOpen: (project: ProjectRow) => void;
  onRename: (project: ProjectRow) => void;
  onDelete: (project: ProjectRow) => void;
};

export function ProjectRowItem({
  project,
  count,
  onOpen,
  onRename,
  onDelete,
}: ProjectHandlers & { project: ProjectRow; count: number }) {
  const { t } = useI18n();
  const theme = useTheme();
  const items: MenuEntry[] = [
    {
      key: 'rename',
      label: t('tasks.project.rename'),
      icon: 'note',
      onPress: () => onRename(project),
    },
    {
      key: 'delete',
      label: t('tasks.project.delete'),
      icon: 'trash',
      destructive: true,
      onPress: () => onDelete(project),
    },
  ];
  return (
    <ContextMenu
      items={items}
      onPress={() => onOpen(project)}
      accessibilityLabel={count > 0 ? `${project.name}, ${count}` : project.name}
      style={[
        styles.row,
        {
          minHeight: ROW_MIN_HEIGHT.one,
          paddingLeft: theme.spacing.xs,
          paddingRight: theme.spacing.lg,
          gap: theme.spacing.sm,
        },
      ]}
    >
      <View style={styles.leading}>
        <Icon name="briefcase" size={20} color={theme.colors.textMuted} />
      </View>
      <Text variant="body" numberOfLines={1} style={styles.grow}>
        {project.name}
      </Text>
      {count > 0 ? (
        <Text variant="body" tone="muted">
          {String(count)}
        </Text>
      ) : null}
    </ContextMenu>
  );
}

export function ProjectsIndex({
  rows,
  projects,
  onNew,
  ...handlers
}: ProjectHandlers & {
  rows: readonly TaskRow[];
  projects: readonly ProjectRow[];
  onNew: () => void;
}) {
  const env = useTaskList();
  const { t } = useI18n();
  const theme = useTheme();
  if (projects.length === 0) {
    return (
      <QuietEmpty
        title={t('tasks.empty.projects')}
        actionLabel={t('tasks.project.new')}
        onAction={onNew}
      />
    );
  }
  const counts = listCounts(rows, env.today).projects;
  return (
    <PlainList separatorInset={taskSeparatorInset(theme)}>
      {[
        ...projects.map((project) => (
          <ProjectRowItem
            key={project.id}
            project={project}
            count={counts.get(project.id) ?? 0}
            {...handlers}
          />
        )),
        <ActionRow
          key="new"
          icon="plus"
          tone="accent"
          label={t('tasks.project.new')}
          onPress={onNew}
        />,
      ]}
    </PlainList>
  );
}

export function ProjectBody({
  rows,
  project,
  sort,
  showDone,
}: {
  rows: readonly TaskRow[];
  project: ProjectRow;
  sort: TaskSort;
  showDone: boolean;
}) {
  const env = useTaskList();
  const { t } = useI18n();
  const groups = projectGroups(rows, project, sort);
  const empty = groups.every((group) => group.rows.length === 0);
  const firstVisible = groups.findIndex((group) => group.section !== null || group.rows.length > 0);

  return (
    <>
      {groups.map((group, index) => {
        if (group.section === null && group.rows.length === 0) return null;
        const section = group.section;
        return (
          <View key={section ?? ''}>
            {section !== null ? (
              <ListHeader
                first={index === firstVisible}
                label={section}
                actionLabel={t('tasks.planned.add')}
                onAction={() => env.addWith({ day: null, projectId: project.id, section })}
              />
            ) : null}
            {sort === 'priority' ? (
              <TaskRows rows={group.rows} mode={FULL_MODE} />
            ) : (
              <ReorderRows rows={group.rows} mode={FULL_MODE} />
            )}
          </View>
        );
      })}
      {empty ? (
        <ActionRow
          icon="plus"
          tone="accent"
          label={t('tasks.add')}
          onPress={() => env.addWith({ day: null, projectId: project.id, section: null })}
        />
      ) : null}
      {showDone ? (
        <DoneSection rows={rows} scope={{ kind: 'project', projectId: project.id }} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  leading: { width: HIT_TARGET, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
});
