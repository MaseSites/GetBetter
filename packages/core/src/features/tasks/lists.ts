// Relative Pfade mit Absicht: so laeuft die Datei auch in den Tests unter Node.
import { dayKey } from '../../db/pure';
import { dueDayOf, priorityOf } from '../../db/taskFields';
import type { ProjectRow, TaskRow } from '../../db/types';

import { addDays, monthOf } from './days';

/**
 * Welche Aufgabe in welcher Ansicht steht und in welcher Reihenfolge. Rein:
 * Zeilen hinein, neue Listen heraus.
 */

export type TaskSort = 'time' | 'priority' | 'manual';

const LAST = Number.MAX_SAFE_INTEGER;
const NO_DAY = '9999-12-31';
const NO_TIME = '99:99';

export function isTopLevel(task: TaskRow): boolean {
  return !task.parentId;
}

export function isOverdue(task: TaskRow, today: string): boolean {
  const day = dueDayOf(task);
  return !task.done && day !== null && day < today;
}

function byManual(a: TaskRow, b: TaskRow): number {
  return (a.order ?? LAST) - (b.order ?? LAST) || a.createdAt.localeCompare(b.createdAt);
}

function byDue(a: TaskRow, b: TaskRow): number {
  const day = (dueDayOf(a) ?? NO_DAY).localeCompare(dueDayOf(b) ?? NO_DAY);
  return day !== 0 ? day : (a.dueTime ?? NO_TIME).localeCompare(b.dueTime ?? NO_TIME);
}

function byPriority(a: TaskRow, b: TaskRow): number {
  return priorityOf(b.priority) - priorityOf(a.priority);
}

export function sortTasks(rows: readonly TaskRow[], sort: TaskSort): TaskRow[] {
  const copy = [...rows];
  if (sort === 'manual') return copy.sort(byManual);
  if (sort === 'priority') {
    return copy.sort((a, b) => byPriority(a, b) || byDue(a, b) || byManual(a, b));
  }
  return copy.sort((a, b) => byDue(a, b) || byManual(a, b));
}

function openTopLevel(rows: readonly TaskRow[]): TaskRow[] {
  return rows.filter((row) => !row.done && isTopLevel(row));
}

export type TodayGroups = {
  overdue: TaskRow[];
  /** Mit Uhrzeit, chronologisch. Leer, wenn anders sortiert wird. */
  timed: TaskRow[];
  untimed: TaskRow[];
  /** Ob sich `untimed` von Hand ordnen laesst. */
  reorderable: boolean;
};

/** Heute: Ueberfaelliges, dann mit Uhrzeit, dann ohne in eigener Reihenfolge. */
export function todayGroups(rows: readonly TaskRow[], today: string, sort: TaskSort): TodayGroups {
  const open = openTopLevel(rows);
  const overdue = sortTasks(
    open.filter((row) => isOverdue(row, today)),
    sort === 'priority' ? 'priority' : 'time',
  );
  const due = open.filter((row) => dueDayOf(row) === today);
  if (sort === 'time') {
    return {
      overdue,
      timed: sortTasks(
        due.filter((row) => row.dueTime),
        'time',
      ),
      untimed: sortTasks(
        due.filter((row) => !row.dueTime),
        'manual',
      ),
      reorderable: true,
    };
  }
  return { overdue, timed: [], untimed: sortTasks(due, sort), reorderable: sort === 'manual' };
}

/** Eingang: ohne Datum und ohne Projekt. */
export function inboxTasks(rows: readonly TaskRow[], sort: TaskSort): TaskRow[] {
  return sortTasks(
    openTopLevel(rows).filter((row) => !row.dueAt && !row.projectId),
    sort === 'priority' ? 'priority' : 'manual',
  );
}

/** Geplant zeigt so viele Tage einzeln, danach Monate. */
export const PLANNED_DAYS = 14;

export type PlannedGroup = {
  key: string;
  kind: 'overdue' | 'day' | 'month';
  /** Bei `day` der Tag, bei `month` der Erste des Monats. */
  day: string | null;
  rows: TaskRow[];
};

export function plannedGroups(rows: readonly TaskRow[], today: string): PlannedGroup[] {
  const dated = sortTasks(
    openTopLevel(rows).filter((row) => dueDayOf(row) !== null),
    'time',
  );
  const days = Array.from({ length: PLANNED_DAYS }, (_, index) => addDays(today, index));
  const lastDay = days[days.length - 1] ?? today;
  const overdue = dated.filter((row) => (dueDayOf(row) ?? NO_DAY) < today);
  const later = dated.filter((row) => (dueDayOf(row) ?? '') > lastDay);
  const months = [...new Set(later.map((row) => monthOf(dueDayOf(row) ?? NO_DAY)))];

  const overdueGroup: PlannedGroup[] =
    overdue.length > 0 ? [{ key: 'overdue', kind: 'overdue', day: null, rows: overdue }] : [];
  const dayGroups: PlannedGroup[] = days.map((day) => ({
    key: day,
    kind: 'day',
    day,
    rows: dated.filter((row) => dueDayOf(row) === day),
  }));
  const monthGroups: PlannedGroup[] = months.map((month) => ({
    key: month,
    kind: 'month',
    day: `${month}-01`,
    rows: later.filter((row) => monthOf(dueDayOf(row) ?? NO_DAY) === month),
  }));
  return [...overdueGroup, ...dayGroups, ...monthGroups];
}

export type ProjectGroup = { section: string | null; rows: TaskRow[] };

/** Ein Projekt: erst ohne Abschnitt, dann jeder Abschnitt — auch leere, damit man hineinlegen kann. */
export function projectGroups(
  rows: readonly TaskRow[],
  project: Pick<ProjectRow, 'id' | 'sections'>,
  sort: TaskSort,
): ProjectGroup[] {
  const own = sortTasks(
    openTopLevel(rows).filter((row) => row.projectId === project.id),
    sort === 'priority' ? 'priority' : 'manual',
  );
  const sections = project.sections ?? [];
  const known = new Set(sections);
  return [
    { section: null, rows: own.filter((row) => !row.section || !known.has(row.section)) },
    ...sections.map((section) => ({
      section,
      rows: own.filter((row) => row.section === section),
    })),
  ];
}

export type TaskScope =
  | { kind: 'today'; today: string }
  | { kind: 'inbox' }
  | { kind: 'planned' }
  | { kind: 'project'; projectId: string };

export const DONE_LIMIT = 30;

function inScope(row: TaskRow, scope: TaskScope): boolean {
  switch (scope.kind) {
    case 'today': {
      const completed = row.completedAt ? dayKey(new Date(row.completedAt)) : null;
      return completed === scope.today || dueDayOf(row) === scope.today;
    }
    case 'inbox':
      return !row.dueAt && !row.projectId;
    case 'planned':
      return row.dueAt !== null;
    case 'project':
      return row.projectId === scope.projectId;
  }
}

/** „Erledigte zeigen“: das zuletzt Erledigte dieser Ansicht zuerst. */
export function doneTasks(
  rows: readonly TaskRow[],
  scope: TaskScope,
  limit = DONE_LIMIT,
): TaskRow[] {
  return rows
    .filter((row) => row.done && isTopLevel(row) && inScope(row, scope))
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    .slice(0, limit);
}

/** Offene Aufgaben an einem Tag — fuer „Morgen: 3 Aufgaben“. */
export function countOnDay(rows: readonly TaskRow[], day: string): number {
  return openTopLevel(rows).filter((row) => dueDayOf(row) === day).length;
}

function sameTag(a: string, b: string): boolean {
  return a.toLocaleLowerCase('de') === b.toLocaleLowerCase('de');
}

/** Tags ohne Doppelte, gross oder klein geschrieben; die erste Schreibweise bleibt. */
export function uniqueTags(tags: readonly string[]): string[] {
  return tags.filter(
    (tag, index) => tag.length > 0 && tags.findIndex((other) => sameTag(other, tag)) === index,
  );
}

export function hasTag(row: TaskRow, tag: string): boolean {
  return (row.tags ?? []).some((own) => sameTag(own, tag));
}

export type TagCount = { tag: string; count: number };

export function tagCounts(rows: readonly TaskRow[]): TagCount[] {
  const open = openTopLevel(rows);
  return uniqueTags(open.flatMap((row) => row.tags ?? []))
    .map((tag) => ({ tag, count: open.filter((row) => hasTag(row, tag)).length }))
    .sort((a, b) => a.tag.localeCompare(b.tag, 'de'));
}

export type ListCounts = {
  inbox: number;
  /** Heute faellig und ueberfaellig. */
  today: number;
  planned: number;
  projects: ReadonlyMap<string, number>;
};

export function listCounts(rows: readonly TaskRow[], today: string): ListCounts {
  const open = openTopLevel(rows);
  const projectIds = [
    ...new Set(open.map((row) => row.projectId).filter((id): id is string => Boolean(id))),
  ];
  return {
    inbox: open.filter((row) => !row.dueAt && !row.projectId).length,
    today: open.filter((row) => {
      const day = dueDayOf(row);
      return day !== null && day <= today;
    }).length,
    planned: open.filter((row) => dueDayOf(row) !== null).length,
    projects: new Map(
      projectIds.map((id) => [id, open.filter((row) => row.projectId === id).length]),
    ),
  };
}

export type Progress = { done: number; total: number };

/** Je Aufgabe: wie viele Teilaufgaben erledigt sind, von wie vielen. */
export function subtaskProgress(rows: readonly TaskRow[]): ReadonlyMap<string, Progress> {
  const parents = [
    ...new Set(rows.map((row) => row.parentId).filter((id): id is string => Boolean(id))),
  ];
  return new Map(
    parents.map((id) => {
      const children = rows.filter((row) => row.parentId === id);
      return [id, { done: children.filter((row) => row.done).length, total: children.length }];
    }),
  );
}

export function subtasksOf(rows: readonly TaskRow[], parentId: string): TaskRow[] {
  return sortTasks(
    rows.filter((row) => row.parentId === parentId),
    'manual',
  );
}

/** Neue Aufgaben kommen ans Ende der eigenen Reihenfolge. */
export function nextOrder(rows: readonly TaskRow[]): number {
  return rows.reduce((highest, row) => Math.max(highest, row.order ?? -1), -1) + 1;
}

export type TaskFilters = {
  overdue: boolean;
  noDate: boolean;
  priority: boolean;
  tag: string | null;
  projectId: string | null;
  includeDone: boolean;
};

export const NO_FILTERS: TaskFilters = {
  overdue: false,
  noDate: false,
  priority: false,
  tag: null,
  projectId: null,
  includeDone: false,
};

/** Ob ein Filter die Liste einschraenkt. „inkl. erledigt“ allein schraenkt nichts ein. */
export function hasActiveFilters(filters: TaskFilters): boolean {
  return (
    filters.overdue ||
    filters.noDate ||
    filters.priority ||
    filters.tag !== null ||
    filters.projectId !== null
  );
}

function normalize(text: string): string {
  return text.trim().toLocaleLowerCase('de');
}

/** Suche ueber Titel, Notiz, Tags und Projektname; Offenes vor Erledigtem. */
export function searchTasks(
  rows: readonly TaskRow[],
  query: string,
  filters: TaskFilters,
  today: string,
  projectNames: ReadonlyMap<string, string>,
): TaskRow[] {
  const needle = normalize(query);
  const hits = rows.filter((row) => {
    if (row.done && !filters.includeDone) return false;
    if (filters.overdue && !isOverdue(row, today)) return false;
    if (filters.noDate && row.dueAt) return false;
    if (filters.priority && priorityOf(row.priority) === 0) return false;
    if (filters.tag !== null && !hasTag(row, filters.tag)) return false;
    if (filters.projectId !== null && row.projectId !== filters.projectId) return false;
    if (needle.length === 0) return true;
    const project = row.projectId ? (projectNames.get(row.projectId) ?? '') : '';
    const haystack = [row.title, row.notes ?? '', ...(row.tags ?? []), project].join('\n');
    return normalize(haystack).includes(needle);
  });
  return sortTasks(hits, 'time').sort((a, b) => Number(a.done) - Number(b.done));
}
