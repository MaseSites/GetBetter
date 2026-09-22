/**
 * Kennzahlen des Benchmarks: Fehler je Gericht, Zusammenfassung, lose
 * Zuordnung der Zutaten (Nutrition5k-Namen gegen das, was die KI nannte).
 */

const GENERIC = new Set([
  'raw', 'cooked', 'fresh', 'white', 'red', 'green', 'yellow', 'mixed', 'sliced', 'diced', 'chopped',
  'baked', 'roasted', 'grilled', 'fried', 'steamed', 'boiled', 'plain', 'with', 'and', 'of', 'the',
  'in', 'a', 'sauce', 'style', 'whole', 'small', 'large', 'piece', 'pieces', 'dried', 'canned',
]);

/** Lose Synonyme, damit „greens“ auch „lettuce“ trifft und Deutsch mitzaehlt. */
const SYNONYMS = {
  greens: ['lettuce', 'salad', 'spinach', 'arugula', 'kale', 'greens', 'salat', 'rucola', 'spinat', 'blattsalat', 'nüsslisalat', 'kopfsalat'],
  lettuce: ['lettuce', 'salad', 'greens', 'salat', 'kopfsalat', 'eisbergsalat', 'romaine'],
  arugula: ['arugula', 'rocket', 'rucola', 'greens', 'salad'],
  spinach: ['spinach', 'spinat', 'greens'],
  egg: ['egg', 'eggs', 'omelet', 'omelette', 'ei', 'eier', 'rührei', 'spiegelei', 'scrambled'],
  eggs: ['egg', 'eggs', 'omelet', 'omelette', 'ei', 'eier', 'rührei', 'spiegelei', 'scrambled'],
  chicken: ['chicken', 'poultry', 'huhn', 'hähnchen', 'poulet', 'pouletbrust', 'hühnerbrust'],
  beef: ['beef', 'steak', 'rind', 'rindfleisch', 'hackfleisch'],
  pork: ['pork', 'schwein', 'schweinefleisch'],
  bacon: ['bacon', 'speck'],
  sausage: ['sausage', 'wurst', 'bratwurst', 'würstchen'],
  fish: ['fish', 'salmon', 'cod', 'tuna', 'fisch', 'lachs', 'thunfisch'],
  rice: ['rice', 'reis', 'risotto'],
  potato: ['potato', 'potatoes', 'kartoffel', 'kartoffeln', 'fries', 'pommes', 'hash'],
  potatoes: ['potato', 'potatoes', 'kartoffel', 'kartoffeln', 'fries', 'pommes', 'hash'],
  sweet: ['sweet', 'süsskartoffel', 'süßkartoffel'],
  broccoli: ['broccoli', 'brokkoli'],
  cauliflower: ['cauliflower', 'blumenkohl'],
  carrot: ['carrot', 'carrots', 'karotte', 'karotten', 'rüebli'],
  carrots: ['carrot', 'carrots', 'karotte', 'karotten', 'rüebli'],
  tomato: ['tomato', 'tomatoes', 'tomate', 'tomaten'],
  tomatoes: ['tomato', 'tomatoes', 'tomate', 'tomaten'],
  cucumber: ['cucumber', 'cucumbers', 'gurke', 'gurken'],
  cucumbers: ['cucumber', 'cucumbers', 'gurke', 'gurken'],
  pepper: ['pepper', 'peppers', 'peperoni', 'paprika'],
  peppers: ['pepper', 'peppers', 'peperoni', 'paprika'],
  berries: ['berries', 'berry', 'strawberry', 'strawberries', 'blueberries', 'raspberries', 'beeren', 'erdbeeren', 'heidelbeeren', 'himbeeren'],
  cantaloupe: ['cantaloupe', 'melon', 'melone', 'honeydew'],
  honeydew: ['honeydew', 'melon', 'melone', 'cantaloupe'],
  watermelon: ['watermelon', 'melon', 'wassermelone', 'melone'],
  pineapple: ['pineapple', 'ananas'],
  apple: ['apple', 'apfel'],
  grapes: ['grape', 'grapes', 'trauben', 'weintrauben'],
  orange: ['orange', 'oranges', 'mandarine'],
  pizza: ['pizza'],
  bread: ['bread', 'toast', 'brot', 'sandwich', 'bun', 'roll', 'brötchen'],
  toast: ['bread', 'toast', 'brot'],
  pasta: ['pasta', 'spaghetti', 'penne', 'noodles', 'nudeln', 'teigwaren', 'macaroni'],
  noodles: ['pasta', 'noodles', 'nudeln', 'teigwaren'],
  cheese: ['cheese', 'käse', 'mozzarella', 'parmesan', 'cheddar', 'feta'],
  tofu: ['tofu'],
  beans: ['bean', 'beans', 'bohnen', 'chickpeas'],
  quinoa: ['quinoa'],
  corn: ['corn', 'mais'],
  mushroom: ['mushroom', 'mushrooms', 'pilze', 'champignons'],
  onions: ['onion', 'onions', 'zwiebel', 'zwiebeln'],
  oil: ['oil', 'öl', 'olivenöl', 'rapsöl', 'dressing', 'vinaigrette', 'butter'],
  olives: ['olive', 'olives', 'oliven'],
  yogurt: ['yogurt', 'yoghurt', 'joghurt', 'jogurt'],
  oatmeal: ['oatmeal', 'oats', 'porridge', 'hafer', 'haferflocken'],
  brussels: ['brussels', 'rosenkohl'],
  squash: ['squash', 'kürbis', 'zucchini', 'zucchetti', 'pumpkin'],
  zucchini: ['zucchini', 'zucchetti', 'squash'],
  almonds: ['almond', 'almonds', 'mandeln', 'nuts'],
  salmon: ['salmon', 'lachs', 'fish'],
  turkey: ['turkey', 'truthahn', 'pute'],
  ham: ['ham', 'schinken'],
  wrap: ['wrap', 'tortilla'],
  soup: ['soup', 'suppe'],
  asparagus: ['asparagus', 'spargel'],
  cabbage: ['cabbage', 'kohl', 'coleslaw', 'slaw'],
  hummus: ['hummus'],
  guacamole: ['guacamole', 'avocado'],
  avocado: ['avocado', 'guacamole'],
};

const normalize = (text) =>
  String(text ?? '')
    .toLowerCase()
    .normalize('NFC')
    .replace(/[()[\],.;:/\\-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

const singular = (word) => (word.length > 4 && word.endsWith('ies') ? `${word.slice(0, -3)}y` : word.length > 3 && word.endsWith('es') && !word.endsWith('oes') ? word.slice(0, -1) : word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word);

/** Hat die KI eine Zutat mit diesem Namen genannt? Lose: ein tragendes Wort oder ein Synonym. */
function ingredientFound(truthName, predictedTexts) {
  const wanted = normalize(truthName).filter((word) => !GENERIC.has(word));
  if (wanted.length === 0) return false;
  const haystack = predictedTexts.flatMap(normalize);
  const hay = new Set([...haystack, ...haystack.map(singular)]);
  const joined = predictedTexts.join(' ').toLowerCase();
  return wanted.some((word) => {
    const candidates = new Set([word, singular(word), ...(SYNONYMS[word] ?? []), ...(SYNONYMS[singular(word)] ?? [])]);
    for (const candidate of candidates) {
      if (hay.has(candidate)) return true;
      // Zusammengesetzte deutsche Woerter: „Olivenöl“ enthaelt „öl“.
      if (candidate.length >= 4 && joined.includes(candidate)) return true;
    }
    return false;
  });
}

const pctErr = (predicted, truth) => (truth > 0 ? (Math.abs(predicted - truth) / truth) * 100 : null);
const signedPct = (predicted, truth) => (truth > 0 ? ((predicted - truth) / truth) * 100 : null);

/** Kennzahlen eines Gerichts aus Wahrheit und Vorhersage. */
function scoreDish(truth, predicted) {
  const main = truth.ingredients.filter((entry) => truth.massG > 0 && entry.grams / truth.massG >= 0.2);
  const texts = predicted.items.flatMap((item) => [item.term, item.foodName].filter(Boolean));
  const found = main.map((entry) => ({ name: entry.name, share: entry.grams / truth.massG, found: ingredientFound(entry.name, texts) }));
  const truthOil = truth.ingredients.filter((entry) => /\boil\b|butter|dressing|vinaigrette|mayonnaise/.test(entry.name));
  const oilG = truthOil.reduce((sum, entry) => sum + entry.grams, 0);
  const predOil = predicted.items.some((item) => /oil|öl|butter|dressing|vinaigrette|mayo/i.test(`${item.term} ${item.foodName ?? ''}`));
  return {
    kcalErrPct: pctErr(predicted.kcal, truth.kcal),
    kcalSignedPct: signedPct(predicted.kcal, truth.kcal),
    massErrPct: pctErr(predicted.massG, truth.massG),
    massSignedPct: signedPct(predicted.massG, truth.massG),
    proteinErrG: Math.abs(predicted.proteinG - truth.proteinG),
    carbsErrG: Math.abs(predicted.carbsG - truth.carbsG),
    fatErrG: Math.abs(predicted.fatG - truth.fatG),
    fatSignedG: predicted.fatG - truth.fatG,
    mainIngredients: found,
    recall: found.length ? found.filter((entry) => entry.found).length / found.length : null,
    truthOilG: Math.round(oilG * 10) / 10,
    oilPredicted: predOil,
  };
}

const sorted = (values) => values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
const mean = (values) => {
  const list = sorted(values);
  return list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : null;
};
const quantile = (values, q) => {
  const list = sorted(values);
  if (!list.length) return null;
  const pos = (list.length - 1) * q;
  const low = Math.floor(pos);
  const high = Math.ceil(pos);
  return list[low] + (list[high] - list[low]) * (pos - low);
};
const share = (values, test) => {
  const list = sorted(values);
  return list.length ? list.filter(test).length / list.length : null;
};

/** Aus „502 provider_busy“ wird „provider_busy“ — fuer die Aufschluesselung der Fehler. */
function errorKind(error) {
  const text = String(error ?? '').trim();
  const match = /^\d{3}\s+(.*)$/.exec(text);
  const kind = (match ? match[1] : text).trim();
  return kind || 'unbekannt';
}

const countBy = (list) => {
  const counts = {};
  for (const entry of list) counts[entry] = (counts[entry] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
};

/**
 * `mainModel`: das konfigurierte Hauptmodell. Alles andere gilt als Ersatzmodell —
 * so faellt auf, wenn der Dienst still auf das schwaechere Modell ausgewichen ist.
 */
function summarize(records, mainModel = null) {
  const done = records.filter((record) => record.status === 'ok');
  const s = done.map((record) => record.score);
  const pick = (key) => s.map((entry) => entry[key]);
  const recalls = s.flatMap((entry) => entry.mainIngredients.map((main) => (main.found ? 1 : 0)));
  const withOil = s.filter((entry) => entry.truthOilG >= 3);
  const levels = {};
  for (const record of done) levels[record.predicted.level] = (levels[record.predicted.level] ?? 0) + 1;
  const summary = {
    dishes: records.length,
    ok: done.length,
    failed: records.length - done.length,
    successRate: records.length ? done.length / records.length : null,
    failures: records.filter((record) => record.status !== 'ok').map((record) => ({ dishId: record.dishId, error: record.error, attempts: record.attempts ?? null })),
    failureKinds: countBy(records.filter((record) => record.status !== 'ok').map((record) => errorKind(record.error))),
    models: countBy(done.map((record) => record.model ?? 'unbekannt')),
    fallback: {
      mainModel,
      // Ohne Hauptmodell laesst sich nichts vergleichen — dann zaehlt nichts als Ersatz.
      count: mainModel ? done.filter((record) => record.model && record.model !== mainModel).length : 0,
      models: mainModel ? [...new Set(done.filter((record) => record.model && record.model !== mainModel).map((record) => record.model))] : [],
    },
    attempts: {
      mean: mean(records.map((record) => record.attempts ?? 1)),
      max: records.reduce((best, record) => Math.max(best, record.attempts ?? 1), 0),
      retried: records.filter((record) => (record.attempts ?? 1) > 1).length,
    },
    kcal: {
      meanPct: mean(pick('kcalErrPct')),
      medianPct: quantile(pick('kcalErrPct'), 0.5),
      p90Pct: quantile(pick('kcalErrPct'), 0.9),
      biasPct: mean(pick('kcalSignedPct')),
      within15: share(pick('kcalErrPct'), (value) => value <= 15),
      within25: share(pick('kcalErrPct'), (value) => value <= 25),
      under: share(pick('kcalSignedPct'), (value) => value < 0),
    },
    mass: {
      meanPct: mean(pick('massErrPct')),
      medianPct: quantile(pick('massErrPct'), 0.5),
      biasPct: mean(pick('massSignedPct')),
    },
    maeG: { protein: mean(pick('proteinErrG')), carbs: mean(pick('carbsErrG')), fat: mean(pick('fatErrG')), fatBias: mean(pick('fatSignedG')) },
    recall: { ingredients: recalls.length, found: recalls.filter(Boolean).length, rate: recalls.length ? recalls.filter(Boolean).length / recalls.length : null },
    oil: { dishesWithOil: withOil.length, oilNamed: withOil.filter((entry) => entry.oilPredicted).length },
    questions: { dishesAsked: done.filter((record) => record.predicted.questions.length > 0).length, levels },
    costChf: { total: records.reduce((sum, record) => sum + (record.costChf ?? 0), 0), perDish: mean(done.map((record) => record.costChf ?? 0)) },
    latencyS: { mean: mean(done.map((record) => record.latencyS)), median: quantile(done.map((record) => record.latencyS), 0.5), p90: quantile(done.map((record) => record.latencyS), 0.9) },
  };
  const groups = new Map();
  for (const record of done) {
    const key = record.truth.dominant;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  summary.byDominant = [...groups.entries()]
    .map(([name, list]) => ({
      name,
      n: list.length,
      kcalMedianPct: quantile(list.map((record) => record.score.kcalErrPct), 0.5),
      kcalBiasPct: mean(list.map((record) => record.score.kcalSignedPct)),
      massBiasPct: mean(list.map((record) => record.score.massSignedPct)),
    }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  summary.worst = [...done]
    .sort((a, b) => b.score.kcalErrPct - a.score.kcalErrPct)
    .slice(0, 5)
    .map((record) => record.dishId);
  return summary;
}

module.exports = { ingredientFound, scoreDish, summarize, quantile, mean, errorKind };
