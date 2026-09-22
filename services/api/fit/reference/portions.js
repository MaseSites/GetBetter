/**
 * Portionen: wie viel ein Mensch in der Schweiz zu einer Mahlzeit isst
 * (menuCH, Median in Gramm) und die Standardportionen eines Gerichts (FNDDS).
 */
const { fold, tokensOf, keyOf, STOPWORDS } = require('./normalize.js');

/**
 * Deutsche Woerter (gefaltet: klein, ohne Umlautpunkte) → menuCH-Kategorie.
 * Gesucht wird der laengste Eintrag, der im Text vorkommt — so gewinnt
 * „kartoffelsalat“ vor „kartoffel“ und „salat“. Kurze Woerter (bis 3
 * Zeichen) zaehlen nur als ganzes Wort, 4 Zeichen am Wortanfang oder -ende,
 * laengere auch mitten in einem Wort („Vollkornbrot“, „Pouletbrust“).
 */
const GERMAN = [
  [['teigwaren', 'pasta', 'spaghetti', 'nudeln', 'penne', 'makkaroni', 'hornli', 'fusilli', 'tagliatelle', 'lasagne', 'lasagna'], 'Teigwaren, total'],
  [['ravioli', 'tortellini', 'gefullte teigwaren'], 'Gefüllte Teigwaren'],
  [['spatzli', 'spaetzli', 'knopfli', 'spatzle'], 'Spätzli'],
  [['reis', 'risotto', 'basmati', 'jasmin'], 'Reis'],
  [['polenta', 'maisgriess'], 'Maisgriess, Polenta'],
  [['couscous', 'bulgur'], 'Couscous'],
  [['brot', 'brotchen', 'weggli', 'gipfeli', 'zopf', 'toast', 'baguette', 'semmel', 'bagel'], 'Brot'],
  [['knackebrot', 'cracker', 'zwieback'], 'Knäckebrot und Crackers'],
  [['muesli', 'musli', 'birchermuesli', 'bircher', 'granola', 'porridge', 'haferbrei'], 'Essfertiges Müesli'],
  [['haferflocken', 'flocken', 'cornflakes'], 'Getreideflocken, total'],
  [['kartoffel', 'kartoffeln', 'hardopfel', 'herdopfel', 'salzkartoffeln', 'gschwellti', 'bratkartoffeln'], 'Kartoffeln'],
  [['pommes', 'pommes frites', 'fritten'], 'Pommes frites '],
  [['kartoffelstock', 'kartoffelpuree', 'stocki', 'puree'], 'Kartoffelstock '],
  [['rosti'], 'Rösti'],
  [['gnocchi'], 'Kartoffel-Gnocchi'],
  [['kartoffelsalat'], 'Kartoffelsalat'],
  [['susskartoffel'], 'Süsskartoffel'],
  [['gemuse', 'broccoli', 'brokkoli', 'blumenkohl', 'spinat', 'erbsen', 'lauch', 'fenchel', 'kurbis', 'rosenkohl', 'peperoni', 'pilze', 'champignons'], 'Gekochtes Gemüse (nicht aus der Dose), total '],
  [['rohkost', 'gemusesticks'], 'Frischgemüse, total '],
  [['salat', 'blattsalat', 'kopfsalat', 'nusslisalat', 'rucola', 'eisbergsalat', 'lattich'], 'Salat (Blattgemüse) '],
  [['gurke', 'gurken'], 'Gurke'],
  [['karotte', 'karotten', 'ruebli', 'rubli'], 'Karotte '],
  [['tomate', 'tomaten', 'cherrytomaten'], 'Tomate'],
  [['zucchini', 'zucchetti'], 'Zucchini'],
  [['fruchte', 'obst', 'fruchtsalat'], 'Frischobst, total '],
  [['apfel'], 'Apfel'],
  [['birne'], 'Birne'],
  [['beeren', 'erdbeeren', 'himbeeren', 'heidelbeeren'], 'Beeren '],
  [['orange'], 'Orange'],
  [['mandarine', 'klementine'], 'Mandarine und Klementine '],
  [['trauben', 'traube'], 'Traube'],
  [['joghurt', 'jogurt', 'yoghurt'], 'Joghurt, total'],
  [['quark'], 'Quark, total'],
  [['milch'], 'Milch'],
  [['kase', 'gruyere', 'emmentaler', 'appenzeller', 'parmesan', 'sbrinz', 'tilsiter'], 'Halbhart- oder Hartkäse (ohne Fondue und Raclette) '],
  [['mozzarella'], 'Mozzarella'],
  [['feta'], 'Feta'],
  [['weichkase', 'camembert', 'brie', 'tomme'], 'Weichkäse'],
  [['frischkase', 'streichkase', 'huttenkase'], 'Streich- oder Frischkäse '],
  [['fondue'], 'Fondue'],
  [['raclette'], 'Raclette'],
  [['poulet', 'huhn', 'hahnchen', 'hendl', 'pouletbrust', 'truthahn', 'trute'], 'Hühnerfleisch'],
  [['fleisch', 'rind', 'rindfleisch', 'schwein', 'schweinefleisch', 'kalb', 'kalbfleisch', 'steak', 'geschnetzeltes', 'hackfleisch', 'lamm', 'schnitzel', 'platzli'], 'Fleisch '],
  [['wurst', 'bratwurst', 'cervelat', 'wienerli', 'klopfer'], 'Wurst (gekocht)'],
  [['schinken'], 'Schinken (gekocht) '],
  [['salami'], 'Salami'],
  [['fisch', 'lachs', 'forelle', 'thunfisch', 'kabeljau', 'egli', 'zander', 'dorsch'], 'Fisch'],
  [['crevetten', 'garnelen', 'meeresfruchte', 'muscheln'], 'Meeresfrüchte'],
  [['ei', 'eier', 'spiegelei', 'ruhrei', 'omelett'], 'Vollei'],
  [['tofu'], 'Tofu'],
  [['bohnen'], 'Bohnen'],
  [['kichererbsen', 'hummus'], 'Kircherbsen'],
  [['linsen'], 'Linsen'],
  [['olivenol', 'rapsol', 'sonnenblumenol', 'speiseol', 'ol'], 'Pflanzliche Öle '],
  [['butter'], 'Butter'],
  [['rahm', 'sahne'], 'Rahm'],
  [['nusse', 'mandeln', 'baumnusse', 'haselnusse', 'cashew'], 'Nüsse'],
  [['schokolade'], 'Schokolade '],
  [['kekse', 'guetzli', 'biskuit'], 'Kekse '],
  [['glace', 'eis', 'sorbet', 'glacé'], 'Eiscreme und Sorbet '],
  [['konfiture', 'marmelade'], 'Konfitüre'],
  [['honig'], 'Honig'],
  [['chips'], 'Chips'],
  [['suppe'], 'Suppe'],
  [['bouillon', 'brühe', 'bruhe'], 'Bouillon'],
  [['salatsauce', 'dressing', 'mayonnaise', 'mayo'], 'Salat- und Dipsaucen und Mayonnaise '],
  [['bolognese'], 'Sauce Bolognese'],
  [['tomatensauce'], 'Tomatensauce'],
  [['wasser'], 'Wasser'],
  [['tee'], 'Tee'],
  [['kaffee', 'espresso', 'kafi'], 'Kaffee, schwarz'],
  [['milchkaffee', 'cappuccino', 'latte', 'kafi creme', 'schale'], 'Kaffee mit Milch'],
  [['saft', 'orangensaft', 'apfelsaft'], 'Fruchtsaft'],
  [['wein'], 'Wein'],
  [['bier'], 'Bier'],
];

/** Die Tabelle flach, laengste Woerter zuerst (gleich lang: alphabetisch). */
const WORDS = GERMAN.flatMap(([words, category]) => words.map((word) => ({ word: fold(word), category: category.trim() })))
  .sort((a, b) => b.word.length - a.word.length || (a.word < b.word ? -1 : 1));

/** Kommt das Wort im Text vor, nach den Regeln oben? */
function occurs(word, folded, tokens) {
  if (word.includes(' ')) return ` ${folded} `.includes(` ${word} `);
  if (word.length <= 3) return tokens.includes(word);
  if (word.length === 4) return tokens.some((token) => token.startsWith(word) || token.endsWith(word));
  return folded.includes(word);
}

/** Die menuCH-Kategorie zu einem deutschen Begriff, oder null. */
function germanCategoryOf(text) {
  const folded = fold(text);
  if (!folded) return null;
  const tokens = folded.split(' ');
  return WORDS.find((entry) => occurs(entry.word, folded, tokens))?.category ?? null;
}

const SLOT_ALIASES = {
  breakfast: 'breakfast', fruehstueck: 'breakfast', fruhstuck: 'breakfast', zmorge: 'breakfast',
  lunch: 'lunch', mittag: 'lunch', mittagessen: 'lunch', zmittag: 'lunch',
  dinner: 'dinner', abend: 'dinner', abendessen: 'dinner', znacht: 'dinner',
  snack: 'snack', znueni: 'snack', znuni: 'snack', zvieri: 'snack', imbiss: 'snack',
};

/** Unter so vielen Nennungen ist der Wert einer Mahlzeit zu duenn; dann gilt die haeufigste. */
const MIN_SLOT_N = 5;

/**
 * Median-Portion einer Kategorie zu einer Mahlzeit. Findet das Deutsche nichts,
 * wird der englische Name der Kategorie verglichen („rice“, „pasta“).
 */
function portionHint(categories, slot, text) {
  if (!categories.length) return null;
  const name = germanCategoryOf(text);
  let category = name ? categories.find((entry) => entry.name.trim() === name) : null;
  if (!category) {
    const key = keyOf(text);
    const tokens = new Set(tokensOf(text));
    category =
      categories.find((entry) => entry.nameEn && keyOf(entry.nameEn.replace(/,?\s*total\s*$/i, '')) === key) ??
      categories.find((entry) => {
        const words = tokensOf(String(entry.nameEn ?? '').replace(/,?\s*total\s*$/i, '')).filter((token) => !STOPWORDS.has(token));
        return words.length === 1 && tokens.has(words[0]);
      }) ??
      null;
  }
  if (!category) return null;
  const wanted = SLOT_ALIASES[fold(slot).replace(/ /g, '')] ?? 'lunch';
  let used = wanted;
  let cell = category.perMeal[wanted];
  if (!cell || cell.n < MIN_SLOT_N) {
    const best = Object.entries(category.perMeal).sort((a, b) => b[1].n - a[1].n || (a[0] < b[0] ? -1 : 1))[0];
    if (!best || best[1].n === 0) return null;
    [used, cell] = best;
  }
  return { category: category.name.trim(), nameEn: category.nameEn?.trim() ?? null, slot: used, requestedSlot: wanted, median: cell.median, mean: cell.mean, n: cell.n, source: 'menuch' };
}

/** FNDDS einmal in Woerter zerlegen; `head` ist der Teil vor dem ersten Komma. */
function indexFoods(foods) {
  return foods.map((food) => {
    const tokens = tokensOf(food.description);
    return { food, tokens: new Set(tokens), first: tokens[0] ?? '', head: new Set(tokensOf(food.description.split(',')[0])), length: tokens.length };
  });
}

/**
 * Standardportionen eines Gerichts: das FNDDS-Lebensmittel, in dessen
 * Beschreibung alle Inhaltswoerter der Anfrage stehen. FNDDS schreibt
 * „Gericht, Zubereitung, Naeheres“ — der Teil vor dem ersten Komma ist also
 * das Gericht selbst. Danach wird sortiert:
 * 1. die Beschreibung faengt mit einem Wort der Anfrage an („Pizza, cheese …“
 *    vor „Dessert pizza“),
 * 2. alle Woerter der Anfrage stehen vor dem ersten Komma,
 * 3. der engste Kopf zuerst („Spaghetti sauce“ vor „Spaghetti and meatballs
 *    dinner, NFS, frozen meal“),
 * 4. „NFS“ (not further specified) — der allgemeine Eintrag vor dem besonderen
 *    („Rice, cooked, NFS“ vor „Rice milk“),
 * 5. die kuerzeste Beschreibung, zuletzt die kleinste Kennzahl.
 * Babynahrung nur, wenn danach gefragt ist.
 */
function fnddsPortions(foodIndex, term, limit = 1) {
  const tokens = tokensOf(term);
  const words = tokens.filter((token) => !STOPWORDS.has(token));
  if (!words.length) return [];
  // „baby“ ist sonst ein Zubereitungswort (Babyspinat) und faellt aus `words`.
  const baby = tokens.includes('baby');
  const hits = foodIndex.filter((entry) => words.every((word) => entry.tokens.has(word)) && (baby || !entry.tokens.has('baby')));
  const rank = (entry) => [
    words.includes(entry.first) ? 0 : 1,
    words.every((word) => entry.head.has(word)) ? 0 : 1,
    entry.head.size,
    entry.tokens.has('nfs') ? 0 : 1,
    entry.length,
    entry.food.code,
  ];
  hits.sort((a, b) => {
    const [x, y] = [rank(a), rank(b)];
    return x.reduce((order, value, index) => order || value - y[index], 0);
  });
  return hits.slice(0, Math.max(1, limit)).map(({ food }) => ({ code: food.code, description: food.description, category: food.category, portions: food.portions }));
}

module.exports = { GERMAN, germanCategoryOf, portionHint, indexFoods, fnddsPortions, SLOT_ALIASES };
