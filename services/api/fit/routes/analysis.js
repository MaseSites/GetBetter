/**
 * Mahlzeitenanalyse per Foto (Masterplan §5–§11, §21):
 *
 *   POST /v1/fit/meal-analysis/start          ein Bild -> Vorschlag
 *   POST /v1/fit/meal-analysis/:id/add-image  zweites Bild (Seite) -> neuer Vorschlag
 *   POST /v1/fit/meal-analysis/:id/answer     eine der hoechstens zwei Rueckfragen
 *   POST /v1/fit/meal-analysis/:id/confirm    Gramm bestaetigt -> Mahlzeit im Tagebuch
 *   POST /v1/fit/meal-analysis/:id/cancel     verwerfen, Bilder weg
 *   GET  /v1/fit/meal-analysis/:id
 *
 * Aufrufe nach aussen (Gemini, USDA) laufen nie innerhalb einer Transaktion.
 * Vor jedem bezahlten Aufruf wird in einer Transaktion geprueft UND reserviert
 * (Tageslimit und Monatsbudget, `usage.reserve`), danach abgerechnet (`settle`).
 *
 * Fehlercodes: `no_food` 422 (nichts erkannt), Anbieter 502, geschlossene
 * Analyse 409 `analysis_closed`, erstes Foto weg 409 `analysis_expired`.
 */
const {
  applyAnswer,
  applyDish,
  applyPersonal,
  buildResult,
  correctionsOf,
  matchFoods,
  personalFactors,
  scaledRanges,
} = require('../analysis.js');
const { publicFood, tokens } = require('../catalog/index.js');
const { applyReference } = require('../reference/guard.js');
const { cleanImage } = require('../images.js');
const { LANGUAGES } = require('../lang.js');
const { createUsda } = require('../sources/usda.js');
const { MAX_AGE_MS } = require('../tempImages.js');
const { createUsage } = require('../usage.js');
const { mockAnalyze, pickFixture } = require('../vision/fixtures.js');
const { geminiAnalyze } = require('../vision/gemini.js');
const { validateVision } = require('../vision/schema.js');
const { daySummary, mealLines, SLOTS } = require('./diary.js');

const languageFor = (wanted, fallback) =>
  LANGUAGES.includes(wanted) ? wanted : LANGUAGES.includes(fallback) ? fallback : 'de';

function analysisRoutes(ctx) {
  const { ok, store, catalog, config, reference } = ctx;
  const usage = createUsage({ store, config, now: ctx.now });
  const { images } = ctx;
  const usda = createUsda({
    apiKey: config.usdaKey,
    enabled: config.mode === 'live',
    ...(config.usdaTestUrl ? { baseUrl: config.usdaTestUrl } : {}),
  });

  /** Das Bild analysieren lassen: Mock oder Gemini, dann streng pruefen. Wirft nie. */
  async function observe(provider, { imageList, fixture, context, language, meal = null }) {
    let response;
    try {
      response =
        provider === 'mock'
          ? await mockAnalyze({ fixture })
          : await geminiAnalyze({
              apiKey: config.geminiKey,
              model: config.visionModel,
              fallbackModel: config.fallbackModel,
              images: imageList,
              context,
              language,
              meal,
              ...(config.geminiTestUrl ? { baseUrl: config.geminiTestUrl } : {}),
            });
    } catch {
      return { ok: false, error: 'provider_error' };
    }
    if (!response.ok) return { ok: false, error: response.error, usage: response.usage };
    const checked = validateVision(response.raw);
    if (!checked.ok) return { ok: false, error: 'vision_invalid', usage: response.usage };
    return { ok: true, vision: checked.result, usage: response.usage };
  }

  /**
   * Zuordnen: erst der Katalog, fuer Unsicheres USDA (live, mit Schluessel);
   * neue USDA-Zeilen landen im gemeinsamen Zwischenspeicher. Danach kommt dazu,
   * was die Kamera nicht sieht (Standardrezept), und zuletzt zaehlt die eigene Portion.
   */
  async function match(auth, vision, language = 'de', slot = 'lunch') {
    // `forOwner` kennt keine fremde Zeile: die eigene Portion bleibt die eigene.
    const { customFoods, cacheRows, confirmed } = await store.read((tx) => ({
      customFoods: tx.forOwner(auth.accountId).list('customFoods'),
      cacheRows: tx.shared('foodCache'),
      confirmed: tx
        .forOwner(auth.accountId)
        .list('mealAnalyses', (row) => row.status === 'confirmed'),
    }));
    const found = new Map();
    if (usda.enabled) {
      for (const entry of vision.foods) {
        const local = catalog.match(entry.displayName, {
          preparation: entry.preparation,
          customFoods,
        });
        if (!local || local.uncertain)
          found.set(
            entry.canonicalSearchTerm,
            await usda.search(entry.canonicalSearchTerm, cacheRows),
          );
      }
      await store.transact((tx) => {
        const shared = tx.shared('foodCache');
        for (const row of cacheRows) {
          const index = shared.findIndex((existing) => existing.key === row.key);
          if (index >= 0) shared[index] = row;
          else shared.push(row);
        }
      });
    }
    const matcher = (term, preparation) => {
      const local = catalog.match(term, { preparation, customFoods });
      if (local && !local.uncertain) return local;
      const [first] = found.get(term) ?? [];
      if (first) {
        const wanted = tokens(term);
        const own = tokens(first.names.en);
        const share =
          wanted.filter((word) => own.some((entry) => entry.startsWith(word))).length /
          Math.max(1, wanted.length);
        const usdaMatch = {
          food: first,
          score: 0.5 + share * 0.4,
          uncertain: share < 0.75,
          stateMismatch: false,
        };
        if (!local || usdaMatch.score > local.score) return usdaMatch;
      }
      return local;
    };
    const plain = (term) => catalog.match(term, { customFoods });
    const withDish = applyDish(vision, matchFoods(vision, matcher), { match: plain, language });
    // Erst das Unmoegliche kappen (menuCH), dann die eigene Portion: wer seine
    // Teller kennt, hat das letzte Wort ueber dem Durchschnitt des Landes.
    const guarded = applyReference(withDish, { reference, slot });
    return applyPersonal(guarded, personalFactors(confirmed));
  }

  const view = (row, language = row.language ?? 'de') => ({
    id: row.id,
    status: row.status,
    day: row.day,
    slot: row.slot,
    images: row.imageCount,
    provider: row.provider,
    ...row.result,
    items: row.result.items.map((item) => ({
      term: item.term,
      preparation: item.preparation,
      grams: item.grams,
      minGrams: item.minGrams,
      maxGrams: item.maxGrams,
      confidence: item.confidence,
      matchUncertain: item.matchUncertain,
      stateMismatch: item.stateMismatch,
      added: item.added,
      // `from: 'dish'` aus dem Standardrezept ergaenzt, `cooked` die Umrechnung
      // („gekocht 200 g ≈ 77 g trocken“), `personal` die eigene Portion,
      // `alternatives` die naechstbesten Begriffe fuer die Korrektur mit einem Tipp.
      from: item.from ?? null,
      cooked: item.cooked ?? null,
      personal: item.personal === true,
      personalFactor: item.personalFactor ?? null,
      // Was der Portionspruefer zu diesem Posten wusste — und ob er die Menge anfasste.
      reference: item.reference ?? null,
      alternatives: item.alternatives ?? [],
      food: item.food ? publicFood(item.food, language) : null,
      nutrients: item.nutrients,
    })),
    confirmedMealId: row.confirmedMealId ?? null,
  });

  const findFood = (id) =>
    catalog.find(`mock:${id}`) ?? catalog.search(id, { limit: 1 })[0]?.food ?? null;

  /**
   * Vor dem Aufruf: Tageslimit und Budget pruefen UND reservieren, in einer
   * Transaktion. `write(own, reserved)` zaehlt den Aufruf an der Analyse.
   */
  const reserveFor = (auth, kind, write) =>
    store.transact((tx) => {
      const today = ctx.todayIn('Europe/Zurich', ctx.now());
      const reserved = usage.reserve(tx, auth.accountId, { today, kind });
      if (!reserved.ok) return reserved;
      return { ...reserved, ...write(tx.forOwner(auth.accountId), reserved) };
    });

  /** Das erste Foto ist weg (nach einer Stunde): eine Fortsetzung saehe nur noch das zweite. */
  const isExpired = (row, loaded) =>
    Date.parse(row.createdAt ?? '') < ctx.now().getTime() - MAX_AGE_MS ||
    loaded.length < (row.tempImages ?? []).length;

  async function start({ auth, body, language: requestLanguage }) {
    const day = ctx.isDay(body.day) ? body.day : ctx.todayIn('Europe/Zurich', ctx.now());
    const slot = SLOTS.includes(body.slot) ? body.slot : 'lunch';
    const language = languageFor(body.language, requestLanguage);
    const image = cleanImage(body.image);
    if (!image.ok) return ok(400, { error: image.error });

    // Die Zeile entsteht schon hier als `pending`: sie zaehlt fuers Tageslimit, bevor Gemini laeuft.
    const admission = await reserveFor(auth, 'meal_analysis', (own, reserved) => ({
      rowId: own.insert('mealAnalyses', {
        day,
        slot,
        language,
        status: 'pending',
        provider: reserved.provider,
        imageCount: 1,
        calls: [reserved.at],
        createdAt: reserved.at,
      }).id,
    }));
    if (!admission.ok) return ok(admission.error === 'daily_limit' ? 429 : 503, admission);
    void images.sweep();

    const fixture =
      admission.provider === 'mock' ? pickFixture(body.mockFixture, image.bytes) : null;
    const observed = await observe(admission.provider, {
      imageList: [image],
      fixture,
      language,
      meal: { slot, day },
    });

    // Was hinausging, wird gezaehlt — auch wenn die Antwort nichts taugte.
    const recordFailure = (error) =>
      store.transact((tx) => {
        const own = tx.forOwner(auth.accountId);
        usage.settle(own, admission.ledgerId, { ...(observed.usage ?? {}), ok: false });
        own.update('mealAnalyses', admission.rowId, { status: 'failed', error });
      });
    if (!observed.ok) {
      await recordFailure(observed.error);
      return ok(502, { error: observed.error });
    }
    if (observed.vision.foods.length === 0) {
      await recordFailure('no_food');
      return ok(422, { error: 'no_food', warnings: observed.vision.warnings });
    }

    const items = await match(auth, observed.vision, language, slot);
    const result = buildResult(observed.vision, items);
    // Das Bild bleibt nur, wenn ein zweites Foto helfen koennte — sonst ist es jetzt weg.
    const temp = result.secondImageRecommended ? [await images.save(image)] : [];
    // Behalten nur mit Zustimmung UND wenn der Betrieb es erlaubt (`STORE_ORIGINAL_MEAL_IMAGES`).
    const kept =
      body.keepImage === true && config.storeOriginalImages
        ? await images.keep(auth.accountId, image)
        : null;

    return store.transact((tx) => {
      const own = tx.forOwner(auth.accountId);
      usage.settle(own, admission.ledgerId, observed.usage);
      const row = own.update('mealAnalyses', admission.rowId, {
        status: 'open',
        fixture,
        tempImages: temp,
        keptImages: kept ? [kept] : [],
        vision: observed.vision,
        result,
        answered: [],
        model: observed.usage?.model ?? null,
        costChf: observed.usage?.costChf ?? 0,
        durationMs: observed.usage?.durationMs ?? 0,
      });
      return ok(201, { analysis: view(row, language), budget: admission.budget?.state ?? 'ok' });
    });
  }

  /** Abgelaufen: Status setzen, Reste wegraeumen, kein bezahlter Aufruf mehr. */
  async function expire(auth, row) {
    await store.transact((tx) =>
      tx
        .forOwner(auth.accountId)
        .update('mealAnalyses', row.id, { status: 'expired', tempImages: [] }),
    );
    await images.remove(row.tempImages);
    return ok(409, { error: 'analysis_expired' });
  }

  async function addImage({ auth, params: [id], body, language }) {
    const row = await store.read((tx) => tx.forOwner(auth.accountId).get('mealAnalyses', id));
    if (!row) return ok(404, { error: 'not_found' });
    if (row.status === 'expired') return ok(409, { error: 'analysis_expired' });
    if (row.status !== 'open') return ok(409, { error: 'analysis_closed' });
    if (row.imageCount >= config.maxImagesPerAnalysis) return ok(409, { error: 'too_many_images' });
    const image = cleanImage(body.image);
    if (!image.ok) return ok(400, { error: image.error });
    const earlier = (
      await Promise.all((row.tempImages ?? []).map((ref) => images.load(ref)))
    ).filter(Boolean);
    if (!row.vision || isExpired(row, earlier)) return expire(auth, row);

    // Das zweite Bild ist ein bezahlter Aufruf wie das erste: es zaehlt und reserviert.
    const admission = await reserveFor(auth, 'meal_analysis_second', (own, reserved) => {
      const current = own.get('mealAnalyses', id);
      const calls = Array.isArray(current?.calls)
        ? current.calls
        : [current?.createdAt].filter(Boolean);
      own.update('mealAnalyses', id, { calls: [...calls, reserved.at] });
      return {};
    });
    if (!admission.ok) return ok(admission.error === 'daily_limit' ? 429 : 503, admission);

    const context = `Zweites Bild derselben Mahlzeit von der Seite. Erste Einschätzung: ${JSON.stringify(row.vision.foods.map((food) => ({ name: food.displayName, grams: food.estimatedGrams })))}. Zähle nichts doppelt.`;
    const fixture =
      admission.provider === 'mock'
        ? pickFixture(body.mockFixture, image.bytes, { secondImage: true })
        : null;
    const observed = await observe(admission.provider, {
      imageList: [...earlier, image],
      fixture,
      context,
      language: row.language,
      meal: { slot: row.slot, day: row.day },
    });
    if (!observed.ok || observed.vision.foods.length === 0) {
      await store.transact((tx) =>
        usage.settle(tx.forOwner(auth.accountId), admission.ledgerId, {
          ...(observed.usage ?? {}),
          ok: false,
        }),
      );
      // Wie beim Start: nichts erkannt ist 422, ein Fehler des Anbieters 502.
      return observed.ok
        ? ok(422, { error: 'no_food', warnings: observed.vision.warnings })
        : ok(502, { error: observed.error });
    }
    const items = await match(auth, observed.vision, row.language ?? language, row.slot);
    const result = buildResult(observed.vision, items);
    await images.remove(row.tempImages);
    return store.transact((tx) => {
      const own = tx.forOwner(auth.accountId);
      usage.settle(own, admission.ledgerId, observed.usage);
      const next = own.update('mealAnalyses', id, {
        vision: observed.vision,
        result,
        answered: [],
        imageCount: row.imageCount + 1,
        tempImages: [],
        costChf: (row.costChf ?? 0) + (observed.usage?.costChf ?? 0),
      });
      return ok(200, { analysis: view(next, row.language ?? language) });
    });
  }

  function answer({ auth, params: [id], body, language }) {
    return store.transact((tx) => {
      const own = tx.forOwner(auth.accountId);
      const row = own.get('mealAnalyses', id);
      if (!row) return ok(404, { error: 'not_found' });
      if (row.status === 'expired') return ok(409, { error: 'analysis_expired' });
      if (row.status !== 'open' || !row.result) return ok(409, { error: 'analysis_closed' });
      if (!row.vision) return ok(409, { error: 'analysis_expired' });
      const question = row.result.questions.find((entry) => entry.id === body.questionId);
      const items = applyAnswer(row.result.items, question, body.optionId, {
        findFood,
        language: row.language ?? language,
      });
      if (!items) return ok(400, { error: 'answer_invalid' });
      const answered = [...row.answered, question.id];
      const result = buildResult(row.vision, items, answered);
      const next = own.update('mealAnalyses', id, {
        result,
        answered,
        answers: [...(row.answers ?? []), { questionId: question.id, optionId: body.optionId }],
      });
      return ok(200, { analysis: view(next) });
    });
  }

  async function confirm({ auth, params: [id], body, idempotencyKey, language }) {
    const response = await ctx.once(auth.accountId, idempotencyKey, () =>
      store.transact((tx) => {
        const own = tx.forOwner(auth.accountId);
        const row = own.get('mealAnalyses', id);
        if (!row) return ok(404, { error: 'not_found' });
        if (row.status === 'confirmed')
          return ok(409, { error: 'already_confirmed', mealId: row.confirmedMealId });
        if (row.status === 'expired') return ok(409, { error: 'analysis_expired' });
        if (row.status !== 'open' || !row.result) return ok(409, { error: 'analysis_closed' });
        // Bestaetigt wird, was die Person sieht — Lebensmittel und Gramm, nie Kalorien.
        const items = Array.isArray(body.items)
          ? body.items
          : row.result.items
              .filter((item) => item.food)
              .map((item) => ({ foodId: item.food.id, grams: item.grams }));
        if (row.result.reviewRequired && !Array.isArray(body.items))
          return ok(409, { error: 'review_required' });
        // Die Spanne folgt den bestaetigten Gramm, nicht der alten Schaetzung; Spannen der App zaehlen nicht.
        const usable = items.every((item) => item && typeof item === 'object');
        const built = mealLines(
          ctx,
          tx,
          own,
          usable ? scaledRanges(row.result.items, items) : items,
          row.language ?? language ?? 'de',
        );
        if (built.error) return ok(400, built);
        if (
          built.warnings.some((entry) => entry.warning === 'large_portion') &&
          body.confirmLarge !== true
        ) {
          return ok(409, { error: 'confirm_large_portion', warnings: built.warnings });
        }
        const slot = SLOTS.includes(body.slot) ? body.slot : row.slot;
        const day = ctx.isDay(body.day) ? body.day : row.day;
        const meal = own.insert('meals', {
          day,
          slot,
          name:
            typeof body.name === 'string' && body.name.trim()
              ? body.name.trim().slice(0, 80)
              : row.result.mealName,
          source: 'photo',
          items: built.lines,
          total: built.total,
          range: built.range,
          analysisId: id,
          planEntryId: null,
          level: row.result.level,
          createdAt: ctx.now().toISOString(),
        });
        const { corrections, gramsDelta, ratios } = correctionsOf(
          row.result.items,
          items.map((item) => ({ foodId: item.foodId, grams: Number(item.grams) })),
        );
        own.update('mealAnalyses', id, {
          status: 'confirmed',
          confirmedMealId: meal.id,
          corrections,
          gramsDelta,
          // Je Lebensmittel bestaetigt/geschaetzt — daraus lernt die naechste Schaetzung.
          portionRatios: ratios,
          tempImages: [],
        });
        return ok(201, {
          meal,
          day: daySummary(ctx, own, day, language ?? row.language ?? 'de'),
          tempImages: row.tempImages ?? [],
        });
      }),
    );
    if (response.status === 201 && response.body.tempImages) {
      await images.remove(response.body.tempImages);
      delete response.body.tempImages;
    }
    return response;
  }

  async function cancel({ auth, params: [id] }) {
    const outcome = await store.transact((tx) => {
      const own = tx.forOwner(auth.accountId);
      const row = own.get('mealAnalyses', id);
      if (!row) return { status: 404 };
      // Schon bestaetigt, verworfen oder abgelaufen: da gibt es nichts mehr zu verwerfen.
      if (row.status !== 'open') return { status: 409 };
      own.update('mealAnalyses', id, { status: 'cancelled', tempImages: [] });
      return { status: 200, refs: row.tempImages ?? [] };
    });
    if (outcome.status === 404) return ok(404, { error: 'not_found' });
    if (outcome.status === 409) return ok(409, { error: 'analysis_closed' });
    await images.remove(outcome.refs);
    return ok(200, { ok: true });
  }

  return [
    { method: 'POST', path: /^\/v1\/fit\/meal-analysis\/start$/, body: true, handler: start },
    {
      method: 'POST',
      path: /^\/v1\/fit\/meal-analysis\/([^/]+)\/add-image$/,
      body: true,
      handler: addImage,
    },
    {
      method: 'POST',
      path: /^\/v1\/fit\/meal-analysis\/([^/]+)\/answer$/,
      body: true,
      handler: answer,
    },
    {
      method: 'POST',
      path: /^\/v1\/fit\/meal-analysis\/([^/]+)\/confirm$/,
      body: true,
      handler: confirm,
    },
    { method: 'POST', path: /^\/v1\/fit\/meal-analysis\/([^/]+)\/cancel$/, handler: cancel },
    {
      method: 'GET',
      path: /^\/v1\/fit\/meal-analysis\/([^/]+)$/,
      handler: ({ auth, params: [id], language }) =>
        store.read((tx) => {
          const row = tx.forOwner(auth.accountId).get('mealAnalyses', id);
          return row && row.result
            ? ok(200, { analysis: view(row, row.language ?? language) })
            : ok(404, { error: 'not_found' });
        }),
    },
    // Nur der Zustand, nie Franken: die Summe ueber alle Konten geht niemanden etwas an.
    {
      method: 'GET',
      path: /^\/v1\/fit\/usage$/,
      handler: async () => ok(200, { state: (await usage.budget()).state }),
    },
  ];
}

module.exports = { analysisRoutes };
