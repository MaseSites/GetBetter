/**
 * Die Stellschrauben von Better Fit, alle aus Umgebungsvariablen — Namen wie
 * im Masterplan (§24). Schluessel stehen nie im Code und nie in einer Antwort.
 *
 * Ohne jede Angabe laeuft alles im Mock-Modus: keine Anfrage nach aussen.
 */

const bool = (value, fallback) => {
  if (value === undefined || value.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const int = (value, fallback, min, max) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

const num = (value, fallback, min, max) => {
  const n = Number(value);
  return value !== undefined && value.trim() !== '' && Number.isFinite(n) && n >= min && n <= max
    ? n
    : fallback;
};

function fitConfig(env = process.env) {
  const mode = env.MEAL_ANALYSIS_MODE === 'live' ? 'live' : 'mock';
  return {
    /** `mock` (Standard) oder `live`. Im Mock-Modus geht nichts nach aussen. */
    mode,
    /** Nur der Dienst kennt ihn. Fehlt er, bleibt die Bildanalyse im Mock. */
    geminiKey: env.GEMINI_API_KEY?.trim() || null,
    visionModel: env.GEMINI_VISION_MODEL?.trim() || 'gemini-3.8-flash',
    cheapModel: env.GEMINI_CHEAP_MODEL?.trim() || 'gemini-3.5-flash-lite',
    /** Springt ein, wenn das Modell ueberlastet ist (503). Leer = keins. */
    fallbackModel:
      env.GEMINI_FALLBACK_MODEL === undefined
        ? 'gemini-3.5-flash'
        : env.GEMINI_FALLBACK_MODEL.trim() || null,
    usdaKey: env.USDA_FDC_API_KEY?.trim() || null,
    storeOriginalImages: bool(env.STORE_ORIGINAL_MEAL_IMAGES, false),
    openFoodFacts: bool(env.ENABLE_OPEN_FOOD_FACTS, true),
    swissDatabase: bool(env.ENABLE_SWISS_FOOD_DATABASE, true),
    commercialProvider: bool(env.ENABLE_COMMERCIAL_FOOD_PROVIDER, false),
    maxImagesPerAnalysis: int(env.MAX_IMAGES_PER_ANALYSIS, 2, 1, 4),
    maxAnalysesPerDay: int(env.MAX_MEAL_ANALYSES_PER_USER_PER_DAY, 10, 0, 500),
    monthlyBudgetChf: num(env.MONTHLY_AI_BUDGET_CHF, 250, 0, 100000),
    /** So viel wird vor jedem bezahlten Bildaufruf reserviert, bis die echten Kosten da sind. */
    reserveChf: num(env.FIT_AI_RESERVE_CHF, 0.02, 0, 10),
    /** Mit Zustimmung behaltene Fotos fallen nach so vielen Tagen weg. */
    keptImageDays: int(env.FIT_KEPT_IMAGE_DAYS, 30, 1, 3650),
    /** Kill-Switch: `1` schaltet jede bezahlte KI von Better Fit ab. */
    aiDisabled: bool(env.FIT_AI_DISABLED, false),
    /** Nur fuer Tests: ein nachgebauter Anbieter auf 127.0.0.1. */
    geminiTestUrl: env.FIT_GEMINI_TEST_URL?.startsWith('http://127.0.0.1:')
      ? env.FIT_GEMINI_TEST_URL
      : null,
    usdaTestUrl: env.FIT_USDA_TEST_URL?.startsWith('http://127.0.0.1:')
      ? env.FIT_USDA_TEST_URL
      : null,
    offTestUrl: env.FIT_OFF_TEST_URL?.startsWith('http://127.0.0.1:') ? env.FIT_OFF_TEST_URL : null,
    /** Anfragen je Konto und Minute an die Fit-Routen. */
    rateLimitPerMinute: int(env.FIT_RATE_LIMIT_PER_MINUTE, 120, 1, 10000),
  };
}

/** Was die App ueber die Einrichtung wissen darf — nie ein Schluessel. */
function publicConfig(config) {
  return {
    mode: config.mode,
    vision: config.mode === 'live' && config.geminiKey !== null && !config.aiDisabled,
    usda: config.mode === 'live' && config.usdaKey !== null,
    openFoodFacts: config.mode === 'live' && config.openFoodFacts,
    storeOriginalImages: config.storeOriginalImages,
    maxImagesPerAnalysis: config.maxImagesPerAnalysis,
    maxAnalysesPerDay: config.maxAnalysesPerDay,
  };
}

module.exports = { fitConfig, publicConfig };
