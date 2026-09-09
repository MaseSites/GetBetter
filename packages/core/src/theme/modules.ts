import type { Palette, ColorScheme, ThemePreset } from './colors';

/**
 * Jede Funktion hat ihre eigene Farbe — daraus wird ihr Logo.
 *
 * Zwei Toene je Farbe, damit das Logo einen Verlauf bekommt statt einer
 * flachen Flaeche, und je einer fuer hell und dunkel.
 */
const HUES = {
  green: { light: ['#4C8168', '#2F5A47'], dark: ['#9CC7B0', '#6E9C86'] },
  teal: { light: ['#3B7E7E', '#265757'], dark: ['#92C8C8', '#659E9E'] },
  blue: { light: ['#4275A6', '#2B4F76'], dark: ['#9BBEDD', '#6D93B8'] },
  indigo: { light: ['#5A66BC', '#3B4489'], dark: ['#AEB5E4', '#7C86C4'] },
  violet: { light: ['#7B64A6', '#523F72'], dark: ['#C0AEE0', '#9080BC'] },
  magenta: { light: ['#9E4E88', '#733561'], dark: ['#DCA5C9', '#B378A2'] },
  rose: { light: ['#B05B76', '#833F55'], dark: ['#E2AABA', '#BA8095'] },
  red: { light: ['#A2453C', '#762F29'], dark: ['#DDA49C', '#B67A72'] },
  orange: { light: ['#AF632E', '#82441C'], dark: ['#E0AC81', '#B98259'] },
  amber: { light: ['#A2712A', '#77501A'], dark: ['#DEB97D', '#B79155'] },
  brown: { light: ['#7C5F42', '#57412C'], dark: ['#C9AF92', '#A2866A'] },
  slate: { light: ['#5A6675', '#3C4652'], dark: ['#AAB6C4', '#7F8C9C'] },
} as const;

type Hue = keyof typeof HUES;

/** Welche Funktion welche Farbe traegt. Ohne Eintrag gilt Schiefer. */
const MODULE_HUE: Readonly<Record<string, Hue>> = {
  // Organisation
  ai: 'violet',
  calendar: 'blue',
  alarm: 'indigo',
  tasks: 'green',
  notes: 'amber',
  documents: 'slate',
  habits: 'teal',
  travel: 'orange',
  contacts: 'magenta',
  // Gesundheit
  meals: 'orange',
  fitness: 'red',
  sleep: 'indigo',
  water: 'teal',
  meds: 'rose',
  vitals: 'magenta',
  mind: 'violet',
  // Haushalt
  shopping: 'green',
  chores: 'amber',
  recipes: 'orange',
  plants: 'green',
  pets: 'brown',
  vehicles: 'slate',
  // Finanzen
  budget: 'teal',
  bills: 'red',
  subscriptions: 'blue',
  savings: 'amber',
};

export const MODULE_COLORS: Readonly<Record<string, (typeof HUES)[Hue]>> = Object.fromEntries(
  Object.entries(MODULE_HUE).map(([id, hue]) => [id, HUES[hue]]),
);

export type ModuleTint = {
  /** Flaeche des Logos, von hell nach dunkel. */
  gradient: readonly [string, string];
  /** Symbol darauf. */
  foreground: string;
  /** Zarte Variante fuer Flaechen, auf denen Text steht. */
  soft: string;
};

/**
 * Wie das Logo einer Funktion aussieht. Die Voreinstellung entscheidet, wie
 * viel Farbe dabei herauskommt — in Schwarzweiss bleibt gar keine uebrig.
 */
export function moduleTint(
  theme: { scheme: ColorScheme; preset: ThemePreset; colors: Palette },
  moduleId: string,
): ModuleTint {
  if (theme.preset === 'mono') {
    const base = theme.scheme === 'light' ? '#3C3C38' : '#D3D3CD';
    const edge = theme.scheme === 'light' ? '#141412' : '#A8A8A3';
    return {
      gradient: [base, edge],
      foreground: theme.scheme === 'light' ? '#FFFFFF' : '#141412',
      soft: theme.colors.surfaceMuted,
    };
  }

  const hue = MODULE_COLORS[moduleId] ?? HUES.slate;
  const tone = theme.scheme === 'light' ? hue.light : hue.dark;
  const [from, to] = tone;

  if (theme.preset === 'colorful') {
    return {
      gradient: [from, to],
      foreground: theme.scheme === 'light' ? '#FFFFFF' : '#141412',
      soft: `${from}22`,
    };
  }

  // Ruhig: dieselbe Farbe, nur zurueckgenommen.
  return {
    gradient: theme.scheme === 'light' ? [`${from}26`, `${to}1A`] : [`${from}33`, `${to}26`],
    foreground: theme.scheme === 'light' ? to : from,
    soft: `${from}1A`,
  };
}

/** Die Hintergrundfarbe allein — wo kein Verlauf hinpasst. */
export function moduleSoft(
  theme: { scheme: ColorScheme; preset: ThemePreset; colors: Palette },
  moduleId: string,
): string {
  return moduleTint(theme, moduleId).soft;
}
