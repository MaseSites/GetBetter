/**
 * Von der Beobachtung der KI zur Mahlzeit — ohne dass die KI eine Zahl setzt.
 *
 * 1. Jeder erkannte Bestandteil wird einem Datensatz zugeordnet (Katalog,
 *    sonst USDA). Unsicher bleibt unsicher und steht so da.
 * 2. Der Dienst rechnet Naehrwerte aus Gramm × Datensatz, mit Spanne aus
 *    Mindest- und Hoechstmenge.
 * 3. Die Ampel (gruen/orange/rot) sagt, wie viel Pruefung es braucht.
 * 4. Hoechstens zwei Rueckfragen — nur solche, die das Ergebnis deutlich
 *    aendern, und jede Antwort hat eine feste, nachvollziehbare Wirkung.
 */
const { expectsCooking, rawGramsOf } = require('./catalog/cooking.js');
const { dishAdditions, dishFits, matchDish, namesDish } = require('./catalog/dishes.js');
const { nameIn } = require('./lang.js');
const { computeMeal } = require('./nutrition.js');

/** Worte fuer versteckte Fette in vier Sprachen und Englisch. */
const FAT_WORDS = [
  'öl',
  'oel',
  'oil',
  'butter',
  'rahm',
  'sahne',
  'cream',
  'huile',
  'beurre',
  'crème',
  'olio',
  'burro',
  'panna',
];
const BUTTER_WORDS = ['butter', 'beurre', 'burro'];

const FAT_OPTIONS = [
  { id: 'none', grams: 0 },
  { id: 'little', grams: 5 },
  { id: 'normal', grams: 10 },
  { id: 'much', grams: 20 },
];

const PORTION_OPTIONS = ['small', 'normal', 'large'];

/** Wie viele kcal eine Rueckfrage mindestens bewegen muss, damit sie gestellt wird. */
const MIN_IMPACT_KCAL = 60;

const lower = (text) => String(text ?? '').toLowerCase();

/**
 * Ordnet jedem Bestandteil einen Datensatz zu. `match(term, preparation)`
 * gibt `{ food, score, uncertain, stateMismatch }` oder null.
 */
function matchFoods(vision, match) {
  return vision.foods.map((entry, index) => {
    // Auf dem Foto liegt gekochtes Essen. Sagt das Modell nichts zur Zubereitung,
    // gilt fuer Reis, Teigwaren, Getreide, Huelsenfruechte, Fleisch und Kartoffeln
    // trotzdem „gekocht“ — sonst waeren 200 g Reis 200 g trockener Reis.
    const preparation =
      entry.preparation ||
      (expectsCooking(entry.displayName, entry.swissSearchTerm, entry.canonicalSearchTerm)
        ? 'gekocht'
        : '');
    // Erst der angezeigte Name, dann der deutsche Begriff fuer die Schweizer Datenbank, dann der englische.
    const first = match(entry.displayName, preparation);
    const swiss =
      !first || first.uncertain
        ? entry.swissSearchTerm
          ? match(entry.swissSearchTerm, preparation)
          : null
        : null;
    const second =
      (!first || first.uncertain) && (!swiss || swiss.uncertain)
        ? match(entry.canonicalSearchTerm, preparation)
        : null;
    const best =
      [first, swiss, second]
        .filter(Boolean)
        .sort((a, b) => Number(a.uncertain) - Number(b.uncertain) || b.score - a.score)[0] ?? null;
    return {
      index,
      term: entry.displayName,
      searchTerm: entry.canonicalSearchTerm,
      preparation: entry.preparation,
      grams: entry.estimatedGrams,
      minGrams: entry.minGrams,
      maxGrams: entry.maxGrams,
      aiGrams: entry.estimatedGrams,
      confidence: entry.confidence,
      hidden: entry.possibleHiddenIngredients,
      // Die drei naechstbesten Suchbegriffe des Modells — fuer die Korrektur mit einem Tipp.
      alternatives: entry.alternatives ?? [],
      food: best?.food ?? null,
      matchScore: best ? Math.round(best.score * 100) / 100 : 0,
      matchUncertain: !best || best.uncertain,
      stateMismatch: best?.stateMismatch ?? false,
      added: false,
    };
  });
}

/**
 * Wurde fuer diesen Posten von roh/trocken auf gekocht umgerechnet? Dann sagt es
 * die App: „gekocht 200 g ≈ 77 g trocken“. Wird bei jedem Bauen neu gerechnet,
 * damit es zu den aktuellen Gramm passt.
 */
function cookedInfoOf(item) {
  const factor = item.food?.yieldFactor;
  if (!factor || !item.food?.derivedFrom || !(item.grams > 0)) return null;
  return {
    factor,
    kind: item.food.cookingKind ?? null,
    cookedGrams: Math.round(item.grams),
    rawGrams: rawGramsOf(item.grams, factor),
    rawFoodId: item.food.derivedFrom,
  };
}

/** Naehrwerte der zugeordneten Posten, mit Spanne. Posten ohne Datensatz zaehlen nicht. */
function totalsOf(items) {
  const usable = items.filter((item) => item.food);
  const meal = computeMeal(
    usable.map((item) => ({
      food: item.food,
      grams: item.grams,
      minGrams: item.minGrams,
      maxGrams: item.maxGrams,
    })),
  );
  const lines = new Map(usable.map((item, index) => [item, meal.lines[index]]));
  return {
    ok: meal.ok,
    total: meal.total,
    range: meal.range,
    lines: items.map((item) => {
      const line = lines.get(item);
      return line
        ? {
            kcal: line.kcal,
            proteinG: line.proteinG,
            carbsG: line.carbsG,
            fatG: line.fatG,
            kcalMin: line.range.kcalMin,
            kcalMax: line.range.kcalMax,
          }
        : null;
    }),
  };
}

/**
 * Gruen: klar getrennt und sicher. Orange: gemischt, Sauce, unklare Portion.
 * Rot: versteckte Schichten, unbekannte Mischung oder etwas ohne Datensatz.
 */
function levelOf(vision, items, totals) {
  const kcal = totals.total.kcal || 1;
  const spread = (totals.range.kcalMax - totals.range.kcalMin) / kcal;
  // Was das Rezept beisteuert, war nie auf dem Foto: es macht die Ampel weder besser noch schlechter.
  const seen = items.filter((item) => item.from !== 'dish');
  if (
    vision.mealClass === 'hidden_ingredients' ||
    vision.overallConfidence < 0.5 ||
    items.some((item) => !item.food)
  )
    return 'red';
  if (
    vision.mealClass === 'mixed' ||
    vision.overallConfidence < 0.75 ||
    seen.some((item) => item.confidence < 0.6 || item.matchUncertain) ||
    spread > 0.4
  )
    return 'orange';
  return 'green';
}

/** Hoechstens zwei Rueckfragen, nach Wirkung auf die Kalorien sortiert. */
function questionsFor(vision, items, totals) {
  const candidates = [];
  const fatty = items.find(
    (item) =>
      !item.added && item.hidden.some((word) => FAT_WORDS.some((fat) => lower(word).includes(fat))),
  );
  if (fatty && vision.mealClass !== 'packaged' && !items.some((item) => item.added)) {
    const butter = fatty.hidden.some((word) =>
      BUTTER_WORDS.some((entry) => lower(word).includes(entry)),
    );
    candidates.push({
      id: 'fat',
      kind: 'fat',
      subject: fatty.term,
      fat: butter ? 'butter' : 'oil',
      options: FAT_OPTIONS.map((option) => option.id),
      // 10 g Oel sind rund 90 kcal.
      impact: 90,
    });
  }
  items.forEach((item, index) => {
    const line = totals.lines[index];
    if (!line || item.added || item.from === 'dish') return;
    const impact = Math.max(line.kcalMax - line.kcal, line.kcal - line.kcalMin);
    if (impact >= MIN_IMPACT_KCAL) {
      candidates.push({
        id: `portion:${index}`,
        kind: 'portion',
        subject: item.term,
        options: PORTION_OPTIONS,
        impact,
      });
    }
  });
  return candidates.sort((a, b) => b.impact - a.impact).slice(0, 2);
}

/**
 * Wendet eine Antwort an. Gibt die neuen Posten zurueck, oder null bei
 * unbekannter Frage/Option. Fett fuegt einen Posten hinzu, die Portion setzt
 * die Gramm auf Mindest-, Schaetz- oder Hoechstmenge.
 */
function applyAnswer(items, question, optionId, { findFood, language = 'de' }) {
  if (!question || !question.options.includes(optionId)) return null;
  if (question.kind === 'fat') {
    const grams = FAT_OPTIONS.find((option) => option.id === optionId)?.grams ?? 0;
    const without = items.filter((item) => !item.added);
    if (grams === 0) return without;
    const food = findFood(question.fat === 'butter' ? 'butter' : 'rapeseed_oil');
    if (!food) return null;
    return [
      ...without,
      {
        index: without.length,
        term: nameIn(food, language) || question.fat,
        searchTerm: question.fat,
        preparation: '',
        grams,
        minGrams: grams,
        maxGrams: grams,
        aiGrams: 0,
        confidence: 1,
        hidden: [],
        food,
        matchScore: 1,
        matchUncertain: false,
        stateMismatch: false,
        added: true,
      },
    ];
  }
  const index = Number(question.id.split(':')[1]);
  return items.map((item, position) => {
    if (position !== index) return item;
    const grams =
      optionId === 'small'
        ? item.minGrams
        : optionId === 'large'
          ? item.maxGrams
          : Math.round((item.minGrams + item.maxGrams) / 2);
    // Nach der Antwort ist die Portion kein Raten mehr: die Spanne schrumpft.
    return {
      ...item,
      grams,
      minGrams: Math.round(grams * 0.9),
      maxGrams: Math.round(grams * 1.1),
      answered: true,
    };
  });
}

/** Alles, was die App zu einer Analyse zeigt. */
function buildResult(vision, items, answered = []) {
  const totals = totalsOf(items);
  const level = levelOf(vision, items, totals);
  const questions = questionsFor(vision, items, totals).filter(
    (question) => !answered.includes(question.id) && !answered.includes(question.kind),
  );
  return {
    mealName: vision.mealName,
    mealClass: vision.mealClass,
    overallConfidence: vision.overallConfidence,
    level,
    // Sehr unsicher: nichts vorausfuellen, was wie eine sichere Zahl aussieht.
    reviewRequired: level === 'red' || vision.overallConfidence < 0.3,
    secondImageRecommended: vision.secondImageRecommended || level === 'red',
    warnings: vision.warnings,
    items: items.map((item, index) => ({
      ...item,
      nutrients: totals.lines[index],
      cooked: cookedInfoOf(item),
    })),
    total: totals.total,
    range: totals.range,
    questions: questions.slice(0, Math.max(0, 2 - answered.length)),
  };
}

/**
 * Die Spanne der bestaetigten Posten: je Posten die Mindest- und Hoechstmenge
 * der Schaetzung im selben Verhaeltnis wie die geaenderten Gramm. Wer 150 g
 * statt 200 g bestaetigt, bekommt 150 × (min/200) bis 150 × (max/200). Ein
 * Posten, den die KI nicht kannte, ist genau (keine Spanne).
 */
function scaledRanges(aiItems, confirmed) {
  const used = new Set();
  return confirmed.map((entry) => {
    const grams = Number(entry.grams);
    const { minGrams: _min, maxGrams: _max, ...rest } = entry;
    const index = aiItems.findIndex((item, position) => !used.has(position) && item.food?.id === entry.foodId);
    if (index < 0 || !Number.isFinite(grams)) return rest;
    used.add(index);
    const item = aiItems[index];
    if (!(item.grams > 0)) return rest;
    const ratio = grams / item.grams;
    const round = (value) => Math.round(value * 10) / 10;
    return {
      ...rest,
      minGrams: round(Math.min(grams, (Number(item.minGrams) || item.grams) * ratio)),
      maxGrams: round(Math.max(grams, (Number(item.maxGrams) || item.grams) * ratio)),
    };
  });
}

/**
 * Wie stark die bestaetigten Gramm von der Schaetzung abweichen — fuer die
 * Auswertung, und je Lebensmittel das Verhaeltnis bestaetigt/geschaetzt
 * (`ratios`), aus dem die persoenliche Portion waechst.
 */
function correctionsOf(aiItems, confirmed) {
  let corrections = 0;
  let gramsDelta = 0;
  const ratios = [];
  for (const item of aiItems.filter((entry) => !entry.added)) {
    const match = confirmed.find((entry) => entry.foodId === item.food?.id);
    if (!match) {
      corrections += 1;
      continue;
    }
    const delta = Math.abs(match.grams - item.aiGrams);
    gramsDelta += delta;
    if (delta > Math.max(10, item.aiGrams * 0.1)) corrections += 1;
    // Gerechnet wird gegen die Schaetzung der KI, nicht gegen die schon
    // angepasste Anzeige — sonst verstaerkt sich eine Anpassung selbst.
    if (item.from !== 'dish' && item.aiGrams > 0 && match.grams > 0)
      ratios.push({
        foodId: item.food.id,
        ratio: Math.round((match.grams / item.aiGrams) * 100) / 100,
      });
  }
  corrections += confirmed.filter(
    (entry) => !aiItems.some((item) => item.food?.id === entry.foodId),
  ).length;
  return { corrections, gramsDelta: Math.round(gramsDelta), ratios };
}

/** Ab zwei Korrekturen je Lebensmittel zaehlt die eigene Portion, und dann nur gedaempft. */
const MIN_PERSONAL_CORRECTIONS = 2;
const PERSONAL_MIN = 0.6;
const PERSONAL_MAX = 1.5;
/** Darunter ist der Unterschied kleiner als das Raten selbst. */
const PERSONAL_DEADBAND = 0.05;

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Was diese Person wirklich isst: je Lebensmittel der Median aus
 * bestaetigt/geschaetzt ueber alle bestaetigten Analysen. Der Median, nicht der
 * Schnitt — ein einzelner Ausreisser soll die naechste Schaetzung nicht kippen.
 * Die Zeilen kommen immer aus `forOwner(...)`, also nur vom eigenen Konto.
 */
function personalFactors(rows) {
  const byFood = new Map();
  for (const row of rows ?? []) {
    for (const entry of row?.portionRatios ?? []) {
      if (typeof entry?.foodId !== 'string' || !(entry.ratio > 0)) continue;
      byFood.set(entry.foodId, [...(byFood.get(entry.foodId) ?? []), entry.ratio]);
    }
  }
  const factors = {};
  for (const [foodId, list] of byFood) {
    if (list.length < MIN_PERSONAL_CORRECTIONS) continue;
    const value = Math.min(PERSONAL_MAX, Math.max(PERSONAL_MIN, median(list)));
    factors[foodId] = Math.round(value * 100) / 100;
  }
  return factors;
}

/** Die eigene Portion auf die Schaetzung legen. `personal: true` sagt es der App. */
function applyPersonal(items, factors) {
  if (!factors || Object.keys(factors).length === 0) return items;
  return items.map((item) => {
    const factor = item.food ? factors[item.food.id] : null;
    if (!factor || item.added || item.from === 'dish') return item;
    if (Math.abs(factor - 1) < PERSONAL_DEADBAND) return item;
    const scale = (value) =>
      Math.max(1, Math.round((Number.isFinite(value) ? value : item.grams) * factor));
    return {
      ...item,
      grams: scale(item.grams),
      minGrams: scale(item.minGrams),
      maxGrams: scale(item.maxGrams),
      personal: true,
      personalFactor: factor,
    };
  });
}

const isFatWord = (text) => FAT_WORDS.some((fat) => lower(text).includes(fat));

/**
 * Was die Kamera nicht sieht: kennt der Name das Gericht (Älplermagronen,
 * Rösti, Carbonara) und passen die erkannten Bestandteile dazu, ergaenzt das
 * Standardrezept Öl, Butter, Rahm oder Käse — auf die geschaetzte Menge
 * gerechnet. Sichtbares wird nie ueberschrieben, und nennt das Modell selbst
 * ein Fett, bleibt es bei der Rueckfrage.
 */
function applyDish(vision, items, { match, language = 'de' }) {
  if (vision.mealClass === 'packaged' || items.length === 0) return items;
  const found = matchDish(vision.mealName, items.length === 1 ? [items[0].term] : []);
  if (!found) return items;
  const { dish } = found;
  // Steht das Gericht als Ganzes im Katalog (Fertiggericht, Restaurantwert),
  // steckt das Fett dort schon drin — nichts dazu.
  const covered = items.some((item) =>
    Object.values(item.food?.names ?? {}).some((name) => namesDish(dish, name)),
  );
  if (covered) return items;
  const visible = items.map((item) => item.term);
  if (!dishFits(dish, visible)) return items;
  const named = items.flatMap((item) => item.hidden ?? []);
  const total = items.reduce((sum, item) => sum + (Number(item.grams) || 0), 0);
  const additions = dishAdditions(dish, [...visible, ...named], total).filter(
    (line) => !(isFatWord(line.term) && named.some(isFatWord)),
  );
  const extra = [];
  for (const line of additions) {
    const best = match(line.term);
    if (!best || best.uncertain || !best.food) continue;
    extra.push({
      index: items.length + extra.length,
      term: nameIn(best.food, language) || line.term,
      searchTerm: line.term,
      preparation: '',
      grams: line.grams,
      minGrams: Math.max(1, Math.round(line.grams * 0.6)),
      maxGrams: Math.round(line.grams * 1.5),
      aiGrams: line.grams,
      confidence: 0.6,
      hidden: [],
      alternatives: [],
      food: best.food,
      matchScore: Math.round(best.score * 100) / 100,
      matchUncertain: false,
      stateMismatch: false,
      added: false,
      from: 'dish',
      dish: dish.id,
    });
  }
  return extra.length > 0 ? [...items, ...extra] : items;
}

module.exports = {
  FAT_OPTIONS,
  PERSONAL_MAX,
  PERSONAL_MIN,
  PORTION_OPTIONS,
  applyAnswer,
  applyDish,
  applyPersonal,
  buildResult,
  cookedInfoOf,
  correctionsOf,
  levelOf,
  matchFoods,
  personalFactors,
  questionsFor,
  scaledRanges,
  totalsOf,
};
