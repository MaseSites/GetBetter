/**
 * Aus den heruntergeladenen Quellen den kompakten Stand `reference.json`
 * bauen. Nur reine Funktionen ueber Text und Zeilen — das Lesen der Dateien
 * macht `scripts/import-fit-reference.js`, damit die Tests mit kleinen
 * Beispielen auskommen.
 */
const { keyOf, quantile } = require('./normalize.js');

const round1 = (value) => Math.round(value * 10) / 10;

/**
 * Eine Zeile der Nutrition5k-Metadaten: sechs Felder zum Gericht, dann je
 * Zutat sieben (ingr_id, Name, Gramm, kcal, Fett, KH, Eiweiss).
 */
function parseDishLine(line) {
  const cells = line.trim().split(',');
  if (cells.length < 6 || !cells[0].startsWith('dish_')) return null;
  const [id, kcal, mass, fat, carb, protein] = [cells[0], ...cells.slice(1, 6).map(Number)];
  const ingredients = [];
  for (let index = 6; index + 6 < cells.length; index += 7) {
    const name = cells[index + 1].trim();
    const grams = Number(cells[index + 2]);
    const ingredientKcal = Number(cells[index + 3]);
    if (!name || !Number.isFinite(grams)) continue;
    ingredients.push({ name, grams: round1(grams), kcal: round1(Number.isFinite(ingredientKcal) ? ingredientKcal : 0) });
  }
  return { id, mass, kcal, fatG: fat, carbG: carb, proteinG: protein, ingredients };
}

/** Offensichtlich kaputte Gerichte: keine Masse, ueber 3000 kcal, ueber 9 kcal je Gramm, keine Zutat. */
function isBroken(dish) {
  if (![dish.mass, dish.kcal, dish.fatG, dish.carbG, dish.proteinG].every(Number.isFinite)) return true;
  if (dish.mass <= 0 || dish.kcal < 0 || dish.kcal > 3000) return true;
  if (dish.kcal / dish.mass > 9) return true;
  return dish.ingredients.length === 0;
}

/**
 * Alle Gerichte aus den CSV-Texten. `trainIds`/`testIds` sind Mengen, `hasImage`
 * sagt, ob das Foto auf der Platte liegt. Gerichte ohne Split (meist ohne Foto
 * von oben) zaehlen als train — in den Test kommen sie ohnehin nie.
 */
function buildDishes(csvTexts, { trainIds, testIds, hasImage = () => false }) {
  const seen = new Set();
  const dishes = [];
  let broken = 0;
  let unsplit = 0;
  for (const text of csvTexts) {
    for (const line of text.split(/\r?\n/)) {
      const dish = parseDishLine(line);
      if (!dish || seen.has(dish.id)) continue;
      seen.add(dish.id);
      if (isBroken(dish)) {
        broken += 1;
        continue;
      }
      const split = testIds.has(dish.id) ? 'test' : 'train';
      if (!testIds.has(dish.id) && !trainIds.has(dish.id)) unsplit += 1;
      dishes.push({
        id: dish.id,
        split,
        image: Boolean(hasImage(dish.id)),
        mass: round1(dish.mass),
        kcal: round1(dish.kcal),
        fatG: round1(dish.fatG),
        carbG: round1(dish.carbG),
        proteinG: round1(dish.proteinG),
        ingredients: dish.ingredients,
      });
    }
  }
  dishes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { dishes, broken, unsplit };
}

/**
 * Wie viel von einer Zutat typischerweise auf dem Teller liegt — nur aus den
 * train-Gerichten, damit der Test sauber bleibt. Dieselbe Zutat zweimal im
 * selben Gericht wird zusammengezaehlt; Spuren unter 0.5 g fallen weg.
 */
function buildPriors(dishes) {
  const grams = new Map();
  for (const dish of dishes) {
    if (dish.split !== 'train') continue;
    const perDish = new Map();
    for (const ingredient of dish.ingredients) {
      const key = keyOf(ingredient.name);
      if (!key) continue;
      perDish.set(key, (perDish.get(key) ?? 0) + ingredient.grams);
    }
    for (const [key, value] of perDish) {
      if (value < 0.5) continue;
      if (!grams.has(key)) grams.set(key, []);
      grams.get(key).push(value);
    }
  }
  const priors = {};
  for (const key of [...grams.keys()].sort()) {
    const values = grams.get(key).sort((a, b) => a - b);
    priors[key] = {
      n: values.length,
      p10: quantile(values, 0.1),
      p25: quantile(values, 0.25),
      median: quantile(values, 0.5),
      p75: quantile(values, 0.75),
      p90: quantile(values, 0.9),
    };
  }
  return priors;
}

/** Die Kopfzeile finden: die erste Zeile, deren erste Zelle „Food code“ heisst. */
function headerIndex(rows) {
  return rows.findIndex((row) => String(row[0] ?? '').trim().toLowerCase() === 'food code');
}

/**
 * FNDDS: je Lebensmittel die Standardportionen. „Quantity not specified“ und
 * 0 g fallen weg, ebenso die „Guideline amount“-Zeilen (Beilagen-Richtwerte).
 */
function buildFndds(portionRows) {
  const start = headerIndex(portionRows);
  const foods = new Map();
  for (const row of portionRows.slice(start + 1)) {
    const [code, description, , category, , portion, weight] = row;
    if (!Number.isFinite(code) || typeof description !== 'string') continue;
    if (!foods.has(code)) foods.set(code, { code, description: description.trim(), category: String(category ?? '').trim(), portions: [] });
    const desc = String(portion ?? '').trim();
    const grams = Number(weight);
    if (!desc || !Number.isFinite(grams) || grams <= 0) continue;
    if (/quantity not specified/i.test(desc) || /^guideline amount/i.test(desc)) continue;
    foods.get(code).portions.push({ desc, grams: round1(grams) });
  }
  return [...foods.values()].filter((food) => food.portions.length > 0);
}

const MEALS = ['breakfast', 'lunch', 'dinner', 'znueni', 'zvieri', 'lateSnack'];

/**
 * Vier Zahlen einer Mahlzeit lesen. In drei Zeilen (Saucen, Mittagessen)
 * stehen sie verschoben als Median, Mittel, SEM — erkennbar daran, dass der
 * „SEM“ groesser als das „Mittel“ ist. Dann wird zurechtgerueckt.
 */
function mealCells(row, column) {
  let [mean, sem, median, n] = [row[column], row[column + 1], row[column + 2], row[column + 3]].map(Number);
  let shifted = false;
  if (Number.isFinite(sem) && Number.isFinite(mean) && sem > mean && n > 0) {
    [median, mean, sem] = [mean, sem, median];
    shifted = true;
  }
  if (![mean, median, n].every(Number.isFinite)) return null;
  return { mean: round1(mean), median: round1(median), n, shifted };
}

/**
 * Ein menuCH-Blatt „pro Mahlzeit“: Kopfzeile mit „Durchschnitt/Mean“ je
 * Mahlzeit, Gruppen in Spalte B, Lebensmittel in Spalte C.
 */
const MEAN_HEADER = /^(dur\w*chnitt|mean|moyenne)/i;

function parseMenuchSheet(rows) {
  const headerRow = rows.findIndex((row) => row.filter((cell) => MEAN_HEADER.test(String(cell ?? '').trim())).length >= 6);
  if (headerRow < 0) return [];
  const columns = rows[headerRow]
    .map((cell, index) => (MEAN_HEADER.test(String(cell ?? '').trim()) ? index : -1))
    .filter((index) => index >= 0)
    .slice(0, 6);
  const items = [];
  let group = '';
  for (const row of rows.slice(headerRow + 2)) {
    const groupCell = String(row[1] ?? '').trim();
    const nameCell = String(row[2] ?? '').trim();
    if (groupCell && !nameCell && row.slice(3).every((cell) => cell === null || cell === '')) {
      group = groupCell;
      continue;
    }
    if (!nameCell || /^(quelle|source|abk|abbrev|\d\))/i.test(groupCell)) continue;
    const meals = {};
    for (const [index, meal] of MEALS.entries()) meals[meal] = mealCells(row, columns[index]);
    if (!meals.lunch) continue;
    items.push({ group, name: nameCell, meals });
  }
  return items;
}

/** Imbiss = Znueni, Zvieri und Spaetsnack, gewichtet nach Anzahl. */
function snackOf(meals) {
  const parts = [meals.znueni, meals.zvieri, meals.lateSnack].filter((part) => part && part.n > 0);
  const n = parts.reduce((sum, part) => sum + part.n, 0);
  if (!n) return { mean: 0, median: 0, n: 0 };
  const weighted = (field) => round1(parts.reduce((sum, part) => sum + part[field] * part.n, 0) / n);
  return { mean: weighted('mean'), median: weighted('median'), n };
}

/**
 * menuCH-Kategorien mit Portion je Mahlzeit. `englishRows` (Blatt „per meal“)
 * liefert den englischen Namen, wenn es gleich viele Zeilen hat.
 */
function buildMenuch(germanRows, englishRows = null) {
  const german = parseMenuchSheet(germanRows);
  const english = englishRows ? parseMenuchSheet(englishRows) : [];
  const sameShape = english.length === german.length;
  let shifted = 0;
  const categories = german.map((item, index) => {
    const slot = (meal) => {
      const cell = item.meals[meal];
      if (cell?.shifted) shifted += 1;
      return cell ? { mean: cell.mean, median: cell.median, n: cell.n } : { mean: 0, median: 0, n: 0 };
    };
    return {
      name: item.name,
      nameEn: sameShape ? english[index].name : null,
      group: item.group,
      perMeal: { breakfast: slot('breakfast'), lunch: slot('lunch'), dinner: slot('dinner'), snack: snackOf(item.meals) },
    };
  });
  return { categories, shifted };
}

module.exports = { parseDishLine, isBroken, buildDishes, buildPriors, buildFndds, parseMenuchSheet, buildMenuch };
