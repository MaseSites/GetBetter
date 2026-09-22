/**
 * Der persoenliche Wochen-Essensplan — deterministisch gerechnet, nie geraten.
 *
 * Je Tag gilt das Ziel des Trainings- oder Ruhetags. Die Mahlzeiten teilen es
 * (Fruehstueck 25 %, Mittag 35 %, Abend 30 %, Snack 10 %); Portionen werden in
 * Vierteln angepasst, bis der Tag innerhalb der Toleranz liegt. Vorrat und
 * bald Ablaufendes werden bevorzugt, Wiederholungen bestraft — ausser als
 * Rest vom Vorabend (Meal Prep). Bereits gegessene Eintraege aendert nichts.
 */
const { recipeNutrition } = require('../recipes.js');
const { BASE_OF, resolveRecipe } = require('./suggest.js');
const { LIBRARY } = require('./library.js');

const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
const SHARE = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 };
const TOLERANCE = 0.08;
const MIN_PORTION = 0.5;
const MAX_PORTION = 3;

const quarter = (value) => Math.min(MAX_PORTION, Math.max(MIN_PORTION, Math.round(value * 4) / 4));
const round1 = (value) => Math.round(value * 10) / 10;

function shiftDay(day, delta) {
  return new Date(Date.parse(`${day}T12:00:00Z`) + delta * 86400000).toISOString().slice(0, 10);
}

/** Montag der Woche eines Tages. */
function mondayOf(day) {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return shiftDay(day, -((weekday + 6) % 7));
}

/** Kleiner fester Zufall aus einem Text — gleiche Woche, gleicher Plan. */
function seeded(text) {
  let hash = 2166136261;
  for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return (salt) => (Math.imul(hash ^ salt, 2654435761) >>> 0) / 4294967296;
}

function nutrientsOf(perServing, portions) {
  return {
    kcal: Math.round(perServing.kcal * portions),
    proteinG: round1(perServing.proteinG * portions),
    carbsG: round1(perServing.carbsG * portions),
    fatG: round1(perServing.fatG * portions),
  };
}

function totalOf(entries) {
  const live = entries.filter((entry) => entry.status !== 'skipped');
  return {
    kcal: live.reduce((sum, entry) => sum + entry.nutrients.kcal, 0),
    proteinG: round1(live.reduce((sum, entry) => sum + entry.nutrients.proteinG, 0)),
    carbsG: round1(live.reduce((sum, entry) => sum + entry.nutrients.carbsG, 0)),
    fatG: round1(live.reduce((sum, entry) => sum + entry.nutrients.fatG, 0)),
  };
}

/** Liegt der Tag im Ziel? Energie ±8 %, Eiweiss mindestens 85 %. */
function toleranceOf(total, target) {
  return {
    kcalOk: Math.abs(total.kcal - target.kcal) <= target.kcal * TOLERANCE,
    proteinOk: total.proteinG >= target.proteinG * 0.85,
  };
}

/** Die Kandidaten: aufgeloest fuer das Profil, mit Naehrwerten je Portion. */
function candidatesFor({ catalog, profile, userRecipes = [], customFoods = [] }) {
  const find = (id) => catalog.find(id, { customFoods });
  const equipment = new Set(profile.equipment ?? ['stove', 'oven']);
  const maxMinutes = (profile.maxCookMinutes ?? 45) * 1.2;
  const list = [];
  // Ein gespeichertes Bibliotheksrezept steht einmal da — als eigenes.
  const saved = new Set(userRecipes.map((recipe) => recipe.basedOn).filter(Boolean));
  for (const template of [...userRecipes, ...LIBRARY.filter((entry) => !saved.has(entry.id))]) {
    const resolved = resolveRecipe(template, { catalog, profile, customFoods });
    if (!resolved.ok) continue;
    const recipe = resolved.recipe;
    if (recipe.equipment.some((entry) => !equipment.has(entry))) continue;
    // Backen ist nichts fuer jeden Tag: lange Rezepte nur, wenn die Zeit reicht.
    if (recipe.timeMinutes > maxMinutes) continue;
    const nutrition = recipeNutrition(recipe, find, { withOptional: false });
    if (!nutrition.ok || nutrition.perServing.kcal <= 0) continue;
    list.push({ recipe, perServing: nutrition.perServing });
  }
  return list;
}

/**
 * Ein Plan fuer sieben Tage ab `weekStart`. `trainingDays`: Menge von Tagen.
 * `goals`: Ergebnis von `computeGoals`. Gibt den Plan (Entwurf) zurueck.
 */
function generatePlan({ catalog, profile, goals, weekStart, trainingDays = new Set(), pantry = [], userRecipes = [], customFoods = [], today, leftovers = true }) {
  const candidates = candidatesFor({ catalog, profile, userRecipes, customFoods });
  const random = seeded(`${weekStart}:${profile.diet}:${(profile.allergies ?? []).join(',')}`);
  const pantryIds = new Set(pantry.map((row) => BASE_OF(row.foodId)));
  const expiring = new Set(
    pantry.filter((row) => row.bestBefore && Date.parse(`${row.bestBefore}T12:00:00Z`) - Date.parse(`${today ?? weekStart}T12:00:00Z`) <= 3 * 86400000).map((row) => BASE_OF(row.foodId)),
  );
  const usage = new Map();
  const recipes = {};
  const days = [];
  let previousDinner = null;
  let entryCount = 0;

  for (let offset = 0; offset < 7; offset += 1) {
    const day = shiftDay(weekStart, offset);
    const kind = trainingDays.has(day) ? 'training' : 'rest';
    const target = kind === 'training' ? goals.trainingDay : goals.restDay;
    const entries = [];

    for (const slot of SLOTS) {
      const slotTarget = target.kcal * SHARE[slot];
      // Rest vom Vorabend als Mittag — gekocht wurde er schon dort.
      if (slot === 'lunch' && leftovers && previousDinner && previousDinner.recipe.servings > 1 && previousDinner.recipe.tags.includes('meal-prep')) {
        const portions = quarter(slotTarget / previousDinner.perServing.kcal);
        entryCount += 1;
        entries.push({
          id: `pe${entryCount}`,
          day,
          slot,
          recipeId: previousDinner.recipe.id,
          title: previousDinner.recipe.title,
          portions,
          nutrients: nutrientsOf(previousDinner.perServing, portions),
          fromEntryId: previousDinner.entryId,
          status: 'planned',
          eatenMealId: null,
        });
        usage.set(previousDinner.recipe.id, (usage.get(previousDinner.recipe.id) ?? 0) + 1);
        continue;
      }
      const options = candidates.filter((candidate) => candidate.recipe.slots.includes(slot));
      if (options.length === 0) continue;
      let best = null;
      let bestScore = -Infinity;
      options.forEach((candidate, index) => {
        const ids = candidate.recipe.items.map((item) => BASE_OF(item.foodId));
        const pantryShare = ids.filter((id) => pantryIds.has(id)).length / Math.max(1, ids.length);
        const expiringBonus = ids.some((id) => expiring.has(id)) && offset < 3 ? 0.3 : 0;
        const proteinDensity = (candidate.perServing.proteinG * 4) / candidate.perServing.kcal;
        const used = usage.get(candidate.recipe.id) ?? 0;
        const portions = quarter(slotTarget / candidate.perServing.kcal);
        const fit = 1 - Math.min(1, Math.abs(candidate.perServing.kcal * portions - slotTarget) / slotTarget);
        const score = pantryShare * 0.4 + expiringBonus + Math.min(1, proteinDensity / 0.3) * 0.4 + fit * 0.3 - used * 0.45 + random(offset * 16 + SLOTS.indexOf(slot) * 4 + index) * 0.15;
        if (score > bestScore) {
          bestScore = score;
          best = candidate;
        }
      });
      const portions = quarter(slotTarget / best.perServing.kcal);
      entryCount += 1;
      const entry = {
        id: `pe${entryCount}`,
        day,
        slot,
        recipeId: best.recipe.id,
        title: best.recipe.title,
        portions,
        nutrients: nutrientsOf(best.perServing, portions),
        fromEntryId: null,
        status: 'planned',
        eatenMealId: null,
      };
      entries.push(entry);
      recipes[best.recipe.id] = { ...best.recipe, perServing: best.perServing };
      usage.set(best.recipe.id, (usage.get(best.recipe.id) ?? 0) + 1);
      if (slot === 'dinner') previousDinner = { ...best, entryId: entry.id };
    }
    if (!entries.some((entry) => entry.slot === 'dinner')) previousDinner = null;

    // Portionen in Vierteln anpassen, bis Energie im Ziel liegt.
    for (let round = 0; round < 12; round += 1) {
      const total = totalOf(entries);
      const gap = target.kcal - total.kcal;
      if (Math.abs(gap) <= target.kcal * TOLERANCE * 0.6) break;
      const adjustable = entries
        .filter((entry) => entry.status === 'planned')
        .sort((a, b) => (gap > 0 ? b.nutrients.kcal - a.nutrients.kcal : a.portions - b.portions));
      const step = gap > 0 ? 0.25 : -0.25;
      const pick = adjustable.find((entry) => quarter(entry.portions + step) !== entry.portions);
      if (!pick) break;
      pick.portions = quarter(pick.portions + step);
      const recipe = recipes[pick.recipeId] ?? candidates.find((candidate) => candidate.recipe.id === pick.recipeId);
      pick.nutrients = nutrientsOf(recipe.perServing, pick.portions);
    }
    // Zu wenig Eiweiss: Snack oder Fruehstueck gegen eine eiweissreichere Wahl tauschen,
    // solange die Energie im Ziel bleibt.
    for (const slot of ['snack', 'breakfast']) {
      if (toleranceOf(totalOf(entries), target).proteinOk) break;
      const entry = entries.find((candidate) => candidate.slot === slot && !candidate.fromEntryId);
      if (!entry) continue;
      const richer = candidates
        .filter((candidate) => candidate.recipe.slots.includes(slot) && candidate.recipe.id !== entry.recipeId)
        .sort((a, b) => b.perServing.proteinG / b.perServing.kcal - a.perServing.proteinG / a.perServing.kcal);
      for (const candidate of richer) {
        const portions = quarter((entry.nutrients.kcal || target.kcal * SHARE[slot]) / candidate.perServing.kcal);
        const trial = { ...entry, recipeId: candidate.recipe.id, title: candidate.recipe.title, portions, nutrients: nutrientsOf(candidate.perServing, portions) };
        const trialEntries = entries.map((other) => (other === entry ? trial : other));
        const before = totalOf(entries);
        const after = totalOf(trialEntries);
        if (after.proteinG > before.proteinG && toleranceOf(after, target).kcalOk) {
          Object.assign(entry, trial);
          recipes[candidate.recipe.id] = { ...candidate.recipe, perServing: candidate.perServing };
          usage.set(candidate.recipe.id, (usage.get(candidate.recipe.id) ?? 0) + 1);
          break;
        }
      }
    }
    const total = totalOf(entries);
    days.push({ day, kind, target, total, tolerance: toleranceOf(total, target), entries });
  }

  // Wer vom Vorabend isst, wurde dort mitgekocht: dessen Menge waechst.
  for (const day of days) {
    for (const entry of day.entries.filter((candidate) => candidate.fromEntryId)) {
      const base = days.flatMap((other) => other.entries).find((candidate) => candidate.id === entry.fromEntryId);
      if (base) base.cookPortions = (base.cookPortions ?? base.portions) + entry.portions;
    }
  }
  return { weekStart, days, recipes };
}

/** Summen und Toleranz eines Tages neu, nach jeder Aenderung. */
function recomputeDay(plan, dayKey) {
  const day = plan.days.find((entry) => entry.day === dayKey);
  if (!day) return;
  day.total = totalOf(day.entries);
  day.tolerance = toleranceOf(day.total, day.target);
}

/** Reihenfolge im Plan: Tag, dann Mahlzeit — Reste gibt es nur nach dem Kochen. */
function positionOf(plan, entry) {
  return plan.days.findIndex((day) => day.day === entry.day) * SLOTS.length + SLOTS.indexOf(entry.slot);
}

/**
 * Reste und Kochmengen nach jeder Aenderung neu: ein Rest haengt nur an einem
 * Abendessen, das noch gekocht wird und dasselbe Rezept hat — sonst wird er
 * eine eigene Mahlzeit (und kauft seine Zutaten selbst). Wer kocht, kocht fuer
 * alle Reste mit, die noch gegessen werden.
 */
function relinkLeftovers(plan) {
  const entries = plan.days.flatMap((day) => day.entries);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  for (const entry of entries) {
    if (!entry.fromEntryId || entry.status === 'eaten') continue;
    const base = byId.get(entry.fromEntryId);
    if (!base || base.status === 'skipped' || base.recipeId !== entry.recipeId) entry.fromEntryId = null;
  }
  for (const entry of entries) {
    const leftovers = entries.filter((other) => other.fromEntryId === entry.id && other.status !== 'skipped');
    if (leftovers.length > 0) entry.cookPortions = entry.portions + leftovers.reduce((sum, other) => sum + other.portions, 0);
    else delete entry.cookPortions;
  }
}

/**
 * Einen Eintrag aendern — ersetzen (`recipeId`), verschieben (`toDay`, `toSlot`),
 * auslassen (`skip`) oder doch wieder einplanen (`unskip`).
 * Gibt `{ ok, plan, affectedDays }` oder `{ ok: false, error }`.
 * Gegessenes bleibt, wie es ist; ein Rest steht nie vor seinem Kochen.
 */
function changeEntry(plan, entryId, change, { candidates }) {
  const next = structuredClone(plan);
  const from = next.days.find((day) => day.entries.some((entry) => entry.id === entryId));
  const entry = from?.entries.find((candidate) => candidate.id === entryId);
  if (!entry) return { ok: false, error: 'entry_not_found' };
  if (entry.status === 'eaten') return { ok: false, error: 'entry_eaten' };
  const affected = new Set([from.day]);

  if (change.skip === true) {
    entry.status = 'skipped';
  } else if (change.unskip === true) {
    if (entry.status !== 'skipped') return { ok: false, error: 'not_skipped' };
    entry.status = 'planned';
  } else if (typeof change.recipeId === 'string') {
    const candidate = candidates.find((option) => option.recipe.id === change.recipeId);
    if (!candidate || !candidate.recipe.slots.includes(entry.slot)) return { ok: false, error: 'recipe_not_allowed' };
    const target = from.target.kcal * SHARE[entry.slot];
    entry.recipeId = candidate.recipe.id;
    entry.title = candidate.recipe.title;
    entry.portions = quarter(target / candidate.perServing.kcal);
    entry.nutrients = nutrientsOf(candidate.perServing, entry.portions);
    entry.fromEntryId = null;
    entry.status = 'planned';
    next.recipes[candidate.recipe.id] = { ...candidate.recipe, perServing: candidate.perServing };
  } else if (typeof change.toDay === 'string') {
    const to = next.days.find((day) => day.day === change.toDay);
    const slot = SLOTS.includes(change.toSlot) ? change.toSlot : entry.slot;
    if (!to) return { ok: false, error: 'day_not_in_plan' };
    if (to.day === from.day && slot === entry.slot) return { ok: false, error: 'no_changes' };
    if (to.entries.some((other) => other.slot === slot && other.status === 'eaten')) return { ok: false, error: 'target_eaten' };
    // Was dort stand, tauscht den Platz.
    const displaced = to.entries.find((other) => other.slot === slot && other.id !== entry.id);
    from.entries = from.entries.filter((other) => other.id !== entry.id);
    if (displaced) {
      to.entries = to.entries.filter((other) => other.id !== displaced.id);
      from.entries.push({ ...displaced, day: from.day, slot: entry.slot });
    }
    to.entries.push({ ...entry, day: to.day, slot });
    affected.add(to.day);
    const all = next.days.flatMap((day) => day.entries);
    const byId = new Map(all.map((other) => [other.id, other]));
    const early = all.find((other) => other.fromEntryId && byId.has(other.fromEntryId) && positionOf(next, other) <= positionOf(next, byId.get(other.fromEntryId)));
    if (early) return { ok: false, error: 'leftover_before_cook' };
  } else {
    return { ok: false, error: 'change_invalid' };
  }
  relinkLeftovers(next);
  for (const day of affected) {
    const target = next.days.find((entry) => entry.day === day);
    target.entries.sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
    recomputeDay(next, day);
  }
  return { ok: true, plan: next, affectedDays: [...affected] };
}

/**
 * Was statt eines Eintrags passt: nur Rezepte fuer diese Mahlzeit, die das
 * Profil erlaubt (`candidates`), ohne den aktuellen, ein gespeichertes Rezept
 * statt seiner Vorlage — mit Portionen und kcal fuer das Ziel dieser Mahlzeit.
 */
function optionsFor(plan, entryId, candidates) {
  const day = plan.days.find((entry) => entry.entries.some((candidate) => candidate.id === entryId));
  const entry = day?.entries.find((candidate) => candidate.id === entryId);
  if (!entry) return null;
  const target = day.target.kcal * SHARE[entry.slot];
  const saved = new Set(candidates.map((candidate) => candidate.recipe.basedOn).filter(Boolean));
  return candidates
    .filter((candidate) => candidate.recipe.slots.includes(entry.slot) && candidate.recipe.id !== entry.recipeId && !saved.has(candidate.recipe.id))
    .map((candidate) => {
      const portions = quarter(target / candidate.perServing.kcal);
      const nutrients = nutrientsOf(candidate.perServing, portions);
      return { recipeId: candidate.recipe.id, title: candidate.recipe.title, portions, kcal: nutrients.kcal, proteinG: nutrients.proteinG, fit: Math.abs(nutrients.kcal - target) / Math.max(1, target), own: !candidate.recipe.id.startsWith('lib:') };
    })
    .sort((a, b) => Number(b.own) - Number(a.own) || a.fit - b.fit || a.title.localeCompare(b.title, 'de'));
}

module.exports = { SLOTS, candidatesFor, changeEntry, generatePlan, mondayOf, optionsFor, recomputeDay, relinkLeftovers, shiftDay, toleranceOf, totalOf };
