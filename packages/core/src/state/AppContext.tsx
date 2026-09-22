import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Platform, useColorScheme } from 'react-native';

import {
  changeUsername,
  findAccount,
  signIn as signInAccount,
  signUp as signUpAccount,
  updateAccount,
  type AuthResult,
  type UsernameSave,
} from '@/auth/accounts';
import {
  db,
  flush,
  households as householdRepo,
  notifyDataChanged,
  ready,
  type Account,
  type HouseholdRole,
  type HouseholdRow,
  type JoinResult,
  type WeatherPlace,
} from '@/db';
import { adminFieldsChanged } from '@/app/access';
import { currentApp } from '@/app/identity';
import {
  REDEEM_PATH,
  beginViewing,
  isViewing,
  onViewChange,
  viewFailed,
  viewState,
  viewTicketOf,
  viewingAccount,
  withoutViewParam,
  type ViewState,
} from '@/app/viewMode';
import { appAccess } from '@/db/appAccess';
import { subscribeDataChanged } from '@/db/events';
import { setFitLanguage } from '@/db/fitEvents';
import { callService, fetchAccount, type RemoteAccount } from '@/db/service';
import { clearSessionToken, restoreSessionToken, setSessionToken } from '@/db/sessionToken';
import { setSpeaker } from '@/features/assistant/cloudVoice';
import { normalizeAvatar, type AvatarStyle } from '@/features/avatar/style';
import { effectivePersonalization, type Personalization } from '@/features/plan/entitlement';
import { onPricedAppsChange, pricedApps } from '@/features/plan/pricedApps';
import { placesOf, withPlaceFirst } from '@/features/weather/places';
import { I18nProvider, translate, type Language, type Translate } from '@/i18n';
import type { Area } from '@/mocks/types';
import {
  ThemeProvider,
  createTheme,
  type AccentKey,
  type ColorScheme,
  type ThemePreset,
} from '@/theme';

const SESSION_KEY = 'better-life/session/v1';

/** Das Ticket aus `?view=…` — nur im Browser, wo der Admin die App einbettet. */
function viewTicketFromLocation(): string | null {
  if (Platform.OS !== 'web') return null;
  const location = (globalThis as { location?: { search?: string } }).location;
  return viewTicketOf(location?.search);
}

type HistoryScope = {
  location?: { href: string };
  history?: { state: unknown; replaceState: (state: unknown, unused: string, url: string) => void };
};

/** Das Ticket verschwindet aus der Adresse — es gilt ohnehin nur einmal. */
function forgetViewTicket(): void {
  const scope = globalThis as HistoryScope;
  if (!scope.location || !scope.history) return;
  scope.history.replaceState(scope.history.state, '', withoutViewParam(scope.location.href));
}

/**
 * Das Konto hinter einem Ticket aus dem Admin, oder null. Es lebt nur im
 * Arbeitsspeicher: keine Sitzung auf dem Geraet, kein `appAccess`.
 */
async function redeemView(ticket: string | null): Promise<Account | null> {
  if (!ticket) return null;
  const result = await callService<{ account: RemoteAccount; token?: string }>(REDEEM_PATH, {
    method: 'POST',
    body: { ticket },
  });
  forgetViewTicket();
  if (!result.ok) return null;
  // Nur lesen und nur im Arbeitsspeicher — die eigene Sitzung auf dem Geraet bleibt.
  if (typeof result.data.token === 'string') {
    await setSessionToken(result.data.token, { persist: false });
  }
  return (await findAccount(result.data.account.id)) ?? null;
}

export type AppContextValue = {
  /** Das angemeldete Konto, oder null. */
  account: Account | null;
  /** „App ansehen“ aus dem Admin: nur lesen, das Konto nur im Arbeitsspeicher. */
  view: ViewState;
  /** Der Haushalt des Kontos, oder null. */
  household: HouseholdRow | null;
  /** Rolle im Haushalt. Verwalter duerfen aendern. */
  role: HouseholdRole | null;
  /** Solange Datenbank und Sitzung geladen werden. */
  hydrated: boolean;
  /** Die gemeinsame Datenbank antwortet nicht. */
  offline: boolean;
  retry: () => Promise<void>;
  colorScheme: ColorScheme;

  signIn: (email: string, password: string) => Promise<AuthResult>;
  /** `username` ist der Kontoname, den man schon beim Registrieren setzt. */
  signUp: (email: string, password: string, username?: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  /** Ein Konto uebernehmen, das aus einer anderen Better-App kommt. */
  adoptAccount: (account: Account) => Promise<void>;

  completeOnboarding: (input: { firstName: string; areas: readonly Area[] }) => Promise<void>;

  setLanguage: (language: Language) => Promise<void>;
  /** Aussehen: was nicht mitgegeben wird, bleibt wie es ist. */
  appearance: Appearance;
  /**
   * Aussehen und Assistent, wie sie gelten: ohne Abo der Standard, nur hell
   * oder dunkel bleibt frei. Gelesen wird hier, nie direkt am Konto.
   */
  personal: Personalization;
  setAppearance: (patch: Partial<Appearance>) => Promise<void>;
  /** Der Ort fuers Wetter, am Konto gespeichert: holt ihn in der Liste nach vorne. */
  setWeatherPlace: (place: WeatherPlace) => Promise<void>;
  /** Die gemerkten Orte fuers Wetter, in der Reihenfolge der Liste — nie leer, hoechstens 20. */
  weatherPlaces: readonly WeatherPlace[];
  /**
   * Die Orte umbauen. `change` bekommt den frischen Stand aus der Ablage; der
   * erste Ort wird zugleich `weatherPlace`, den die Startseite zeigt.
   */
  updateWeatherPlaces: (
    change: (places: readonly WeatherPlace[]) => readonly WeatherPlace[],
  ) => Promise<void>;
  /** Schnellzugriff und Favoriten (`appId:moduleId`), in dieser Reihenfolge. */
  setFavorites: (keys: readonly string[]) => Promise<void>;
  /** Der Schnellzugriff — eine eigene Liste neben den Favoriten. */
  setQuickAccess: (keys: readonly string[]) => Promise<void>;
  /** Wie der Assistent heisst. */
  setAssistantName: (name: string) => Promise<void>;
  /** Mit welcher Stimme er spricht (`voiceURI`); leer heisst: die erste passende. */
  setAssistantVoice: (voiceUri: string) => Promise<void>;
  /** Wie sein Avatar aussieht — gilt in allen Apps. */
  setAssistantAvatar: (style: AvatarStyle) => Promise<void>;
  /** Der Spitzname, mit dem die App dich anspricht. */
  setFirstName: (name: string) => Promise<void>;
  /**
   * Der Kontoname (`@name`), unter dem andere dich finden. Das letzte Wort hat
   * der Dienst — darum sagt der Rueckgabewert, ob es geklappt hat.
   */
  setUsername: (name: string) => Promise<UsernameSave>;
  /** Der Hintergrund: `app`, ein Schluessel aus `BACKDROPS` oder `upload:<id>`. */
  setBackdrop: (key: string) => Promise<void>;

  createHousehold: (name: string) => Promise<boolean>;
  switchHousehold: (householdId: string) => Promise<void>;
  joinHousehold: (code: string) => Promise<JoinResult>;
  leaveHousehold: () => Promise<void>;
  /** Nach Aenderungen im Haushalt: Konto und Haushalt neu laden. */
  refreshHousehold: () => Promise<void>;
};

/** Die drei Regler fuer das Aussehen. */
export type Appearance = {
  mode: 'light' | 'dark' | 'system';
  accent: AccentKey;
  preset: ThemePreset;
};

function appearanceOf(personal: Personalization): Appearance {
  return { mode: personal.mode, accent: personal.accent, preset: personal.preset };
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [household, setHousehold] = useState<HouseholdRow | null>(null);
  const [role, setRole] = useState<HouseholdRole | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [offline, setOffline] = useState(false);
  const view = useSyncExternalStore(onViewChange, viewState, viewState);
  const systemScheme = useColorScheme();
  const priced = useSyncExternalStore(onPricedAppsChange, pricedApps, pricedApps);
  // Ohne Abo gilt der Standard — gespeichert bleibt, was einmal gewaehlt war.
  const personal = useMemo(() => effectivePersonalization(account, priced), [account, priced]);
  const canPersonalize = personal.canPersonalize;
  // Eigene Konstante, sonst haengt der ganze Kontext an jedem Rendern.
  const appearance = useMemo(() => appearanceOf(personal), [personal]);
  const colorScheme: ColorScheme =
    appearance.mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : appearance.mode;

  // Die Stimmen von ElevenLabs zaehlen fuer das angemeldete Konto (im Admin je Konto).
  const speakerId = account?.id ?? null;
  useEffect(() => {
    setSpeaker(speakerId);
  }, [speakerId]);

  // Sitzung wiederherstellen: Datenbank laden, dann das gemerkte Konto holen.
  const hydrate = useCallback(async () => {
    setHydrated(false);
    setOffline(false);
    const ticket = viewTicketFromLocation();
    // Nur ansehen: ab sofort, noch vor der ersten Anfrage — so geht nie etwas hinaus.
    if (ticket) beginViewing();
    try {
      await ready();
    } catch {
      // Ohne Datenbank hat es keinen Sinn weiterzumachen — das sagen wir auch.
      setOffline(true);
      setHydrated(true);
      return;
    }
    try {
      if (isViewing()) {
        // Nie das eigene, gemerkte Konto: entweder das angesehene oder keines.
        const viewed = await redeemView(ticket);
        if (!viewed) {
          viewFailed();
          return;
        }
        viewingAccount(viewed.username);
        setAccount(viewed);
        const [hh, memberRole] = await loadHousehold(viewed);
        setHousehold(hh);
        setRole(memberRole);
        return;
      }
      const id = await AsyncStorage.getItem(SESSION_KEY);
      await restoreSessionToken();
      if (id) {
        const found = await findAccount(id);
        if (!found) await AsyncStorage.removeItem(SESSION_KEY);
        if (found) {
          setAccount(found);
          // Auch beim Wiederherstellen: die App gilt als freigeschaltet.
          void appAccess.markSeen(found.id, currentApp().id);
          const [hh, memberRole] = await loadHousehold(found);
          setHousehold(hh);
          setRole(memberRole);
        }
      }
    } catch {
      // Ohne Sitzung startet die App einfach beim Anmelden.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    // Der Effekt startet nur das Laden; die Zustaende setzt der Rueckweg.
    const timer = setTimeout(() => void hydrate(), 0);
    return () => clearTimeout(timer);
  }, [hydrate]);

  const remember = useCallback(async (next: Account) => {
    // Nur ansehen: kein anderes Konto uebernehmen, nichts auf dem Geraet merken.
    if (isViewing()) return;
    setAccount(next);
    // Damit GetBetter weiss, welche Apps freigeschaltet sind.
    void appAccess.markSeen(next.id, currentApp().id);
    const [hh, memberRole] = await loadHousehold(next);
    setHousehold(hh);
    setRole(memberRole);
    await AsyncStorage.setItem(SESSION_KEY, next.id);
  }, []);

  const refreshHousehold = useCallback(async () => {
    if (!account) return;
    const fresh = (await findAccount(account.id)) ?? account;
    setAccount(fresh);
    const [hh, memberRole] = await loadHousehold(fresh);
    setHousehold(hh);
    setRole(memberRole);
  }, [account]);

  const signIn = useCallback<AppContextValue['signIn']>(
    async (email, password) => {
      const result = await signInAccount(email, password);
      if (result.ok) await remember(result.account);
      return result;
    },
    [remember],
  );

  const signUp = useCallback<AppContextValue['signUp']>(
    async (email, password, username) => {
      const result = await signUpAccount(email, password, username);
      if (result.ok) await remember(result.account);
      return result;
    },
    [remember],
  );

  const adoptAccount = useCallback<AppContextValue['adoptAccount']>(
    async (next: Account) => {
      await remember(next);
    },
    [remember],
  );

  const signOut = useCallback(async () => {
    // Beim Ansehen gehoert die Sitzung auf dem Geraet jemand anderem — sie bleibt, wie sie ist.
    if (!isViewing()) {
      await flush();
      await AsyncStorage.removeItem(SESSION_KEY);
      // Das Token gilt danach auch beim Dienst nicht mehr.
      await callService('/v1/sessions/current', { method: 'DELETE' });
      await clearSessionToken();
    }
    setAccount(null);
    setHousehold(null);
    setRole(null);
  }, []);

  // Im Admin geloescht: nach dem naechsten Abgleich fehlt die eigene Zeile.
  // Abgemeldet wird erst, wenn der Dienst selbst „gibt es nicht“ sagt — ein
  // Aussetzer im Netz meldet nie ab. Ohne `flush`: was noch aussteht, gehoert
  // einem Konto, das es nicht mehr gibt.
  useEffect(() => {
    // Beim Ansehen nie an die Sitzung auf dem Geraet: sie ist nicht die des angesehenen Kontos.
    if (!account || view.active) return;
    const accountId = account.id;
    let active = true;
    let checking = false;
    const check = async () => {
      if (checking) return;
      checking = true;
      try {
        const stored = await db.accounts.find(accountId);
        if (stored) {
          // Abo, Sperre oder Apps hat der Admin geaendert: das gilt ab diesem Abgleich.
          if (active) {
            setAccount((current) =>
              current?.id === stored.id && adminFieldsChanged(current, stored) ? stored : current,
            );
          }
          return;
        }
        const remote = await fetchAccount(accountId);
        if (!active || remote.ok || remote.error !== 'not_found') return;
        await AsyncStorage.removeItem(SESSION_KEY);
        await clearSessionToken();
        setAccount(null);
        setHousehold(null);
        setRole(null);
      } catch {
        // Beim naechsten Abgleich nochmal.
      } finally {
        checking = false;
      }
    };
    const unsubscribe = subscribeDataChanged(() => void check());
    return () => {
      active = false;
      unsubscribe();
    };
  }, [account, view.active]);

  const completeOnboarding = useCallback<AppContextValue['completeOnboarding']>(
    async ({ firstName, areas }) => {
      if (!account) return;
      const updated = await updateAccount(account.id, {
        firstName: firstName.trim(),
        selectedAreas: areas,
        onboarded: true,
      });
      // Ein neues Konto startet bewusst leer.
      if (updated) setAccount(updated);
      const fresh = (await findAccount(account.id)) ?? updated ?? account;
      setAccount(fresh);
      const [hh, memberRole] = await loadHousehold(fresh);
      setHousehold(hh);
      setRole(memberRole);
      notifyDataChanged();
    },
    [account],
  );

  const setLanguage = useCallback(
    async (language: Language) => {
      if (!account) return;
      const updated = await updateAccount(account.id, { language });
      if (updated) setAccount(updated);
    },
    [account],
  );

  const setAppearance = useCallback<AppContextValue['setAppearance']>(
    async (patch) => {
      if (!account) return;
      // Hell oder dunkel geht immer; Farben nur mit Abo — der Dienst wiese sie sonst ab.
      const changes = {
        ...(patch.mode ? { themeMode: patch.mode } : {}),
        ...(patch.accent && canPersonalize ? { accentKey: patch.accent } : {}),
        ...(patch.preset && canPersonalize ? { themePreset: patch.preset } : {}),
      };
      if (Object.keys(changes).length === 0) return;
      const updated = await updateAccount(account.id, changes);
      if (updated) setAccount(updated);
    },
    [account, canPersonalize],
  );

  // Aeltere Konten kennen nur `weatherPlace` — `placesOf` zieht ihn beim Lesen in die Liste.
  const weatherPlaces = useMemo(() => placesOf(account), [account]);

  const updateWeatherPlaces = useCallback<AppContextValue['updateWeatherPlaces']>(
    async (change) => {
      if (!account) return;
      // Frisch aus der Ablage, nicht aus dem letzten Rendern: zwei schnelle
      // Aenderungen (Entfernen, dann Rückgängig) sollen sich nicht ueberschreiben.
      const fresh = (await db.accounts.find(account.id)) ?? account;
      const next = change(placesOf(fresh));
      const first = next[0];
      if (!first) return;
      const updated = await updateAccount(account.id, {
        weatherPlaces: [...next],
        weatherPlace: first,
      });
      if (updated) setAccount(updated);
    },
    [account],
  );

  const setWeatherPlace = useCallback<AppContextValue['setWeatherPlace']>(
    (place) => updateWeatherPlaces((places) => withPlaceFirst(places, place)),
    [updateWeatherPlaces],
  );

  const setFavorites = useCallback<AppContextValue['setFavorites']>(
    async (keys) => {
      if (!account) return;
      const updated = await updateAccount(account.id, { favorites: [...keys] });
      if (updated) setAccount(updated);
    },
    [account],
  );

  const setAssistantVoice = useCallback<AppContextValue['setAssistantVoice']>(
    async (voiceUri) => {
      // Ohne Abo spricht die beste Stimme — gewaehlt wird erst mit Abo.
      if (!account || !canPersonalize) return;
      const updated = await updateAccount(account.id, { assistantVoice: voiceUri });
      if (updated) setAccount(updated);
    },
    [account, canPersonalize],
  );

  const setAssistantAvatar = useCallback<AppContextValue['setAssistantAvatar']>(
    async (style) => {
      if (!account || !canPersonalize) return;
      // Nur, was gueltig ist — der Dienst wiese alles andere ohnehin ab.
      const updated = await updateAccount(account.id, { assistantAvatar: normalizeAvatar(style) });
      if (updated) setAccount(updated);
    },
    [account, canPersonalize],
  );

  const setQuickAccess = useCallback<AppContextValue['setQuickAccess']>(
    async (keys) => {
      if (!account) return;
      const updated = await updateAccount(account.id, { quickAccess: [...keys] });
      if (updated) setAccount(updated);
    },
    [account],
  );

  const setAssistantName = useCallback<AppContextValue['setAssistantName']>(
    async (name) => {
      if (!account || !canPersonalize) return;
      const updated = await updateAccount(account.id, { assistantName: name.trim() });
      if (updated) setAccount(updated);
    },
    [account, canPersonalize],
  );

  const setBackdrop = useCallback<AppContextValue['setBackdrop']>(
    async (key) => {
      if (!account || !canPersonalize) return;
      const updated = await updateAccount(account.id, { backdrop: key });
      if (updated) setAccount(updated);
    },
    [account, canPersonalize],
  );

  const setFirstName = useCallback<AppContextValue['setFirstName']>(
    async (name) => {
      if (!account) return;
      const updated = await updateAccount(account.id, { firstName: name.trim() });
      if (updated) setAccount(updated);
    },
    [account],
  );

  const setUsername = useCallback<AppContextValue['setUsername']>(
    async (name) => {
      if (!account) return 'offline';
      const result = await changeUsername(account.id, name);
      if (result !== 'ok') return result;
      const fresh = await findAccount(account.id);
      if (fresh) setAccount(fresh);
      return 'ok';
    },
    [account],
  );

  const createHousehold = useCallback(
    async (name: string) => {
      if (!account) return false;
      const created = await householdRepo.create(account.id, name);
      await refreshHousehold();
      return created !== null;
    },
    [account, refreshHousehold],
  );

  const switchHousehold = useCallback(
    async (householdId: string) => {
      if (!account) return;
      await householdRepo.setActive(account.id, householdId);
      await refreshHousehold();
    },
    [account, refreshHousehold],
  );

  const joinHousehold = useCallback<AppContextValue['joinHousehold']>(
    async (code) => {
      if (!account) return { ok: false, error: 'code_unknown' };
      const result = await householdRepo.join(account.id, code);
      if (result.ok) await refreshHousehold();
      return result;
    },
    [account, refreshHousehold],
  );

  const leaveHousehold = useCallback(async () => {
    if (!account || !household) return;
    await householdRepo.leave(household.id, account.id);
    await refreshHousehold();
  }, [account, household, refreshHousehold]);

  const language = (account?.language ?? 'de') as Language;
  // Better Fit nennt Lebensmittel, Rezepte und Uebungen in dieser Sprache — als
  // Layout-Effekt, der vor den Effekten der Kinder laeuft; sonst ginge die erste
  // Abfrage noch in der alten Sprache hinaus.
  useLayoutEffect(() => {
    setFitLanguage(language);
  }, [language]);

  const t = useMemo<Translate>(() => (key, values) => translate(language, key, values), [language]);

  const theme = useMemo(
    () => createTheme(colorScheme, appearance.accent, appearance.preset),
    [colorScheme, appearance.accent, appearance.preset],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      account,
      view,
      household,
      role,
      hydrated,
      offline,
      retry: hydrate,
      colorScheme,
      signIn,
      signUp,
      signOut,
      adoptAccount,
      completeOnboarding,
      setLanguage,
      appearance,
      personal,
      setAppearance,
      setWeatherPlace,
      weatherPlaces,
      updateWeatherPlaces,
      setFavorites,
      setQuickAccess,
      setAssistantName,
      setAssistantVoice,
      setAssistantAvatar,
      setFirstName,
      setUsername,
      setBackdrop,
      createHousehold,
      switchHousehold,
      joinHousehold,
      leaveHousehold,
      refreshHousehold,
    }),
    [
      account,
      view,
      hydrated,
      offline,
      hydrate,
      signIn,
      signUp,
      signOut,
      adoptAccount,
      completeOnboarding,
      setLanguage,
      colorScheme,
      appearance,
      personal,
      setAppearance,
      setWeatherPlace,
      weatherPlaces,
      updateWeatherPlaces,
      setFavorites,
      setQuickAccess,
      setAssistantName,
      setAssistantVoice,
      setAssistantAvatar,
      setFirstName,
      setUsername,
      setBackdrop,
      household,
      role,
      createHousehold,
      switchHousehold,
      joinHousehold,
      leaveHousehold,
      refreshHousehold,
    ],
  );

  return (
    <AppContext.Provider value={value}>
      <ThemeProvider value={theme}>
        <I18nProvider value={{ language, t }}>{children}</I18nProvider>
      </ThemeProvider>
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) {
    throw new Error('useApp muss innerhalb von AppProvider verwendet werden.');
  }
  return value;
}

async function loadHousehold(
  account: Account,
): Promise<[HouseholdRow | null, HouseholdRole | null]> {
  if (!account.householdId) return [null, null];
  const hh = await householdRepo.find(account.householdId);
  if (!hh) return [null, null];
  const memberRole = await householdRepo.roleOf(hh.id, account.id);
  return [hh, memberRole ?? null];
}

/**
 * Was fast jede Abfrage braucht: wer fragt, und in welchem Haushalt.
 */
export function useScope(): { accountId: string; householdId: string | null } {
  const { account } = useApp();
  if (!account) {
    throw new Error('useScope ausserhalb eines angemeldeten Bereichs verwendet.');
  }
  return { accountId: account.id, householdId: account.householdId };
}

/** Fuer Bildschirme, die ohne angemeldetes Konto ohnehin nicht laufen. */
export function useAccount(): Account {
  const { account } = useApp();
  if (!account) {
    throw new Error('useAccount ausserhalb eines angemeldeten Bereichs verwendet.');
  }
  return account;
}
