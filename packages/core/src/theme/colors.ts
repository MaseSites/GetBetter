/**
 * Warme Neutraltoene plus genau eine Farbe, die etwas bedeutet.
 *
 * Alle Graustufen tragen einen Hauch Gruen-Gelb. Auf dem Bildschirm liest sich
 * das als Papier statt als Systemgrau — und es ist der Grund, warum die App
 * neben den anderen sofort anders wirkt, bevor ein einzelnes Element auffaellt.
 *
 * Was am Ende zu sehen ist, haengt an drei Reglern: hell/dunkel, Akzentfarbe
 * und Voreinstellung.
 */
const grey = {
  g0: '#FFFFFF',
  /** Papier, hell. */
  g50: '#FBFAF7',
  /** Vertiefte Flaeche, hell. */
  g100: '#F2F0E9',
  /** Linie, hell. */
  g200: '#E5E2D9',
  /** Linie kraeftig, hell. */
  g300: '#D2CEC2',
  g400: '#B4B1A6',
  /** Schrift zart, hell — geprueft auf 4.8:1 gegen Papier. */
  g500: '#6E7064',
  /** Schrift ruhig, hell. */
  g600: '#55574C',
  /** Linie kraeftig, dunkel. */
  g700: '#3A3F33',
  /** Linie, dunkel. */
  g750: '#2A2E24',
  /** Karte, dunkel. */
  g800: '#1B1E17',
  /** Papier, dunkel. */
  g900: '#121410',
} as const;

/** Schrift auf dunklem Papier — eigene Toene, kein gespiegeltes Hell. */
const inkDark = {
  text: '#F2F1E9',
  muted: '#A3A698',
  /** Geprueft auf 5.5:1 gegen dunkles Papier. */
  faint: '#8A8D7E',
} as const;

/**
 * Je Akzent vier Toene: Grundton, kraeftig, zart — und die Schriftfarbe, die
 * darauf lesbar ist. Ohne `on` wuerde Weiss auf dem hellen Signalgruen landen,
 * und das liest niemand.
 */
type AccentTone = { base: string; strong: string; soft: string; on: string };
type AccentSet = { light: AccentTone; dark: AccentTone };

export const ACCENTS = {
  /**
   * Die Hausfarbe. Sie markiert *jetzt*, *erledigt* und *Fortschritt* — sonst
   * nichts. Genau diese Sparsamkeit macht sie zur Marke, und sie haelt in Hell
   * und Dunkel denselben Ton.
   */
  signal: {
    // `strong` ist die Schriftfarbe auf Papier, nicht eine dunklere Fuellung:
    // das helle Signalgruen selbst schafft als Text nur 3:1 und ist unlesbar.
    light: { base: '#C9F23F', strong: '#5E7610', soft: '#EDF7C9', on: '#14150F' },
    dark: { base: '#C9F23F', strong: '#A8D22B', soft: '#2B3A0F', on: '#14150F' },
  },
  sage: {
    light: { base: '#3F6E5A', strong: '#2F5344', soft: '#E4EDE7', on: '#FFFFFF' },
    dark: { base: '#8DBBA4', strong: '#A9CFBB', soft: '#22352C', on: '#121410' },
  },
  blue: {
    light: { base: '#4A5FD0', strong: '#37489F', soft: '#E6E9F7', on: '#FFFFFF' },
    dark: { base: '#8D9BEA', strong: '#AAB4F0', soft: '#232A4A', on: '#121410' },
  },
  violet: {
    light: { base: '#8A56C8', strong: '#6B4099', soft: '#EFE8F7', on: '#FFFFFF' },
    dark: { base: '#B492E4', strong: '#C9AEEE', soft: '#2F2445', on: '#121410' },
  },
  rose: {
    light: { base: '#B04A6B', strong: '#8A3853', soft: '#F7E7EC', on: '#FFFFFF' },
    dark: { base: '#E294AC', strong: '#EEB0C2', soft: '#42212C', on: '#121410' },
  },
  amber: {
    light: { base: '#96601A', strong: '#734912', soft: '#F6EDDC', on: '#FFFFFF' },
    dark: { base: '#D7A24F', strong: '#E6BB78', soft: '#3B2C11', on: '#121410' },
  },
  teal: {
    light: { base: '#24705F', strong: '#1A5548', soft: '#DFEEEB', on: '#FFFFFF' },
    dark: { base: '#5FBFA8', strong: '#84D2BF', soft: '#173832', on: '#121410' },
  },
  slate: {
    light: { base: '#4E5A54', strong: '#3A4440', soft: '#E9ECEA', on: '#FFFFFF' },
    dark: { base: '#A5B0AA', strong: '#BFC8C3', soft: '#2A322E', on: '#121410' },
  },
} as const satisfies Record<string, AccentSet>;

export type AccentKey = keyof typeof ACCENTS;
export const ACCENT_KEYS = Object.keys(ACCENTS) as readonly AccentKey[];
export const DEFAULT_ACCENT: AccentKey = 'signal';

/**
 * Die Voreinstellungen. Sie aendern nicht nur Farben, sondern auch, wie viel
 * Farbe die App ueberhaupt zeigt:
 *
 * - `clean`    — ruhig, die Akzentfarbe nur dort, wo sie zaehlt
 * - `colorful` — jeder Bereich traegt seine Farbe kraeftiger
 * - `mono`     — gar keine Farbe, alles in Schwarzweiss
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
  /** Umgekehrtes Papier — der Grund fuer die eine Haupthandlung je Bildschirm. */
  inverse: string;
  onInverse: string;
  accent: string;
  /** Derselbe Ton, aber lesbar als Schrift auf Papier. */
  accentStrong: string;
  accentSoft: string;
  danger: string;
  dangerSoft: string;
  overlay: string;
  disabledBackground: string;
  disabledText: string;
};

export type ColorScheme = 'light' | 'dark';

const base: Record<ColorScheme, Omit<Palette, 'accent' | 'accentStrong' | 'accentSoft' | 'textOnAccent'>> =
  {
    light: {
      background: grey.g50,
      surface: grey.g0,
      surfaceMuted: grey.g100,
      border: grey.g200,
      borderStrong: grey.g300,
      text: '#14150F',
      textMuted: grey.g600,
      textFaint: grey.g500,
      inverse: '#14150F',
      onInverse: grey.g50,
      danger: '#A8392C',
      dangerSoft: '#F7E7E4',
      overlay: 'rgba(20, 21, 15, 0.42)',
      disabledBackground: grey.g100,
      disabledText: grey.g400,
    },
    dark: {
      background: grey.g900,
      surface: grey.g800,
      surfaceMuted: grey.g750,
      border: grey.g750,
      borderStrong: grey.g700,
      text: inkDark.text,
      textMuted: inkDark.muted,
      textFaint: inkDark.faint,
      inverse: inkDark.text,
      onInverse: grey.g900,
      danger: '#E8908A',
      dangerSoft: '#3A211D',
      overlay: 'rgba(0, 0, 0, 0.6)',
      disabledBackground: grey.g750,
      disabledText: '#5C6053',
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
      accent: scheme === 'light' ? '#14150F' : inkDark.text,
      accentStrong: scheme === 'light' ? grey.g700 : grey.g0,
      accentSoft: scheme === 'light' ? grey.g100 : grey.g750,
      danger: scheme === 'light' ? grey.g600 : grey.g300,
      dangerSoft: scheme === 'light' ? grey.g100 : grey.g750,
    };
  }

  const tone = ACCENTS[accent][scheme];
  return {
    ...ground,
    accent: tone.base,
    accentStrong: tone.strong,
    accentSoft: tone.soft,
    textOnAccent: tone.on,
  };
}

export const lightPalette = createPalette('light');
export const darkPalette = createPalette('dark');
