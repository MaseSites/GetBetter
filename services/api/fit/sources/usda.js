/**
 * USDA FoodData Central (CC0) — Suche nach generischen Lebensmitteln, wenn der
 * Katalog nichts Sicheres findet. Nur mit `USDA_FDC_API_KEY` und nur im
 * Live-Modus; jede Antwort landet im gemeinsamen Zwischenspeicher
 * (`foodCache`, 30 Tage), damit dieselbe Suche nicht erneut hinausgeht.
 *
 * Nur „Foundation“ und „SR Legacy“: Markenprodukte kommen ueber Barcode.
 */
const { inferAllergens } = require('../catalog/allergens.js');
const { checkPer100 } = require('../nutrition.js');

const API_BASE = 'https://api.nal.usda.gov/fdc/v1';
const CACHE_DAYS = 30;
const TIMEOUT_MS = 10_000;

/** Naehrstoffnummern der USDA: Energie kcal 208, Protein 203, Fett 204, KH 205, Ballaststoffe 291, Zucker 269. */
const NUMBERS = { kcal: '208', proteinG: '203', fatG: '204', carbsG: '205', fiberG: '291', sugarG: '269' };

/** Ein Suchtreffer der USDA -> ein Datensatz wie im Katalog, oder null. */
function toFood(entry) {
  const nutrients = Array.isArray(entry?.foodNutrients) ? entry.foodNutrients : [];
  const byNumber = (number) => {
    const found = nutrients.find((nutrient) => String(nutrient.nutrientNumber ?? nutrient.nutrient?.number) === number);
    const value = Number(found?.value ?? found?.amount);
    return Number.isFinite(value) ? value : undefined;
  };
  const per100 = {};
  for (const [key, number] of Object.entries(NUMBERS)) {
    const value = byNumber(number);
    if (value !== undefined) per100[key] = Math.round(value * 10) / 10;
  }
  if (!checkPer100(per100).ok) return null;
  const description = String(entry.description ?? '').slice(0, 120);
  if (!description || !Number.isFinite(Number(entry.fdcId))) return null;
  const lowered = description.toLowerCase();
  return {
    id: `usda:${entry.fdcId}`,
    source: 'usda',
    sourceId: String(entry.fdcId),
    sourceVersion: String(entry.publishedDate ?? entry.dataType ?? ''),
    names: { en: description, de: description },
    synonyms: [],
    state: /cooked|boiled|roasted|fried|baked|grilled/.test(lowered) ? 'cooked' : /raw|dry/.test(lowered) ? 'raw' : null,
    per100,
    // Die USDA fuehrt keine Allergene: aus dem Namen geschaetzt, lieber einmal zu viel.
    allergens: inferAllergens(description),
    allergensInferred: true,
    gramsPerPiece: null,
    gramsPerMl: null,
    shopCategory: 'other',
    quality: entry.dataType === 'Foundation' ? 0.8 : 0.7,
  };
}

function createUsda({ apiKey, enabled, baseUrl = API_BASE, fetchImpl = fetch, now = () => Date.now() }) {
  /**
   * Sucht und legt Treffer in `cacheRows` (die gemeinsame Tabelle einer
   * Transaktion) ab. Gibt die Datensaetze zurueck, bei Fehlern eine leere Liste.
   */
  async function search(query, cacheRows) {
    const term = String(query ?? '').trim().toLowerCase().slice(0, 80);
    if (!enabled || !apiKey || term.length < 2) return [];
    const key = `usda-search:${term}`;
    const cached = cacheRows.find((row) => row.key === key);
    if (cached && cached.expiresAt > now()) return cached.foodIds.map((id) => cacheRows.find((row) => row.food?.id === id)?.food).filter(Boolean);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const url = `${baseUrl}/foods/search?query=${encodeURIComponent(term)}&dataType=Foundation,SR%20Legacy&pageSize=5`;
      const response = await fetchImpl(url, { headers: { 'X-Api-Key': apiKey }, signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) return [];
      const data = await response.json();
      const foods = (Array.isArray(data?.foods) ? data.foods : []).map(toFood).filter(Boolean);
      const expiresAt = now() + CACHE_DAYS * 86_400_000;
      for (const food of foods) {
        const index = cacheRows.findIndex((row) => row.food?.id === food.id);
        const row = { key: `food:${food.id}`, food, expiresAt };
        if (index >= 0) cacheRows[index] = row;
        else cacheRows.push(row);
      }
      const searchIndex = cacheRows.findIndex((row) => row.key === key);
      const searchRow = { key, foodIds: foods.map((food) => food.id), expiresAt };
      if (searchIndex >= 0) cacheRows[searchIndex] = searchRow;
      else cacheRows.push(searchRow);
      return foods;
    } catch {
      clearTimeout(timer);
      return [];
    }
  }

  return { search, enabled: Boolean(enabled && apiKey) };
}

module.exports = { createUsda, toFood };
