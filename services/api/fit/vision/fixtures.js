/**
 * Die Bildanalyse im Mock-Modus (Masterplan §23): feste Antworten in genau
 * der Form, die Gemini liefern muss. Kein Aufruf nach aussen.
 *
 * Welche Antwort kommt, bestimmt `mockFixture` aus der Anfrage (nur im
 * Mock-Modus beachtet) — sonst ein Hash ueber die Bildbytes, damit dasselbe
 * Bild immer dasselbe Ergebnis gibt.
 */
const crypto = require('node:crypto');

const food = (
  displayName,
  canonicalSearchTerm,
  preparation,
  estimatedGrams,
  minGrams,
  maxGrams,
  confidence,
  hidden = [],
) => ({
  displayName,
  canonicalSearchTerm,
  preparation,
  estimatedGrams,
  minGrams,
  maxGrams,
  confidence,
  visibleIngredients: [displayName],
  possibleHiddenIngredients: hidden,
});

const FIXTURES = {
  rice_chicken_veg: {
    mealName: 'Reis mit Poulet und Gemüse',
    mealClass: 'mixed',
    foods: [
      food('Reis', 'rice, white, cooked', 'gekocht', 180, 140, 230, 0.86),
      food('Pouletbrust', 'chicken breast, cooked', 'gebraten', 130, 100, 160, 0.82, ['Öl']),
      food('Broccoli', 'broccoli, cooked', 'gekocht', 90, 60, 120, 0.9),
      food('Karotte', 'carrot', 'gekocht', 60, 40, 80, 0.85),
    ],
    overallConfidence: 0.84,
    secondImageRecommended: false,
    questions: [],
    warnings: [],
  },
  pasta_tomato_bacon: {
    mealName: 'Pasta mit Tomatensauce und Speck',
    mealClass: 'mixed',
    foods: [
      food('Spaghetti', 'pasta, cooked', 'gekocht', 250, 190, 320, 0.8),
      food('Tomatensauce', 'tomato sauce', 'gekocht', 120, 80, 170, 0.7, ['Öl', 'Zucker']),
      food('Speck', 'bacon', 'gebraten', 35, 20, 55, 0.65),
      food('Parmesan', 'parmesan', '', 10, 5, 20, 0.55),
    ],
    overallConfidence: 0.7,
    secondImageRecommended: false,
    questions: ['Wurde der Speck in Öl angebraten?'],
    warnings: [],
  },
  lasagne: {
    mealName: 'Lasagne',
    mealClass: 'hidden_ingredients',
    foods: [
      food('Lasagne Bolognese', 'lasagna with meat sauce', 'gebacken', 350, 250, 480, 0.55, [
        'Butter',
        'Rahm',
        'Käse',
        'Öl',
      ]),
    ],
    overallConfidence: 0.5,
    secondImageRecommended: true,
    questions: [
      'Selbst gemacht oder aus dem Restaurant?',
      'Wie gross war das Stück im Vergleich zum Teller?',
    ],
    warnings: ['Schichten und Füllung sind auf dem Foto nicht sichtbar.'],
  },
  packaged: {
    mealName: 'Joghurt nature',
    mealClass: 'packaged',
    foods: [food('Joghurt nature', 'yogurt, plain, whole milk', '', 180, 175, 185, 0.9)],
    overallConfidence: 0.88,
    secondImageRecommended: false,
    questions: [],
    warnings: ['Verpacktes Produkt: Barcode oder Nährwerttabelle ist genauer.'],
  },
  blurry: {
    mealName: 'Unscharfes Gericht',
    mealClass: 'mixed',
    foods: [food('Gemüse', 'mixed vegetables, cooked', 'gekocht', 150, 60, 300, 0.3)],
    overallConfidence: 0.25,
    secondImageRecommended: true,
    questions: [],
    warnings: ['Das Bild ist unscharf.'],
  },
  no_food: {
    mealName: 'Kein Essen erkannt',
    mealClass: 'simple',
    foods: [],
    overallConfidence: 0,
    secondImageRecommended: false,
    questions: [],
    warnings: ['Auf dem Bild ist kein Essen zu sehen.'],
  },
  low_confidence: {
    mealName: 'Unbekanntes Curry',
    mealClass: 'hidden_ingredients',
    foods: [
      food('Curry-Sauce', 'curry sauce', 'gekocht', 200, 120, 320, 0.35, [
        'Kokosmilch',
        'Öl',
        'Rahm',
      ]),
      food('Reis', 'rice, white, cooked', 'gekocht', 150, 100, 220, 0.6),
    ],
    overallConfidence: 0.35,
    secondImageRecommended: true,
    questions: ['War Kokosmilch oder Rahm in der Sauce?'],
    warnings: [],
  },
  // Ein zweites Bild von der Seite: dieselbe Lasagne, jetzt mit sichtbarer Hoehe.
  lasagne_side: {
    mealName: 'Lasagne',
    mealClass: 'hidden_ingredients',
    foods: [
      food('Lasagne Bolognese', 'lasagna with meat sauce', 'gebacken', 330, 290, 380, 0.7, [
        'Butter',
        'Rahm',
        'Käse',
      ]),
    ],
    overallConfidence: 0.68,
    secondImageRecommended: false,
    questions: ['Selbst gemacht oder aus dem Restaurant?'],
    warnings: [],
  },
};

/** Diese Namen loesen einen Fehler aus statt einer Antwort. */
const FAILURES = { api_error: 'provider_error', timeout: 'provider_timeout' };

const ROTATION = ['rice_chicken_veg', 'pasta_tomato_bacon', 'lasagne', 'packaged'];

function pickFixture(requested, imageBytes, { secondImage = false } = {}) {
  if (typeof requested === 'string' && (requested in FIXTURES || requested in FAILURES))
    return requested;
  if (secondImage) return 'lasagne_side';
  const digest = crypto
    .createHash('sha256')
    .update(imageBytes ?? Buffer.alloc(0))
    .digest();
  return ROTATION[digest[0] % ROTATION.length];
}

/** Wie der Anbieter: `{ ok, result, usage }` oder `{ ok: false, error }`. */
async function mockAnalyze({ fixture }) {
  if (fixture in FAILURES) return { ok: false, error: FAILURES[fixture] };
  return {
    ok: true,
    raw: structuredClone(FIXTURES[fixture]),
    usage: { model: 'mock', inputTokens: 0, outputTokens: 0, costChf: 0, durationMs: 0 },
  };
}

module.exports = { FIXTURES, FAILURES, mockAnalyze, pickFixture };
