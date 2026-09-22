import { callService, type ServiceCall } from './service';

/**
 * Better Fit: Aenderungen melden, Sprache mitschicken. Geteilt von
 * `fit.ts`, `fitDiary.ts`, `fitKitchen.ts` und `fitTraining.ts`.
 */

/** Bereiche, nach denen neu geladen wird. `all` trifft jede Ansicht. */
export type FitTopic = 'all' | 'profile' | 'diary' | 'kitchen' | 'training';

type Listener = { run: () => void; topics: readonly FitTopic[] | null };

const listeners = new Set<Listener>();

/**
 * Nach einer Aenderung laden die offenen Ansichten neu — ohne `topics` jede,
 * sonst nur die, deren Bereich betroffen ist (oder bei `all`).
 */
export function onFitChanged(run: () => void, topics?: readonly FitTopic[]): () => void {
  const listener: Listener = { run, topics: topics && topics.length > 0 ? topics : null };
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Meldet eine gelungene Aenderung im Bereich `topic`. */
export function notifyFitChanged(topic: FitTopic): void {
  for (const listener of listeners) {
    if (topic === 'all' || !listener.topics || listener.topics.includes(topic)) listener.run();
  }
}

/** `changed(result)` fuer einen Bereich: meldet nur, wenn es geklappt hat. */
export function changedFor(topic: FitTopic) {
  return function changed<T>(result: ServiceCall<T>): ServiceCall<T> {
    if (result.ok) notifyFitChanged(topic);
    return result;
  };
}

/** Ein Schluessel je Absicht — derselbe zweimal geschickt legt nichts doppelt an. */
export function idempotencyKey(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 12);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export const q = (value: string) => encodeURIComponent(value);

let language = 'de';

/** Die Sprache des Kontos — der Dienst nennt Lebensmittel, Rezepte und Uebungen darin. */
export function setFitLanguage(next: string): void {
  if (next === language) return;
  language = next;
  // Offene Ansichten holen ihre Inhalte in der neuen Sprache.
  notifyFitChanged('all');
}

/** `callService` mit `Accept-Language`, damit Inhalte in der Sprache der Person kommen. */
export function fitCall<T>(
  path: string,
  init?: Parameters<typeof callService>[1],
): Promise<ServiceCall<T>> {
  return callService<T>(path, {
    ...init,
    method: init?.method ?? 'GET',
    headers: { 'Accept-Language': language, ...(init?.headers ?? {}) },
  });
}
