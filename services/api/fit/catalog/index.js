/**
 * Der Lebensmittelkatalog: woher ein Naehrwert kommt und wie ein Wort wie
 * „Reis, gekocht“ zu einem Datensatz wird.
 *
 * Quellen und ihr Rang (kleiner = verlaesslicher), wie im Plan:
 *   recipe 0 · label 1 · barcode 1 · swiss 2 · usda 3 · off 4 · mock 5 · custom 6
 *
 * Die Schweizer Datei (`<datenordner>/fit-catalog-swiss.json`, aus
 * `scripts/import-swiss-foods.js`) ersetzt die Beispielwerte. Open Food Facts
 * bleibt im eigenen Zwischenspeicher und wird nie mit anderen Quellen gemischt.
 */
const fs = require('node:fs');
const path = require('node:path');

const { checkPer100 } = require('../nutrition.js');
const { GAP_FOODS, MOCK_FOODS } = require('./mockFoods.js');

const MOCK_BY_ID = new Map(MOCK_FOODS.map((food) => [food.id, food]));

const SOURCE_RANK = {
  recipe: 0,
  label: 1,
  barcode: 1,
  swiss: 2,
  usda: 3,
  off: 4,
  mock: 5,
  custom: 6,
};

const ATTRIBUTION = {
  swiss:
    'Schweizer Nährwertdatenbank, Bundesamt für Lebensmittelsicherheit und Veterinärwesen (BLV)',
  usda: 'USDA FoodData Central (CC0)',
  off: 'Open Food Facts, Open Database License (ODbL)',
  mock: 'Beispielwerte (Mock-Modus), keine offiziellen Daten',
  label: 'Nährwerttabelle der Verpackung',
  barcode: 'Nährwerttabelle der Verpackung',
  custom: 'Eigene Angabe',
  recipe: 'Eigenes Rezept',
};

/** Kleinbuchstaben, ohne Akzente, ß als ss — „Süsskartoffel“ findet „susskartoffel“. */
function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP = new Set([
  'und',
  'mit',
  'im',
  'vom',
  'the',
  'and',
  'with',
  'de',
  'la',
  'le',
  'et',
  'con',
  'di',
  'e',
  'a',
  'in',
]);
const tokens = (text) =>
  normalize(text)
    .split(' ')
    .filter((word) => word.length > 1 && !STOP.has(word));

/**
 * Alltagswoerter -> Wort der Schweizer Naehrwertdatenbank. Gilt fuer die Suche,
 * nie fuer die Anzeige: „Spaghetti“ bleibt Spaghetti und findet „Teigwaren“.
 */
const EVERYDAY = new Map(
  Object.entries({
    spaghetti: 'teigwaren ohne ei',
    pasta: 'teigwaren ohne ei',
    penne: 'teigwaren ohne ei',
    fusilli: 'teigwaren ohne ei',
    makkaroni: 'teigwaren ohne ei',
    maccaroni: 'teigwaren ohne ei',
    nudeln: 'teigwaren',
    tagliatelle: 'teigwaren mit ei',
    hornli: 'teigwaren',
    spatzli: 'knopfli',
    hackfleisch: 'gehacktes',
    hack: 'gehacktes',
    faschiertes: 'gehacktes',
    hahnchen: 'poulet',
    huhn: 'poulet',
    hahnchenbrust: 'poulet brust',
    pouletbrust: 'poulet brust',
    chicken: 'poulet',
    sahne: 'rahm',
    blattsalat: 'kopfsalat',
    salat: 'kopfsalat',
    rucolasalat: 'rucola',
    kartoffeln: 'kartoffel',
    pommes: 'pommes frites',
    fritten: 'pommes frites',
    semmel: 'brotchen',
    weckli: 'brotchen',
    paradeiser: 'tomate',
    tomaten: 'tomate',
    karotten: 'karotte',
    rueebli: 'karotte',
    ruebli: 'karotte',
    mohren: 'karotte',
    ei: 'huhnerei',
    eier: 'huhnerei',
    spiegelei: 'huhnerei',
    festgekocht: 'gekocht',
    hartgekocht: 'gekocht',
    yoghurt: 'joghurt',
    parmesan: 'hart halbhartkase',
    grana: 'hart halbhartkase',
    bergkase: 'hart halbhartkase',
    weissmehl: 'mehl',
    magerquark: 'quark nature mager',
    rindshackfleisch: 'rind gehacktes',
    gemusebouillon: 'bouillon gemuse',
    muesli: 'mueslimischung ungesusst',
    // Farben sagen ueber Naehrwerte kaum etwas: „rote Linsen“ sind Linsen.
    rote: '',
    gelbe: '',
    grune: '',
    vollkornbrot: 'brot',
    toast: 'toastbrot',
    bolognese: 'bolognaisesauce',
    bolognesesauce: 'bolognaisesauce',
  }),
);

/**
 * Suchvarianten eines Begriffs: „Blattsalat / Rucola“ -> beide, „Spaghetti
 * (gekocht)“ -> ohne Klammer und die Klammer, dazu jede mit Alltagswoertern
 * uebersetzt. Das Gewicht senkt Varianten, die nur Nebensache sind.
 */
function variantsOf(term) {
  const text = String(term ?? '');
  const inside = [...text.matchAll(/\(([^)]*)\)/g)].map((found) => found[1]);
  const outside = text.replace(/\([^)]*\)/g, ' ');
  const raw = [
    { text: outside, weight: 1 },
    ...outside.split(/[/|]| oder | or | ou | o /).map((part) => ({ text: part, weight: 0.97 })),
    ...inside.flatMap((part) => part.split(/[/|,]/)).map((part) => ({ text: part, weight: 0.9 })),
  ];
  const seen = new Set();
  const variants = [];
  for (const { text: part, weight } of raw) {
    const everyday = tokens(part)
      .flatMap((word) => (EVERYDAY.has(word) ? tokens(EVERYDAY.get(word)) : [word]))
      .filter(
        (word, index, all) =>
          !(word === 'sauce' && all.some((other) => other !== word && other.endsWith('sauce'))),
      );
    for (const words of [tokens(part), everyday]) {
      const key = words.join(' ');
      if (words.length === 0 || seen.has(key)) continue;
      seen.add(key);
      variants.push({ words, weight });
    }
  }
  return variants;
}

/** Woerter fuer „gekocht“ und „roh“ in vier Sprachen. */
const COOKED = [
  'gekocht',
  'gebraten',
  'gegart',
  'gebacken',
  'gedampft',
  'gedunstet',
  'geschmort',
  'pochiert',
  'gegrillt',
  'frittiert',
  'cooked',
  'fried',
  'boiled',
  'baked',
  'grilled',
  'cuit',
  'cuite',
  'cotto',
  'cotta',
  'angebraten',
  'festgekocht',
  'hartgekocht',
  'weichgekocht',
  'gerostet',
  'sautiert',
  'gratiniert',
  'uberbacken',
  'gesotten',
  'steamed',
  'roasted',
  'sauteed',
  'stewed',
  'poached',
  'braised',
  'cuits',
  'cuites',
  'grille',
  'poele',
  'bollito',
  'bollita',
  'arrosto',
  'grigliato',
  'grigliata',
  'fritto',
  'fritta',
];
const RAW = ['roh', 'raw', 'cru', 'crue', 'crues', 'crus', 'crudo', 'cruda', 'trocken', 'dry', 'ungekocht', 'uncooked'];
/** Getrocknet heisst fuer den Zustand roh (vor dem Kochen), macht einen Namen aber spezieller. */
const DRY = ['getrocknet', 'gedorrt', 'dried'];

/**
 * Wie gut ein Wort des Katalogs (`own`) zu einem gesuchten Wort passt:
 *
 * - gleich 1
 * - Mehrzahl („Bananen“ -> Banane, hoechstens zwei Buchstaben mehr) 0.9
 * - das Gesuchte ist zusammengesetzt und der Katalog fuehrt den Grundstoff
 *   („Weissmehl“ -> Mehl; im Deutschen steht das Hauptwort hinten) 0.7
 * - umgekehrt: der Katalog ist genauer als die Frage („Speck“ -> Kochspeck,
 *   „Wurst“ -> Bratwurst, „Melone“ -> Zuckermelone) 0.65
 * - nur derselbe Anfang („lait“ -> laitue, „Reis“ -> Reisgetraenk) 0.6 — das
 *   ist der schwaechste Fall, denn ein Reisgetraenk ist kein Reis.
 */
function pairWeight(own, word) {
  if (own === word) return 1;
  if (word.startsWith(own) && own.length >= 4 && word.length - own.length <= 2) return 0.9;
  if (word.endsWith(own) && own.length >= 4) return 0.7;
  if (own.endsWith(word) && word.length >= 4 && own.length - word.length >= 2) return 0.65;
  if (own.startsWith(word) && word.length >= 3) return 0.6;
  return 0;
}

/**
 * Die Kategorien der amtlichen Datenbank, die ein fertiges Gericht ausweisen
 * („Gerichte/Salate“, „Gerichte/Sandwiches“ …) — 149 Datensaetze.
 */
const DISH_CATEGORY = /^Gerichte\//;
/** So viel bleibt einem Gericht, wenn jemand nur eine Zutat genannt hat. */
const DISH_PENALTY = 0.6;

/**
 * Woerter, die ein Ersatzprodukt ausweisen. Sie stehen in der Schweizer
 * Datenbank gleich neben dem Original („Wurst, vegan, aus Seitan“), treffen
 * darum jede Suche nach dem Original — und haben ganz andere Naehrwerte.
 */
const SUBSTITUTE = new Set([
  'vegan',
  'vegane',
  'veganer',
  'veganes',
  'vegetarisch',
  'vegetarische',
  'alternative',
  'ersatz',
  'fleischersatz',
]);

const NEUTRAL = new Set([
  'durchschnitt',
  'ohne',
  'zugabe',
  'zusatz',
  'salz',
  'salzwasser',
  'unjodiert',
  'jodiert',
  'nature',
  'zubereitet',
  'hausgemacht',
  'wasser',
]);

/** Zustand aus einer Angabe wie „gekocht“ oder „roh“ — sonst null. */
function stateOf(text) {
  const words = tokens(text);
  if (words.some((word) => COOKED.some((stem) => word.startsWith(stem)))) return 'cooked';
  if (words.some((word) => RAW.includes(word) || DRY.includes(word))) return 'raw';
  return null;
}

/**
 * Uebliche Stueckgewichte (essbarer Anteil, gerundet) fuer „6 Eier“ oder
 * „4 Bananen“ — die Schweizer Datenbank fuehrt nur Werte je 100 g. Gilt fuer
 * das erste Wort des Namens, nur wenn der Datensatz selbst keins hat.
 */
const PIECE_GRAMS = {
  huhnerei: 55,
  ei: 55,
  banane: 120,
  apfel: 150,
  birne: 160,
  orange: 150,
  mandarine: 70,
  kiwi: 75,
  zitrone: 100,
  pfirsich: 130,
  aprikose: 40,
  avocado: 150,
  tomate: 100,
  kartoffel: 150,
  zwiebel: 80,
  karotte: 80,
  knoblauch: 5,
  peperoni: 150,
  gurke: 300,
  zucchetti: 200,
  brotchen: 60,
  weggli: 60,
  gipfeli: 45,
};

function withPieceWeight(food) {
  if (food.gramsPerPiece) return food;
  const first = tokens(String(food.names?.de ?? '').split(',')[0])[0];
  return first && PIECE_GRAMS[first] ? { ...food, gramsPerPiece: PIECE_GRAMS[first] } : food;
}

function readSwiss(dataDir) {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'fit-catalog-swiss.json'), 'utf8'),
    );
    // Der Zustand wird beim Lesen neu bestimmt: aeltere Importe kannten „gedünstet“ oder „getrocknet“ noch nicht.
    const withState = (food) => ({
      ...food,
      state: stateOf(Object.values(food.names ?? {}).join(' ')) ?? food.state ?? null,
    });
    return Array.isArray(parsed?.foods)
      ? { foods: parsed.foods.map(withPieceWeight).map(withState), version: parsed.version ?? null }
      : null;
  } catch {
    return null;
  }
}

function createCatalog({ dataDir, mode }) {
  let cached = null;

  /** Die festen Datensaetze: Schweizer Import und — im Mock-Modus oder ohne Import — die Beispielwerte. */
  function base() {
    if (cached) return cached;
    const swiss = readSwiss(dataDir);
    const foods = [...(swiss?.foods ?? [])];
    if (mode === 'mock' || !swiss) foods.push(...MOCK_FOODS);
    // Im Live-Betrieb nur die drei, die der Schweizer Datenbank fehlen
    // (`GAP_FOODS`) — sonst faende „Backpulver“ weiter gezuckertes Kakaopulver
    // und „Sojadrink“ einen Energy Drink.
    else foods.push(...GAP_FOODS);
    cached = {
      foods: foods.filter((food) => checkPer100(food.per100).ok),
      swissVersion: swiss?.version ?? null,
      byId: null,
    };
    cached.byId = new Map(cached.foods.map((food) => [food.id, food]));
    return cached;
  }

  /** Nach einem Import neu lesen. */
  function reload() {
    cached = null;
  }

  /** Ein Datensatz nach Id: fest, eigener oder aus dem Zwischenspeicher. */
  function find(id, { customFoods = [], cacheRows = [] } = {}) {
    // Gekocht umgerechnet (`cooked:<Id>`): aus dem rohen Datensatz jederzeit neu gebaut.
    if (typeof id === 'string' && id.startsWith('cooked:')) {
      const { cookedVariant } = require('./cooking.js');
      return cookedVariant(find(id.slice('cooked:'.length), { customFoods, cacheRows }));
    }
    return (
      base().byId.get(id) ??
      customFoods.find((food) => food.id === id) ??
      cacheRows.find((row) => row.food?.id === id)?.food ??
      // Bereits gegessene Mahlzeiten und die Rezeptbibliothek nennen Beispielwerte
      // auch dann noch, wenn die Schweizer Datenbank sie ersetzt hat.
      MOCK_BY_ID.get(id) ??
      null
    );
  }

  /**
   * Ein Begriff -> sortierte Treffer mit `score` 0..1. Beruecksichtigt Name in
   * vier Sprachen, Synonyme, Zustand (roh/gekocht), Quelle und was die Person
   * frueher fuer denselben Begriff bestaetigt hat (`history`: Begriff -> Id).
   */
  function search(term, { preparation = '', customFoods = [], history = {}, limit = 10 } = {}) {
    const variants = variantsOf(term);
    if (variants.length === 0) return [];
    const wantedState = stateOf(`${term} ${preparation}`);
    const remembered = history[normalize(term)];
    const pool = [...base().foods, ...customFoods];

    const scored = [];
    for (const food of pool) {
      const names = [...Object.values(food.names ?? {}), ...(food.synonyms ?? [])];
      let best = 0;
      for (const name of names) {
        // Klammern der amtlichen Namen („(ohne Zugabe von Salz)“) sind Nebensache.
        const plain = String(name).replace(/\([^)]*\)/g, ' ');
        const words = tokens(plain);
        if (words.length === 0) continue;
        // Laenge zaehlt nur fuer den Kopf vor dem ersten Komma: „Teigwaren ohne Ei, gekocht im
        // Salzwasser“ ist so treffend wie „Teigwaren, gekocht“.
        const head = tokens(plain.split(',')[0]).length || words.length;
        const full = normalize(plain);
        for (const { words: query, weight } of variants) {
          let score;
          if (full === query.join(' ')) score = 1;
          else {
            // Ganzes Wort 1, Mehrzahl („Bananen“ -> Banane, hoechstens zwei Buchstaben mehr) 0.9,
            // Wortende eines zusammengesetzten Worts („Weissmehl“ -> Mehl, im Deutschen steht das
            // Hauptwort hinten) 0.7, dasselbe andersherum („Speck“ -> Kochspeck, „Wurst“ ->
            // Bratwurst, „Melone“ -> Zuckermelone) 0.65 — eine Spur tiefer, weil der Katalog
            // dann genauer ist als die Frage, nur Anfang („lait“ -> laitue) 0.6.
            const weights = query.map((word) => Math.max(0, ...words.map((own) => pairWeight(own, word))));
            const hits = weights.filter((value) => value > 0).length;
            const sum = weights.reduce((total, value) => total + value, 0);
            score = (sum / query.length) * 0.85 * Math.min(1, (hits + 1) / (head + 1) + 0.3);
            // Jedes Wort, das weder gesucht noch Zustand noch neutral ist, macht den Datensatz spezieller:
            // „Banane, roh“ schlaegt „Banane, gedoerrt“, „Teigwaren ohne Ei“ die gefuellten.
            const isExtra = (own) =>
              !NEUTRAL.has(own) &&
              !RAW.includes(own) &&
              !COOKED.some((stem) => own.startsWith(stem)) &&
              !query.some((word) => pairWeight(own, word) > 0);
            const extras = words.filter(isExtra).length;
            score -= Math.min(0.1, extras * 0.02);
            // Wer eine Zutat nennt, meint die Zutat — nicht ein Gericht, in dem
            // sie vorkommt: „Speck“ ist Kochspeck, nicht „Crêpes mit Speck“.
            // Entschieden wird das an der Kategorie der amtlichen Datenbank
            // („Gerichte/…“), nicht an der Wortstellung — und nur, wenn das
            // Gericht ausser der Zutat noch etwas anderes nennt. „Lasagne“
            // bleibt darum Lasagne, auch wenn sie ein Gericht ist.
            if (DISH_CATEGORY.test(food.category ?? '') && query.length === 1 && extras > 0)
              score *= DISH_PENALTY;
            // Ein Ersatzprodukt ist nicht das Original: „Wurst, vegan, aus Seitan“
            // hat mit Bratwurst nur den Namen gemein. Wer danach fragt, bekommt
            // es weiterhin — wer nur „Wurst“ sagt, meint Fleisch.
            if (
              words.some((own) => SUBSTITUTE.has(own)) &&
              !query.some((word) => SUBSTITUTE.has(word))
            )
              score *= 0.5;
          }
          if (score * weight > best) best = score * weight;
        }
      }
      // Frueher bestaetigt zaehlt, auch wenn das Wort anders lautet („Brot“ -> Toastbrot).
      if (remembered === food.id) best = Math.max(best, 0.9) + 0.1;
      if (best < 0.3) continue;
      let stateMismatch = false;
      if (wantedState && food.state && food.state !== 'prepared' && food.state !== wantedState) {
        best -= 0.25;
        stateMismatch = true;
      }
      // Ohne Angabe zur Zubereitung gewinnt bei Gleichstand das Rohe: „Tomaten“ im Vorrat sind roh.
      if (!wantedState && food.state === 'raw') best += 0.005;
      best -= (SOURCE_RANK[food.source] ?? 6) * 0.01;
      scored.push({
        food,
        score: Math.max(0, Math.min(1, best)),
        stateMismatch,
        remembered: remembered === food.id,
      });
    }
    const best = scored
      .sort((a, b) => b.score - a.score || Number(b.remembered) - Number(a.remembered))
      .slice(0, limit);
    // Gesucht gekocht, gefunden nur roh: umrechnen (`cooking.js`). Erst nach dem
    // Sortieren, damit ein echter gekochter Datensatz immer vorgeht — und mit dem
    // Abzug zurueck, denn der Zustand stimmt danach.
    if (wantedState !== 'cooked') return best;
    const { cookedVariant } = require('./cooking.js');
    return best.map((entry) => {
      const cooked =
        entry.stateMismatch && entry.food.state === 'raw' ? cookedVariant(entry.food) : null;
      return cooked
        ? { ...entry, food: cooked, score: Math.min(1, entry.score + 0.25), stateMismatch: false, converted: true }
        : entry;
    });
  }

  /** Der beste Treffer oder null; unter 0.6 gilt er als unsicher. */
  function match(term, options) {
    const [best] = search(term, { ...options, limit: 1 });
    if (!best) return null;
    return { ...best, uncertain: best.score < 0.6 || best.stateMismatch };
  }

  return {
    search,
    match,
    find,
    reload,
    info: () => ({ foods: base().foods.length, swissVersion: base().swissVersion, mode }),
  };
}

/** Was die App ueber einen Datensatz zeigt — nie mehr als noetig. */
function publicFood(food, language = 'de') {
  if (!food) return null;
  return {
    id: food.id,
    name:
      food.names?.[language] ??
      food.names?.de ??
      food.names?.en ??
      Object.values(food.names ?? {})[0] ??
      '',
    brand: food.brand ?? null,
    source: food.source,
    attribution: ATTRIBUTION[food.source] ?? null,
    state: food.state ?? null,
    per100: food.per100,
    gramsPerPiece: food.gramsPerPiece ?? null,
    gramsPerMl: food.gramsPerMl ?? null,
    allergens: food.allergens ?? [],
    shopCategory: food.shopCategory ?? 'other',
  };
}

module.exports = {
  ATTRIBUTION,
  SOURCE_RANK,
  createCatalog,
  normalize,
  publicFood,
  stateOf,
  tokens,
};
