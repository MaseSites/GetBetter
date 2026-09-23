/**
 * Genauigkeits-Benchmark der **zweiten Haelfte** der Foto-Pipeline von Better
 * Fit — ohne KI, ohne Netz, ohne Kosten, und darum ueber Tausende Gerichte.
 *
 *   npx -y node@24 scripts/fit-db-benchmark.js [--n 5000] [--label db-baseline]
 *                                              [--no-cooking] [--mode live|mock]
 *                                              [--out datei.json]
 *   npx -y node@24 scripts/fit-db-benchmark.js --compare a.json b.json
 *
 * Die Idee: Nutrition5k kennt je Gericht die Wahrheit — Zutat (englisch),
 * Gramm und kcal/Makros. Wir schicken **Zutat und Gramm** durch genau den Weg,
 * den eine Antwort der KI nimmt (`matchFoods` → `catalog.match` →
 * `cooking.js` → `totalsOf` → `computeMeal`) und vergleichen die Summe mit der
 * Wahrheit. Was uebrig bleibt, ist der Fehler **unseres** Codes: falsche oder
 * fehlende Datensaetze, roh statt gekocht, Werte je 100 g — unabhaengig davon,
 * wie gut das Bildmodell sieht und schaetzt.
 *
 * Den deutschen Suchbegriff liefert im Betrieb das Bildmodell
 * (`swissSearchTerm`); hier steht er in `benchmark/terms.js` und spielt einen
 * perfekten Uebersetzer. Die Schweizer Datenbank fuehrt nur deutsche Namen.
 *
 * `--no-cooking` schaltet allein die Umrechnung roh→gekocht ab
 * (`cookedVariant`), damit sich ihre Wirkung beziffern laesst. Die Ableitung
 * „das lag gekocht auf dem Teller“ (`expectsCooking`) bleibt an, sonst
 * vermischten sich zwei Wirkungen.
 *
 * Schreibt services/api/data/fit-reference/benchmarks/<datum>-<label>.json und
 * .md. Deterministisch: dieselbe Datenlage gibt Zeile fuer Zeile dasselbe.
 * `services/api/**` wird nur gelesen.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { loadDishes } = require('./benchmark/nutrition5k.js');
const { scoreDish, summarize } = require('./benchmark/dbmetrics.js');
const { markdown, compareMarkdown } = require('./benchmark/dbreport.js');
const { termFor } = require('./benchmark/terms.js');

const API = path.join(__dirname, '..', 'services', 'api');
const DATA = path.join(API, 'data');
const N5K = path.join(DATA, 'fit-reference', 'nutrition5k');
const OUT_DIR = path.join(DATA, 'fit-reference', 'benchmarks');

/** Grenzen fuer kaputte Wahrheit (Nutrition5k hat Waagefehler und Platzhalter). */
const MAX_KCAL = 3000;
const MAX_KCAL_PER_G = 9;
/** Unter einem Gramm nimmt `computeMeal` keinen Posten an (`checkPortion`). */
const MIN_GRAMS = 1;

function parseArgs(argv) {
  const args = { n: Infinity, label: 'db-baseline', cooking: true, mode: 'live', out: null, compare: null };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i].replace(/^--/, '');
    if (key === 'compare') {
      args.compare = [path.resolve(argv[i + 1]), path.resolve(argv[i + 2])];
      i += 2;
      continue;
    }
    if (key === 'no-cooking') {
      args.cooking = false;
      continue;
    }
    const value = argv[i + 1];
    i += 1;
    if (key === 'n') args.n = Number(value);
    else if (key === 'label') args.label = String(value).replace(/[^a-zA-Z0-9_-]/g, '-');
    else if (key === 'mode') args.mode = value === 'mock' ? 'mock' : 'live';
    else if (key === 'out') args.out = path.resolve(value);
    else throw new Error(`Unbekannte Option --${key}`);
  }
  if (!args.compare && !(args.n > 0)) throw new Error('--n muss groesser als 0 sein');
  return args;
}

/**
 * Die Module des Dienstes laden — und bei `--no-cooking` vorher die
 * Umrechnung stilllegen. `analysis.js` holt sich `expectsCooking` beim Laden,
 * darum muss der Eingriff davor passieren. Geaendert wird nur der Zwischen-
 * speicher dieses Prozesses, nie eine Datei.
 */
function loadPipeline(cooking) {
  const cookingModule = require(path.join(API, 'fit', 'catalog', 'cooking.js'));
  if (!cooking) cookingModule.cookedVariant = () => null;
  const { createCatalog } = require(path.join(API, 'fit', 'catalog', 'index.js'));
  const { matchFoods, totalsOf } = require(path.join(API, 'fit', 'analysis.js'));
  return { createCatalog, matchFoods, totalsOf };
}

/**
 * Fingerabdruck der Katalogdatei. Wird am Katalog gearbeitet, aendern sich die
 * Zahlen zwischen zwei Laeufen — ohne diesen Wert saehe es nach Zufall aus.
 * Zwei Laeufe sind nur dann vergleichbar, wenn er derselbe ist.
 */
function catalogFingerprint() {
  try {
    const bytes = fs.readFileSync(path.join(DATA, 'fit-catalog-swiss.json'));
    return crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 12);
  } catch {
    return null;
  }
}

/** Taugt die Wahrheit? Waagefehler, Platzhalter und unmoegliche Dichten fliegen raus. */
function usableTruth(dish) {
  if (!(dish.massG > 0) || !(dish.kcal > 0)) return false;
  if (dish.kcal > MAX_KCAL || dish.kcal / dish.massG > MAX_KCAL_PER_G) return false;
  if (dish.ingredients.length === 0) return false;
  for (const entry of dish.ingredients) {
    if (!Number.isFinite(entry.grams) || entry.grams < 0) return false;
    // Ein Platzhalter macht die ganze Zeile unbrauchbar: seine kcal stehen in
    // der Summe, sein Name steht fuer nichts.
    if (termFor(entry.name)?.skip) return false;
  }
  return true;
}

/**
 * Aus der Wahrheit eine Beobachtung bauen, wie sie das Bildmodell liefern
 * wuerde: englischer Name als `displayName` und `canonicalSearchTerm`,
 * deutscher als `swissSearchTerm` — genau die drei Begriffe, die `matchFoods`
 * der Reihe nach probiert. Die Gramm sind die echten, damit die Schaetzung
 * der Portion nichts vernebelt.
 */
function visionOf(dish) {
  const foods = [];
  let skippedTiny = 0;
  for (const entry of dish.ingredients) {
    if (!(entry.grams >= MIN_GRAMS)) {
      skippedTiny += 1;
      continue;
    }
    const term = termFor(entry.name);
    const grams = Math.round(entry.grams * 10) / 10;
    foods.push({
      displayName: entry.name,
      canonicalSearchTerm: entry.name,
      swissSearchTerm: term?.de ?? '',
      preparation: term?.prep ?? '',
      estimatedGrams: grams,
      minGrams: grams,
      maxGrams: grams,
      confidence: 1,
      visibleIngredients: [],
      possibleHiddenIngredients: [],
      alternatives: [],
      truth: entry,
    });
  }
  return { foods, skippedTiny };
}

/** Ein Gericht durch die Pipeline schicken. */
function runDish(dish, { matchFoods, totalsOf, match }) {
  const { foods, skippedTiny } = visionOf(dish);
  if (foods.length === 0) return null;
  const items = matchFoods({ foods }, match);
  const totals = totalsOf(items);
  const lines = items.map((item, index) => {
    const values = totals.lines[index];
    const truth = foods[index].truth;
    return {
      name: truth.name,
      grams: item.grams,
      truthKcal: truth.kcal,
      kcal: values?.kcal ?? 0,
      foodId: item.food?.id ?? null,
      foodName: item.food ? (item.food.names?.de ?? item.food.names?.en ?? null) : null,
      state: item.food?.state ?? null,
      converted: Boolean(item.food?.derivedFrom),
      score: item.matchScore,
      uncertain: item.matchUncertain,
    };
  });
  const predicted = {
    kcal: totals.total.kcal,
    proteinG: totals.total.proteinG,
    carbsG: totals.total.carbsG,
    fatG: totals.total.fatG,
  };
  return {
    dishId: dish.id,
    skippedTiny,
    truth: { kcal: dish.kcal, massG: dish.massG, proteinG: dish.proteinG, carbsG: dish.carbsG, fatG: dish.fatG },
    predicted,
    score: scoreDish(dish, predicted),
    lines,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.compare) {
    const [a, b] = args.compare.map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
    console.log(compareMarkdown(a, b));
    return;
  }

  const { createCatalog, matchFoods, totalsOf } = loadPipeline(args.cooking);
  const catalog = createCatalog({ dataDir: DATA, mode: args.mode });
  const info = catalog.info();
  if (info.foods === 0) throw new Error(`Kein Katalog in ${DATA} — fit-catalog-swiss.json fehlt.`);
  // Genau der Aufruf aus `routes/analysis.js`, nur ohne eigene Lebensmittel
  // und ohne USDA: gemessen werden soll der Katalog, den jedes Konto sieht.
  const match = (term, preparation) => catalog.match(term, { preparation });

  const all = [...loadDishes(N5K).values()];
  if (all.length === 0) throw new Error(`Keine Gerichte in ${N5K}.`);
  // Nach Id sortiert, nicht gemischt: derselbe Lauf gibt dieselbe Stichprobe.
  const dishes = all
    .filter(usableTruth)
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, Number.isFinite(args.n) ? args.n : all.length);

  const started = Date.now();
  const records = [];
  for (const dish of dishes) {
    const record = runDish(dish, { matchFoods, totalsOf, match });
    if (record) records.push(record);
  }

  const meta = {
    label: args.label,
    date: new Date().toISOString().slice(0, 10),
    dishesTotal: all.length,
    dishesUsable: dishes.length,
    dishesSkipped: all.length - dishes.length,
    cooking: args.cooking,
    catalog: {
      foods: info.foods,
      swissVersion: info.swissVersion,
      mode: info.mode,
      fingerprint: catalogFingerprint(),
    },
    seconds: Math.round((Date.now() - started) / 100) / 10,
  };
  const summary = summarize(records, meta);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const base = args.out ?? path.join(OUT_DIR, `${meta.date}-${args.label}.json`);
  // Die Zeilen je Gericht bleiben drin: ohne sie liesse sich eine Zutat
  // spaeter nicht mehr nachschlagen.
  fs.writeFileSync(base, `${JSON.stringify({ meta, summary, records }, null, 1)}\n`);
  const report = markdown(meta, summary);
  fs.writeFileSync(base.replace(/\.json$/, '.md'), `${report}\n`);
  console.log(report);
  console.log(`Geschrieben: ${base}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
