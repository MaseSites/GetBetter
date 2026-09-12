import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';

import { appUrl } from '@/app/bridge';
import { APP_IDS, APP_MODULES, APPS, currentApp, type AppId } from '@/app/identity';
import { useLiveQuery } from '@/db';
import { appAccess } from '@/db/appAccess';
import { BUILT_MODULE_IDS, MODULES } from '@/mocks/modules';
import type { ModuleDefinition } from '@/mocks/types';
import { useApp } from '@/state/AppContext';

import {
  availableModules,
  cleanFavorites,
  favoriteKey,
  resolveFavorites,
  toggleFavorite,
  type AppModules,
  type FavoriteEntry,
  type ModuleCatalog,
} from './favorites';

const CATALOG: ModuleCatalog<ModuleDefinition, AppId> = {
  appIds: APP_IDS,
  appModules: APP_MODULES,
  builtIds: BUILT_MODULE_IDS,
  modules: MODULES,
};

export type QuickEntry = FavoriteEntry<ModuleDefinition, AppId>;
export type QuickGroup = AppModules<ModuleDefinition, AppId>;

export type Favorites = {
  /** Die gespeicherten Schluessel `appId:moduleId`, in der gewaehlten Reihenfolge. */
  keys: readonly string[];
  /** Was es davon gibt — die Karten im Karussell, die Zeilen unter „Favoriten“. */
  entries: readonly QuickEntry[];
  /** Was man hinzufuegen kann: diese App zuerst, dann die freigeschalteten. */
  available: readonly QuickGroup[];
  /** Die laufende App. */
  currentAppId: AppId;
  isFavorite: (appId: AppId, moduleId: string) => boolean;
  toggle: (appId: AppId, moduleId: string) => void;
  /** Eigene App: die volle Ansicht; andere App: per Tiefenlink dorthin. */
  open: (appId: AppId, moduleId: string) => void;
};

/** Der Name einer Better-App, fuer die kleine Zeile unter einer fremden Karte. */
export function appNameOf(appId: AppId): string {
  return APPS[appId].name;
}

/**
 * Die gemeinsame Rechnung hinter beiden Listen. Sie sind gleich gebaut —
 * Schluessel `appId:moduleId` am Konto —, meinen aber Verschiedenes: Favoriten
 * sind die Sterne in „Bereiche“, der Schnellzugriff ist das Karussell.
 */
function useList(
  stored: readonly string[] | undefined,
  save: (keys: readonly string[]) => Promise<void>,
): Favorites {
  const router = useRouter();
  const { account } = useApp();
  const accountId = account?.id ?? null;
  const currentAppId = currentApp().id;

  const unlocked = useLiveQuery(
    () => (accountId ? appAccess.appsOf(accountId) : Promise.resolve<string[]>([])),
    [accountId],
  );

  const keys = cleanFavorites(stored ?? []);
  // Aufgeloest wird ueber alle Apps: sonst verschwaenden fremde Karten kurz,
  // bis die Freischaltungen geladen sind.
  const entries = resolveFavorites(keys, CATALOG);
  const available = availableModules(CATALOG, currentAppId, unlocked.data ?? []);

  function isFavorite(appId: AppId, moduleId: string): boolean {
    return keys.includes(favoriteKey(appId, moduleId));
  }

  function toggle(appId: AppId, moduleId: string) {
    void save(toggleFavorite(keys, favoriteKey(appId, moduleId)));
  }

  function open(appId: AppId, moduleId: string) {
    if (appId === currentAppId) {
      router.push(`/run/${moduleId}`);
      return;
    }
    // `appUrl` endet schon mit `/` (Browser) oder `scheme://` (Geraet).
    void Linking.openURL(`${appUrl(appId)}run/${moduleId}`);
  }

  return { keys, entries, available, currentAppId, isFavorite, toggle, open };
}

/**
 * Die Favoriten des Kontos — die Sterne in „Bereiche“ und der Tab daneben.
 * Gespeichert am Konto (`account.favorites`), damit dieselbe Auswahl in jeder
 * Better-App gilt.
 */
export function useFavorites(): Favorites {
  const { account, setFavorites } = useApp();
  return useList(account?.favorites, setFavorites);
}

/**
 * Der Schnellzugriff auf der Startseite (`account.quickAccess`) — eine eigene
 * Liste. Was man oft braucht, ist nicht dasselbe wie was man mag: eine Karte
 * ins Karussell zu legen macht daraus keinen Favoriten. Hinzufuegen laesst
 * sich nur, was die laufende App oder eine App fuehrt, in der das Konto schon
 * angemeldet war (`appAccess`).
 */
export function useQuickAccess(): Favorites {
  const { account, setQuickAccess } = useApp();
  return useList(account?.quickAccess, setQuickAccess);
}
