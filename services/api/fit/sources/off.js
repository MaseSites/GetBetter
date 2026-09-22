/**
 * Open Food Facts (ODbL) fuer verpackte Produkte per Barcode.
 *
 * - Nur im Live-Modus und mit `ENABLE_OPEN_FOOD_FACTS`; sonst Fixtures.
 * - Zwischenspeicher zuerst (30 Tage, „nicht gefunden“ 1 Tag), nie eine Suche
 *   bei jedem Tastendruck: gefragt wird nur mit vollstaendigem, gueltigem Code.
 * - Die Datensaetze bleiben mit `source: 'off'` im eigenen Speicher und werden
 *   nie mit Schweizer oder eigenen Daten vermischt; die App nennt die Quelle.
 */
const { inferAllergens } = require('../catalog/allergens.js');
const { checkPer100 } = require('../nutrition.js');

const API_BASE = 'https://world.openfoodfacts.org';
const USER_AGENT = 'BetterFit/0.1 (Entwicklung; https://github.com/MaseSites/GetBetter)';
const FOUND_DAYS = 30;
const MISSING_DAYS = 1;
const TIMEOUT_MS = 8_000;
const FIELDS = ['product_name', 'product_name_de', 'product_name_fr', 'product_name_it', 'product_name_en', 'brands', 'nutriments', 'serving_quantity', 'allergens_tags', 'quantity'];

/** Beispielprodukte des Mock-Modus — erfundene Codes mit gueltiger Pruefziffer. */
const MOCK_PRODUCTS = {
  '7610000000011': {
    product_name_de: 'Joghurt nature (Beispiel)',
    brands: 'Beispielmarke',
    serving_quantity: 180,
    allergens_tags: ['en:milk'],
    nutriments: { 'energy-kcal_100g': 66, proteins_100g: 3.9, carbohydrates_100g: 4.9, fat_100g: 3.5, sugars_100g: 4.9, salt_100g: 0.12 },
  },
  '7610000000028': {
    product_name_de: 'Proteinriegel Schoko (Beispiel)',
    brands: 'Beispielmarke',
    serving_quantity: 45,
    allergens_tags: ['en:milk', 'en:soybeans', 'en:nuts'],
    nutriments: { 'energy-kcal_100g': 372, proteins_100g: 33, carbohydrates_100g: 31, fat_100g: 12, sugars_100g: 3, fiber_100g: 9, salt_100g: 0.5 },
  },
  '7610000000035': {
    product_name_de: 'Haferflocken fein (Beispiel)',
    brands: 'Beispielmarke',
    allergens_tags: ['en:gluten'],
    nutriments: { 'energy-kcal_100g': 372, proteins_100g: 13.5, carbohydrates_100g: 58.7, fat_100g: 7, fiber_100g: 10 },
  },
};

const OFF_ALLERGENS = { 'en:milk': 'milk', 'en:gluten': 'gluten', 'en:eggs': 'egg', 'en:nuts': 'nuts', 'en:peanuts': 'peanut', 'en:soybeans': 'soy', 'en:fish': 'fish', 'en:crustaceans': 'crustaceans', 'en:molluscs': 'molluscs', 'en:celery': 'celery', 'en:mustard': 'mustard', 'en:sesame-seeds': 'sesame', 'en:sulphur-dioxide-and-sulphites': 'sulphites', 'en:lupin': 'lupin' };

/** Ein Produkt von Open Food Facts -> Datensatz, oder null, wenn die Werte nicht taugen. */
function toFood(code, product) {
  const n = product?.nutriments ?? {};
  const kcal = Number(n['energy-kcal_100g'] ?? (Number(n.energy_100g) ? Number(n.energy_100g) / 4.184 : undefined));
  const per100 = {
    kcal: Math.round(kcal),
    proteinG: Number(n.proteins_100g),
    carbsG: Number(n.carbohydrates_100g),
    fatG: Number(n.fat_100g),
    ...(Number.isFinite(Number(n.fiber_100g)) ? { fiberG: Number(n.fiber_100g) } : {}),
    ...(Number.isFinite(Number(n.sugars_100g)) ? { sugarG: Number(n.sugars_100g) } : {}),
    ...(Number.isFinite(Number(n.salt_100g)) ? { saltG: Number(n.salt_100g) } : {}),
  };
  const check = checkPer100(per100);
  if (!check.ok) return null;
  const names = {};
  for (const lang of ['de', 'fr', 'it', 'en']) {
    const value = product[`product_name_${lang}`];
    if (typeof value === 'string' && value.trim()) names[lang] = value.trim().slice(0, 100);
  }
  if (Object.keys(names).length === 0 && typeof product.product_name === 'string' && product.product_name.trim()) names.de = product.product_name.trim().slice(0, 100);
  if (Object.keys(names).length === 0) return null;
  const tagged = (Array.isArray(product.allergens_tags) ? product.allergens_tags : []).map((tag) => OFF_ALLERGENS[tag]).filter(Boolean);
  const serving = Number(product.serving_quantity);
  return {
    id: `off:${code}`,
    source: 'off',
    sourceId: code,
    barcode: code,
    names,
    synonyms: [],
    brand: typeof product.brands === 'string' ? product.brands.split(',')[0].trim().slice(0, 60) : null,
    state: null,
    per100,
    allergens: [...new Set([...tagged, ...inferAllergens(...Object.values(names))])].sort(),
    gramsPerPiece: Number.isFinite(serving) && serving > 0 && serving < 3000 ? serving : null,
    gramsPerMl: null,
    shopCategory: 'other',
    quality: 0.6,
    warnings: check.warnings,
  };
}

function createOpenFoodFacts({ enabled, mode, baseUrl = API_BASE, fetchImpl = fetch, now = () => Date.now() }) {
  /**
   * Sucht einen gueltigen Code. `cacheRows` ist die gemeinsame Tabelle (eine
   * Kopie ausserhalb der Transaktion); neue Zeilen werden dort ergaenzt.
   * Gibt `{ food }`, `{ food: null }` (unbekannt) oder `{ error }`.
   */
  async function lookup(code, cacheRows) {
    const key = `off:${code}`;
    const cached = cacheRows.find((row) => row.key === key);
    if (cached && cached.expiresAt > now()) return { food: cached.food ?? null, cached: true };

    let product = null;
    if (mode === 'mock' || !enabled) {
      product = MOCK_PRODUCTS[code] ?? null;
    } else {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await fetchImpl(`${baseUrl}/api/v2/product/${code}.json?fields=${FIELDS.join(',')}`, {
          headers: { 'User-Agent': USER_AGENT },
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (response.status === 404) product = null;
        else if (!response.ok) return { error: response.status === 429 ? 'provider_busy' : 'provider_error' };
        else {
          const data = await response.json();
          product = data?.status === 1 || data?.product ? data.product : null;
        }
      } catch {
        clearTimeout(timer);
        return { error: 'provider_unreachable' };
      }
    }
    const food = product ? toFood(code, product) : null;
    const row = { key, food, expiresAt: now() + (food ? FOUND_DAYS : MISSING_DAYS) * 86_400_000 };
    const index = cacheRows.findIndex((entry) => entry.key === key);
    if (index >= 0) cacheRows[index] = row;
    else cacheRows.push(row);
    return { food, cached: false };
  }

  return { lookup };
}

module.exports = { MOCK_PRODUCTS, createOpenFoodFacts, toFood };
