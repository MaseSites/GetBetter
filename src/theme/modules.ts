import type { Palette, ColorScheme, ThemePreset } from './colors';

/**
 * Jede App hat ihre eigene Farbe — daraus wird das Logo auf der Kachel.
 * Zwei Toene je Farbe: einer fuer den hellen, einer fuer den dunklen Modus.
 */
const HUES = {
  green: { light: '#3F6E5A', dark: '#8FBBA6' },
  teal: { light: '#2F6B6B', dark: '#86BCBC' },
  blue: { light: '#3A6491', dark: '#8DAFD3' },
  indigo: { light: '#4A56A6', dark: '#A0A8DC' },
  violet: { light: '#6A5590', dark: '#B4A2D6' },
  magenta: { light: '#8B4276', dark: '#CE95BB' },
  rose: { light: '#9C4F67', dark: '#D69FAF' },
  red: { light: '#8C3A32', dark: '#D19A93' },
  orange: { light: '#9A5526', dark: '#D6A279' },
  amber: { light: '#8E6224', dark: '#D2AE72' },
  brown: { light: '#6B5138', dark: '#BFA487' },
  slate: { light: '#4C5866', dark: '#A0ADBB' },
} as const;

type Hue = keyof typeof HUES;

/** Welche App welche Farbe traegt. Ohne Eintrag gilt Schiefer. */
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
  /** Flaeche des Logos. */
  background: string;
  /** Symbol darauf. */
  foreground: string;
};

/**
 * Wie das Logo einer App aussieht. Die Voreinstellung entscheidet, wie viel
 * Farbe dabei herauskommt — in Schwarzweiss bleibt gar keine uebrig.
 */
export function moduleTint(
  theme: { scheme: ColorScheme; preset: ThemePreset; colors: Palette },
  moduleId: string,
): ModuleTint {
  if (theme.preset === 'mono') {
    return { background: theme.colors.surfaceMuted, foreground: theme.colors.text };
  }

  const hue = MODULE_COLORS[moduleId] ?? HUES.slate;
  const tone = theme.scheme === 'light' ? hue.light : hue.dark;

  if (theme.preset === 'colorful') {
    return {
      background: tone,
      foreground: theme.scheme === 'light' ? '#FFFFFF' : '#141412',
    };
  }

  // Ruhig: die Farbe nur angedeutet, das Symbol traegt sie.
  return { background: `${tone}1F`, foreground: tone };
}
