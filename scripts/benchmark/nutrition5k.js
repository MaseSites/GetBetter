/**
 * Nutrition5k lesen (Google Research, CC BY 4.0): Gerichte mit Gesamtwerten
 * und Zutaten, die Splits und welche Bilder schon auf der Platte liegen.
 *
 * Zeile: dish_id,total_calories,total_mass,total_fat,total_carb,total_protein,
 * dann je Zutat ingr_id,ingr_name,grams,calories,fat,carb,protein.
 */
const fs = require('node:fs');
const path = require('node:path');

function parseDishLine(line) {
  const cells = line.trim().split(',');
  if (cells.length < 6 || !cells[0].startsWith('dish_')) return null;
  const num = (value) => Number(value);
  const ingredients = [];
  for (let i = 6; i + 6 < cells.length; i += 7) {
    ingredients.push({
      id: cells[i],
      name: cells[i + 1],
      grams: num(cells[i + 2]),
      kcal: num(cells[i + 3]),
      fatG: num(cells[i + 4]),
      carbsG: num(cells[i + 5]),
      proteinG: num(cells[i + 6]),
    });
  }
  return {
    id: cells[0],
    kcal: num(cells[1]),
    massG: num(cells[2]),
    fatG: num(cells[3]),
    carbsG: num(cells[4]),
    proteinG: num(cells[5]),
    ingredients,
  };
}

function loadDishes(root) {
  const dishes = new Map();
  for (const file of ['dish_metadata_cafe1.csv', 'dish_metadata_cafe2.csv']) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
      const dish = parseDishLine(line);
      if (dish) dishes.set(dish.id, dish);
    }
  }
  return dishes;
}

function loadSplit(root, split) {
  const file = path.join(root, 'dish_ids', 'splits', `rgb_${split}_ids.txt`);
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

const imagePath = (root, id) => path.join(root, 'images', `${id}.jpg`);

/** Ein Bild gilt erst als da, wenn es ein vollstaendiges JPEG ist (Download laeuft evtl. noch). */
function imageReady(root, id) {
  try {
    const bytes = fs.readFileSync(imagePath(root, id));
    return bytes.length > 1000 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  } catch {
    return false;
  }
}

/** Deterministisch nach Seed (mulberry32 + Fisher-Yates). */
function shuffle(list, seed) {
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Die Zutat mit den meisten Gramm — fuer die Aufschluesselung. */
const dominantOf = (dish) =>
  dish.ingredients.reduce((best, entry) => (!best || entry.grams > best.grams ? entry : best), null)?.name ?? 'unknown';

module.exports = { loadDishes, loadSplit, imagePath, imageReady, shuffle, dominantOf, parseDishLine };
