/**
 * Favoriten und Schnellzugriff, ohne Speicher und ohne Oberflaeche.
 *
 * Ein Favorit ist ein Schluessel `appId:moduleId`. Die App gehoert dazu, weil
 * dasselbe Modul in zwei Apps stehen kann: den Kalender fuehrt GetBetter privat
 * und BetterFamily fuer die Familie. Die Reihenfolge der Liste ist die
 * Reihenfolge im Karussell — neu Hinzugefuegtes kommt ans Ende.
 *
 * Bewusst ohne Importe aus `app/identity` oder `mocks/modules`: die ziehen Expo
 * nach sich. Wer rechnet, bekommt die Tabellen als `ModuleCatalog` mitgegeben —
 * so laeuft die Datei auch in den Tests unter Node.
 */

export const FAVORITE_SEPARATOR = ':';

export type FavoriteRef = { appId: string; moduleId: string };

/** Was ein Modul mindestens mitbringt. */
export type ModuleLike = { id: string };

/** Die Tabellen, aus denen sich ergibt, was man favorisieren kann. */
export type ModuleCatalog<M extends ModuleLike, A extends string = string> = {
  /** Alle Apps in fester Reihenfolge (`APP_IDS`). */
  appIds: readonly A[];
  /** Welche App welche Module fuehrt (`APP_MODULES`). */
  appModules: Readonly<Record<A, readonly string[]>>;
  /** Was wirklich etwas tut (`BUILT_MODULE_IDS`). */
  builtIds: readonly string[];
  /** Die Definitionen (`MODULES`). */
  modules: readonly M[];
};

/** Die Module einer App, die man als Favorit anbieten kann. */
export type AppModules<M extends ModuleLike, A extends string = string> = {
  appId: A;
  modules: readonly M[];
};

/** Ein Favorit, den es wirklich gibt — eine Karte im Karussell. */
export type FavoriteEntry<M extends ModuleLike, A extends string = string> = {
  key: string;
  appId: A;
  module: M;
};

export function favoriteKey(appId: string, moduleId: string): string {
  return `${appId}${FAVORITE_SEPARATOR}${moduleId}`;
}

/** Liest einen Schluessel; `null`, wenn er nicht die Form `appId:moduleId` hat. */
export function parseFavoriteKey(key: string): FavoriteRef | null {
  const parts = key.split(FAVORITE_SEPARATOR);
  const [appId, moduleId] = parts;
  if (parts.length !== 2 || !appId || !moduleId) return null;
  return { appId, moduleId };
}

/** Ohne Doppelte und ohne kaputte Eintraege; die Reihenfolge bleibt. */
export function cleanFavorites(keys: readonly string[]): string[] {
  return keys.filter((key, index) => parseFavoriteKey(key) !== null && keys.indexOf(key) === index);
}

export function hasFavorite(keys: readonly string[], key: string): boolean {
  return keys.includes(key);
}

/** Fehlt der Schluessel, kommt er ans Ende; ist er da, faellt er weg. Gibt eine neue Liste zurueck. */
export function toggleFavorite(keys: readonly string[], key: string): string[] {
  const clean = cleanFavorites(keys);
  if (parseFavoriteKey(key) === null) return clean;
  return clean.includes(key) ? clean.filter((entry) => entry !== key) : [...clean, key];
}

/** Die laufende App zuerst, dann die freigeschalteten in der festen Reihenfolge. */
export function reachableApps<A extends string>(
  appIds: readonly A[],
  current: string,
  unlocked: readonly string[],
): A[] {
  const own = appIds.filter((id) => id === current);
  const others = appIds.filter((id) => id !== current && unlocked.includes(id));
  return [...own, ...others];
}

/** Die gebauten Module einer App, in der Reihenfolge, in der die App sie fuehrt. */
export function builtModulesOf<M extends ModuleLike, A extends string>(
  catalog: ModuleCatalog<M, A>,
  appId: A,
): M[] {
  const ids: readonly string[] | undefined = catalog.appModules[appId];
  return (ids ?? []).flatMap((id) => {
    if (!catalog.builtIds.includes(id)) return [];
    const module = catalog.modules.find((entry) => entry.id === id);
    return module ? [module] : [];
  });
}

/** Was man hinzufuegen kann: je erreichbare App ihre gebauten Module, leere Apps fallen weg. */
export function availableModules<M extends ModuleLike, A extends string>(
  catalog: ModuleCatalog<M, A>,
  current: string,
  unlocked: readonly string[],
): AppModules<M, A>[] {
  return reachableApps(catalog.appIds, current, unlocked)
    .map((appId) => ({ appId, modules: builtModulesOf(catalog, appId) }))
    .filter((group) => group.modules.length > 0);
}

/**
 * Die Favoriten als Karten, in ihrer Reihenfolge. Was es nicht (mehr) gibt oder
 * nicht gebaut ist, faellt weg — die gespeicherte Liste bleibt unberuehrt.
 */
export function resolveFavorites<M extends ModuleLike, A extends string>(
  keys: readonly string[],
  catalog: ModuleCatalog<M, A>,
): FavoriteEntry<M, A>[] {
  return cleanFavorites(keys).flatMap((key) => {
    const ref = parseFavoriteKey(key);
    const appId = catalog.appIds.find((id) => id === ref?.appId);
    if (!ref || appId === undefined) return [];
    const module = builtModulesOf(catalog, appId).find((entry) => entry.id === ref.moduleId);
    return module ? [{ key, appId, module }] : [];
  });
}
