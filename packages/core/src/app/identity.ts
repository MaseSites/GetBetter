import Constants from 'expo-constants';

/** Die Better-Familie. Jede App ist ein eigenes Programm mit eigenem Speicher. */
export const APP_IDS = [
  'getbetter',
  'betterfamily',
  'bettergym',
  'betterai',
  'bettermoney',
] as const;
export type AppId = (typeof APP_IDS)[number];

export type AppIdentity = {
  id: AppId;
  name: string;
  /** Fuer Tiefenlinks: `betterfamily://…` */
  scheme: string;
  /** Kurz gesagt, wofuer sie da ist. */
  taglineKey: string;
  /** Farbe des Logos, Schluessel aus den Modulfarben. */
  hue: string;
  icon: string;
};

export const APPS: Readonly<Record<AppId, AppIdentity>> = {
  getbetter: {
    id: 'getbetter',
    name: 'GetBetter',
    scheme: 'getbetter',
    taglineKey: 'apps.getbetter.tagline',
    hue: 'green',
    icon: 'grid',
  },
  betterfamily: {
    id: 'betterfamily',
    name: 'BetterFamily',
    scheme: 'betterfamily',
    taglineKey: 'apps.betterfamily.tagline',
    hue: 'amber',
    icon: 'home',
  },
  bettergym: {
    id: 'bettergym',
    name: 'BetterGym',
    scheme: 'bettergym',
    taglineKey: 'apps.bettergym.tagline',
    hue: 'red',
    icon: 'fitness',
  },
  betterai: {
    id: 'betterai',
    name: 'BetterAi',
    scheme: 'betterai',
    taglineKey: 'apps.betterai.tagline',
    hue: 'violet',
    icon: 'sparkles',
  },
  bettermoney: {
    id: 'bettermoney',
    name: 'BetterMoney',
    scheme: 'bettermoney',
    taglineKey: 'apps.bettermoney.tagline',
    hue: 'teal',
    icon: 'wallet',
  },
};

/**
 * Welche App welche Module fuehrt. Zusammen ergeben sie die Registry —
 * jedes Modul gehoert genau einer App.
 */
export const APP_MODULES: Readonly<Record<AppId, readonly string[]>> = {
  getbetter: ['calendar', 'tasks', 'notes', 'alarm', 'documents', 'habits', 'travel', 'contacts'],
  // Der Familienkalender gehoert hierher; den privaten fuehrt GetBetter.
  betterfamily: ['calendar', 'shopping', 'chores', 'recipes', 'plants', 'pets', 'vehicles'],
  bettergym: ['fitness', 'meals', 'sleep', 'water', 'meds', 'vitals', 'mind'],
  betterai: ['ai'],
  bettermoney: ['budget', 'bills', 'subscriptions', 'savings'],
};

/**
 * Haushalte gibt es nur in BetterFamily. GetBetter fuehrt den privaten
 * Kalender, BetterFamily den der Familie — jede Seite bleibt bei ihrem.
 */
export const APPS_WITH_HOUSEHOLD: readonly AppId[] = ['betterfamily'];

/** Ob diese App mit dem Haushalt arbeitet. */
export function hasHouseholds(): boolean {
  return APPS_WITH_HOUSEHOLD.includes(currentApp().id);
}

/**
 * In welcher App ein Modul steckt. Der Kalender kommt zweimal vor — dort
 * entscheidet die Reihenfolge, und GetBetter fuehrt den privaten.
 */
export function appOfModule(moduleId: string): AppId | undefined {
  return APP_IDS.find((id) => APP_MODULES[id].includes(moduleId));
}

function isAppId(value: string | undefined): value is AppId {
  return value !== undefined && (APP_IDS as readonly string[]).includes(value);
}

/**
 * Welche App gerade laeuft. Kommt aus `app.json` (`slug`) — damit weiss der
 * gemeinsame Kern, in welchem Programm er steckt, ohne dass man es durchreicht.
 */
export function currentApp(): AppIdentity {
  const slug = Constants.expoConfig?.slug;
  return APPS[isAppId(slug) ? slug : 'getbetter'];
}
