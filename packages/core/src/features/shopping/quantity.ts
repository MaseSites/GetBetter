/**
 * Zahlen in Mengenangaben lesen und schreiben — „200“, „1.5“, „1,5“, „1/2“,
 * „½“, „1½“, „1 1/2“. Rein gerechnet, darum getestet (`quantity.test.ts`);
 * Einkaufsliste (`merge.ts`) und Rezepte (`family/scale.ts`) teilen es.
 */

const GLYPHS: Readonly<Record<string, number>> = {
  '½': 0.5,
  '¼': 0.25,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
};

/** Wie eine Zahl dastand: als Bruch („½“) oder mit Komma/Punkt („1.5“). */
export type AmountStyle = 'fraction' | 'decimal';

export type ReadAmount = {
  value: number;
  /** Wie viele Zeichen vorne die Zahl waren. */
  length: number;
  style: AmountStyle;
};

const NUMBER = /^(\d+)\s+(\d+)\/(\d+)|^(\d+)\s*([½¼¾⅓⅔])|^(\d+)\/(\d+)|^(\d+(?:[.,]\d+)?)|^([½¼¾⅓⅔])/;

/** Liest die Zahl ganz vorne im Text; ohne Zahl `null`. */
export function readAmount(text: string): ReadAmount | null {
  const match = NUMBER.exec(text);
  if (!match) return null;
  const [all, whole, num, den, glyphWhole, glyph, fNum, fDen, plain, glyphOnly] = match;
  let value: number;
  let style: AmountStyle = 'fraction';
  if (whole !== undefined && num !== undefined && den !== undefined) {
    value = Number(whole) + Number(num) / Number(den);
  } else if (glyphWhole !== undefined && glyph !== undefined) {
    value = Number(glyphWhole) + (GLYPHS[glyph] ?? 0);
  } else if (fNum !== undefined && fDen !== undefined) {
    value = Number(fNum) / Number(fDen);
  } else if (plain !== undefined) {
    value = Number(plain.replace(',', '.'));
    // „1.5“ bleibt mit Punkt; eine ganze Zahl („1 TL“) darf zum Bruch werden.
    if (/[.,]/.test(plain)) style = 'decimal';
  } else {
    value = GLYPHS[glyphOnly ?? ''] ?? Number.NaN;
  }
  if (!Number.isFinite(value) || value <= 0) return null;
  return { value, length: all.length, style };
}

const QUARTERS: Readonly<Record<number, string>> = { 25: '¼', 50: '½', 75: '¾' };

/**
 * Schreibt eine Zahl: ganze ohne Stellen, sonst als Bruch (½, ¼, ¾), wenn es
 * einer ist und die Vorlage einer war, sonst mit Punkt und höchstens zwei Stellen.
 */
export function formatAmount(value: number, style: AmountStyle = 'decimal'): string {
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  const whole = Math.floor(rounded);
  const part = Math.round((rounded - whole) * 100);
  const glyph = QUARTERS[part];
  if (style === 'fraction' && glyph) return whole > 0 ? `${whole}${glyph}` : glyph;
  return String(rounded);
}
