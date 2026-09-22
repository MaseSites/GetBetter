/**
 * Verpackte Produkte (Masterplan §5 Weg A, §12):
 *
 *   GET  /v1/fit/foods/barcode/:code    eigenes Produkt -> Zwischenspeicher -> Open Food Facts
 *   POST /v1/fit/nutrition-label/scan   Foto der Naehrwerttabelle lesen, nichts speichern
 *   POST /v1/fit/foods/label            bestaetigtes Produkt speichern (Barcode, Werte je 100 g)
 */
const { normalizeBarcode } = require('../barcode.js');
const { publicFood, normalize } = require('../catalog/index.js');
const { cleanImage } = require('../images.js');
const { LANGUAGES } = require('../lang.js');
const { validPieceGrams } = require('../limits.js');
const { checkPer100 } = require('../nutrition.js');
const { createOpenFoodFacts } = require('../sources/off.js');
const { createUsage } = require('../usage.js');
const { geminiAnalyze } = require('../vision/gemini.js');
const { LABEL_SCHEMA, MOCK_LABEL, labelInstruction, validateLabel } = require('../vision/label.js');

function packagedRoutes(ctx) {
  const { ok, store, config } = ctx;
  const usage = createUsage({ store, config, now: ctx.now });
  const off = createOpenFoodFacts({
    enabled: config.openFoodFacts,
    mode: config.mode,
    ...(config.offTestUrl ? { baseUrl: config.offTestUrl } : {}),
  });

  async function barcode({ auth, params: [raw], language }) {
    const code = normalizeBarcode(raw);
    if (!code) return ok(400, { error: 'barcode_invalid' });
    // Zuerst, was die Person selbst bestaetigt hat — das ist genauer als jede Datenbank.
    const own = await store.read((tx) => tx.forOwner(auth.accountId).list('customFoods', (row) => row.barcode === code)[0] ?? null);
    if (own) return ok(200, { code, source: 'own', food: publicFood(own, language) });

    const cacheRows = await store.read((tx) => tx.shared('foodCache'));
    const result = await off.lookup(code, cacheRows);
    if (result.error) return ok(502, { error: result.error });
    if (!result.cached) {
      await store.transact((tx) => {
        const shared = tx.shared('foodCache');
        const row = cacheRows.find((entry) => entry.key === `off:${code}`);
        const index = shared.findIndex((entry) => entry.key === row.key);
        if (index >= 0) shared[index] = row;
        else shared.push(row);
      });
    }
    if (!result.food) return ok(404, { error: 'barcode_unknown', code, next: 'scan_label' });
    return ok(200, { code, source: 'off', food: publicFood(result.food, language), warnings: result.food.warnings ?? [] });
  }

  async function scanLabel({ auth, body, language: requestLanguage }) {
    const image = cleanImage(body.image);
    if (!image.ok) return ok(400, { error: image.error });
    // Nur bekannte Sprachen gehen in die Anweisung an die KI.
    const language = LANGUAGES.includes(body.language) ? body.language : LANGUAGES.includes(requestLanguage) ? requestLanguage : 'de';
    const today = ctx.todayIn('Europe/Zurich', ctx.now());
    // Pruefen und reservieren in einem Schritt: parallele Scans ueberziehen nichts.
    const admission = await store.transact((tx) => {
      const reserved = usage.reserve(tx, auth.accountId, { today, kind: 'label_scan' });
      if (!reserved.ok) return reserved;
      const row = tx.forOwner(auth.accountId).insert('mealAnalyses', {
        day: today,
        status: 'pending',
        provider: reserved.provider,
        imageCount: 1,
        calls: [reserved.at],
        createdAt: reserved.at,
      });
      return { ...reserved, rowId: row.id };
    });
    if (!admission.ok) return ok(admission.error === 'daily_limit' ? 429 : 503, admission);

    let response;
    try {
      response =
        admission.provider === 'mock'
          ? { ok: true, raw: structuredClone(MOCK_LABEL), usage: { model: 'mock', inputTokens: 0, outputTokens: 0, costChf: 0, durationMs: 0 } }
          : await geminiAnalyze({
              apiKey: config.geminiKey,
              // Ablesen ist einfach: das guenstige Modell reicht.
              model: config.cheapModel,
              fallbackModel: config.fallbackModel,
              images: [image],
              schema: LABEL_SCHEMA,
              instruction: labelInstruction(language),
              ...(config.geminiTestUrl ? { baseUrl: config.geminiTestUrl } : {}),
            });
    } catch {
      response = { ok: false, error: 'provider_error' };
    }
    // Das Bild wird nie abgelegt: nach dieser Anfrage gibt es es nicht mehr.
    await store.transact((tx) => {
      const own = tx.forOwner(auth.accountId);
      usage.settle(own, admission.ledgerId, { ...(response.usage ?? {}), ok: response.ok });
      own.update('mealAnalyses', admission.rowId, { status: response.ok ? 'label' : 'failed' });
    });
    if (!response.ok) return ok(502, { error: response.error });
    const checked = validateLabel(response.raw);
    if (!checked.ok) return ok(422, { error: checked.error });
    return ok(200, { label: checked.label });
  }

  function saveLabel({ auth, body }) {
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
    if (!name) return ok(400, { error: 'name_required' });
    const per100 = {
      kcal: Number(body.per100?.kcal),
      proteinG: Number(body.per100?.proteinG),
      carbsG: Number(body.per100?.carbsG),
      fatG: Number(body.per100?.fatG),
    };
    for (const key of ['fiberG', 'sugarG', 'saltG']) if (Number.isFinite(Number(body.per100?.[key])) && body.per100?.[key] !== null) per100[key] = Number(body.per100[key]);
    const check = checkPer100(per100);
    if (!check.ok) return ok(400, { error: 'per100_invalid', details: check.errors });
    const code = body.barcode === undefined || body.barcode === null || body.barcode === '' ? null : normalizeBarcode(body.barcode);
    if (body.barcode && !code) return ok(400, { error: 'barcode_invalid' });
    const brand = typeof body.brand === 'string' ? body.brand.trim().slice(0, 60) : null;
    const piece = validPieceGrams(Number(body.gramsPerPiece));

    return store.transact((tx) => {
      const own = tx.forOwner(auth.accountId);
      const row = {
        source: 'label',
        names: { de: name },
        synonyms: [],
        brand,
        barcode: code,
        state: null,
        per100,
        allergens: Array.isArray(body.allergens) ? body.allergens.filter((entry) => typeof entry === 'string').slice(0, 14) : [],
        gramsPerPiece: piece,
        shopCategory: 'other',
        confirmedAt: ctx.now().toISOString(),
      };
      // Duplikate: derselbe Barcode wird aktualisiert statt doppelt angelegt.
      const sameCode = code ? own.list('customFoods', (entry) => entry.barcode === code)[0] : null;
      if (sameCode) {
        const updated = own.update('customFoods', sameCode.id, row, { reason: 'label_rescan' });
        return ok(200, { food: publicFood(updated), duplicate: 'barcode', warnings: check.warnings });
      }
      const sameName = own.list('customFoods', (entry) => normalize(entry.names?.de) === normalize(name) && (entry.brand ?? null) === brand)[0];
      if (sameName && body.allowDuplicate !== true) return ok(409, { error: 'duplicate_name', food: publicFood(sameName) });
      const created = own.insert('customFoods', { ...row, createdAt: ctx.now().toISOString() });
      return ok(201, { food: publicFood(created), warnings: check.warnings });
    });
  }

  return [
    { method: 'GET', path: /^\/v1\/fit\/foods\/barcode\/([^/]+)$/, handler: barcode },
    { method: 'POST', path: /^\/v1\/fit\/nutrition-label\/scan$/, body: true, handler: scanLabel },
    { method: 'POST', path: /^\/v1\/fit\/foods\/label$/, body: true, handler: saveLabel },
  ];
}

module.exports = { packagedRoutes };
