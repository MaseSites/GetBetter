/**
 * Kueche in der Sprache der Person. Gespeichert bleibt alles Deutsch (Ids,
 * Namen aus dem Katalog, Titel der Bibliothek); uebersetzt wird erst in der
 * Antwort. Eigene Titel und Schritte bleiben, wie die Person sie schrieb.
 */
const { nameIn } = require('../lang.js');
const { LIBRARY } = require('./library.js');
const { localizedTemplate } = require('./libraryText.js');

const isLibrary = (id) => typeof id === 'string' && id.startsWith('lib:');

/** Titel eines Rezepts: aus der Bibliothek uebersetzt, eigene unveraendert. */
function recipeTitle(id, title, language) {
  if (!isLibrary(id) || language === 'de') return title;
  return localizedTemplate(LIBRARY.find((entry) => entry.id === id) ?? { id, title }, language).title ?? title;
}

/** Name eines Lebensmittels ueber den Katalog, sonst der gespeicherte. */
function foodName(find, foodId, stored, language) {
  if (!foodId || language === 'de') return stored;
  return nameIn(find(foodId), language) || stored;
}

/** Ein gespeichertes oder aufgeloestes Rezept fuer die Antwort. */
function localizeRecipe(recipe, language, find) {
  if (!recipe || language === 'de') return recipe;
  const template = isLibrary(recipe.id) ? localizedTemplate({ id: recipe.id, title: recipe.title, steps: recipe.steps }, language) : recipe;
  return {
    ...recipe,
    title: template.title,
    steps: template.steps,
    items: (recipe.items ?? []).map((item) => ({ ...item, name: foodName(find, item.foodId, item.name, language) })),
  };
}

function localizePlan(plan, language, find) {
  if (!plan || language === 'de') return plan;
  return {
    ...plan,
    days: plan.days.map((day) => ({ ...day, entries: day.entries.map((entry) => ({ ...entry, title: recipeTitle(entry.recipeId, entry.title, language) })) })),
    recipes: Object.fromEntries(Object.entries(plan.recipes ?? {}).map(([id, recipe]) => [id, localizeRecipe(recipe, language, find)])),
  };
}

/** Die Einkaufsliste merkt sich Rezepttitel (Deutsch): ueber die Bibliothek zurueck in die Sprache. */
function titleByName(title, language) {
  const template = LIBRARY.find((entry) => entry.title === title);
  return template ? recipeTitle(template.id, title, language) : title;
}

function localizeList(list, language, find) {
  if (!list || language === 'de') return list;
  return {
    ...list,
    items: list.items.map((item) => ({ ...item, name: item.typed ? item.name : foodName(find, item.foodId, item.name, language), recipes: (item.recipes ?? []).map((title) => titleByName(title, language)) })),
    covered: (list.covered ?? []).map((item) => ({ ...item, name: foodName(find, item.foodId, item.name, language) })),
  };
}

function localizePantry(rows, language, find) {
  if (language === 'de') return rows;
  return rows.map((row) => ({ ...row, name: foodName(find, row.foodId, row.name, language) }));
}

module.exports = { foodName, localizeList, localizePantry, localizePlan, localizeRecipe, recipeTitle };
