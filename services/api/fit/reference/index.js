/**
 * Referenzwissen fuer die Foto-Analyse: wie viel von einer Zutat meist auf
 * dem Teller liegt (Nutrition5k), welche Gerichte aehnlich zusammengesetzt
 * sind, was eine Schweizer Portion ist (menuCH) und die Standardportionen
 * eines Gerichts (FNDDS).
 *
 * Gebaut von `scripts/import-fit-reference.js` nach
 * `<datenordner>/fit-reference/reference.json`. Geladen wird erst beim ersten
 * Aufruf; fehlt die Datei oder ist sie kaputt, gibt es leere Antworten
 * (null bzw. []), nie einen Fehler — die Analyse laeuft dann wie bisher.
 */
const fs = require('node:fs');
const path = require('node:path');

const { indexPriors, priorFor, indexDishes, similarDishes } = require('./match.js');
const { portionHint, indexFoods, fnddsPortions } = require('./portions.js');

const EMPTY = { version: 0, builtAt: null, sources: [], nutrition5k: { dishes: [] }, ingredientPriors: {}, fndds: { foods: [] }, menuch: { categories: [] } };

/** Einen geladenen Stand pruefen und mit leeren Teilen auffuellen. */
function normalizeData(data) {
  if (!data || typeof data !== 'object') return EMPTY;
  return {
    version: data.version ?? 0,
    builtAt: data.builtAt ?? null,
    sources: Array.isArray(data.sources) ? data.sources : [],
    nutrition5k: { dishes: Array.isArray(data.nutrition5k?.dishes) ? data.nutrition5k.dishes : [] },
    ingredientPriors: data.ingredientPriors && typeof data.ingredientPriors === 'object' ? data.ingredientPriors : {},
    fndds: { foods: Array.isArray(data.fndds?.foods) ? data.fndds.foods : [] },
    menuch: { categories: Array.isArray(data.menuch?.categories) ? data.menuch.categories : [] },
  };
}

/**
 * Das Referenzwissen ueber einem Stand. `load` liefert die Rohdaten (oder
 * null) und wird hoechstens einmal gerufen.
 */
function createReferenceFrom(load) {
  let state = null;
  const get = () => {
    if (state) return state;
    let data = EMPTY;
    try {
      data = normalizeData(load());
    } catch {
      data = EMPTY;
    }
    state = {
      data,
      priorIndex: indexPriors(data.ingredientPriors),
      dishIndex: indexDishes(data.nutrition5k.dishes),
      foodIndex: indexFoods(data.fndds.foods),
    };
    return state;
  };

  return {
    /** Gramm-Verteilung einer Zutat: { key, match, n, p10, p25, median, p75, p90 } oder null. */
    priorFor(term) {
      if (typeof term !== 'string' || !term.trim()) return null;
      const { data, priorIndex } = get();
      return priorFor(data.ingredientPriors, priorIndex, term);
    },
    /** Die k aehnlichsten train-Gerichte zu [{ term, grams? }]. */
    similarDishes(foods, k = 3) {
      const { data, priorIndex, dishIndex } = get();
      return similarDishes(data.ingredientPriors, priorIndex, dishIndex, foods, k);
    },
    /** menuCH: Median-Gramm einer Kategorie zu einer Mahlzeit, aus einem deutschen Begriff. */
    portionHint(slot, text) {
      if (typeof text !== 'string' || !text.trim()) return null;
      return portionHint(get().data.menuch.categories, slot ?? 'lunch', text);
    },
    /** FNDDS: Standardportionen des passendsten Gerichts ([] ohne Treffer). */
    fnddsPortions(term, limit = 1) {
      if (typeof term !== 'string' || !term.trim()) return [];
      return fnddsPortions(get().foodIndex, term, limit);
    },
    /** Zahlen fuer den Admin. */
    referenceStats() {
      const { data } = get();
      const dishes = data.nutrition5k.dishes;
      return {
        available: dishes.length > 0 || data.fndds.foods.length > 0 || data.menuch.categories.length > 0,
        builtAt: data.builtAt,
        dishes: dishes.length,
        train: dishes.filter((dish) => dish.split === 'train').length,
        test: dishes.filter((dish) => dish.split === 'test').length,
        withImage: dishes.filter((dish) => dish.image).length,
        priors: Object.keys(data.ingredientPriors).length,
        fnddsFoods: data.fndds.foods.length,
        menuchCategories: data.menuch.categories.length,
        sources: data.sources.map((source) => ({ id: source.id, attribution: source.attribution, license: source.license })),
      };
    },
  };
}

/** Das Referenzwissen aus `<dataDir>/fit-reference/reference.json`. */
function createReference({ dataDir, file } = {}) {
  const target = file ?? (dataDir ? path.join(dataDir, 'fit-reference', 'reference.json') : null);
  return createReferenceFrom(() => (target && fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, 'utf8')) : null));
}

module.exports = { createReference, createReferenceFrom, normalizeData };
