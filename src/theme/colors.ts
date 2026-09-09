/**
 * Graustufen plus eine waehlbare Akzentfarbe. Was die App am Ende zeigt,
 * haengt an drei Reglern: hell/dunkel, Akzentfarbe und Voreinstellung.
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

/** Je Akzent vier Toene: hell und dunkel, jeweils kraeftig und zart. */
type AccentSet = {
  light: { base: string; strong: string; soft: string };
  dark: { base: string; strong: string; soft: string };
};

export const ACCENTS = {
  sage: {
    light: { base: '#3F6E5A', strong: '#31563F', soft: '#E7F0EB' },
    dark: { base: '#7FA994', strong: '#9CC0AD', soft: '#243B31' },
  },
  blue: {
    light: { base: '#3A6491', strong: '#2C4E72', soft: '#E6EDF5' },
    dark: { base: '#7CA3CC', strong: '#9BBBDD', soft: '#1F3247' },
  },
  violet: {
    light: { base: '#6A5590', strong: '#523F72', soft: '#EDE9F4' },
    dark: { base: '#A692CC', strong: '#BFAFDD', soft: '#332A47' },
  },
  rose: {
    light: { base: '#9C4F67', strong: '#7C3B50', soft: '#F6E9ED' },
    dark: { base: '#CD8FA3', strong: '#DFAABB', soft: '#4A2A35' },
  },
  amber: {
    light: { base: '#8E6224', strong: '#6F4B18', soft: '#F6EEE0' },
    dark: { base: '#C99C55', strong: '#DDB776', soft: '#453117' },
  },
  teal: {
    light: { base: '#2F6B6B', strong: '#245252', soft: '#E4F0F0' },
    dark: { base: '#7BB0B0', strong: '#9AC6C6', soft: '#1E3A3A' },
  },
  slate: {
    light: { base: '#4C5866', strong: '#3A434F', soft: '#EAEDF0' },
    dark: { base: '#95A3B3', strong: '#B2BDCA', soft: '#2A323B' },
  },
  crimson: {
    light: { base: '#8C3A32', strong: '#6E2C26', soft: '#F6E7E5' },
    dark: { base: '#C98A82', strong: '#DBA69F', soft: '#43231F' },
  },
} as const satisfies Record<string, AccentSet>;

export type AccentKey = keyof typeof ACCENTS;
export const ACCENT_KEYS = Object.keys(ACCENTS) as readonly AccentKey[];
export const DEFAULT_ACCENT: AccentKey = 'sage';

/**
 * Die Voreinstellungen. Sie aendern nicht nur Farben, sondern auch, wie viel
 * Farbe die App ueberhaupt zeigt:
 *
 * - `clean` — ruhige Graustufen, die Akzentfarbe nur dort, wo sie zaehlt
 * - `colorful` — App-Kacheln in ihrer eigenen Farbe, kraeftigere Flaechen
 * - `mono` — gar keine Farbe, alles in Schwarzweiss
 */
export const THEME_PRESETS = ['clean', 'colorful', 'mono'] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];
export const DEFAULT_PRESET: ThemePreset = 'clean';

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

export type ColorScheme = 'light' | 'dark';

const base: Record<ColorScheme, Omit<Palette, 'accent' | 'accentStrong' | 'accentSoft'>> = {
  light: {
    background: grey.g50,
    surface: grey.g0,
    surfaceMuted: grey.g100,
    border: grey.g200,
    borderStrong: grey.g300,
    text: grey.g900,
    textMuted: grey.g600,
    textFaint: grey.g500,
    textOnAccent: grey.g0,
    danger: '#8C3A32',
    dangerSoft: '#F6EAE8',
    overlay: 'rgba(20, 20, 18, 0.45)',
    disabledBackground: grey.g200,
    disabledText: grey.g400,
  },
  dark: {
    background: grey.g900,
    surface: grey.g800,
    surfaceMuted: grey.g700,
    border: grey.g700,
    borderStrong: grey.g600,
    text: grey.g50,
    textMuted: grey.g300,
    textFaint: grey.g400,
    textOnAccent: grey.g900,
    danger: '#C98A82',
    dangerSoft: '#3A2523',
    overlay: 'rgba(0, 0, 0, 0.6)',
    disabledBackground: grey.g700,
    disabledText: grey.g500,
  },
};

export function createPalette(
  scheme: ColorScheme,
  accent: AccentKey = DEFAULT_ACCENT,
  preset: ThemePreset = DEFAULT_PRESET,
): Palette {
  const ground = base[scheme];

  // Schwarzweiss kennt keine Akzentfarbe — dort ist der Akzent die Schrift.
  if (preset === 'mono') {
    return {
      ...ground,
      textOnAccent: scheme === 'light' ? grey.g0 : grey.g900,
      accent: scheme === 'light' ? grey.g900 : grey.g50,
      accentStrong: scheme === 'light' ? grey.g700 : grey.g0,
      accentSoft: scheme === 'light' ? grey.g100 : grey.g700,
      danger: scheme === 'light' ? grey.g600 : grey.g300,
      dangerSoft: scheme === 'light' ? grey.g100 : grey.g700,
    };
  }

  const tone = ACCENTS[accent][scheme];
  return { ...ground, accent: tone.base, accentStrong: tone.strong, accentSoft: tone.soft };
}

export const lightPalette = createPalette('light');
export const darkPalette = createPalette('dark');
