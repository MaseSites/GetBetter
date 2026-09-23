/**
 * Kennzahlen des Datenbank-Benchmarks: was unser eigener Code an Fehler
 * beisteuert, wenn Zutat und Gramm schon stimmen.
 *
 * Getrennt von `metrics.js` (Foto-Benchmark), weil dort die Vorhersage der KI
 * gemessen wird und hier die Zuordnung im Katalog — dieselben Zahlen waeren
 * zwei verschiedene Dinge. Die reinen Rechenhelfer kommen von dort, damit
 * Median und Mittel in beiden Laeufen dasselbe bedeuten.
 */
const { mean, quantile } = require('./metrics.js');

const pctErr = (predicted, truth) => (truth > 0 ? (Math.abs(predicted - truth) / truth) * 100 : null);
const signedPct = (predicted, truth) => (truth > 0 ? ((predicted - truth) / truth) * 100 : null);

const share = (values, test) => {
  const list = values.filter((value) => Number.isFinite(value));
  return list.length ? list.filter(test).length / list.length : null;
};

/** Ein Gericht bewerten: unsere Summe gegen die Wahrheit von Nutrition5k. */
function scoreDish(truth, predicted) {
  return {
    kcalErrPct: pctErr(predicted.kcal, truth.kcal),
    kcalSignedPct: signedPct(predicted.kcal, truth.kcal),
    kcalDelta: predicted.kcal - truth.kcal,
    proteinErrG: Math.abs(predicted.proteinG - truth.proteinG),
    proteinSignedG: predicted.proteinG - truth.proteinG,
    carbsErrG: Math.abs(predicted.carbsG - truth.carbsG),
    carbsSignedG: predicted.carbsG - truth.carbsG,
    fatErrG: Math.abs(predicted.fatG - truth.fatG),
    fatSignedG: predicted.fatG - truth.fatG,
  };
}

/**
 * Je Zutat aufaddiert, wie viele Kalorien sie danebenlag — das ist die Liste,
 * an der sich arbeiten laesst. `picked` zaehlt, welcher Datensatz wie oft
 * gewaehlt wurde; angezeigt wird der haeufigste.
 */
function collectIngredients(records) {
  const byName = new Map();
  for (const record of records) {
    for (const line of record.lines) {
      const entry = byName.get(line.name) ?? {
        name: line.name,
        n: 0,
        absKcal: 0,
        signedKcal: 0,
        truthKcal: 0,
        grams: 0,
        misses: 0,
        converted: 0,
        rawState: 0,
        picked: new Map(),
      };
      entry.n += 1;
      entry.absKcal += Math.abs(line.kcal - line.truthKcal);
      entry.signedKcal += line.kcal - line.truthKcal;
      entry.truthKcal += line.truthKcal;
      entry.grams += line.grams;
      if (!line.foodId) entry.misses += 1;
      if (line.converted) entry.converted += 1;
      if (line.state === 'raw') entry.rawState += 1;
      const key = line.foodName ?? '—';
      entry.picked.set(key, (entry.picked.get(key) ?? 0) + 1);
      byName.set(line.name, entry);
    }
  }
  return [...byName.values()]
    .map((entry) => {
      const [bestName, bestCount] = [...entry.picked.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      )[0] ?? ['—', 0];
      return {
        name: entry.name,
        n: entry.n,
        absKcal: Math.round(entry.absKcal),
        meanSignedKcal: Math.round(entry.signedKcal / entry.n),
        meanTruthKcal: Math.round(entry.truthKcal / entry.n),
        meanGrams: Math.round(entry.grams / entry.n),
        missRate: entry.misses / entry.n,
        convertedRate: entry.converted / entry.n,
        rawRate: entry.rawState / entry.n,
        picked: bestName,
        pickedShare: bestCount / entry.n,
      };
    })
    .sort((a, b) => b.absKcal - a.absKcal || a.name.localeCompare(b.name));
}

/** Alles ueber einen Lauf: Fehler je Gericht, Makros, Zuordnung, schlimmste Zutaten. */
function summarize(records, meta = {}) {
  const pick = (key) => records.map((record) => record.score[key]);
  const lines = records.flatMap((record) => record.lines);
  const matched = lines.filter((line) => line.foodId);
  const ingredients = collectIngredients(records);
  return {
    dishes: records.length,
    ingredients: lines.length,
    skippedTiny: records.reduce((sum, record) => sum + record.skippedTiny, 0),
    kcal: {
      medianPct: quantile(pick('kcalErrPct'), 0.5),
      meanPct: mean(pick('kcalErrPct')),
      p90Pct: quantile(pick('kcalErrPct'), 0.9),
      biasPct: mean(pick('kcalSignedPct')),
      medianBiasPct: quantile(pick('kcalSignedPct'), 0.5),
      within10: share(pick('kcalErrPct'), (value) => value <= 10),
      within15: share(pick('kcalErrPct'), (value) => value <= 15),
      within25: share(pick('kcalErrPct'), (value) => value <= 25),
      under: share(pick('kcalSignedPct'), (value) => value < 0),
      meanDeltaKcal: mean(pick('kcalDelta')),
    },
    maeG: {
      protein: mean(pick('proteinErrG')),
      carbs: mean(pick('carbsErrG')),
      fat: mean(pick('fatErrG')),
    },
    biasG: {
      protein: mean(pick('proteinSignedG')),
      carbs: mean(pick('carbsSignedG')),
      fat: mean(pick('fatSignedG')),
    },
    match: {
      total: lines.length,
      noHit: lines.filter((line) => !line.foodId).length,
      noHitShare: lines.length ? lines.filter((line) => !line.foodId).length / lines.length : null,
      uncertain: matched.filter((line) => line.uncertain).length,
      uncertainShare: matched.length ? matched.filter((line) => line.uncertain).length / matched.length : null,
      rawState: matched.filter((line) => line.state === 'raw').length,
      rawShare: matched.length ? matched.filter((line) => line.state === 'raw').length / matched.length : null,
      converted: matched.filter((line) => line.converted).length,
      convertedShare: matched.length ? matched.filter((line) => line.converted).length / matched.length : null,
      cookedState: matched.filter((line) => line.state === 'cooked' && !line.converted).length,
      // Was die fehlenden Treffer an Wahrheit auf der Strasse liegen lassen.
      lostKcal: Math.round(lines.filter((line) => !line.foodId).reduce((sum, line) => sum + line.truthKcal, 0)),
      truthKcal: Math.round(lines.reduce((sum, line) => sum + line.truthKcal, 0)),
      meanScore: mean(matched.map((line) => line.score)),
    },
    worstIngredients: ingredients.slice(0, 30),
    worstDishes: [...records]
      .sort((a, b) => b.score.kcalErrPct - a.score.kcalErrPct)
      .slice(0, 5)
      .map((record) => ({
        dishId: record.dishId,
        kcal: record.predicted.kcal,
        truthKcal: Math.round(record.truth.kcal),
        signedPct: record.score.kcalSignedPct,
      })),
    meta,
  };
}

module.exports = { collectIngredients, scoreDish, summarize };
