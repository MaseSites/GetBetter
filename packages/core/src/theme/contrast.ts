/**
 * Kontrast nach WCAG 2.2, ohne Bibliothek.
 *
 * Die App hat drei Farbregler (hell/dunkel, Akzent, Voreinstellung) und dazu
 * Bereichs- und Terminfarben. Welche Kombination jemand waehlt, weiss niemand
 * vorher — darum wird Kontrast nicht von Hand geprueft, sondern ausgerechnet
 * und, wo noetig, nachgezogen.
 */

/** Fliesstext und kleine Schrift. */
export const MIN_TEXT_CONTRAST = 4.5;
/** Grosse Schrift, Symbole, Ringe, Punkte — alles, was man erkennen muss. */
export const MIN_MARK_CONTRAST = 3;

type Rgba = { r: number; g: number; b: number; a: number };

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };
const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };

/** `#RGB`, `#RRGGBB`, `#RRGGBBAA` und `rgba(r, g, b, a)`. Unbekanntes wirft. */
export function parseColor(color: string): Rgba {
  const value = color.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex;
    const channel = (index: number) => parseInt(full.slice(index, index + 2), 16);
    return { r: channel(0), g: channel(2), b: channel(4), a: full.length === 8 ? channel(6) / 255 : 1 };
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(value);
  if (rgb) {
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
      a: rgb[4] === undefined ? 1 : Number(rgb[4]),
    };
  }
  throw new Error(`Unbekannte Farbe: ${color}`);
}

function toHex({ r, g, b }: Rgba): string {
  const part = (channel: number) =>
    Math.round(Math.min(255, Math.max(0, channel)))
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** Eine halb durchsichtige Farbe, so wie sie auf ihrem Grund erscheint. */
function over(top: Rgba, ground: Rgba): Rgba {
  const a = top.a;
  return {
    r: top.r * a + ground.r * (1 - a),
    g: top.g * a + ground.g * (1 - a),
    b: top.b * a + ground.b * (1 - a),
    a: 1,
  };
}

/** Wie eine Farbe auf ihrem Grund erscheint, als `#RRGGBB`. */
export function flatten(color: string, ground: string): string {
  return toHex(over(parseColor(color), over(parseColor(ground), WHITE)));
}

function luminance({ r, g, b }: Rgba): number {
  const linear = (channel: number) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/**
 * Kontrastverhaeltnis 1–21. Durchsichtiges wird zuerst auf seinen Grund
 * gelegt, der Grund selbst auf Weiss.
 */
export function contrastRatio(foreground: string, background: string): number {
  const ground = over(parseColor(background), WHITE);
  const fore = over(parseColor(foreground), ground);
  const [light, dark] = [luminance(fore), luminance(ground)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

function mix(from: Rgba, to: Rgba, amount: number): Rgba {
  return {
    r: from.r + (to.r - from.r) * amount,
    g: from.g + (to.g - from.g) * amount,
    b: from.b + (to.b - from.b) * amount,
    a: 1,
  };
}

/**
 * Zieht eine Farbe so wenig wie moeglich Richtung Schwarz oder Weiss, bis sie
 * auf `background` mindestens `min` erreicht. Der Ton bleibt erkennbar; wer
 * schon genug hat, bleibt unveraendert. Schafft keine Richtung das Ziel,
 * kommt die mit dem hoeheren Kontrast.
 */
export function ensureContrast(foreground: string, background: string, min: number): string {
  if (contrastRatio(foreground, background) >= min) return foreground;
  // Themen werden bei jedem Rendern gefragt; die Suche laeuft je Paar nur einmal.
  const key = `${foreground}|${background}|${min}`;
  const known = adjusted.get(key);
  if (known) return known;
  const result = searchContrast(foreground, background, min);
  adjusted.set(key, result);
  return result;
}

const adjusted = new Map<string, string>();

function searchContrast(foreground: string, background: string, min: number): string {
  const ground = over(parseColor(background), WHITE);
  const fore = over(parseColor(foreground), ground);

  // Auf hellem Grund dunkler, auf dunklem heller — und nur, wenn das nicht
  // reicht, die andere Richtung.
  const towards = luminance(ground) > 0.18 ? [BLACK, WHITE] : [WHITE, BLACK];
  let best = toHex(fore);
  for (const target of towards) {
    for (let step = 1; step <= 100; step += 1) {
      const candidate = toHex(mix(fore, target, step / 100));
      if (contrastRatio(candidate, background) >= min) return candidate;
      if (contrastRatio(candidate, background) > contrastRatio(best, background)) best = candidate;
    }
  }
  return best;
}

/**
 * Die lesbarere von zwei Schriftfarben — auf einer Flaeche oder auf jedem
 * Stopp eines Verlaufs, dann zaehlt die schwaechste Stelle.
 */
export function readableOn(
  background: string | readonly string[],
  light = '#FFFFFF',
  dark = '#14150F',
): string {
  const grounds = typeof background === 'string' ? [background] : background;
  const weakest = (color: string) =>
    Math.min(...grounds.map((ground) => contrastRatio(color, ground)));
  return weakest(light) >= weakest(dark) ? light : dark;
}
