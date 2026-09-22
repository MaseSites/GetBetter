/**
 * Naehrwerte rechnen und pruefen — nur hier, nie in der App und nie von der KI.
 *
 * Ein Lebensmittel traegt seine Werte je 100 g (`per100`). Eine Mahlzeit ist
 * eine Liste aus Lebensmittel und Gramm; daraus entsteht alles andere. Jeder
 * Datensatz und jedes Ergebnis geht durch die Grenzen aus dem Plan (§10).
 */

const MACROS = ['kcal', 'proteinG', 'carbsG', 'fatG'];
const OPTIONAL = ['fiberG', 'sugarG', 'saltG'];

const LIMITS = {
  kcal: [0, 950],
  proteinG: [0, 100],
  carbsG: [0, 100],
  fatG: [0, 100],
  fiberG: [0, 100],
  sugarG: [0, 100],
  saltG: [0, 100],
};

const MIN_PORTION_G = 1;
const MAX_PORTION_G = 3000;
/** Ab hier fragt die App nach, bevor sie speichert. */
const LARGE_PORTION_G = 1500;

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const round1 = (value) => Math.round(value * 10) / 10;

/** 4 × Protein + 4 × Kohlenhydrate + 9 × Fett. */
const energyOf = ({ proteinG, carbsG, fatG }) => 4 * proteinG + 4 * carbsG + 9 * fatG;

/**
 * Prueft Werte je 100 g. Fehler machen den Datensatz unbrauchbar, Warnungen
 * nur verdaechtig (Ballaststoffe, Alkohol und Rundung erklaeren kleine Luecken).
 */
function checkPer100(per100) {
  const errors = [];
  const warnings = [];
  if (!per100 || typeof per100 !== 'object') return { ok: false, errors: ['missing'], warnings };

  for (const key of MACROS) {
    const value = per100[key];
    if (!isNumber(value)) errors.push(`${key}_missing`);
    else if (value < LIMITS[key][0] || value > LIMITS[key][1]) errors.push(`${key}_out_of_range`);
  }
  for (const key of OPTIONAL) {
    const value = per100[key];
    if (value === undefined || value === null) continue;
    if (!isNumber(value) || value < LIMITS[key][0] || value > LIMITS[key][1]) {
      errors.push(`${key}_out_of_range`);
    }
  }
  if (errors.length > 0) return { ok: false, errors, warnings };

  if (per100.proteinG + per100.carbsG + per100.fatG > 105) errors.push('macros_exceed_weight');
  if (isNumber(per100.sugarG) && per100.sugarG > per100.carbsG + 1) warnings.push('sugar_above_carbs');

  const computed = energyOf(per100);
  const gap = Math.abs(computed - per100.kcal);
  if (gap > Math.max(80, per100.kcal * 0.5)) errors.push('energy_mismatch');
  else if (gap > Math.max(40, per100.kcal * 0.25)) warnings.push('energy_mismatch');

  return { ok: errors.length === 0, errors, warnings };
}

function checkPortion(grams) {
  if (!isNumber(grams)) return { ok: false, error: 'grams_missing' };
  if (grams < MIN_PORTION_G || grams > MAX_PORTION_G) return { ok: false, error: 'grams_out_of_range' };
  return { ok: true, needsConfirmation: grams > LARGE_PORTION_G };
}

/** Naehrwerte einer Menge. */
function nutrientsFor(per100, grams) {
  const factor = grams / 100;
  const result = {};
  for (const key of [...MACROS, ...OPTIONAL]) {
    if (isNumber(per100[key])) result[key] = key === 'kcal' ? Math.round(per100[key] * factor) : round1(per100[key] * factor);
  }
  return result;
}

function sum(list) {
  const total = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  for (const entry of list) {
    for (const key of MACROS) total[key] += isNumber(entry[key]) ? entry[key] : 0;
  }
  return {
    kcal: Math.round(total.kcal),
    proteinG: round1(total.proteinG),
    carbsG: round1(total.carbsG),
    fatG: round1(total.fatG),
  };
}

/**
 * Ballaststoffe, Zucker, Salz summieren — nur, was mindestens eine Zeile kennt.
 * Getrennt von `sum`, weil nicht jeder Datensatz sie fuehrt.
 */
function sumOptional(list) {
  const total = {};
  for (const entry of list) {
    for (const key of OPTIONAL) {
      if (isNumber(entry?.[key])) total[key] = (total[key] ?? 0) + entry[key];
    }
  }
  for (const key of Object.keys(total)) total[key] = round1(total[key]);
  return total;
}

/**
 * Eine Mahlzeit neu rechnen: `items` = [{ food, grams, minGrams?, maxGrams? }].
 * Gibt je Posten die Werte, die Summe und — wo Mengen geschaetzt sind — den
 * Bereich. Wirft nie; Probleme stehen in `errors`.
 */
function computeMeal(items) {
  const errors = [];
  const warnings = [];
  const lines = items.map((item, index) => {
    const check = checkPer100(item.food?.per100);
    if (!check.ok) errors.push({ index, errors: check.errors });
    warnings.push(...check.warnings.map((warning) => ({ index, warning })));
    const portion = checkPortion(item.grams);
    if (!portion.ok) errors.push({ index, errors: [portion.error] });
    else if (portion.needsConfirmation) warnings.push({ index, warning: 'large_portion' });
    if (!check.ok || !portion.ok) return null;

    const line = nutrientsFor(item.food.per100, item.grams);
    const min = isNumber(item.minGrams) ? Math.min(item.minGrams, item.grams) : item.grams;
    const max = isNumber(item.maxGrams) ? Math.max(item.maxGrams, item.grams) : item.grams;
    return { ...line, range: { kcalMin: nutrientsFor(item.food.per100, min).kcal, kcalMax: nutrientsFor(item.food.per100, max).kcal } };
  });

  const valid = lines.filter((line) => line !== null);
  const total = sum(valid);
  const range = {
    kcalMin: valid.reduce((acc, line) => acc + line.range.kcalMin, 0),
    kcalMax: valid.reduce((acc, line) => acc + line.range.kcalMax, 0),
  };
  const grams = items.reduce((acc, item) => acc + (isNumber(item.grams) ? item.grams : 0), 0);
  if (total.proteinG > grams) errors.push({ index: null, errors: ['protein_above_weight'] });
  return { ok: errors.length === 0, lines, total, range, errors, warnings };
}

/** Der Rest des Tages: Ziel minus gegessen, nie negativ angezeigt, aber ehrlich als „ueber“. */
function remaining(goal, eaten) {
  const result = {};
  for (const key of MACROS) {
    const left = (goal[key] ?? 0) - (eaten[key] ?? 0);
    result[key] = key === 'kcal' ? Math.round(left) : round1(left);
  }
  return result;
}

module.exports = {
  LARGE_PORTION_G,
  MACROS,
  MAX_PORTION_G,
  OPTIONAL,
  checkPer100,
  checkPortion,
  computeMeal,
  energyOf,
  nutrientsFor,
  remaining,
  sum,
  sumOptional,
};
