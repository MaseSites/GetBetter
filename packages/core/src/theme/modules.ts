import type { Palette, ColorScheme, ThemePreset } from './colors';

/**
 * Fuenf Farben, nicht zwoelf.
 *
 * Vorher trug jede einzelne Funktion ihren eigenen Ton. Nebeneinander wurden
 * daraus zwoelf aehnlich entsaettigte Flecken, die niemand auseinanderhaelt.
 * Jetzt traegt der **Bereich** die Farbe: alles aus Organisation ist blau,
 * alles aus Gesundheit rot, und man erkennt in einer Zehntelsekunde, woher
 * eine Zeile kommt.
 *
 * Zwei Toene je Farbe, damit ein Logo einen Verlauf bekommt statt einer
 * flachen Flaeche, und je einer fuer hell und dunkel.
 */
const AREA_HUES = {
  /** Die Marke selbst — nur fuer das Logo von GetBetter. */
  brand: { light: ['#D6F55E', '#B5E02A'], dark: ['#D6F55E', '#B5E02A'] },
  organisation: { light: ['#5C71E0', '#3B4CAF'], dark: ['#A3AFF0', '#7C8AD8'] },
  health: { light: ['#DC6258', '#B03A31'], dark: ['#EFA39C', '#D07E76'] },
  household: { light: ['#C07E28', '#8F5A17'], dark: ['#E0B063', '#BC8E45'] },
  money: { light: ['#389A86', '#256D5E'], dark: ['#72CDB5', '#4FA792'] },
  ai: { light: ['#9A66D6', '#7043AA'], dark: ['#C2A2EC', '#9E7CD0'] },
  neutral: { light: ['#5E6A62', '#404941'], dark: ['#AAB5AC', '#818C84'] },
} as const;

type Area = keyof typeof AREA_HUES;

/**
 * Aeltere Farbnamen zeigen auf ihren Bereich. `identity.ts` fuehrt sie noch,
 * und so bleibt jeder fruehere Aufruf gueltig, statt still auf Grau zu fallen.
 */
const ALIASES: Readonly<Record<string, Area>> = {
  green: 'brand',
  blue: 'organisation',
  indigo: 'organisation',
  red: 'health',
  rose: 'health',
  magenta: 'health',
  amber: 'household',
  orange: 'household',
  brown: 'household',
  teal: 'money',
  violet: 'ai',
  slate: 'neutral',
};

/** Welche Funktion zu welchem Bereich gehoert. Ohne Eintrag gilt Neutral. */
const MODULE_AREA: Readonly<Record<string, Area>> = {
  // Organisation
  calendar: 'organisation',
  alarm: 'organisation',
  weather: 'organisation',
  tasks: 'organisation',
  notes: 'organisation',
  documents: 'organisation',
  habits: 'organisation',
  travel: 'organisation',
  contacts: 'organisation',
  birthdays: 'organisation',
  mail: 'organisation',
  // Der Assistent steht quer ueber allem und traegt deshalb seine eigene Farbe.
  ai: 'ai',
  // Gesundheit
  meals: 'health',
  fitness: 'health',
  sleep: 'health',
  water: 'health',
  meds: 'health',
  vitals: 'health',
  mind: 'health',
  // Haushalt
  shopping: 'household',
  chores: 'household',
  recipes: 'household',
  plants: 'household',
  pets: 'household',
  vehicles: 'household',
  // Geld
  budget: 'money',
  bills: 'money',
  subscriptions: 'money',
  savings: 'money',
};

export const MODULE_COLORS: Readonly<Record<string, (typeof AREA_HUES)[Area]>> = Object.fromEntries(
  Object.entries(MODULE_AREA).map(([id, area]) => [id, AREA_HUES[area]]),
);

export type ModuleTint = {
  /** Flaeche des Logos, von hell nach dunkel. */
  gradient: readonly [string, string];
  /** Symbol darauf. */
  foreground: string;
  /** Zarte Variante fuer Flaechen, auf denen Text steht. */
  soft: string;
  /**
   * Die volle Farbe. Fuer Punkte, Schienen und Quadrate in Ueberschriften —
   * also ueberall dort, wo der Bereich erkennbar sein soll, ohne dass Farbe
   * eine ganze Flaeche einnimmt.
   */
  base: string;
};

function resolve(name: string): Area {
  if (name in AREA_HUES) return name as Area;
  return ALIASES[name] ?? 'neutral';
}

/** Wie das Logo einer Funktion aussieht. */
export function moduleTint(
  theme: { scheme: ColorScheme; preset: ThemePreset; colors: Palette },
  moduleId: string,
): ModuleTint {
  return hueTint(theme, MODULE_AREA[moduleId] ?? 'neutral');
}

/** Dasselbe fuer einen Bereich oder eine Farbe direkt. */
export function hueTint(
  theme: { scheme: ColorScheme; preset: ThemePreset; colors: Palette },
  hueName: string,
): ModuleTint {
  if (theme.preset === 'mono') {
    const solid = theme.scheme === 'light' ? '#3A3F33' : '#D2CEC2';
    const edge = theme.scheme === 'light' ? '#14150F' : '#A5A99B';
    return {
      gradient: [solid, edge],
      foreground: theme.scheme === 'light' ? '#FFFFFF' : '#121410',
      soft: theme.colors.surfaceMuted,
      base: solid,
    };
  }

  const tone = AREA_HUES[resolve(hueName)][theme.scheme];
  const [from, to] = tone;
  const solid = theme.scheme === 'light' ? to : from;

  if (theme.preset === 'colorful') {
    return {
      gradient: [from, to],
      foreground: theme.scheme === 'light' ? '#FFFFFF' : '#121410',
      soft: `${from}22`,
      base: solid,
    };
  }

  // Ruhig: dieselbe Farbe, nur zurueckgenommen.
  return {
    gradient: theme.scheme === 'light' ? [`${from}26`, `${to}1A`] : [`${from}33`, `${to}26`],
    foreground: solid,
    soft: `${from}1A`,
    base: solid,
  };
}

/** Die Hintergrundfarbe allein — wo kein Verlauf hinpasst. */
export function moduleSoft(
  theme: { scheme: ColorScheme; preset: ThemePreset; colors: Palette },
  moduleId: string,
): string {
  return moduleTint(theme, moduleId).soft;
}

/** Die volle Bereichsfarbe — fuer Punkte, Schienen und Marken. */
export function moduleBase(
  theme: { scheme: ColorScheme; preset: ThemePreset; colors: Palette },
  moduleId: string,
): string {
  return moduleTint(theme, moduleId).base;
}

/** In welchem Bereich eine Funktion sitzt — fuer Ueberschriften und Filter. */
export function areaOfModule(moduleId: string): string {
  return MODULE_AREA[moduleId] ?? 'neutral';
}
