/**
 * Roh/trocken gegen gekocht — der groesste stille Fehler einer Fotoanalyse.
 *
 * Auf dem Foto liegt gekochtes Essen. Findet die Suche fuer „Reis“ nur
 * „Reis poliert, trocken“, waeren 200 g auf dem Teller 200 g trockener Reis:
 * rund 700 statt 260 kcal. Hier stehen die Ausbeute-Faktoren (gekochtes
 * Gewicht ÷ Faktor = rohes Gewicht, aus dem die Naehrwerte kommen) und daraus
 * ein abgeleiteter Datensatz „gekocht, umgerechnet“ mit eigener Id
 * (`cooked:<roh-Id>`), den `catalog.find` jederzeit wieder herstellt.
 *
 * Die Faktoren sind gerundete Richtwerte aus der Kuechenpraxis, keine
 * Messwerte eines bestimmten Rezepts.
 */
const { stateOf, tokens } = require('./index.js');

/** Ab dieser Abweichung von 1 lohnt sich ein eigener Datensatz; darunter ist es Schaetzrauschen. */
const MIN_FACTOR_DELTA = 0.15;

const DRY_MARKERS = ['trocken', 'getrocknet', 'dry', 'dried', 'sec', 'secs', 'secche', 'secchi', 'roh', 'raw', 'cru', 'crudo', 'reif'];

/**
 * Arten mit Faktor. `words` sind ganze Woerter im Kopf des Namens (vor dem
 * ersten Komma), `infer`: ohne Angabe zur Zubereitung gilt das Foto als
 * gekocht (Fisch nicht — Sushi, Tatar und Rauchlachs sind roh).
 */
const KINDS = [
  { kind: 'rice', factor: 2.6, infer: true, words: ['reis', 'rice', 'riz', 'riso', 'basmati', 'jasmin'] },
  {
    kind: 'pasta',
    factor: 2.3,
    infer: true,
    words: ['teigwaren', 'pasta', 'spaghetti', 'nudeln', 'hornli', 'makkaroni', 'penne', 'fusilli', 'pates', 'tagliatelle', 'magronen'],
    exclude: ['frisch', 'gefullt', 'fresh', 'filled'],
  },
  { kind: 'couscous', factor: 2.4, infer: true, words: ['couscous', 'bulgur'] },
  { kind: 'quinoa', factor: 2.7, infer: true, words: ['quinoa'] },
  { kind: 'grain', factor: 2.5, infer: true, words: ['hirse', 'buchweizen', 'rollgerste', 'amaranth', 'millet', 'buckwheat'] },
  {
    kind: 'legumes',
    factor: 2.4,
    infer: true,
    words: ['linse', 'linsen', 'kichererbse', 'kichererbsen', 'hulsenfruchte', 'sojabohne', 'lentils', 'lentil', 'chickpeas', 'chickpea', 'lentilles', 'lenticchie', 'ceci'],
  },
  // Bohnen und Erbsen nur getrocknet — gruene sind Gemuese.
  { kind: 'legumes', factor: 2.4, infer: false, words: ['bohne', 'bohnen', 'erbse', 'erbsen', 'beans', 'haricots', 'fagioli'], needsDry: true },
  {
    kind: 'meat',
    factor: 0.72,
    infer: true,
    category: /^Fleisch und Innereien/,
    words: [
      'rind', 'rindfleisch', 'kalb', 'kalbfleisch', 'schwein', 'schweinefleisch', 'lamm', 'poulet', 'pouletbrust',
      'huhn', 'hahnchen', 'hahnchenbrust', 'chicken', 'truthahn', 'trutenbrust', 'turkey', 'geflugelfleisch', 'fleisch',
      'hirsch', 'reh', 'wildschwein', 'wildfleisch', 'kaninchen', 'pferd', 'ziege', 'hase', 'gehacktes', 'hackfleisch',
      'rindshackfleisch', 'geschnetzeltes', 'platzli', 'kotelett', 'steak', 'entrecote', 'beef', 'pork', 'lamb', 'veal',
      'mince', 'boeuf', 'porc', 'veau', 'agneau', 'manzo', 'maiale', 'vitello', 'pollo',
    ],
  },
  {
    kind: 'fish',
    factor: 0.8,
    infer: false,
    category: /^Fisch/,
    words: ['lachs', 'salmon', 'fisch', 'fish', 'dorsch', 'kabeljau', 'forelle', 'egli', 'felche', 'hecht', 'seehecht', 'seelachs', 'scholle', 'flunder', 'heilbutt', 'seezunge', 'garnele', 'crevetten', 'shrimp', 'scampi', 'kalmar', 'saumon', 'salmone'],
  },
  { kind: 'potato', factor: 1, infer: true, words: ['kartoffel', 'kartoffeln', 'potato', 'potatoes', 'susskartoffel', 'patata', 'patate'] },
  {
    kind: 'vegetables',
    factor: 0.9,
    infer: false,
    category: /^Gemüse\/(Gemüse frisch|Gemüse tiefgekühlt|Pilze)/,
    words: [
      'broccoli', 'brokkoli', 'blumenkohl', 'karotte', 'karotten', 'zucchetti', 'zucchini', 'spinat', 'peperoni', 'aubergine',
      'fenchel', 'lauch', 'zwiebel', 'kohl', 'weisskohl', 'rotkohl', 'wirz', 'rosenkohl', 'mangold', 'kurbis', 'spargel',
      'champignon', 'champignons', 'pilz', 'pilze', 'kefe', 'rande', 'sellerie', 'knollensellerie', 'stangensellerie',
      'kohlrabi', 'pastinake', 'schwarzwurzel', 'gemuse', 'gemusemischung', 'blattgemuse', 'chinakohl', 'federkohl', 'bohne',
      'erbse', 'erbsen', 'carrot', 'spinach', 'vegetables',
    ],
  },
];

const headWords = (name) => tokens(String(name ?? '').replace(/\([^)]*\)/g, ' ').split(',')[0]);

/** Welche Art ein Datensatz ist — nach Name (Deutsch, Englisch) und Kategorie der Schweizer Datenbank. */
function kindOf(food) {
  if (!food) return null;
  const names = [food.names?.de, food.names?.en].filter(Boolean);
  const heads = names.flatMap(headWords);
  const all = names.flatMap((name) => tokens(name));
  const dry = all.some((word) => DRY_MARKERS.includes(word));
  for (const entry of KINDS) {
    if (entry.exclude && all.some((word) => entry.exclude.includes(word))) continue;
    const byWord = heads.some((word) => entry.words.includes(word));
    const byCategory = entry.category && entry.category.test(String(food.category ?? ''));
    if (!byWord && !byCategory) continue;
    if (entry.needsDry && !dry) continue;
    return entry;
  }
  return null;
}

/**
 * Soll ein Begriff ohne Angabe als gekocht gelten? Reis, Teigwaren, Getreide,
 * Huelsenfruechte, Fleisch und Kartoffeln liegen nie roh auf dem Teller.
 */
function expectsCooking(...terms) {
  const words = terms.flatMap((term) => tokens(term));
  return KINDS.some((entry) => entry.infer && !entry.needsDry && words.some((word) => entry.words.includes(word)));
}

/** Der Zustand, den das Foto zeigt: Angabe des Modells, sonst geschlossen aus dem Namen. */
function photoState(entry) {
  const stated =
    stateOf(entry.preparation) ??
    stateOf(entry.displayName) ??
    stateOf(entry.canonicalSearchTerm) ??
    stateOf(entry.swissSearchTerm);
  if (stated) return { state: stated, inferred: false };
  if (expectsCooking(entry.displayName, entry.swissSearchTerm, entry.canonicalSearchTerm))
    return { state: 'cooked', inferred: true };
  return { state: null, inferred: false };
}

const SUFFIX = {
  de: 'gekocht, umgerechnet',
  fr: 'cuit, converti',
  it: 'cotto, convertito',
  en: 'cooked, converted',
};

const round1 = (value) => Math.round(value * 10) / 10;

/**
 * Aus einem rohen Datensatz der gekochte: Werte je 100 g gekocht = roh ÷ Faktor.
 * Null, wenn es keinen Faktor gibt, der Faktor zu nahe bei 1 liegt oder der
 * Datensatz nicht roh ist. Kartoffeln (1) und Gemuese (0.9) bleiben darum, was
 * sie sind: dort waere die Umrechnung feiner als die Schaetzung selbst.
 */
function cookedVariant(food) {
  if (!food || food.state !== 'raw' || String(food.id).startsWith('cooked:')) return null;
  const entry = kindOf(food);
  if (!entry || Math.abs(entry.factor - 1) < MIN_FACTOR_DELTA) return null;
  const per100 = {};
  for (const [key, value] of Object.entries(food.per100 ?? {})) {
    if (typeof value === 'number') per100[key] = key === 'kcal' ? Math.round(value / entry.factor) : round1(value / entry.factor);
  }
  const names = {};
  for (const [language, name] of Object.entries(food.names ?? {})) {
    names[language] = `${String(name).replace(/,?\s*(roh|trocken|getrocknet|raw|dry|cru|crue|crues|crudo|cruda)\b/giu, '').trim()} (${SUFFIX[language] ?? SUFFIX.en})`;
  }
  return {
    ...food,
    id: `cooked:${food.id}`,
    names,
    synonyms: [],
    state: 'cooked',
    per100,
    gramsPerPiece: null,
    gramsPerMl: null,
    derivedFrom: food.id,
    yieldFactor: entry.factor,
    cookingKind: entry.kind,
  };
}

/** Rohes Gewicht aus dem gekochten, auf ganze Gramm. */
const rawGramsOf = (cookedGrams, factor) => Math.round(Number(cookedGrams) / factor);

module.exports = {
  KINDS,
  MIN_FACTOR_DELTA,
  cookedVariant,
  expectsCooking,
  kindOf,
  photoState,
  rawGramsOf,
};
