import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EVENT_COLORS } from '../features/calendar/colors';
import { ACCENT_KEYS, THEME_PRESETS, createPalette, type ColorScheme } from './colors';
import {
  MIN_MARK_CONTRAST,
  MIN_TEXT_CONTRAST,
  contrastRatio,
  ensureContrast,
  flatten,
  parseColor,
  readableOn,
} from './contrast';
import { hueTint } from './modules';

const SCHEMES: readonly ColorScheme[] = ['light', 'dark'];
const AREAS = ['brand', 'organisation', 'health', 'household', 'money', 'ai', 'neutral'];

/** Jede Kombination, die jemand in den Einstellungen waehlen kann. */
function everyTheme() {
  return SCHEMES.flatMap((scheme) =>
    THEME_PRESETS.flatMap((preset) =>
      ACCENT_KEYS.map((accent) => ({
        scheme,
        preset,
        accent,
        colors: createPalette(scheme, accent, preset),
      })),
    ),
  );
}

type Pair = { what: string; fg: string; bg: string; min: number };

function failures(pairs: readonly Pair[]): string[] {
  return pairs
    .map((pair) => ({ ...pair, ratio: contrastRatio(pair.fg, pair.bg) }))
    .filter((pair) => pair.ratio < pair.min)
    .map((pair) => `${pair.what}: ${pair.fg} auf ${pair.bg} = ${pair.ratio.toFixed(2)} < ${pair.min}`);
}

test('contrastRatio: Schwarz auf Weiss ist 21, gleiche Farben 1', () => {
  assert.equal(Math.round(contrastRatio('#000000', '#FFFFFF')), 21);
  assert.equal(contrastRatio('#3F6E5A', '#3F6E5A'), 1);
  assert.equal(contrastRatio('#FFF', '#000'), contrastRatio('#000', '#FFF'));
});

test('parseColor versteht Hex mit Alpha und rgba()', () => {
  assert.deepEqual(parseColor('#FF000080'), { r: 255, g: 0, b: 0, a: 128 / 255 });
  assert.deepEqual(parseColor('rgba(20, 21, 15, 0.42)'), { r: 20, g: 21, b: 15, a: 0.42 });
  assert.throws(() => parseColor('red'));
});

test('flatten legt Durchsichtiges auf seinen Grund', () => {
  assert.equal(flatten('#00000080', '#FFFFFF'), '#7F7F7F');
  assert.equal(flatten('#123456', '#FFFFFF'), '#123456');
});

test('ensureContrast laesst Lesbares in Ruhe und zieht Unlesbares nach', () => {
  assert.equal(ensureContrast('#14150F', '#FFFFFF', MIN_TEXT_CONTRAST), '#14150F');
  const lime = ensureContrast('#C9F23F', '#FBFAF7', MIN_TEXT_CONTRAST);
  assert.ok(contrastRatio(lime, '#FBFAF7') >= MIN_TEXT_CONTRAST);
  const onDark = ensureContrast('#3F6E5A', '#121410', MIN_MARK_CONTRAST);
  assert.ok(contrastRatio(onDark, '#121410') >= MIN_MARK_CONTRAST);
});

test('readableOn nimmt die lesbarere Schrift', () => {
  assert.equal(readableOn('#C9F23F'), '#14150F');
  assert.equal(readableOn('#3B4CAF'), '#FFFFFF');
});

test('jede Palette: Schrift, Akzent und Warnung sind lesbar', () => {
  const pairs = everyTheme().flatMap(({ scheme, preset, accent, colors: c }): Pair[] => {
    const at = `${scheme}/${preset}/${accent}`;
    const grounds = { background: c.background, surface: c.surface, surfaceMuted: c.surfaceMuted };
    return [
      ...Object.entries(grounds).flatMap(([name, bg]) => [
        { what: `${at} text/${name}`, fg: c.text, bg, min: MIN_TEXT_CONTRAST },
        { what: `${at} textMuted/${name}`, fg: c.textMuted, bg, min: MIN_TEXT_CONTRAST },
        { what: `${at} textFaint/${name}`, fg: c.textFaint, bg, min: MIN_TEXT_CONTRAST },
        { what: `${at} accentStrong/${name}`, fg: c.accentStrong, bg, min: MIN_TEXT_CONTRAST },
        { what: `${at} danger/${name}`, fg: c.danger, bg, min: MIN_TEXT_CONTRAST },
        // Ein Akzent als Ring, Punkt oder Balken muss sich vom Grund abheben.
        { what: `${at} accentMark/${name}`, fg: c.accentMark, bg, min: MIN_MARK_CONTRAST },
      ]),
      { what: `${at} accentStrong/accentSoft`, fg: c.accentStrong, bg: c.accentSoft, min: MIN_TEXT_CONTRAST },
      { what: `${at} text/accentSoft`, fg: c.text, bg: c.accentSoft, min: MIN_TEXT_CONTRAST },
      { what: `${at} textOnAccent/accent`, fg: c.textOnAccent, bg: c.accent, min: MIN_TEXT_CONTRAST },
      { what: `${at} danger/dangerSoft`, fg: c.danger, bg: c.dangerSoft, min: MIN_TEXT_CONTRAST },
      { what: `${at} onInverse/inverse`, fg: c.onInverse, bg: c.inverse, min: MIN_TEXT_CONTRAST },
    ];
  });
  assert.deepEqual(failures(pairs), []);
});

test('jeder Bereich: Farbe, Symbol und zarte Flaeche heben sich ab', () => {
  const pairs = everyTheme()
    .filter((theme) => theme.accent === 'signal')
    .flatMap((theme): Pair[] =>
      AREAS.flatMap((area) => {
        const tint = hueTint(theme, area);
        const c = theme.colors;
        const at = `${theme.scheme}/${theme.preset}/${area}`;
        const soft = flatten(tint.soft, c.surface);
        return [
          { what: `${at} base/surface`, fg: tint.base, bg: c.surface, min: MIN_MARK_CONTRAST },
          { what: `${at} base/background`, fg: tint.base, bg: c.background, min: MIN_MARK_CONTRAST },
          ...tint.gradient.map((stop, index) => ({
            what: `${at} foreground/gradient${index}`,
            fg: tint.foreground,
            bg: flatten(stop, c.surface),
            min: MIN_MARK_CONTRAST,
          })),
          { what: `${at} text/soft`, fg: c.text, bg: soft, min: MIN_TEXT_CONTRAST },
          { what: `${at} base/soft`, fg: tint.base, bg: soft, min: MIN_MARK_CONTRAST },
        ];
      }),
    );
  assert.deepEqual(failures(pairs), []);
});

test('jede Terminfarbe: weisse Schrift darauf, Streifen auf hell und dunkel', () => {
  const light = createPalette('light');
  const dark = createPalette('dark');
  const pairs = Object.entries(EVENT_COLORS).flatMap(([key, color]): Pair[] => [
    { what: `${key} weiss`, fg: '#FFFFFF', bg: color, min: MIN_TEXT_CONTRAST },
    { what: `${key} auf hell`, fg: color, bg: light.surface, min: MIN_MARK_CONTRAST },
    { what: `${key} auf Papier hell`, fg: color, bg: light.background, min: MIN_MARK_CONTRAST },
    { what: `${key} auf dunkel`, fg: color, bg: dark.surface, min: MIN_MARK_CONTRAST },
    { what: `${key} auf Papier dunkel`, fg: color, bg: dark.background, min: MIN_MARK_CONTRAST },
  ]);
  assert.deepEqual(failures(pairs), []);
});
