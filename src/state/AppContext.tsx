import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  findAccount,
  signIn as signInAccount,
  signUp as signUpAccount,
  updateAccount,
  type AuthResult,
} from '@/auth/accounts';
import { flush, notifyDataChanged, ready, type Account } from '@/db';
import { I18nProvider, translate, type Language, type Translate } from '@/i18n';
import type { Area } from '@/mocks/types';
import { ThemeProvider, createTheme, type ColorScheme } from '@/theme';

const SESSION_KEY = 'better-life/session/v1';

export type HouseholdChoice = 'created' | 'joined' | 'solo';

export type AppContextValue = {
  /** Das angemeldete Konto, oder null. */
  account: Account | null;
  /** Solange Datenbank und Sitzung geladen werden. */
  hydrated: boolean;
  colorScheme: ColorScheme;

  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;

  completeOnboarding: (input: {
    firstName: string;
    areas: readonly Area[];
    householdChoice: HouseholdChoice;
  }) => Promise<void>;

  setLanguage: (language: Language) => Promise<void>;
  toggleFavourite: (moduleId: string) => Promise<void>;
  isFavourite: (moduleId: string) => boolean;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const colorScheme: ColorScheme = 'light';

  // Sitzung wiederherstellen: Datenbank laden, dann das gemerkte Konto holen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ready();
        const id = await AsyncStorage.getItem(SESSION_KEY);
        if (id) {
          const found = await findAccount(id);
          if (!cancelled && found) setAccount(found);
          if (!found) await AsyncStorage.removeItem(SESSION_KEY);
        }
      } catch {
        // Ohne Sitzung startet die App einfach beim Anmelden.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const remember = useCallback(async (next: Account) => {
    setAccount(next);
    await AsyncStorage.setItem(SESSION_KEY, next.id);
  }, []);

  const signIn = useCallback<AppContextValue['signIn']>(
    async (email, password) => {
      const result = await signInAccount(email, password);
      if (result.ok) await remember(result.account);
      return result;
    },
    [remember],
  );

  const signUp = useCallback<AppContextValue['signUp']>(
    async (email, password) => {
      const result = await signUpAccount(email, password);
      if (result.ok) await remember(result.account);
      return result;
    },
    [remember],
  );

  const signOut = useCallback(async () => {
    await flush();
    await AsyncStorage.removeItem(SESSION_KEY);
    setAccount(null);
  }, []);

  const completeOnboarding = useCallback<AppContextValue['completeOnboarding']>(
    async ({ firstName, areas, householdChoice }) => {
      if (!account) return;
      const updated = await updateAccount(account.id, {
        firstName: firstName.trim(),
        selectedAreas: areas,
        favouriteModuleIds: ['calendar', 'tasks', 'shopping', 'notes'],
        householdName: householdChoice === 'solo' ? null : 'Zuhause',
        onboarded: true,
      });
      // Ein neues Konto startet bewusst leer.
      if (updated) setAccount(updated);
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

  const toggleFavourite = useCallback(
    async (moduleId: string) => {
      if (!account) return;
      const current = account.favouriteModuleIds;
      const next = current.includes(moduleId)
        ? current.filter((id) => id !== moduleId)
        : [...current, moduleId];
      const updated = await updateAccount(account.id, { favouriteModuleIds: next });
      if (updated) setAccount(updated);
    },
    [account],
  );

  const isFavourite = useCallback(
    (moduleId: string) => account?.favouriteModuleIds.includes(moduleId) ?? false,
    [account],
  );

  const language = (account?.language ?? 'de') as Language;

  const t = useMemo<Translate>(() => (key, values) => translate(language, key, values), [language]);

  const theme = useMemo(() => createTheme(colorScheme), [colorScheme]);

  const value = useMemo<AppContextValue>(
    () => ({
      account,
      hydrated,
      colorScheme,
      signIn,
      signUp,
      signOut,
      completeOnboarding,
      setLanguage,
      toggleFavourite,
      isFavourite,
    }),
    [
      account,
      hydrated,
      signIn,
      signUp,
      signOut,
      completeOnboarding,
      setLanguage,
      toggleFavourite,
      isFavourite,
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

/** Fuer Bildschirme, die ohne angemeldetes Konto ohnehin nicht laufen. */
export function useAccount(): Account {
  const { account } = useApp();
  if (!account) {
    throw new Error('useAccount ausserhalb eines angemeldeten Bereichs verwendet.');
  }
  return account;
}
