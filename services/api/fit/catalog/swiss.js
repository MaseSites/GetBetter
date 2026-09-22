/**
 * Die Schweizer Naehrwertdatenbank (BLV, naehrwertdaten.ch) in den Katalog.
 *
 * Gelesen wird die offizielle XLSX-Datei, nie abgeschriebene Webseitenwerte.
 * Die Spalten findet der Import ueber ihre Ueberschrift (Deutsch, Franzoesisch,
 * Italienisch oder Englisch), nicht ueber feste Positionen — so ueberlebt er
 * eine neue Fassung mit verschobenen Spalten. Zeilen, deren Werte die
 * Plausibilitaet nicht bestehen, fallen weg und werden gezaehlt.
 */
const { checkPer100 } = require('../nutrition.js');
const { inferAllergens } = require('./allergens.js');
const { normalize, stateOf } = require('./index.js');

const LANGUAGES = ['de', 'fr', 'it', 'en'];

/** Ueberschrift -> Feld. Reihenfolge zaehlt: das erste passende Muster gewinnt. */
const HEADERS = [
  ['id', /^id$/i],
  ['name', /^(name|nom|nome)$/i],
  ['synonyms', /^(synonyme?s?|sinonimi)$/i],
  ['category', /^(kategorie|catégorie|categoria|category)/i],
  ['unit', /^(bezugseinheit|unité de référence|unità di riferimento|matrix unit|reference unit)/i],
  ['density', /^(dichte|densité|densità|density)/i],
  ['kcal', /(kalorien|calories|calorie).*kcal|kcal/i],
  ['proteinG', /^(protein|protéines|proteine|proteins?)\b/i],
  ['carbsG', /(kohlenhydrate|glucides|carboidrati|carbohydrates?).*(verfügbar|disponibles?|disponibili|available)/i],
  ['fatG', /^(fett,? total|lipides,? totaux|grassi,? totali|fat,? total)/i],
  ['fiberG', /^(nahrungsfasern|fibres alimentaires|fibre alimentari|dietary fibres?)/i],
  ['sugarG', /^(zucker|sucres|zuccheri|sugars?)\b/i],
  ['saltG', /^(salz|sel|sale|salt)\b/i],
];

/** Welche Spalte ist welches Feld — aus der ersten Zeile, die Name und kcal hat. */
function findColumns(rows) {
  for (let index = 0; index < Math.min(rows.length, 15); index += 1) {
    const row = rows[index] ?? [];
    const columns = {};
    row.forEach((cell, column) => {
      if (typeof cell !== 'string') return;
      const label = cell.trim();
      const hit = HEADERS.find(([field, pattern]) => !(field in columns) && pattern.test(label));
      if (hit) columns[hit[0]] = column;
    });
    if ('name' in columns && 'kcal' in columns && 'proteinG' in columns) return { headerRow: index, columns };
  }
  return null;
}

/** „<0.1“, „tr.“ und leere Zellen: Spuren zaehlen als 0, unbekannt als undefined. */
function numberOf(cell) {
  if (typeof cell === 'number') return cell;
  if (typeof cell !== 'string') return undefined;
  const text = cell.trim().replace(',', '.');
  if (/^(<|tr|n\.?\s?a|-)/i.test(text)) return /^(<|tr)/i.test(text) ? 0 : undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

const SHOP = [
  ['produce', /(früchte|frucht|gemüse|obst|beeren|salat|pilze|kartoffel|fruits?|légumes|frutta|verdura|vegetables)/i],
  ['bakery', /(brot|backwaren|gebäck|pain|pane|bread|bakery)/i],
  ['dairy', /(milch|käse|joghurt|eier|lait|fromage|œufs|latte|formaggi|uova|dairy|milk|cheese|egg)/i],
  ['meat', /(fleisch|wurst|fisch|meeresfrüchte|geflügel|viande|poisson|carne|pesce|meat|fish|poultry)/i],
  ['drinks', /(getränke|boissons|bevande|beverages|drinks)/i],
];

const shopOf = (category) => SHOP.find(([, pattern]) => pattern.test(category ?? ''))?.[0] ?? 'pantry';

/**
 * Ein Blatt -> Datensaetze. `names` enthaelt die Blaetter anderer Sprachen
 * (`{ fr: rows, it: rows, en: rows }`), verbunden ueber die ID.
 */
function foodsFromSheet(rows, { version, language = 'de', names = {} }) {
  const found = findColumns(rows);
  if (!found) throw new Error('Spalten nicht gefunden: Name, kcal und Protein muessen in den ersten 15 Zeilen stehen');
  const { headerRow, columns } = found;

  const otherNames = {};
  for (const [lang, sheet] of Object.entries(names)) {
    const other = findColumns(sheet);
    if (!other || !('id' in other.columns)) continue;
    otherNames[lang] = new Map(sheet.slice(other.headerRow + 1).map((row) => [String(row[other.columns.id] ?? ''), String(row[other.columns.name] ?? '').trim()]));
  }

  const foods = [];
  let skipped = 0;
  for (const row of rows.slice(headerRow + 1)) {
    const name = typeof row[columns.name] === 'string' ? row[columns.name].trim() : '';
    if (!name) continue;
    const id = String(row[columns.id] ?? normalize(name).replace(/ /g, '-'));
    // Nur Werte je 100 g; Angaben je 100 ml rechnet die Dichte um, sonst weg.
    const unit = String(row[columns.unit] ?? 'per 100g').toLowerCase();
    const density = numberOf(row[columns.density]);
    const perMl = /ml/.test(unit);
    const factor = perMl ? (density ? 1 / density : null) : 1;
    if (factor === null) {
      skipped += 1;
      continue;
    }
    const per100 = {};
    for (const field of ['kcal', 'proteinG', 'carbsG', 'fatG', 'fiberG', 'sugarG', 'saltG']) {
      if (!(field in columns)) continue;
      const value = numberOf(row[columns[field]]);
      if (value !== undefined) per100[field] = Math.round(value * factor * 10) / 10;
    }
    if ('kcal' in per100) per100.kcal = Math.round(per100.kcal);
    if (!checkPer100(per100).ok) {
      skipped += 1;
      continue;
    }
    const localized = { [language]: name };
    for (const lang of LANGUAGES) {
      const other = otherNames[lang]?.get(id);
      if (other) localized[lang] = other;
    }
    const category = typeof row[columns.category] === 'string' ? row[columns.category] : '';
    const synonyms = typeof row[columns.synonyms] === 'string' ? row[columns.synonyms].split(/[;,]/).map((entry) => entry.trim()).filter(Boolean).slice(0, 10) : [];
    foods.push({
      id: `swiss:${id}`,
      source: 'swiss',
      sourceId: id,
      sourceVersion: version,
      names: localized,
      synonyms,
      category,
      shopCategory: shopOf(category),
      state: stateOf(Object.values(localized).join(' ')) ?? null,
      per100,
      allergens: inferAllergens(...Object.values(localized), ...synonyms),
      allergensInferred: true,
      diet: null,
      gramsPerPiece: null,
      gramsPerMl: density ?? null,
      quality: 0.9,
    });
  }
  return { foods, skipped };
}

module.exports = { findColumns, foodsFromSheet, numberOf };
