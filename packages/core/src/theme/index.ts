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
import { radii } from './radii';
import { spacing } from './spacing';
import { fontFamily, fontSize, fontWeight, lineHeight } from './typography';

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
  fontFamily: string | undefined;
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
    fontFamily,
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
  fontFamily,
};
export type { AccentKey, ColorScheme, Palette, ThemePreset };
export { hueTint, moduleTint, MODULE_COLORS } from './modules';
