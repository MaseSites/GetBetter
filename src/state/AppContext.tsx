import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { I18nProvider, translate, type Language, type Translate } from '@/i18n';
import { DEFAULT_FAVOURITE_IDS, highlightedModuleIds } from '@/mocks/modules';
import { HOUSEHOLD, PERSON } from '@/mocks/person';
import type { Area, Household, Person } from '@/mocks/types';
import { ThemeProvider, createTheme, type ColorScheme } from '@/theme';

const STORAGE_KEY = 'better-life-proto/state/v2';

export type HouseholdChoice = 'created' | 'joined' | 'solo';

/** Der gesamte Mock-Zustand. Bildschirme lesen ausschliesslich hierher. */
export type AppState = {
  signedIn: boolean;
  onboarded: boolean;
  person: Person;
  household: Household | null;
  householdChoice: HouseholdChoice | null;
  selectedAreas: readonly Area[];
  /** Vom Nutzer markierte Module. Steuert den Filter im Module-Tab. */
  favouriteModuleIds: readonly string[];
  language: Language;
  colorScheme: ColorScheme;
};

const INITIAL_STATE: AppState = {
  signedIn: false,
  onboarded: false,
  person: PERSON,
  household: null,
  householdChoice: null,
  selectedAreas: [],
  favouriteModuleIds: DEFAULT_FAVOURITE_IDS,
  language: 'de',
  colorScheme: 'light',
};

/** 'returning' springt direkt in die App, 'new' zuerst ins Onboarding. */
export type SignInMode = 'returning' | 'new';

export type AppActions = {
  signIn: (mode: SignInMode) => void;
  signOut: () => void;
  completeOnboarding: (input: {
    firstName: string;
    areas: readonly Area[];
    householdChoice: HouseholdChoice;
  }) => void;
  setFirstName: (firstName: string) => void;
  setSelectedAreas: (areas: readonly Area[]) => void;
  toggleFavourite: (id: string) => void;
  isFavourite: (id: string) => boolean;
  setLanguage: (language: Language) => void;
  resetPrototype: () => void;
};

export type AppContextValue = AppActions & {
  state: AppState;
  /** Solange der gespeicherte Zustand geladen wird. */
  hydrated: boolean;
};

const AppContext = createContext<AppContextValue | null>(null);

type PersistedState = Pick<
  AppState,
  | 'signedIn'
  | 'onboarded'
  | 'household'
  | 'householdChoice'
  | 'selectedAreas'
  | 'favouriteModuleIds'
  | 'language'
> & { firstName: string };

function toPersisted(state: AppState): PersistedState {
  return {
    signedIn: state.signedIn,
    onboarded: state.onboarded,
    household: state.household,
    householdChoice: state.householdChoice,
    selectedAreas: state.selectedAreas,
    favouriteModuleIds: state.favouriteModuleIds,
    language: state.language,
    firstName: state.person.firstName,
  };
}

function fromPersisted(raw: string): Partial<AppState> | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (typeof parsed !== 'object' || parsed === null) return null;
    return {
      signedIn: parsed.signedIn ?? INITIAL_STATE.signedIn,
      onboarded: parsed.onboarded ?? INITIAL_STATE.onboarded,
      household: parsed.household ?? null,
      householdChoice: parsed.householdChoice ?? null,
      selectedAreas: parsed.selectedAreas ?? [],
      favouriteModuleIds: parsed.favouriteModuleIds ?? DEFAULT_FAVOURITE_IDS,
      language: parsed.language ?? 'de',
      person: { ...PERSON, firstName: parsed.firstName ?? PERSON.firstName },
    };
  } catch {
    // Ein kaputter Eintrag darf den Prototyp nicht blockieren.
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);

  // P-015: Der Zustand ueberlebt ein Neuladen der Seite.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        const restored = raw ? fromPersisted(raw) : null;
        if (restored) setState((current) => ({ ...current, ...restored }));
      })
      .catch(() => {
        // Ohne Speicher laeuft der Prototyp einfach mit dem Ausgangszustand.
      })
      .finally(() => {
        if (cancelled) return;
        hydratedRef.current = true;
        setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toPersisted(state))).catch(() => {
      // Schreibfehler sind im Prototyp folgenlos.
    });
  }, [state]);

  const signIn = useCallback<AppActions['signIn']>((mode) => {
    setState((current) => ({
      ...current,
      signedIn: true,
      onboarded: mode === 'returning' ? true : current.onboarded,
      household: mode === 'returning' && !current.household ? HOUSEHOLD : current.household,
      householdChoice:
        mode === 'returning' && !current.householdChoice ? 'created' : current.householdChoice,
    }));
  }, []);

  const signOut = useCallback(() => {
    setState((current) => ({ ...current, signedIn: false }));
  }, []);

  const completeOnboarding = useCallback<AppActions['completeOnboarding']>(
    ({ firstName, areas, householdChoice }) => {
      setState((current) => ({
        ...current,
        signedIn: true,
        onboarded: true,
        selectedAreas: areas,
        favouriteModuleIds: highlightedModuleIds(areas),
        householdChoice,
        household: householdChoice === 'solo' ? null : HOUSEHOLD,
        person: {
          ...current.person,
          firstName: firstName.trim().length > 0 ? firstName.trim() : current.person.firstName,
        },
      }));
    },
    [],
  );

  const setFirstName = useCallback((firstName: string) => {
    setState((current) => ({ ...current, person: { ...current.person, firstName } }));
  }, []);

  const setSelectedAreas = useCallback((areas: readonly Area[]) => {
    setState((current) => ({ ...current, selectedAreas: areas }));
  }, []);

  const toggleFavourite = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      favouriteModuleIds: current.favouriteModuleIds.includes(id)
        ? current.favouriteModuleIds.filter((moduleId) => moduleId !== id)
        : [...current.favouriteModuleIds, id],
    }));
  }, []);

  const setLanguage = useCallback((language: Language) => {
    setState((current) => ({ ...current, language }));
  }, []);

  const resetPrototype = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const isFavourite = useCallback(
    (id: string) => state.favouriteModuleIds.includes(id),
    [state.favouriteModuleIds],
  );

  const t = useMemo<Translate>(
    () => (key, values) => translate(state.language, key, values),
    [state.language],
  );

  const theme = useMemo(() => createTheme(state.colorScheme), [state.colorScheme]);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      hydrated,
      signIn,
      signOut,
      completeOnboarding,
      setFirstName,
      setSelectedAreas,
      toggleFavourite,
      isFavourite,
      setLanguage,
      resetPrototype,
    }),
    [
      state,
      hydrated,
      signIn,
      signOut,
      completeOnboarding,
      setFirstName,
      setSelectedAreas,
      toggleFavourite,
      isFavourite,
      setLanguage,
      resetPrototype,
    ],
  );

  return (
    <AppContext.Provider value={value}>
      <ThemeProvider value={theme}>
        <I18nProvider value={{ language: state.language, t }}>{children}</I18nProvider>
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

/** Kurzform fuer Bildschirme, die nur lesen. */
export function useAppState(): AppState {
  return useApp().state;
}
