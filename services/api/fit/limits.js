/**
 * Wertebereiche, die jede Route gleich erzwingt: Gramm-Spannen einer
 * Schaetzung, Gramm je Stueck, aktive Minuten eines Rezepts.
 *
 * Zwei Arten von Helfern: `clamp…` rueckt Werte in den Bereich (fuer
 * Nebenangaben, bei denen ein Ausreisser nicht die ganze Anfrage kippen
 * soll), `valid…` sagt nur ja/nein (fuer Felder, die gespeichert werden).
 */

const GRAMS = { min: 0, max: 3000 };
const PIECE_GRAMS = { min: 1, max: 2000 };
const ACTIVE_MINUTES = { min: 0, max: 600 };

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

/** Zahl in [min, max], sonst `fallback` (auch fuer Nicht-Zahlen). */
function clampNumber(value, { min, max }, fallback = null) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!isNumber(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Mindest- und Hoechstmenge zu einer Menge: beide in 0–3000 g, `min` nie
 * ueber `grams`, `max` nie darunter. Fehlt eine, faellt sie weg.
 * Gibt `{ minGrams?, maxGrams? }` zum Einspreizen.
 */
function gramRange(grams, minGrams, maxGrams) {
  const out = {};
  const base = isNumber(grams) ? grams : null;
  if (isNumber(minGrams)) out.minGrams = clampNumber(base === null ? minGrams : Math.min(minGrams, base), GRAMS);
  if (isNumber(maxGrams)) out.maxGrams = clampNumber(base === null ? maxGrams : Math.max(maxGrams, base), GRAMS);
  if (out.minGrams !== undefined && out.maxGrams !== undefined && out.minGrams > out.maxGrams) out.minGrams = out.maxGrams;
  return out;
}

/** Gramm je Stueck: 1–2000, sonst null (kein Stueck-Wert). */
function validPieceGrams(value) {
  return isNumber(value) && value >= PIECE_GRAMS.min && value <= PIECE_GRAMS.max ? value : null;
}

/** Aktive Minuten eines Rezepts: 0–600, sonst `fallback` (ebenfalls begrenzt). */
function activeMinutesOf(value, fallback = 0) {
  const n = Number(value);
  if (value !== null && value !== undefined && value !== '' && Number.isFinite(n) && n > 0) return Math.round(clampNumber(n, ACTIVE_MINUTES));
  return Math.round(clampNumber(Number(fallback), ACTIVE_MINUTES, 0));
}

module.exports = { ACTIVE_MINUTES, GRAMS, PIECE_GRAMS, activeMinutesOf, clampNumber, gramRange, validPieceGrams };
