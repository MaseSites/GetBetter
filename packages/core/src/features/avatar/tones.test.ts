import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ACCENT_KEYS, THEME_PRESETS, createPalette, type ColorScheme } from '../../theme/colors';
import { MIN_MARK_CONTRAST, MIN_TEXT_CONTRAST, contrastRatio } from '../../theme/contrast';
import { AVATAR_COLORS } from './style';
import { avatarBody, avatarTones } from './tones';

const SCHEMES: readonly ColorScheme[] = ['light', 'dark'];

/** Jede Kombination aus Modus, Voreinstellung, Akzent und Avatarfarbe. */
function everyLook() {
  return SCHEMES.flatMap((scheme) =>
    THEME_PRESETS.flatMap((preset) =>
      ACCENT_KEYS.flatMap((accent) => {
        const theme = { scheme, preset, colors: createPalette(scheme, accent, preset) };
        return AVATAR_COLORS.map((color) => ({
          theme,
          color,
          at: `${scheme}/${preset}/${accent}/${color}`,
        }));
      }),
    ),
  );
}

type Pair = { what: string; fg: string; bg: string; min: number };

function failures(pairs: readonly Pair[]): string[] {
  return pairs
    .filter((pair) => contrastRatio(pair.fg, pair.bg) < pair.min)
    .map((pair) => `${pair.what}: ${pair.fg} auf ${pair.bg}`);
}

test('Koerper, Kacheln und Antenne heben sich auf jeder Flaeche ab', () => {
  const pairs = everyLook().flatMap(({ theme, color, at }): Pair[] => {
    const tones = avatarTones(theme, color);
    const c = theme.colors;
    return [c.background, c.surface, c.surfaceMuted].flatMap((ground) => [
      { what: `${at} body`, fg: tones.body, bg: ground, min: MIN_MARK_CONTRAST },
      { what: `${at} bodyAlt`, fg: tones.bodyAlt, bg: ground, min: MIN_MARK_CONTRAST },
      { what: `${at} stalk`, fg: tones.stalk, bg: ground, min: MIN_MARK_CONTRAST },
    ]);
  });
  assert.deepEqual(failures(pairs), []);
});

test('Augen und Mund heben sich vom Koerper ab, Augen auf dem Schild sind lesbar', () => {
  const pairs = everyLook().flatMap(({ theme, color, at }): Pair[] => {
    const tones = avatarTones(theme, color);
    return [
      { what: `${at} ink/body`, fg: tones.ink, bg: tones.body, min: MIN_MARK_CONTRAST },
      { what: `${at} ink/bodyAlt`, fg: tones.ink, bg: tones.bodyAlt, min: MIN_MARK_CONTRAST },
      { what: `${at} inkGlint/ink`, fg: tones.inkGlint, bg: tones.ink, min: MIN_MARK_CONTRAST },
      { what: `${at} plate/body`, fg: tones.plate, bg: tones.body, min: MIN_MARK_CONTRAST },
      { what: `${at} eye/plate`, fg: tones.eye, bg: tones.plate, min: MIN_TEXT_CONTRAST },
      { what: `${at} glint/eye`, fg: tones.glint, bg: tones.eye, min: MIN_MARK_CONTRAST },
    ];
  });
  assert.deepEqual(failures(pairs), []);
});

test('die festen Farben sind unterscheidbar, in Schwarzweiss gibt es keine', () => {
  const light = {
    scheme: 'light' as const,
    preset: 'clean' as const,
    colors: createPalette('light'),
  };
  const bodies = AVATAR_COLORS.filter((color) => color !== 'accent').map((color) =>
    avatarBody(light, color),
  );
  assert.equal(new Set(bodies).size, bodies.length);

  const mono = {
    scheme: 'dark' as const,
    preset: 'mono' as const,
    colors: createPalette('dark', 'blue', 'mono'),
  };
  assert.deepEqual(new Set(AVATAR_COLORS.map((color) => avatarBody(mono, color))).size, 1);
});

test('»wie die App« folgt dem Akzent', () => {
  const blue = {
    scheme: 'light' as const,
    preset: 'clean' as const,
    colors: createPalette('light', 'blue'),
  };
  assert.equal(avatarBody(blue, 'accent'), blue.colors.accent);
});
