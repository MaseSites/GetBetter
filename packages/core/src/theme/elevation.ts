import type { ViewStyle } from 'react-native';

import type { ColorScheme } from './colors';

/**
 * Tiefe in drei Stufen, mehr gibt es nicht.
 *
 * - `flat`   — liegt auf dem Papier, nur eine Haarlinie trennt sie
 * - `card`   — eine Karte, kaum abgehoben
 * - `raised` — was gerade dran ist, oder was ueber allem schwebt
 *
 * `boxShadow` statt `shadow*`: das versteht React Native auf jedem Geraet, und
 * im Browser gibt es keine Warnung (siehe Regeln in CLAUDE.md).
 *
 * Im Dunkeln traegt ein Schlagschatten nichts. Dort kommt die Trennung aus
 * einem hauchduennen hellen Ring, nicht aus Schwarz auf Fast-Schwarz.
 */
export type ElevationLevel = 'flat' | 'card' | 'raised';
export type Elevation = Readonly<Record<ElevationLevel, ViewStyle>>;

const LIGHT: Elevation = {
  flat: {},
  card: { boxShadow: '0 1px 2px rgba(20, 21, 15, 0.05), 0 0 0 1px rgba(20, 21, 15, 0.055)' },
  raised: { boxShadow: '0 10px 28px -12px rgba(20, 21, 15, 0.2), 0 0 0 1px rgba(20, 21, 15, 0.05)' },
};

const DARK: Elevation = {
  flat: {},
  card: { boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.055)' },
  raised: { boxShadow: '0 12px 30px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.06)' },
};

export function createElevation(scheme: ColorScheme): Elevation {
  return scheme === 'dark' ? DARK : LIGHT;
}
