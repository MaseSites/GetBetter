/**
 * Zutaten-Priors und aehnliche Gerichte aus Nutrition5k. Alles ueber Woerter,
 * ohne Zufall: dieselbe Anfrage gibt immer dieselbe Antwort.
 */
const { keyOf, STOPWORDS } = require('./normalize.js');

/** Unter so vielen Gerichten ist ein Prior zu duenn — ausser der Name passt genau. */
const MIN_N = 3;

/**
 * Zubereitungswoerter, die an einem Schluessel nichts Eigenes bedeuten:
 * „spinach raw“ ist einfach Spinat. „fried rice“ dagegen ist ein eigenes
 * Gericht und passt nicht still auf „jasmine rice“.
 */
const NEUTRAL = new Set(['raw', 'fresh', 'plain', 'whole', 'cooked', 'mixed', 'baby', 'leaf']);

/** Andere Woerter fuer dasselbe (Gemini sagt es anders als die Cafeteria). */
const SYNONYMS = [
  ['salad green', 'mixed green'],
  ['leafy green', 'mixed green'],
  ['scallion', 'green onion'],
  ['spring onion', 'green onion'],
  ['garbanzo bean', 'chickpea'],
  ['garbanzo', 'chickpea'],
  ['courgette', 'zucchini'],
  ['aubergine', 'eggplant'],
  ['rocket', 'arugula'],
  ['capsicum', 'bell pepper'],
  ['prawn', 'shrimp'],
  ['spaghetti', 'pasta'],
  ['penne', 'pasta'],
  ['macaroni', 'pasta'],
  ['fusilli', 'pasta'],
  ['ground beef', 'beef'],
  ['minced beef', 'beef'],
  ['chicken fillet', 'chicken breast'],
  ['extra virgin olive oil', 'olive oil'],
];

/** Synonyme auf einen Schluessel anwenden, ganze Woerter, laengste zuerst. */
function withSynonyms(key) {
  let text = ` ${key} `;
  for (const [from, to] of SYNONYMS) text = text.split(` ${from} `).join(` ${to} `);
  return text.trim();
}

/** Die Priors einmal in Woerter zerlegen (fuer jede Anfrage wiederverwendet). */
function indexPriors(priors) {
  return Object.keys(priors).map((key) => {
    const tokens = key.split(' ');
    return { key, tokens, content: tokens.filter((token) => !STOPWORDS.has(token)), n: priors[key].n };
  });
}

const better = (a, b) => (a.score !== b.score ? a.score > b.score : a.n !== b.n ? a.n > b.n : a.key < b.key);

/**
 * Den passendsten Prior zu einem englischen Begriff finden. Stufen:
 * 1. genau derselbe Schluessel,
 * 2. alle Woerter des Schluessels stehen in der Anfrage (je Inhaltswort 2
 *    Punkte, je Zubereitungswort 1 — „chicken breast“ schlaegt „grilled chicken“),
 * 3. alle Inhaltswoerter des Schluessels stehen in der Anfrage und der Rest
 *    ist neutral („spinach raw“ fuer „spinach“),
 * 4. das letzte Inhaltswort der Anfrage kommt im Schluessel vor („jasmine
 *    rice“ → der haeufigste Reis).
 */
function findPrior(priors, index, term) {
  const key = withSynonyms(keyOf(term));
  if (!key) return null;
  if (priors[key]) return { key, match: 'exact' };
  const query = new Set(key.split(' '));
  const content = [...query].filter((token) => !STOPWORDS.has(token));
  const pick = (score) => {
    let best = null;
    for (const entry of index) {
      if (entry.n < MIN_N) continue;
      const value = score(entry);
      if (value === null) continue;
      const candidate = { key: entry.key, n: entry.n, score: value };
      if (!best || better(candidate, best)) best = candidate;
    }
    return best;
  };
  const tokens = pick((entry) =>
    entry.tokens.every((token) => query.has(token)) && entry.content.length > 0
      ? entry.tokens.reduce((sum, token) => sum + (STOPWORDS.has(token) ? 1 : 2), 0)
      : null,
  );
  if (tokens) return { key: tokens.key, match: 'tokens' };
  const loose = pick((entry) =>
    entry.content.length > 0 &&
    entry.content.every((token) => query.has(token)) &&
    entry.tokens.every((token) => query.has(token) || NEUTRAL.has(token))
      ? entry.content.length
      : null,
  );
  if (loose) return { key: loose.key, match: 'loose' };
  const head = content[content.length - 1];
  if (!head) return null;
  const tail = pick((entry) => (entry.content.includes(head) ? (entry.content[entry.content.length - 1] === head ? 1 : 0) : null));
  return tail ? { key: tail.key, match: 'head' } : null;
}

/** Ein Prior samt Schluessel und Art des Treffers, oder null. */
function priorFor(priors, index, term) {
  const found = findPrior(priors, index, term);
  if (!found) return null;
  const prior = priors[found.key];
  return { key: found.key, match: found.match, n: prior.n, p10: prior.p10, p25: prior.p25, median: prior.median, p75: prior.p75, p90: prior.p90 };
}

/** Ein Gericht als Anteile je Zutat (Summe 1). */
function shareVector(entries) {
  const grams = new Map();
  for (const [key, value] of entries) {
    if (!key || !(value > 0)) continue;
    grams.set(key, (grams.get(key) ?? 0) + value);
  }
  const total = [...grams.values()].reduce((sum, value) => sum + value, 0);
  const shares = new Map();
  if (total > 0) for (const [key, value] of grams) shares.set(key, value / total);
  return shares;
}

/** Gewichteter Jaccard ueber Anteile: Summe der Minima durch Summe der Maxima. */
function weightedJaccard(a, b) {
  let min = 0;
  let max = 0;
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(key) ?? 0;
    const y = b.get(key) ?? 0;
    min += Math.min(x, y);
    max += Math.max(x, y);
  }
  return max > 0 ? min / max : 0;
}

/**
 * Die Familie eines Schluessels: sein letztes Inhaltswort. „white rice“ und
 * „brown rice“ sind beide Reis, „grilled chicken“ und „chicken“ beide Huhn.
 */
function familyOf(key) {
  const content = key.split(' ').filter((token) => !STOPWORDS.has(token));
  return content[content.length - 1] ?? key;
}

/** Anteile auf die Familien zusammenfassen. */
function familyShares(shares) {
  return shareVector([...shares].map(([key, value]) => [familyOf(key), value]));
}

/** Die train-Gerichte einmal als Anteile (genau und je Familie) und ein Index auf die Familien. */
function indexDishes(dishes) {
  const train = dishes
    .filter((dish) => dish.split === 'train')
    .map((dish) => {
      const shares = shareVector(dish.ingredients.map((ingredient) => [keyOf(ingredient.name), ingredient.grams]));
      return { dish, shares, families: familyShares(shares) };
    });
  const byFamily = new Map();
  for (const [position, entry] of train.entries()) {
    for (const family of entry.families.keys()) {
      if (!byFamily.has(family)) byFamily.set(family, []);
      byFamily.get(family).push(position);
    }
  }
  return { train, byFamily };
}

/**
 * Die k aehnlichsten train-Gerichte zu einer Liste { term, grams? }. Jeder
 * Begriff wird erst auf seinen Prior-Schluessel gebracht; ohne Gramm zaehlt
 * dessen Median (sonst 50 g). Verglichen wird die Zusammensetzung, nicht die
 * Menge — ein halber Teller Reis mit Poulet gleicht einem ganzen. Der Wert
 * ist das Mittel aus dem gewichteten Jaccard ueber die genauen Schluessel und
 * ueber die Familien, damit „grilled chicken“ auch „chicken“ findet.
 */
function similarDishes(priors, priorIndex, dishIndex, foods, k = 3) {
  const entries = (Array.isArray(foods) ? foods : []).map((food) => {
    const term = typeof food === 'string' ? food : food?.term;
    const found = findPrior(priors, priorIndex, term ?? '');
    const key = found?.key ?? withSynonyms(keyOf(term ?? ''));
    const grams = Number(food?.grams) > 0 ? Number(food.grams) : priors[key]?.median || 50;
    return [key, grams];
  });
  const query = shareVector(entries);
  if (!query.size) return [];
  const queryFamilies = familyShares(query);
  const candidates = new Set();
  for (const family of queryFamilies.keys()) for (const position of dishIndex.byFamily.get(family) ?? []) candidates.add(position);
  const scored = [...candidates].map((position) => {
    const { dish, shares, families } = dishIndex.train[position];
    return { dish, score: (weightedJaccard(query, shares) + weightedJaccard(queryFamilies, families)) / 2 };
  });
  scored.sort((a, b) => b.score - a.score || (a.dish.id < b.dish.id ? -1 : 1));
  return scored.slice(0, Math.max(0, k)).map(({ dish, score }) => ({
    id: dish.id,
    score: Math.round(score * 1000) / 1000,
    mass: dish.mass,
    kcal: dish.kcal,
    ingredients: dish.ingredients,
  }));
}

module.exports = { MIN_N, NEUTRAL, SYNONYMS, familyOf, withSynonyms, indexPriors, findPrior, priorFor, shareVector, weightedJaccard, indexDishes, similarDishes };
