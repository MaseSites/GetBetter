#!/usr/bin/env node
/**
 * Referenzwissen fuer die Foto-Analyse von Better Fit bauen:
 *
 *   node scripts/import-fit-reference.js [quellordner] [--out datei]
 *
 * Liest aus `services/api/data/fit-reference/` (Standard):
 *   nutrition5k/dish_metadata_cafe1.csv, dish_metadata_cafe2.csv,
 *   nutrition5k/dish_ids/splits/rgb_train_ids.txt, rgb_test_ids.txt, images/<id>.jpg
 *   fndds/Portions_and_Weights.xlsx
 *   menuch/portion_sizes_per_meal.xlsx
 * und schreibt `reference.json` in denselben Ordner. Alles bleibt ausserhalb
 * des Git (`services/api/data/`).
 */
const fs = require('node:fs');
const path = require('node:path');

const { readSheets } = require('../services/api/fit/reference/xlsx.js');
const { buildDishes, buildPriors, buildFndds, buildMenuch } = require('../services/api/fit/reference/build.js');
const { SOURCES } = require('../services/api/fit/reference/sources.js');

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const out = outIndex >= 0 ? args[outIndex + 1] : null;
const positional = args.filter((arg, index) => !arg.startsWith('--') && index !== outIndex + 1);
const dir = path.resolve(positional[0] ?? path.join(__dirname, '..', 'services', 'api', 'data', 'fit-reference'));
const target = path.resolve(out ?? path.join(dir, 'reference.json'));

const readText = (...parts) => {
  const file = path.join(dir, ...parts);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
};
const idsOf = (text) => new Set(text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));

function nutrition5k() {
  const csv = ['dish_metadata_cafe1.csv', 'dish_metadata_cafe2.csv'].map((name) => readText('nutrition5k', name));
  if (!csv.some(Boolean)) return { dishes: [], broken: 0, unsplit: 0 };
  const imageDir = path.join(dir, 'nutrition5k', 'images');
  const images = new Set(fs.existsSync(imageDir) ? fs.readdirSync(imageDir).filter((name) => name.endsWith('.jpg')).map((name) => name.slice(0, -4)) : []);
  return buildDishes(csv, {
    trainIds: idsOf(readText('nutrition5k', 'dish_ids', 'splits', 'rgb_train_ids.txt')),
    testIds: idsOf(readText('nutrition5k', 'dish_ids', 'splits', 'rgb_test_ids.txt')),
    hasImage: (id) => images.has(id),
  });
}

function fndds() {
  const file = path.join(dir, 'fndds', 'Portions_and_Weights.xlsx');
  if (!fs.existsSync(file)) return [];
  const [sheet] = readSheets(fs.readFileSync(file));
  return sheet ? buildFndds(sheet.rows) : [];
}

function menuch() {
  const file = path.join(dir, 'menuch', 'portion_sizes_per_meal.xlsx');
  if (!fs.existsSync(file)) return { categories: [], shifted: 0 };
  const sheets = readSheets(fs.readFileSync(file));
  const german = sheets.find((sheet) => /mahlzeit/i.test(sheet.name)) ?? sheets[0];
  const english = sheets.find((sheet) => /^per meal/i.test(sheet.name)) ?? null;
  return buildMenuch(german.rows, english?.rows ?? null);
}

const started = Date.now();
const n5k = nutrition5k();
const priors = buildPriors(n5k.dishes);
const foods = fndds();
const swiss = menuch();

const reference = {
  version: 1,
  builtAt: new Date().toISOString(),
  sources: SOURCES,
  nutrition5k: { dishes: n5k.dishes },
  ingredientPriors: priors,
  fndds: { foods },
  menuch: { categories: swiss.categories },
};
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(reference));

const count = (split) => n5k.dishes.filter((dish) => dish.split === split).length;
console.log(`Nutrition5k: ${n5k.dishes.length} Gerichte (train ${count('train')}, test ${count('test')}, mit Foto ${n5k.dishes.filter((dish) => dish.image).length}), ${n5k.broken} kaputt verworfen, ${n5k.unsplit} ohne Split (als train)`);
console.log(`Zutaten-Priors: ${Object.keys(priors).length}`);
console.log(`FNDDS: ${foods.length} Lebensmittel, ${foods.reduce((sum, food) => sum + food.portions.length, 0)} Portionen`);
console.log(`menuCH: ${swiss.categories.length} Kategorien, ${swiss.shifted} verschobene Zellen zurechtgerueckt`);
console.log(`→ ${target} (${Math.round(fs.statSync(target).size / 1024)} KB, ${Date.now() - started} ms)`);
