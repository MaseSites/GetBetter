import { threadStates, type ThreadTimed } from './threadState';

/**
 * Die drei Ansichten der Startseite — rein gerechnet, getestet in
 * `homeView.test.ts`.
 *
 * - `list`  — alles untereinander, wie bisher
 * - `grid`  — kleine Kacheln: Heute, Aufgaben, Notizen, Neuigkeiten, Schnellzugriff
 * - `focus` — nur, was jetzt dran ist, und die Aufgaben von heute
 * - `custom` — selbst gebaut: der Baukasten (`homeLayout.ts`)
 */
export const HOME_VIEWS = ['list', 'grid', 'focus', 'custom'] as const;
export type HomeView = (typeof HOME_VIEWS)[number];
export const DEFAULT_HOME_VIEW: HomeView = 'list';

/** Je Konto auf dem Geraet gemerkt. */
export function homeViewKey(accountId: string): string {
  return `home.view.${accountId}`;
}

/** Was gespeichert war — alles Unbekannte ist die erste Ansicht. */
export function parseHomeView(raw: string | null | undefined): HomeView {
  return HOME_VIEWS.find((view) => view === raw) ?? DEFAULT_HOME_VIEW;
}

/** Was heute noch kommt oder gerade laeuft, der Reihe nach, hoechstens `limit`. */
export function upcomingOf<T extends ThreadTimed>(
  entries: readonly T[],
  now: Date,
  limit: number,
): T[] {
  const states = threadStates(entries, now);
  return entries.filter((_, index) => states[index] !== 'past').slice(0, limit);
}

/**
 * Worum es jetzt geht: der Eintrag, der gerade laeuft — sonst der naechste.
 * Null, wenn heute nichts mehr kommt.
 */
export function focusOf<T extends ThreadTimed>(
  entries: readonly T[],
  now: Date,
): { entry: T; running: boolean } | null {
  const states = threadStates(entries, now);
  const live = states.indexOf('live');
  const index = live === -1 ? states.indexOf('next') : live;
  const entry = index === -1 ? undefined : entries[index];
  return entry ? { entry, running: live !== -1 } : null;
}
