// Relativ statt ueber `@/theme`: so rechnet das hier auch unter Node im Test.
import { markOn, type ColorScheme, type Palette, type ThemePreset } from '../../theme/colors';
import { contrastRatio, readableOn } from '../../theme/contrast';
import { hueTint } from '../../theme/modules';
import { mixHex, type PieceTone } from '../intro/avatarPieces';
import type { AvatarColor } from './style';

/** Was vom Thema gebraucht wird — so laesst es sich ohne React testen. */
export type AvatarTheme = Readonly<{ scheme: ColorScheme; preset: ThemePreset; colors: Palette }>;

type FixedColor = Exclude<AvatarColor, 'accent'>;

/**
 * Die festen Farben, je fuer helles und dunkles Papier. Was hier steht, ist
 * nur der Wunsch: `avatarBody` zieht jede so weit nach, dass sie sich auf
 * jeder Flaeche mit 3:1 abhebt.
 */
export const AVATAR_SWATCHES: Readonly<Record<FixedColor, Readonly<Record<ColorScheme, string>>>> =
  {
    sky: { light: '#2F7FC1', dark: '#7DB9EA' },
    violet: { light: '#7A4FC0', dark: '#B492E4' },
    coral: { light: '#C4553F', dark: '#F08E78' },
    sun: { light: '#B07A12', dark: '#E9B949' },
    mint: { light: '#23826A', dark: '#6FD0B0' },
    berry: { light: '#B23A72', dark: '#E68BB4' },
    stone: { light: '#5E625A', dark: '#B9BDB2' },
  };

const INK_LIGHT = '#FFFFFF';
const INK_DARK = '#14150F';

function fixed(theme: AvatarTheme, color: FixedColor): string {
  return markOn(theme.colors, AVATAR_SWATCHES[color][theme.scheme]);
}

/**
 * Die Koerperfarbe, wie sie gezeichnet wird. `accent` folgt der App; in
 * Schwarzweiss gibt es keine Farbe, dort traegt er die Schrift des Themas.
 */
export function avatarBody(theme: AvatarTheme, color: AvatarColor): string {
  const wanted =
    theme.preset === 'mono' || color === 'accent'
      ? theme.colors.accent
      : AVATAR_SWATCHES[color][theme.scheme];
  return markOn(theme.colors, wanted);
}

/** Von mehreren Farben die, die sich auf allen Gruenden zugleich am besten abhebt. */
function standOut(candidates: readonly string[], grounds: readonly string[]): string {
  const weakest = (color: string) =>
    Math.min(...grounds.map((ground) => contrastRatio(color, ground)));
  return candidates.reduce((best, color) => (weakest(color) > weakest(best) ? color : best));
}

/**
 * Jede Rolle eines Stuecks bekommt ihre Farbe. Garantiert (und in
 * `tones.test.ts` durchgerechnet): Koerper und Kacheln heben sich auf jeder
 * Flaeche mit 3:1 ab, Augen und Mund auf dem Koerper ebenso, Augen auf dem
 * Schild sind Schrift. Zubehoer nimmt aus mehreren Toenen den deutlichsten.
 */
export function avatarTones(
  theme: AvatarTheme,
  color: AvatarColor,
): Readonly<Record<PieceTone, string>> {
  const { colors } = theme;
  const body = avatarBody(theme, color);
  const ink = readableOn(body, INK_LIGHT, INK_DARK);
  const colourful = (keys: readonly FixedColor[]) =>
    theme.preset === 'mono'
      ? [ink, colors.text, colors.textMuted]
      : keys.map((key) => fixed(theme, key));

  const hat = standOut(
    [colors.text, colors.textMuted, colors.accentStrong],
    [body, colors.background],
  );
  const bow = standOut(colourful(['berry', 'sky', 'sun']), [body, colors.background]);
  const ai = hueTint(theme, 'ai').base;

  return {
    body,
    bodyAlt: markOn(colors, mixHex(body, ink, 0.14)),
    plate: colors.surface,
    eye: colors.text,
    glint: colors.surface,
    ink,
    inkGlint: body,
    // Ruhige Wangen: eine Schattierung im Koerperton, kein rosa Rouge.
    cheek: mixHex(body, ink, 0.34),
    shine: mixHex(body, INK_LIGHT, 0.5),
    pattern: mixHex(body, ink, 0.3),
    beak: standOut(colourful(['sun', 'coral']), [body, colors.surface]),
    stalk: markOn(colors, mixHex(body, ink, 0.3)),
    bulb: ai,
    hat,
    band: standOut([ai, ...colourful(['coral', 'sky'])], [hat]),
    bow,
    bowKnot: mixHex(bow, readableOn(bow, INK_LIGHT, INK_DARK), 0.3),
    organisation: hueTint(theme, 'organisation').base,
    health: hueTint(theme, 'health').base,
    household: hueTint(theme, 'household').base,
    money: hueTint(theme, 'money').base,
    ai,
    accent: colors.accentStrong,
  };
}
