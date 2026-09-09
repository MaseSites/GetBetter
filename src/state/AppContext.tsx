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
  backfillUsernames,
  findAccount,
  signIn as signInAccount,
  signUp as signUpAccount,
  updateAccount,
  type AuthResult,
} from '@/auth/accounts';
import {
  flush,
  households as householdRepo,
  notifyDataChanged,
  ready,
  type Account,
  type HouseholdRole,
  type HouseholdRow,
  type JoinResult,
} from '@/db';
import { I18nProvider, translate, type Language, type Translate } from '@/i18n';
import type { Area } from '@/mocks/types';
import { ThemeProvider, createTheme, type ColorScheme } from '@/theme';

const SESSION_KEY = 'better-life/session/v1';

export type HouseholdChoice = 'created' | 'joined' | 'solo';

export type AppContextValue = {
  /** Das angemeldete Konto, oder null. */
  account: Account | null;
  /** Der Haushalt des Kontos, oder null. */
  household: HouseholdRow | null;
  /** Rolle im Haushalt. Verwalter duerfen aendern. */
  role: HouseholdRole | null;
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

  createHousehold: (name: string) => Promise<boolean>;
  switchHousehold: (householdId: string) => Promise<void>;
  joinHousehold: (code: string) => Promise<JoinResult>;
  leaveHousehold: () => Promise<void>;
  /** Nach Aenderungen im Haushalt: Konto und Haushalt neu laden. */
  refreshHousehold: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [household, setHousehold] = useState<HouseholdRow | null>(null);
  const [role, setRole] = useState<HouseholdRole | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const colorScheme: ColorScheme = 'light';

  // Sitzung wiederherstellen: Datenbank laden, dann das gemerkte Konto holen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ready();
        await backfillUsernames();
        const id = await AsyncStorage.getItem(SESSION_KEY);
        if (id) {
          const found = await findAccount(id);
          if (!found) await AsyncStorage.removeItem(SESSION_KEY);
          if (!cancelled && found) {
            setAccount(found);
            const [hh, memberRole] = await loadHousehold(found);
            if (!cancelled) {
              setHousehold(hh);
              setRole(memberRole);
            }
          }
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
    setHousehold(null);
    setRole(null);
  }, []);

  const completeOnboarding = useCallback<AppContextValue['completeOnboarding']>(
    async ({ firstName, areas, householdChoice }) => {
      if (!account) return;
      const updated = await updateAccount(account.id, {
        firstName: firstName.trim(),
        selectedAreas: areas,
        favouriteModuleIds: ['calendar', 'tasks', 'shopping', 'notes'],
        onboarded: true,
      });
      // Ein neues Konto startet bewusst leer.
      if (updated) setAccount(updated);
      if (householdChoice === 'created') {
        await householdRepo.create(account.id, 'Zuhause');
      }
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

  const t = useMemo<Translate>(() => (key, values) => translate(language, key, values), [language]);

  const theme = useMemo(() => createTheme(colorScheme), [colorScheme]);

  const value = useMemo<AppContextValue>(
    () => ({
      account,
      household,
      role,
      hydrated,
      colorScheme,
      signIn,
      signUp,
      signOut,
      completeOnboarding,
      setLanguage,
      toggleFavourite,
      isFavourite,
      createHousehold,
      switchHousehold,
      joinHousehold,
      leaveHousehold,
      refreshHousehold,
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
