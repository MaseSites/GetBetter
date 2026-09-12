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
  /**
   * Paketname im Store. Steht erst fest, wenn die App veroeffentlicht ist —
   * bis dahin fuehrt der Installieren-Knopf zur laufenden App.
   */
  packageName?: string;
  /** Fuer Tiefenlinks: `betterfamily://…` */
  scheme: string;
  /** Kurz gesagt, wofuer sie da ist. */
  taglineKey: string;
  /** Farbe des Logos — der Bereich, den die App fuehrt, oder `brand`. */
  hue: string;
  icon: string;
};

export const APPS: Readonly<Record<AppId, AppIdentity>> = {
  getbetter: {
    id: 'getbetter',
    name: 'GetBetter',
    scheme: 'getbetter',
    taglineKey: 'apps.getbetter.tagline',
    hue: 'brand',
    icon: 'grid',
  },
  betterfamily: {
    id: 'betterfamily',
    name: 'BetterFamily',
    scheme: 'betterfamily',
    taglineKey: 'apps.betterfamily.tagline',
    hue: 'household',
    icon: 'home',
  },
  bettergym: {
    id: 'bettergym',
    name: 'BetterGym',
    scheme: 'bettergym',
    taglineKey: 'apps.bettergym.tagline',
    hue: 'health',
    icon: 'fitness',
  },
  betterai: {
    id: 'betterai',
    name: 'BetterAi',
    scheme: 'betterai',
    taglineKey: 'apps.betterai.tagline',
    hue: 'ai',
    icon: 'sparkles',
  },
  bettermoney: {
    id: 'bettermoney',
    name: 'BetterMoney',
    scheme: 'bettermoney',
    taglineKey: 'apps.bettermoney.tagline',
    hue: 'money',
    icon: 'wallet',
  },
};

/**
 * Welche App welche Module fuehrt. Zusammen ergeben sie die Registry —
 * jedes Modul gehoert genau einer App.
 */
export const APP_MODULES: Readonly<Record<AppId, readonly string[]>> = {
  getbetter: [
    'calendar',
    'tasks',
    'notes',
    'alarm',
    'weather',
    'documents',
    'habits',
    'travel',
    'contacts',
    'birthdays',
    'mail',
  ],
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

const PLAY_STORE = 'https://play.google.com/store/apps/details?id=';
const APP_STORE = 'https://apps.apple.com/app/';

/**
 * Wohin der Installieren-Knopf fuehrt. Solange keine App veroeffentlicht ist,
 * gibt es keine Adresse — dann oeffnet der Knopf die App selbst.
 */
export function storeUrl(app: AppIdentity, platform: string): string | null {
  if (!app.packageName) return null;
  if (platform === 'android') return `${PLAY_STORE}${app.packageName}`;
  if (platform === 'ios') return `${APP_STORE}${app.packageName}`;
  return null;
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
