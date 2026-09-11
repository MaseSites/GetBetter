import { createContext, useContext } from 'react';

import {
  ACCENTS,
  ACCENT_KEYS,
  THEME_PRESETS,
  createPalette,
  lightPalette,
  DEFAULT_ACCENT,
  DEFAULT_PRESET,
  type AccentKey,
  type ColorScheme,
  type Palette,
  type ThemePreset,
} from './colors';
import { createElevation, type Elevation, type ElevationLevel } from './elevation';
import { duration, easing, pressScale } from './motion';
import { radii } from './radii';
import { spacing } from './spacing';
import {
  fontFamily,
  fontFamilyDisplay,
  fontSize,
  fontWeight,
  lineHeight,
  numeric,
  tracking,
} from './typography';

export type Theme = {
  scheme: ColorScheme;
  accent: AccentKey;
  preset: ThemePreset;
  colors: Palette;
  spacing: typeof spacing;
  radii: typeof radii;
  fontSize: typeof fontSize;
  lineHeight: typeof lineHeight;
  fontWeight: typeof fontWeight;
  tracking: typeof tracking;
  fontFamily: string | undefined;
  /** Fuer Zahlen und Titel. */
  fontFamilyDisplay: string | undefined;
  /** Drei Stufen Tiefe, im Dunkeln ohne Schlagschatten. */
  elevation: Elevation;
  /** Dauern, Kurven und wie stark etwas beim Druecken nachgibt. */
  motion: { duration: typeof duration; easing: typeof easing; pressScale: typeof pressScale };
};

export function createTheme(
  scheme: ColorScheme,
  accent: AccentKey = DEFAULT_ACCENT,
  preset: ThemePreset = DEFAULT_PRESET,
): Theme {
  return {
    scheme,
    accent,
    preset,
    colors: createPalette(scheme, accent, preset),
    spacing,
    radii,
    fontSize,
    lineHeight,
    fontWeight,
    tracking,
    fontFamily,
    fontFamilyDisplay,
    elevation: createElevation(scheme),
    motion: { duration, easing, pressScale },
  };
}

export const lightTheme = createTheme('light');
export const darkTheme = createTheme('dark');

const ThemeContext = createContext<Theme>(lightTheme);

export const ThemeProvider = ThemeContext.Provider;

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

export {
  ACCENTS,
  ACCENT_KEYS,
  DEFAULT_ACCENT,
  DEFAULT_PRESET,
  THEME_PRESETS,
  createPalette,
  lightPalette,
  radii,
  spacing,
  fontSize,
  lineHeight,
  fontWeight,
  tracking,
  fontFamily,
  fontFamilyDisplay,
  numeric,
  duration,
  easing,
  pressScale,
};
export type { AccentKey, ColorScheme, Palette, ThemePreset, Elevation, ElevationLevel };
export {
  hueTint,
  moduleTint,
  moduleSoft,
  moduleBase,
  areaOfModule,
  MODULE_COLORS,
} from './modules';
export type { ModuleTint } from './modules';
