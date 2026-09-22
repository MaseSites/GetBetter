const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const {
  applyAnswer,
  applyDish,
  applyPersonal,
  buildResult,
  correctionsOf,
  matchFoods,
  personalFactors,
} = require('./analysis.js');
const { createCatalog } = require('./catalog/index.js');
const { FIXTURES } = require('./vision/fixtures.js');
const { systemInstruction, validateVision } = require('./vision/schema.js');

const catalog = createCatalog({ dataDir: 'kein-ordner', mode: 'mock' });
const matcher = (term, preparation) => catalog.match(term, { preparation });
const findFood = (id) => catalog.find(`mock:${id}`);

const analyse = (name) => {
  const checked = validateVision(structuredClone(FIXTURES[name]));
  assert.equal(checked.ok, true, JSON.stringify(checked.errors));
  const items = matchFoods(checked.result, matcher);
  return { vision: checked.result, items, result: buildResult(checked.result, items) };
};

describe('Schema der Bildanalyse', () => {
  test('alle Fixtures sind gueltig', () => {
    for (const [name, fixture] of Object.entries(FIXTURES)) {
      assert.equal(validateVision(structuredClone(fixture)).ok, true, name);
    }
  });

  test('falsche Mengen, fehlende Felder und Unsinn werden abgelehnt', () => {
    const bad = structuredClone(FIXTURES.rice_chicken_veg);
    bad.foods[0].minGrams = 500;
    bad.foods[1].estimatedGrams = -3;
    bad.overallConfidence = 3;
    delete bad.mealClass;
    const result = validateVision(bad);
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors.sort(), ['foods.0.range', 'foods.1.estimatedGrams', 'mealClass', 'overallConfidence']);
    assert.equal(validateVision('<html>').ok, false);
  });

  test('Kalorien vom Modell werden nicht uebernommen, Texte gekuerzt', () => {
    const raw = structuredClone(FIXTURES.packaged);
    raw.foods[0].kcal = 9999;
    raw.mealName = 'x'.repeat(500);
    const { result } = validateVision(raw);
    assert.equal('kcal' in result.foods[0], false);
    assert.equal(result.mealName.length, 120);
  });

  test('Teller und Alternativen sind freiwillig: da oder leer, nie ein Fehler', () => {
    const raw = structuredClone(FIXTURES.rice_chicken_veg);
    raw.plateDiameterCm = 27;
    raw.foods[0].alternatives = ['rice, brown, cooked', 'risotto, cooked', 'couscous', 'zuviel'];
    const good = validateVision(raw);
    assert.equal(good.ok, true);
    assert.equal(good.result.plateDiameterCm, 27);
    assert.deepEqual(good.result.foods[0].alternatives, [
      'rice, brown, cooked',
      'risotto, cooked',
      'couscous',
    ]);
    assert.deepEqual(good.result.foods[1].alternatives, []);

    const odd = structuredClone(FIXTURES.rice_chicken_veg);
    odd.plateDiameterCm = 900;
    odd.foods[0].alternatives = 'nein';
    const still = validateVision(odd);
    assert.equal(still.ok, true);
    assert.equal(still.result.plateDiameterCm, null);
    assert.deepEqual(still.result.foods[0].alternatives, []);
  });

  test('die Anweisung nennt Massstab, Schweizer Portionen und das Fett', () => {
    const text = systemInstruction('de');
    assert.match(text, /26–28 cm/);
    assert.match(text, /plateDiameterCm/);
    assert.match(text, /Teigwaren oder Reis gekocht 200–300 g/);
    assert.match(text, /nicht systematisch zu tief/);
    assert.match(text, /Nenne Öl, Butter, Rahm/);
    assert.match(text, /alternatives/);
    assert.match(systemInstruction('fr'), /Sprache "fr"/);
  });
});

describe('Analyse', () => {
  test('Reis, Poulet, Gemuese: alles zugeordnet, gekocht bleibt gekocht, Nährwerte aus dem Katalog', () => {
    const { items, result } = analyse('rice_chicken_veg');
    assert.deepEqual(items.map((item) => item.food?.id), ['mock:rice_cooked', 'mock:chicken_breast_cooked', 'mock:broccoli_cooked', 'mock:carrot']);
    // 180 g Reis 234 + 130 g Poulet 195 + 90 g Broccoli 32 + 60 g Karotte 22
    assert.equal(result.total.kcal, 234 + 195 + 32 + 22);
    assert.ok(result.range.kcalMin < result.total.kcal && result.total.kcal < result.range.kcalMax);
    assert.equal(result.level, 'orange');
    assert.ok(result.questions.length <= 2);
  });

  test('Lasagne ist rot, braucht Pruefung und empfiehlt ein zweites Bild', () => {
    const { result } = analyse('lasagne');
    assert.equal(result.level, 'red');
    assert.equal(result.reviewRequired, true);
    assert.equal(result.secondImageRecommended, true);
  });

  test('verpackt und sicher ist gruen', () => {
    const { result } = analyse('packaged');
    assert.equal(result.level, 'green');
    assert.equal(result.reviewRequired, false);
  });

  test('hoechstens zwei Rueckfragen, nach Wirkung sortiert', () => {
    const { result } = analyse('pasta_tomato_bacon');
    assert.equal(result.questions.length, 2);
    assert.ok(result.questions[0].impact >= result.questions[1].impact);
  });

  test('Fett-Antwort fuegt Oel hinzu, "kein" entfernt es wieder', () => {
    const { vision, items } = analyse('rice_chicken_veg');
    const question = buildResult(vision, items).questions.find((entry) => entry.kind === 'fat');
    assert.ok(question);
    const withOil = applyAnswer(items, question, 'normal', { findFood });
    assert.equal(withOil.at(-1).food.id, 'mock:rapeseed_oil');
    assert.equal(withOil.at(-1).grams, 10);
    const after = buildResult(vision, withOil, ['fat']);
    assert.equal(after.total.kcal, buildResult(vision, items).total.kcal + 88);
    assert.equal(after.questions.some((entry) => entry.kind === 'fat'), false);
    assert.equal(applyAnswer(withOil, question, 'none', { findFood }).length, items.length);
    assert.equal(applyAnswer(items, question, 'eimer', { findFood }), null);
  });

  test('Portion-Antwort setzt Gramm und schrumpft die Spanne', () => {
    const { vision, items } = analyse('lasagne');
    const question = buildResult(vision, items).questions.find((entry) => entry.kind === 'portion');
    const large = applyAnswer(items, question, 'large', { findFood });
    assert.equal(large[0].grams, 480);
    assert.ok(large[0].maxGrams - large[0].minGrams < items[0].maxGrams - items[0].minGrams);
  });

  test('Korrekturen zaehlen, was die Person geaendert hat', () => {
    const { items } = analyse('rice_chicken_veg');
    const confirmed = items.map((item) => ({ foodId: item.food.id, grams: item.grams }));
    const same = correctionsOf(items, confirmed);
    assert.equal(same.corrections, 0);
    assert.equal(same.gramsDelta, 0);
    assert.deepEqual(
      same.ratios.map((entry) => entry.ratio),
      [1, 1, 1, 1],
    );
    confirmed[0].grams = 250;
    const changed = correctionsOf(items, confirmed.slice(0, 3));
    assert.equal(changed.corrections, 2);
    assert.equal(changed.gramsDelta, 70);
    // 250 g statt 180 g: das merkt sich die persoenliche Portion als 1.39.
    assert.deepEqual(changed.ratios[0], { foodId: 'mock:rice_cooked', ratio: 1.39 });
  });
});

/** Ein Bild, auf dem nur zu sehen ist, was man sehen kann — das Fett fehlt. */
const seen = (mealName, foods) => ({
  mealName,
  mealClass: 'mixed',
  foods: foods.map(([displayName, grams]) => ({
    displayName,
    canonicalSearchTerm: displayName,
    swissSearchTerm: '',
    preparation: 'gekocht',
    estimatedGrams: grams,
    minGrams: Math.round(grams * 0.8),
    maxGrams: Math.round(grams * 1.2),
    confidence: 0.8,
    visibleIngredients: [displayName],
    possibleHiddenIngredients: [],
    alternatives: [],
  })),
  overallConfidence: 0.8,
  plateDiameterCm: 27,
  secondImageRecommended: false,
  questions: [],
  warnings: [],
});

const withDish = (vision) =>
  applyDish(vision, matchFoods(vision, matcher), { match: (term) => catalog.match(term) });

describe('Was die Kamera nicht sieht', () => {
  test('Älplermagronen bekommen Rahm und Käse dazu, mit Herkunft „dish“', () => {
    const vision = seen('Älplermagronen', [
      ['Teigwaren', 200],
      ['Kartoffel', 90],
    ]);
    const items = withDish(vision);
    const added = items.filter((item) => item.from === 'dish');
    assert.ok(added.length >= 1);
    assert.deepEqual(added.map((item) => item.food.id).sort(), ['mock:cream', 'mock:gruyere']);
    assert.ok(added.every((item) => item.grams > 0 && item.aiGrams === item.grams));
    // Sichtbares bleibt unangetastet.
    assert.deepEqual(items.slice(0, 2).map((item) => item.grams), [200, 90]);
    // Und es faellt ins Gewicht.
    const result = buildResult(vision, items);
    assert.ok(result.total.kcal > buildResult(vision, matchFoods(vision, matcher)).total.kcal + 100);
    assert.equal(result.questions.some((entry) => entry.subject === 'Vollrahm'), false);
  });

  test('Rösti bekommen ihre Butter, auch als einziger Posten', () => {
    const items = withDish(seen('Rösti', [['Rösti', 250]]));
    assert.deepEqual(
      items.filter((item) => item.from === 'dish').map((item) => item.food.id),
      ['mock:butter'],
    );
  });

  test('nennt das Modell das Fett selbst, bleibt es bei der Rueckfrage', () => {
    const vision = seen('Spaghetti Carbonara', [
      ['Spaghetti', 230],
      ['Speck', 55],
    ]);
    vision.foods[1].possibleHiddenIngredients = ['Öl'];
    assert.equal(withDish(vision).some((item) => item.from === 'dish' && item.food.id.includes('oil')), false);
  });

  test('kennt der Katalog das Gericht als Ganzes, kommt nichts dazu', () => {
    const vision = seen('Lasagne', [['Lasagne Bolognese', 350]]);
    assert.equal(withDish(vision).length, 1);
  });

  test('ohne erkanntes Gericht und bei Verpacktem bleibt alles, wie es war', () => {
    assert.equal(withDish(seen('Irgendwas vom Buffet', [['Reis', 180]])).length, 1);
    const packaged = seen('Älplermagronen', [['Teigwaren', 200]]);
    packaged.mealClass = 'packaged';
    assert.equal(withDish(packaged).length, 1);
  });
});

describe('Die eigene Portion', () => {
  const rows = (...ratios) =>
    ratios.map((ratio) => ({ portionRatios: [{ foodId: 'mock:rice_cooked', ratio }] }));

  test('erst ab zwei Korrekturen, und dann der Median', () => {
    assert.deepEqual(personalFactors(rows(1.4)), {});
    assert.deepEqual(personalFactors(rows(1.4, 1.2)), { 'mock:rice_cooked': 1.3 });
    // Ein Ausreisser kippt nichts.
    assert.deepEqual(personalFactors(rows(1.3, 1.2, 4)), { 'mock:rice_cooked': 1.3 });
    assert.deepEqual(personalFactors([]), {});
    assert.deepEqual(personalFactors(undefined), {});
  });

  test('gedeckelt auf 0.6 bis 1.5 — gelernt wird, nicht geraten', () => {
    assert.deepEqual(personalFactors(rows(3, 4)), { 'mock:rice_cooked': 1.5 });
    assert.deepEqual(personalFactors(rows(0.1, 0.2)), { 'mock:rice_cooked': 0.6 });
  });

  test('angewendet wird sie nur auf den eigenen Posten, mit Spanne und Merkmal', () => {
    const { items } = analyse('rice_chicken_veg');
    const applied = applyPersonal(items, { 'mock:rice_cooked': 1.3 });
    assert.equal(applied[0].grams, 234);
    assert.equal(applied[0].minGrams, 182);
    assert.equal(applied[0].maxGrams, 299);
    assert.equal(applied[0].personal, true);
    assert.equal(applied[0].personalFactor, 1.3);
    assert.equal(applied[0].aiGrams, 180, 'die Schaetzung der KI bleibt, wie sie war');
    // Alle anderen bleiben unberuehrt.
    assert.equal(applied[1].grams, items[1].grams);
    assert.equal(applied[1].personal, undefined);
  });

  test('winzige Unterschiede und fehlende Faktoren aendern nichts', () => {
    const { items } = analyse('rice_chicken_veg');
    assert.deepEqual(applyPersonal(items, { 'mock:rice_cooked': 1.02 }), items);
    assert.deepEqual(applyPersonal(items, {}), items);
  });
});
