import {
  dayKey,
  projects as projectRepo,
  tasks as taskRepo,
  type ProjectRow,
  type TaskPriority,
  type TaskRow,
} from '@/db';
import { dueDayOf } from '@/db/taskFields';
import { useI18n } from '@/i18n';
import { useUndo } from '@/ui';

import { formatTaskDay } from './format';
import { dayLabel } from './labels';
import { postponeSchedule, postponeTarget, type PostponeKind } from './postpone';
import { nextDueDay } from './recurrence';
import { schedulePatch, type Schedule } from './schedule';

type Snapshot = Pick<
  TaskRow,
  | 'id'
  | 'dueAt'
  | 'dueTime'
  | 'reminderOffsetMinutes'
  | 'repeat'
  | 'priority'
  | 'projectId'
  | 'section'
>;

type Completion = { taskId: string; nextId: string | null; nextDay: string | null };

function snapshotOf(task: TaskRow): Snapshot {
  return {
    id: task.id,
    dueAt: task.dueAt,
    dueTime: task.dueTime ?? null,
    reminderOffsetMinutes: task.reminderOffsetMinutes ?? null,
    repeat: task.repeat ?? null,
    priority: task.priority ?? 0,
    projectId: task.projectId ?? null,
    section: task.section ?? null,
  };
}

async function restoreSnapshots(snapshots: readonly Snapshot[]) {
  await Promise.all(
    snapshots.map(({ id, ...fields }) =>
      taskRepo.update(id, {
        ...fields,
        dueTime: fields.dueTime ?? null,
        reminderOffsetMinutes: fields.reminderOffsetMinutes ?? null,
        repeat: fields.repeat ?? null,
        projectId: fields.projectId ?? null,
        section: fields.section ?? null,
      }),
    ),
  );
}

/** Abhaken, Planen, Loeschen und Co. — jedes mit „Rückgängig“ statt Rueckfrage. */
export function useTaskActions() {
  const undo = useUndo();
  const { t, language } = useI18n();

  async function completeOne(task: TaskRow): Promise<Completion> {
    await taskRepo.setDone(task.id, true);
    if (!task.repeat) return { taskId: task.id, nextId: null, nextDay: null };
    const nextDay = nextDueDay(task.repeat, dueDayOf(task), dayKey());
    const next = await taskRepo.duplicate(
      task.id,
      schedulePatch(task, { day: nextDay, time: task.dueTime ?? null }),
    );
    return { taskId: task.id, nextId: next?.id ?? null, nextDay };
  }

  async function undoCompletions(completions: readonly Completion[]) {
    await Promise.all(completions.map((entry) => taskRepo.setDone(entry.taskId, false)));
    for (const entry of completions) {
      if (entry.nextId) await taskRepo.removeTree(entry.nextId);
    }
  }

  async function complete(task: TaskRow) {
    const result = await completeOne(task);
    undo.show({
      message: result.nextDay
        ? t('tasks.toast.next', { date: formatTaskDay(language, result.nextDay) })
        : t('tasks.toast.done'),
      onUndo: () => void undoCompletions([result]),
    });
  }

  async function completeMany(tasks: readonly TaskRow[]) {
    const results: Completion[] = [];
    for (const task of tasks) results.push(await completeOne(task));
    undo.show({
      message: t('tasks.toast.doneMany', { count: results.length }),
      onUndo: () => void undoCompletions(results),
    });
  }

  async function reopen(task: TaskRow) {
    await taskRepo.setDone(task.id, false);
  }

  async function removeMany(tasks: readonly TaskRow[]) {
    const removed: TaskRow[] = [];
    for (const task of tasks) removed.push(...(await taskRepo.removeTree(task.id)));
    if (removed.length === 0) return;
    undo.show({
      message:
        tasks.length === 1
          ? t('tasks.toast.deleted')
          : t('tasks.toast.deletedMany', { count: tasks.length }),
      onUndo: () => void taskRepo.restore(removed),
    });
  }

  async function reschedule(
    tasks: readonly TaskRow[],
    targetOf: (task: TaskRow) => Schedule,
    messageOf: (day: string | null) => string,
  ) {
    const first = tasks[0];
    if (!first) return;
    const snapshots = tasks.map(snapshotOf);
    await Promise.all(
      tasks.map((task) => taskRepo.update(task.id, schedulePatch(task, targetOf(task)))),
    );
    undo.show({
      message: messageOf(targetOf(first).day),
      onUndo: () => void restoreSnapshots(snapshots),
    });
  }

  /** `target` fuer alle gleich, oder je Aufgabe — so behaelt „Morgen“ jede eigene Uhrzeit. */
  async function schedule(
    tasks: readonly TaskRow[],
    target: Schedule | ((task: TaskRow) => Schedule),
  ) {
    await reschedule(
      tasks,
      (task) => (typeof target === 'function' ? target(task) : target),
      (day) =>
        day
          ? t('tasks.toast.planned', { date: dayLabel(t, language, day, dayKey()) })
          : t('tasks.toast.unplanned'),
    );
  }

  /**
   * Verschieben ab dem echten Heute. Uhrzeit und Wiederholung bleiben — es
   * wandert nur diese eine Frist.
   */
  async function postpone(tasks: readonly TaskRow[], kind: PostponeKind) {
    const today = dayKey();
    const day = postponeTarget(kind, today);
    await reschedule(
      tasks,
      (task) => postponeSchedule(kind, today, task.dueTime ?? null),
      () => t('tasks.toast.postponed', { date: dayLabel(t, language, day, today) }),
    );
  }

  async function setPriority(tasks: readonly TaskRow[], priority: TaskPriority) {
    await Promise.all(tasks.map((task) => taskRepo.update(task.id, { priority })));
  }

  async function moveTo(tasks: readonly TaskRow[], project: ProjectRow | null) {
    const snapshots = tasks.map(snapshotOf);
    await Promise.all(
      tasks.map((task) =>
        taskRepo.update(task.id, { projectId: project?.id ?? null, section: null }),
      ),
    );
    undo.show({
      message: project ? t('tasks.toast.moved', { name: project.name }) : t('tasks.toast.movedOut'),
      onUndo: () => void restoreSnapshots(snapshots),
    });
  }

  async function duplicate(task: TaskRow) {
    const copy = await taskRepo.duplicate(task.id);
    if (!copy) return;
    undo.show({
      message: t('tasks.toast.duplicated'),
      onUndo: () => void taskRepo.removeTree(copy.id),
    });
  }

  /** Das Projekt geht, seine Aufgaben bleiben — ohne Projekt. */
  async function removeProject(project: ProjectRow, rows: readonly TaskRow[]) {
    const snapshots = rows.filter((row) => row.projectId === project.id).map(snapshotOf);
    await taskRepo.clearProject(project.id);
    await projectRepo.remove(project.id);
    undo.show({
      message: t('tasks.toast.projectDeleted'),
      onUndo: () => void projectRepo.restore(project).then(() => restoreSnapshots(snapshots)),
    });
  }

  return {
    complete,
    completeMany,
    reopen,
    remove: (task: TaskRow) => removeMany([task]),
    removeMany,
    schedule,
    postpone,
    setPriority,
    moveTo,
    duplicate,
    removeProject,
  };
}

export type TaskActions = ReturnType<typeof useTaskActions>;
