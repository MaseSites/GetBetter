import { createContext, useContext } from 'react';

import { lightPalette, palettes, type ColorScheme, type Palette } from './colors';
import { radii } from './radii';
import { spacing } from './spacing';
import { fontFamily, fontSize, fontWeight, lineHeight } from './typography';

export type Theme = {
  scheme: ColorScheme;
  colors: Palette;
  spacing: typeof spacing;
  radii: typeof radii;
  fontSize: typeof fontSize;
  lineHeight: typeof lineHeight;
  fontWeight: typeof fontWeight;
  fontFamily: string | undefined;
};

export function createTheme(scheme: ColorScheme): Theme {
  return {
    scheme,
    colors: palettes[scheme],
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

export { lightPalette, palettes, radii, spacing, fontSize, lineHeight, fontWeight, fontFamily };
export type { ColorScheme, Palette };
