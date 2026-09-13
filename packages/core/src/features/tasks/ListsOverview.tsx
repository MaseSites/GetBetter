import { useRef } from 'react';
import { ScrollView, View } from 'react-native';

import type { ProjectRow, TaskRow } from '@/db';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Chip, measureAnchor, PlainList, type MenuAnchor, type MenuEntry } from '@/ui';

import { ActionRow, ListHeader, QuietEmpty } from './fields';
import { listCounts, searchTasks, tagCounts, type TaskFilters } from './lists';
import { useTaskList } from './TaskListContext';
import { taskSeparatorInset } from './TaskRowItem';
import { ProjectRowItem, TaskRows, type ProjectHandlers } from './views';

export type OverviewTarget = 'inbox' | 'today' | 'planned';

/** Alle Listen: Eingang, Heute, Geplant mit Anzahl, dann Projekte und Tags. */
export function ListsOverview({
  rows,
  projects,
  onOpenList,
  onNewProject,
  onPickTag,
  ...handlers
}: ProjectHandlers & {
  rows: readonly TaskRow[];
  projects: readonly ProjectRow[];
  onOpenList: (target: OverviewTarget) => void;
  onNewProject: () => void;
  onPickTag: (tag: string) => void;
}) {
  const env = useTaskList();
  const { t } = useI18n();
  const theme = useTheme();
  const counts = listCounts(rows, env.today);
  const tags = tagCounts(rows);
  const inset = taskSeparatorInset(theme);
  const countText = (count: number) => (count > 0 ? String(count) : undefined);

  return (
    <>
      <PlainList separatorInset={inset}>
        <ActionRow
          icon="inbox"
          label={t('tasks.view.inbox')}
          value={countText(counts.inbox)}
          onPress={() => onOpenList('inbox')}
        />
        <ActionRow
          icon="sun"
          label={t('tasks.view.today')}
          value={countText(counts.today)}
          onPress={() => onOpenList('today')}
        />
        <ActionRow
          icon="calendar"
          label={t('tasks.view.planned')}
          value={countText(counts.planned)}
          onPress={() => onOpenList('planned')}
        />
      </PlainList>

      <ListHeader
        label={t('tasks.view.projects')}
        actionLabel={t('tasks.project.new')}
        onAction={onNewProject}
      />
      <PlainList separatorInset={inset}>
        {projects.map((project) => (
          <ProjectRowItem
            key={project.id}
            project={project}
            count={counts.projects.get(project.id) ?? 0}
            {...handlers}
          />
        ))}
      </PlainList>

      {tags.length > 0 ? (
        <>
          <ListHeader label={t('tasks.lists.tags')} />
          <PlainList separatorInset={inset}>
            {tags.map(({ tag, count }) => (
              <ActionRow
                key={tag}
                label={`#${tag}`}
                value={String(count)}
                onPress={() => onPickTag(tag)}
              />
            ))}
          </PlainList>
        </>
      ) : null}
    </>
  );
}

/** Die Filter-Tokens unter dem Suchfeld. Tag und Projekt oeffnen ein Menue. */
export function FilterBar({
  filters,
  onChange,
  tags,
  projects,
  openMenu,
}: {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  tags: readonly string[];
  projects: readonly ProjectRow[];
  openMenu: (anchor: MenuAnchor, items: readonly MenuEntry[]) => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const tagNode = useRef<View>(null);
  const projectNode = useRef<View>(null);
  const projectName = projects.find((project) => project.id === filters.projectId)?.name;

  async function pickTag() {
    if (filters.tag !== null) {
      onChange({ ...filters, tag: null });
      return;
    }
    const anchor = await measureAnchor(tagNode.current);
    if (!anchor) return;
    openMenu(
      anchor,
      tags.map((tag) => ({
        key: tag,
        label: `#${tag}`,
        onPress: () => onChange({ ...filters, tag }),
      })),
    );
  }

  async function pickProject() {
    if (filters.projectId !== null) {
      onChange({ ...filters, projectId: null });
      return;
    }
    const anchor = await measureAnchor(projectNode.current);
    if (!anchor) return;
    openMenu(
      anchor,
      projects.map((project) => ({
        key: project.id,
        label: project.name,
        onPress: () => onChange({ ...filters, projectId: project.id }),
      })),
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: theme.spacing.sm, paddingHorizontal: theme.spacing.lg }}
    >
      <Chip
        label={t('tasks.filter.overdue')}
        selected={filters.overdue}
        onPress={() => onChange({ ...filters, overdue: !filters.overdue })}
      />
      <Chip
        label={t('tasks.filter.noDate')}
        selected={filters.noDate}
        onPress={() => onChange({ ...filters, noDate: !filters.noDate })}
      />
      <Chip
        label={t('tasks.field.priority')}
        selected={filters.priority}
        onPress={() => onChange({ ...filters, priority: !filters.priority })}
      />
      <View ref={tagNode} collapsable={false}>
        <Chip
          label={filters.tag !== null ? `#${filters.tag}` : t('tasks.field.tag')}
          selected={filters.tag !== null}
          disabled={filters.tag === null && tags.length === 0}
          onPress={() => void pickTag()}
        />
      </View>
      <View ref={projectNode} collapsable={false}>
        <Chip
          label={projectName ?? t('tasks.field.project')}
          selected={filters.projectId !== null}
          disabled={filters.projectId === null && projects.length === 0}
          onPress={() => void pickProject()}
        />
      </View>
      <Chip
        label={t('tasks.filter.includeDone')}
        selected={filters.includeDone}
        onPress={() => onChange({ ...filters, includeDone: !filters.includeDone })}
      />
    </ScrollView>
  );
}

/** Treffer ueber alle Aufgaben; ohne Treffer der Knopf, der aus der Suche eine Aufgabe macht. */
export function SearchResults({
  rows,
  query,
  filters,
  projects,
  onCreate,
}: {
  rows: readonly TaskRow[];
  query: string;
  filters: TaskFilters;
  projects: readonly ProjectRow[];
  onCreate: (title: string) => void;
}) {
  const env = useTaskList();
  const { t } = useI18n();
  const names = new Map(projects.map((project) => [project.id, project.name]));
  const hits = searchTasks(rows, query, filters, env.today, names);
  const trimmed = query.trim();

  if (hits.length > 0) {
    return <TaskRows rows={hits} mode={{ dateMode: 'full', showGroup: false }} />;
  }
  if (trimmed.length === 0) return <QuietEmpty title={t('tasks.search.noneFiltered')} />;
  return (
    <QuietEmpty
      title={t('tasks.search.none', { query: trimmed })}
      actionLabel={t('tasks.search.create', { query: trimmed })}
      onAction={() => onCreate(trimmed)}
    />
  );
}
