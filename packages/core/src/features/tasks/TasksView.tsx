import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import {
  dayKey,
  projects as projectRepo,
  TASK_PRIORITIES,
  tasks as taskRepo,
  useLiveQuery,
  type ProjectRow,
  type TaskRow,
} from '@/db';
import { dueAtOfDay, dueDayOf, priorityOf } from '@/db/taskFields';
import { useI18n, type TranslationKey } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount, useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { useCelebrate } from '@/features/celebrate/CelebrationLayer';
import {
  FLOATING_BUTTON_SIZE,
  FloatingButton,
  HIT_TARGET,
  Header,
  Icon,
  IconButton,
  isMenuDivider,
  measureAnchor,
  Menu,
  PlainList,
  ROW_MIN_HEIGHT,
  Screen,
  Sheet,
  Skeleton,
  type IconName,
  type MenuAnchor,
  type MenuEntry,
} from '@/ui';

import { CompletionQueue } from './CompletionQueue';
import { DateSheet, type DateRequest } from './DateSheet';
import { ActionRow } from './fields';
import { PRESET_ICONS, presetLabel, priorityName } from './labels';
import { FilterBar, ListsOverview, SearchResults } from './ListsOverview';
import {
  hasActiveFilters,
  nextOrder,
  NO_FILTERS,
  subtaskProgress,
  tagCounts,
  type TaskFilters,
  type TaskSort,
} from './lists';
import { metaPartsOf } from './meta';
import { ProjectSheet, type ProjectEdit } from './ProjectSheet';
import { QuickAddBar } from './QuickAddBar';
import { NO_DEFAULTS, type QuickAddDefaults, type TaskDraft } from './quickAdd';
import { SCHEDULE_PRESETS, scheduleFor, type Schedule } from './schedule';
import { SelectionBar } from './SelectionBar';
import { TaskDetailSheet } from './TaskDetailSheet';
import { TaskListProvider, type AnchorFn, type TaskListEnv } from './TaskListContext';
import { CIRCLE_SIZE } from './TaskRowItem';
import { useTaskActions } from './useTaskActions';
import { InboxBody, PlannedBody, ProjectBody, ProjectsIndex, TodayBody } from './views';

type ViewState =
  | { kind: 'today' }
  | { kind: 'inbox' }
  | { kind: 'planned' }
  | { kind: 'projects' }
  | { kind: 'project'; projectId: string }
  | { kind: 'lists' };

type MenuView = 'inbox' | 'today' | 'planned' | 'projects' | 'lists';

const MENU_VIEWS: readonly Exclude<MenuView, 'lists'>[] = ['inbox', 'today', 'planned', 'projects'];

const VIEW_LABELS: Record<MenuView, TranslationKey> = {
  inbox: 'tasks.view.inbox',
  today: 'tasks.view.today',
  planned: 'tasks.view.planned',
  projects: 'tasks.view.projects',
  lists: 'tasks.view.lists',
};

const VIEW_ICONS: Record<MenuView, IconName> = {
  inbox: 'inbox',
  today: 'sun',
  planned: 'calendar',
  projects: 'briefcase',
  lists: 'lines',
};

/** Mehr Punkte passen nicht in ein Menue; dann kommt ein Blatt. */
const MAX_MENU_ITEMS = 7;

/** Platzhalter erst, wenn nach so langer Zeit noch nichts da ist. */
const SKELETON_DELAY_MS = 300;
const SKELETON_ROWS = [0, 1, 2, 3] as const;

function useDelayed(active: boolean, delayMs: number): boolean {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setElapsed(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);
  return active && elapsed;
}

function toggled(set: ReadonlySet<string> | null, id: string): ReadonlySet<string> {
  const current = set ?? new Set<string>();
  return current.has(id)
    ? new Set([...current].filter((entry) => entry !== id))
    : new Set([...current, id]);
}

function TaskSkeleton() {
  const theme = useTheme();
  return (
    <View accessibilityRole="progressbar">
      {SKELETON_ROWS.map((row) => (
        <View
          key={row}
          style={[
            styles.row,
            { minHeight: ROW_MIN_HEIGHT.one, paddingLeft: theme.spacing.xs, gap: theme.spacing.sm },
          ]}
        >
          <View style={styles.hit}>
            <Skeleton height={CIRCLE_SIZE} width={CIRCLE_SIZE} />
          </View>
          <View style={[styles.grow, { paddingRight: theme.spacing.lg }]}>
            <Skeleton height={theme.fontSize.sm} width="60%" />
          </View>
        </View>
      ))}
    </View>
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <View
      style={[
        styles.row,
        {
          minHeight: HIT_TARGET - theme.spacing.xs,
          borderRadius: theme.radii.sm,
          backgroundColor: theme.colors.surfaceMuted,
          paddingHorizontal: theme.spacing.md,
          gap: theme.spacing.sm,
        },
      ]}
    >
      <Icon name="search" size={16} color={theme.colors.textFaint} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={t('tasks.search.placeholder')}
        placeholderTextColor={theme.colors.textFaint}
        accessibilityLabel={t('tasks.search.placeholder')}
        returnKeyType="search"
        autoCorrect={false}
        style={[
          styles.searchInput,
          { fontFamily: theme.fontFamily, fontSize: theme.fontSize.md, color: theme.colors.text },
        ]}
      />
      {value.length > 0 ? (
        <IconButton icon="close" label={t('tasks.search.clear')} onPress={() => onChange('')} />
      ) : null}
    </View>
  );
}

/**
 * Aufgaben wie in Things und Erinnerungen: Heute als Wurzel, der Titel
 * wechselt die Ansicht, „+“ unten rechts oeffnet die Satz-Eingabe.
 */
export function TasksView(_props: { module: ModuleDefinition }) {
  const celebrate = useCelebrate();
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const { household } = useApp();
  const householdId = household?.id ?? null;
  const actions = useTaskActions();
  const today = dayKey();

  const [view, setView] = useState<ViewState>({ kind: 'today' });
  const [sort, setSort] = useState<TaskSort>('time');
  const [showDone, setShowDone] = useState(false);
  const [overdueOpen, setOverdueOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<TaskFilters>(NO_FILTERS);
  const [quickAdd, setQuickAdd] = useState<{ id: number; defaults: QuickAddDefaults } | null>(null);
  const [detail, setDetail] = useState<readonly string[]>([]);
  const [selection, setSelection] = useState<ReadonlySet<string> | null>(null);
  const [menu, setMenu] = useState<{
    anchor: MenuAnchor;
    items: readonly MenuEntry[];
    open: boolean;
  } | null>(null);
  const [choices, setChoices] = useState<readonly MenuEntry[] | null>(null);
  const [dateRequest, setDateRequest] = useState<DateRequest | null>(null);
  const [projectEdit, setProjectEdit] = useState<ProjectEdit | null>(null);
  const [dragging, setDragging] = useState(false);
  const [completing, setCompleting] = useState<ReadonlySet<string>>(new Set());
  const [queue] = useState(() => new CompletionQueue(setCompleting));
  const moreNode = useRef<View>(null);

  // Vertrag fuer andere Bildschirme: `?new=1` oeffnet die Eingabe, `?task=<id>` das Blatt.
  const params = useLocalSearchParams<{ new?: string; task?: string }>();
  const newParam = typeof params.new === 'string' ? params.new : '';
  const taskParam = typeof params.task === 'string' ? params.task : '';
  const paramKey = `${newParam}|${taskParam}`;
  const [seenParams, setSeenParams] = useState('');
  if (paramKey !== seenParams) {
    setSeenParams(paramKey);
    if (newParam === '1') setQuickAdd({ id: 1, defaults: { ...NO_DEFAULTS, day: today } });
    if (taskParam.length > 0) setDetail([taskParam]);
  }

  const all = useLiveQuery(
    () => taskRepo.listVisible(account.id, householdId),
    [account.id, householdId],
  );
  const projectQuery = useLiveQuery(
    () => projectRepo.list(account.id, householdId),
    [account.id, householdId],
  );
  const rows = all.data ?? [];
  const projects = projectQuery.data ?? [];
  const showSkeleton = useDelayed(all.data === undefined, SKELETON_DELAY_MS);

  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const projectsById = new Map(projects.map((project) => [project.id, project]));
  const progress = subtaskProgress(rows);
  const tags = tagCounts(rows).map((entry) => entry.tag);
  const project = view.kind === 'project' ? projectsById.get(view.projectId) : undefined;
  const currentView: MenuView = view.kind === 'project' ? 'projects' : view.kind;

  // Was 1,2 s nach dem Tipp auf den Kreis passiert — mit den neuesten Zeilen.
  useEffect(() => {
    queue.setRunner((id) => {
      const task = rowsById.get(id);
      return task ? actions.complete(task) : undefined;
    });
  });
  useEffect(() => () => queue.flush(), [queue]);

  function switchView(next: ViewState) {
    setView(next);
    setSelection(null);
    setOverdueOpen(false);
  }

  function openMenu(anchor: MenuAnchor, items: readonly MenuEntry[]) {
    if (items.filter((item) => !isMenuDivider(item)).length > MAX_MENU_ITEMS) {
      setChoices(items);
      return;
    }
    setMenu({ anchor, items, open: true });
  }

  function openMenuAt(anchor: AnchorFn, items: readonly MenuEntry[]) {
    void anchor().then((found) => {
      if (found) openMenu(found, items);
    });
  }

  function openDate(request: Omit<DateRequest, 'id'>) {
    setDateRequest((current) => ({ ...request, id: (current?.id ?? 0) + 1 }));
  }

  function defaultsForView(): QuickAddDefaults {
    if (view.kind === 'today') return { ...NO_DEFAULTS, day: today };
    if (project) return { ...NO_DEFAULTS, projectId: project.id };
    return NO_DEFAULTS;
  }

  function openQuickAdd(defaults: QuickAddDefaults = defaultsForView()) {
    setSelection(null);
    setQuickAdd((current) => ({ id: (current?.id ?? 0) + 1, defaults }));
  }

  const clearSelection = () => setSelection(null);

  function pickDate(list: readonly TaskRow[], after?: () => void) {
    const single = list.length === 1 ? list[0] : undefined;
    openDate({
      day: single ? dueDayOf(single) : null,
      time: single?.dueTime ?? null,
      onApply: (schedule) => void actions.schedule(list, schedule).then(after),
    });
  }

  function planTasks(list: readonly TaskRow[], anchor: AnchorFn, after?: () => void) {
    const apply = (target: (task: TaskRow) => Schedule) =>
      void actions.schedule(list, target).then(after);
    openMenuAt(anchor, [
      ...SCHEDULE_PRESETS.map((preset) => ({
        key: preset,
        label: presetLabel(t, preset),
        icon: PRESET_ICONS[preset],
        onPress: () => apply((task: TaskRow) => scheduleFor(preset, today, task.dueTime ?? null)),
      })),
      {
        key: 'pick',
        label: t('tasks.plan.pick'),
        icon: 'calendar',
        onPress: () => pickDate(list, after),
      },
    ]);
  }

  function prioritizeTasks(list: readonly TaskRow[], anchor: AnchorFn) {
    const single = list.length === 1 ? list[0] : undefined;
    openMenuAt(
      anchor,
      TASK_PRIORITIES.map((level) => ({
        key: `priority-${level}`,
        label: priorityName(t, level),
        selected: single ? priorityOf(single.priority) === level : undefined,
        onPress: () => void actions.setPriority(list, level),
      })),
    );
  }

  function moveTasks(list: readonly TaskRow[], anchor: AnchorFn, after?: () => void) {
    const single = list.length === 1 ? list[0] : undefined;
    const move = (target: ProjectRow | null) => void actions.moveTo(list, target).then(after);
    openMenuAt(anchor, [
      {
        key: 'none',
        label: t('tasks.project.none'),
        icon: 'inbox',
        selected: single ? !single.projectId : undefined,
        onPress: () => move(null),
      },
      ...projects.map((entry) => ({
        key: entry.id,
        label: entry.name,
        icon: 'briefcase' as const,
        selected: single ? single.projectId === entry.id : undefined,
        onPress: () => move(entry),
      })),
    ]);
  }

  function groupNameOf(task: TaskRow): string | null {
    if (task.projectId) return projectsById.get(task.projectId)?.name ?? null;
    if (task.shared && household && task.householdId === household.id) return household.name;
    return null;
  }

  async function createTask(draft: TaskDraft) {
    celebrate('task');
    await taskRepo.create({
      accountId: account.id,
      householdId,
      title: draft.title,
      dueAt: draft.day ? dueAtOfDay(draft.day) : null,
      dueTime: draft.time,
      priority: draft.priority,
      projectId: draft.projectId,
      section: draft.section,
      tags: draft.tags.length > 0 ? [...draft.tags] : undefined,
      repeat: draft.repeat,
      reminderOffsetMinutes: draft.reminderOffsetMinutes,
      order: nextOrder(rows),
    });
  }

  async function createFromQuery(title: string) {
    const created = await taskRepo.create({
      accountId: account.id,
      householdId,
      title,
      order: nextOrder(rows),
    });
    setQuery('');
    setFilters(NO_FILTERS);
    setDetail([created.id]);
  }

  const env: TaskListEnv = {
    today,
    completing,
    selection,
    metaOf: (task, mode) =>
      metaPartsOf(task, {
        today,
        dateMode: mode.dateMode,
        progress: progress.get(task.id),
        groupName: groupNameOf(task),
        showGroup: mode.showGroup,
      }),
    toggleDone: (task) => (task.done ? void actions.reopen(task) : queue.toggle(task.id)),
    completeNow: (task) => void actions.complete(task),
    open: (task) => setDetail([task.id]),
    toggleSelect: (task) => setSelection((current) => toggled(current, task.id)),
    startSelection: (task) => {
      setQuickAdd(null);
      setSelection(new Set([task.id]));
    },
    plan: (list, anchor) => planTasks(list, anchor),
    postpone: (task, kind) => void actions.postpone([task], kind),
    pickDate: (list) => pickDate(list),
    prioritize: prioritizeTasks,
    move: (list, anchor) => moveTasks(list, anchor),
    duplicate: (task) => void actions.duplicate(task),
    remove: (task) => void actions.remove(task),
    reorder: (ids) => void taskRepo.reorder(ids),
    setDragging,
    // Das Kontextmenue einer Zeile ist in Gruppen geteilt und bleibt ein Menue —
    // wie bei Zeilen ohne Umordnen, wo `ContextMenu` es selbst oeffnet.
    openMenu: (anchor, items) => setMenu({ anchor, items, open: true }),
    addWith: (defaults) => openQuickAdd(defaults),
  };

  const projectHandlers = {
    onOpen: (entry: ProjectRow) => switchView({ kind: 'project', projectId: entry.id }),
    onRename: (entry: ProjectRow) => setProjectEdit({ kind: 'rename', project: entry }),
    onDelete: (entry: ProjectRow) => {
      if (view.kind === 'project' && view.projectId === entry.id) switchView({ kind: 'projects' });
      void actions.removeProject(entry, rows);
    },
  };

  async function openMore() {
    const anchor = await measureAnchor(moreNode.current);
    if (!anchor) return;
    const doneToggle: MenuEntry = {
      key: 'showDone',
      label: showDone ? t('tasks.menu.hideDone') : t('tasks.menu.showDone'),
      icon: 'checkCircle',
      onPress: () => setShowDone((value) => !value),
    };
    const select: MenuEntry = {
      key: 'select',
      label: t('tasks.action.select'),
      icon: 'checkbox',
      onPress: () => {
        setQuickAdd(null);
        setSelection(new Set());
      },
    };
    const sortItem = (value: TaskSort, key: TranslationKey): MenuEntry => ({
      key: `sort-${value}`,
      label: t(key),
      selected: view.kind === 'inbox' && value === 'manual' ? sort !== 'priority' : sort === value,
      onPress: () => setSort(value),
    });
    const newProject: MenuEntry = {
      key: 'newProject',
      label: t('tasks.project.new'),
      icon: 'plus',
      onPress: () => setProjectEdit({ kind: 'new' }),
    };

    if (project) {
      openMenu(anchor, [
        doneToggle,
        select,
        { key: 'divider', divider: true },
        {
          key: 'rename',
          label: t('tasks.project.rename'),
          icon: 'note',
          onPress: () => setProjectEdit({ kind: 'rename', project }),
        },
        {
          key: 'section',
          label: t('tasks.project.addSection'),
          icon: 'plus',
          onPress: () => setProjectEdit({ kind: 'section', project }),
        },
        {
          key: 'delete',
          label: t('tasks.project.delete'),
          icon: 'trash',
          destructive: true,
          onPress: () => projectHandlers.onDelete(project),
        },
      ]);
      return;
    }
    if (view.kind === 'projects' || view.kind === 'lists' || view.kind === 'project') {
      openMenu(anchor, [newProject]);
      return;
    }
    const sorts: MenuEntry[] =
      view.kind === 'today'
        ? [
            sortItem('time', 'tasks.sort.time'),
            sortItem('priority', 'tasks.sort.priority'),
            sortItem('manual', 'tasks.sort.manual'),
          ]
        : view.kind === 'inbox'
          ? [sortItem('priority', 'tasks.sort.priority'), sortItem('manual', 'tasks.sort.manual')]
          : [];
    openMenu(anchor, [
      doneToggle,
      ...(sorts.length > 0 ? [{ key: 'd1', divider: true } as const, ...sorts] : []),
      { key: 'd2', divider: true },
      select,
    ]);
  }

  const titleMenu: MenuEntry[] = [
    ...MENU_VIEWS.map((kind) => ({
      key: kind,
      label: t(VIEW_LABELS[kind]),
      icon: VIEW_ICONS[kind],
      selected: currentView === kind,
      onPress: () => switchView({ kind }),
    })),
    { key: 'divider', divider: true },
    {
      key: 'lists',
      label: t(VIEW_LABELS.lists),
      icon: VIEW_ICONS.lists,
      selected: currentView === 'lists',
      onPress: () => switchView({ kind: 'lists' }),
    },
  ];

  const searching = query.trim().length > 0 || hasActiveFilters(filters);
  const selectedTasks = selection ? rows.filter((row) => selection.has(row.id)) : [];

  function renderBody() {
    if (showSkeleton) return <TaskSkeleton />;
    if (all.data === undefined) return null;
    if (searching) {
      return (
        <SearchResults
          rows={rows}
          query={query}
          filters={filters}
          projects={projects}
          onCreate={(title) => void createFromQuery(title)}
        />
      );
    }
    switch (view.kind) {
      case 'today':
        return (
          <TodayBody
            rows={rows}
            sort={sort}
            showDone={showDone}
            overdueOpen={overdueOpen}
            onExpandOverdue={() => setOverdueOpen(true)}
            onAllToToday={(list) =>
              void actions.schedule(list, (task) => ({ day: today, time: task.dueTime ?? null }))
            }
            onShowTomorrow={() => switchView({ kind: 'planned' })}
          />
        );
      case 'inbox':
        return <InboxBody rows={rows} sort={sort} showDone={showDone} />;
      case 'planned':
        return <PlannedBody rows={rows} showDone={showDone} />;
      case 'lists':
        return (
          <ListsOverview
            rows={rows}
            projects={projects}
            onOpenList={(kind) => switchView({ kind })}
            onNewProject={() => setProjectEdit({ kind: 'new' })}
            onPickTag={(tag) => setFilters({ ...NO_FILTERS, tag })}
            {...projectHandlers}
          />
        );
      case 'project':
        if (project) {
          return <ProjectBody rows={rows} project={project} sort={sort} showDone={showDone} />;
        }
        return (
          <ProjectsIndex
            rows={rows}
            projects={projects}
            onNew={() => setProjectEdit({ kind: 'new' })}
            {...projectHandlers}
          />
        );
      case 'projects':
        return (
          <ProjectsIndex
            rows={rows}
            projects={projects}
            onNew={() => setProjectEdit({ kind: 'new' })}
            {...projectHandlers}
          />
        );
    }
  }

  const header = (
    <Header
      title={project?.name ?? t(VIEW_LABELS[currentView])}
      titleMenu={titleMenu}
      showBack
      onBack={() => {
        if (view.kind === 'project') {
          switchView({ kind: 'projects' });
          return;
        }
        if (router.canGoBack()) router.back();
        else router.replace('/');
      }}
      right={
        <View ref={moreNode} collapsable={false}>
          <IconButton
            icon="more"
            label={t('tasks.more')}
            tone="default"
            onPress={() => void openMore()}
          />
        </View>
      }
    />
  );

  const footer = quickAdd ? (
    <QuickAddBar
      key={quickAdd.id}
      defaults={quickAdd.defaults}
      today={today}
      projects={projects}
      tags={tags}
      onSubmit={(draft) => void createTask(draft)}
      onClose={() => setQuickAdd(null)}
      openMenu={openMenu}
      openDate={openDate}
    />
  ) : selection ? (
    <SelectionBar
      count={selectedTasks.length}
      onClose={clearSelection}
      onDone={() =>
        void actions.completeMany(selectedTasks.filter((task) => !task.done)).then(clearSelection)
      }
      onPlan={(anchor) => planTasks(selectedTasks, anchor, clearSelection)}
      onMove={(anchor) => moveTasks(selectedTasks, anchor, clearSelection)}
      onDelete={() => void actions.removeMany(selectedTasks).then(clearSelection)}
    />
  ) : undefined;

  return (
    <TaskListProvider value={env}>
      <Screen scroll={false} padded={false} header={header} footer={footer}>
        <ScrollView
          style={styles.grow}
          scrollEnabled={!dragging}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: theme.spacing.xs,
            paddingBottom: FLOATING_BUTTON_SIZE + theme.spacing.xxl,
          }}
        >
          <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md }}>
            <SearchField value={query} onChange={setQuery} />
          </View>
          {view.kind === 'lists' || searching ? (
            <View style={{ paddingBottom: theme.spacing.md }}>
              <FilterBar
                filters={filters}
                onChange={setFilters}
                tags={tags}
                projects={projects}
                openMenu={openMenu}
              />
            </View>
          ) : null}
          {renderBody()}
        </ScrollView>
        {quickAdd ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('tasks.quick.close')}
            onPress={() => setQuickAdd(null)}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        {!quickAdd && !selection ? (
          <FloatingButton label={t('tasks.new')} onPress={() => openQuickAdd()} />
        ) : null}
      </Screen>

      <TaskDetailSheet
        stack={detail}
        rows={rows}
        projects={projects}
        today={today}
        accountId={account.id}
        onPush={(id) => setDetail((stack) => [...stack, id])}
        onPop={() => setDetail((stack) => stack.slice(0, -1))}
        onClose={() => setDetail([])}
        onToggleDone={(task) => void (task.done ? actions.reopen(task) : actions.complete(task))}
        onDuplicate={(task) => void actions.duplicate(task)}
        onDelete={(task) => {
          setDetail((stack) => stack.slice(0, -1));
          void actions.remove(task);
        }}
        openMenu={openMenu}
      />

      <Menu
        visible={menu?.open ?? false}
        anchor={menu?.anchor ?? null}
        items={menu?.items ?? []}
        onClose={() => setMenu((current) => (current ? { ...current, open: false } : null))}
      />

      <Sheet visible={choices !== null} onClose={() => setChoices(null)}>
        <PlainList separatorInset="none">
          {(choices ?? [])
            .filter((item) => !isMenuDivider(item))
            .map((item) =>
              isMenuDivider(item) ? null : (
                <ActionRow
                  key={item.key}
                  icon={item.selected ? 'check' : item.icon}
                  tone={item.destructive ? 'danger' : item.selected ? 'accent' : 'default'}
                  label={item.label}
                  onPress={() => {
                    setChoices(null);
                    item.onPress();
                  }}
                />
              ),
            )}
        </PlainList>
      </Sheet>

      {dateRequest ? (
        <DateSheet
          key={dateRequest.id}
          request={dateRequest}
          onClose={() => setDateRequest(null)}
        />
      ) : null}

      {projectEdit ? (
        <ProjectSheet
          key={projectEdit.kind === 'new' ? 'new' : `${projectEdit.kind}-${projectEdit.project.id}`}
          edit={projectEdit}
          accountId={account.id}
          onClose={() => setProjectEdit(null)}
          onCreated={(created) => switchView({ kind: 'project', projectId: created.id })}
        />
      ) : null}
    </TaskListProvider>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  hit: { width: HIT_TARGET, height: HIT_TARGET, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
  searchInput: { flex: 1, minHeight: HIT_TARGET - 4, outlineStyle: 'none' as never },
});
