/**
 * Graustufen plus eine einzige zurückhaltende Akzentfarbe.
 * Hell und dunkel sind vorbereitet, benutzt wird vorerst nur hell.
 */
const grey = {
  g0: '#FFFFFF',
  g50: '#F4F4F1',
  g100: '#ECECE8',
  g200: '#E3E3DE',
  g300: '#D3D3CD',
  g400: '#A8A8A3',
  g500: '#7A7A75',
  g600: '#575752',
  g700: '#3C3C38',
  g800: '#262623',
  g900: '#141412',
} as const;

const accent = {
  base: '#3F6E5A',
  strong: '#31563F',
  soft: '#E7F0EB',
} as const;

export type Palette = {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  textOnAccent: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  danger: string;
  dangerSoft: string;
  overlay: string;
  disabledBackground: string;
  disabledText: string;
};

export const lightPalette: Palette = {
  background: grey.g50,
  surface: grey.g0,
  surfaceMuted: grey.g100,
  border: grey.g200,
  borderStrong: grey.g300,
  text: grey.g900,
  textMuted: grey.g600,
  textFaint: grey.g500,
  textOnAccent: grey.g0,
  accent: accent.base,
  accentStrong: accent.strong,
  accentSoft: accent.soft,
  danger: '#8C3A32',
  dangerSoft: '#F6EAE8',
  overlay: 'rgba(20, 20, 18, 0.45)',
  disabledBackground: grey.g200,
  disabledText: grey.g400,
};

export const darkPalette: Palette = {
  background: grey.g900,
  surface: grey.g800,
  surfaceMuted: grey.g700,
  border: grey.g700,
  borderStrong: grey.g600,
  text: grey.g50,
  textMuted: grey.g300,
  textFaint: grey.g400,
  textOnAccent: grey.g0,
  accent: '#7FA994',
  accentStrong: '#9CC0AD',
  accentSoft: '#243B31',
  danger: '#C98A82',
  dangerSoft: '#3A2523',
  overlay: 'rgba(0, 0, 0, 0.6)',
  disabledBackground: grey.g700,
  disabledText: grey.g500,
};

export const palettes = { light: lightPalette, dark: darkPalette } as const;
export type ColorScheme = keyof typeof palettes;
