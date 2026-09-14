import { createContext, useContext } from 'react';

import type { TaskRow } from '@/db';
import type { MenuAnchor, MenuEntry } from '@/ui';

import type { MetaOptions, MetaPart } from './meta';
import type { PostponeKind } from './postpone';
import type { QuickAddDefaults } from './quickAdd';

/** Misst die Zeile erst, wenn ein Menue wirklich aufgeht — nie beim Rendern. */
export type AnchorFn = () => Promise<MenuAnchor | null>;

export type RowMode = { dateMode: MetaOptions['dateMode']; showGroup: boolean };

/**
 * Was jede Zeile der Aufgaben braucht, ohne dass es durch jede Ansicht
 * gereicht werden muss: Zustand der Liste und die Handgriffe.
 */
export type TaskListEnv = {
  today: string;
  /** Abgehakt, aber noch nicht weg — 1,2 s lang. */
  completing: ReadonlySet<string>;
  /** `null` heisst: kein Auswahlmodus. */
  selection: ReadonlySet<string> | null;
  metaOf: (task: TaskRow, mode: RowMode) => MetaPart[];
  toggleDone: (task: TaskRow) => void;
  completeNow: (task: TaskRow) => void;
  open: (task: TaskRow) => void;
  toggleSelect: (task: TaskRow) => void;
  startSelection: (task: TaskRow) => void;
  plan: (tasks: readonly TaskRow[], anchor: AnchorFn) => void;
  /** Ein Tipp: neuer Tag ab heute, mit „Rückgängig“. */
  postpone: (task: TaskRow, kind: PostponeKind) => void;
  /** „Datum wählen …“: das Blatt mit Tag und Uhrzeit. */
  pickDate: (tasks: readonly TaskRow[]) => void;
  prioritize: (tasks: readonly TaskRow[], anchor: AnchorFn) => void;
  move: (tasks: readonly TaskRow[], anchor: AnchorFn) => void;
  duplicate: (task: TaskRow) => void;
  remove: (task: TaskRow) => void;
  reorder: (ids: readonly string[]) => void;
  setDragging: (active: boolean) => void;
  openMenu: (anchor: MenuAnchor, items: readonly MenuEntry[]) => void;
  addWith: (defaults: QuickAddDefaults) => void;
};

const TaskListContext = createContext<TaskListEnv | null>(null);

export const TaskListProvider = TaskListContext.Provider;

export function useTaskList(): TaskListEnv {
  const env = useContext(TaskListContext);
  if (!env) throw new Error('useTaskList braucht TaskListProvider.');
  return env;
}
