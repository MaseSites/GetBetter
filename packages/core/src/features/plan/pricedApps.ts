import { DEFAULT_PRICED_APPS } from './prices';

/**
 * Welche Apps ein Abo haben, wie es der Dienst zuletzt gesagt hat. Bis er
 * antwortet, gelten die Preise aus `prices.ts`. Lebt ausserhalb von React,
 * damit `AppProvider` es per `useSyncExternalStore` lesen kann.
 */
let current: readonly string[] = DEFAULT_PRICED_APPS;
const listeners = new Set<() => void>();

export function pricedApps(): readonly string[] {
  return current;
}

/** Aus `GET /v1/plans`. Unsinn zaehlt nicht; gleiche Liste weckt niemanden. */
export function rememberPricedApps(apps: unknown): void {
  if (!Array.isArray(apps)) return;
  const next = apps.filter((app): app is string => typeof app === 'string');
  if (next.length === current.length && next.every((app, index) => app === current[index])) return;
  current = next;
  for (const listener of listeners) listener();
}

export function onPricedAppsChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
