/**
 * Aktionen und der KI-Coach.
 *
 *   GET  /v1/fit/actions                  offene und letzte Vorschlaege
 *   POST /v1/fit/actions                  { tool, args } -> Vorschlag
 *   POST /v1/fit/actions/:id/confirm      speichern (nur wenn die Vorschau noch stimmt)
 *   POST /v1/fit/actions/:id/reject
 *   POST /v1/fit/coach/message            { text } -> Antworten des Coaches
 *   GET  /v1/fit/coach/messages
 *   GET  /v1/fit/coach/today              Hinweise des Tages, nach festen Regeln (ohne KI)
 *
 * Der Coach schreibt nie selbst. Er erkennt die Absicht, liest ueber
 * Lese-Werkzeuge oder schlaegt ueber Schreib-Werkzeuge vor. Die Nachricht
 * „gespeichert“ entsteht erst nach der Bestaetigung — aus dem, was
 * tatsaechlich gespeichert ist. Seine Nachrichten sind Daten (`kind`, `data`);
 * den Satz baut die App in der Sprache der Person.
 */
const { detectIntent } = require('../coach/intents.js');
const { parsePantryText } = require('../kitchen/pantryText.js');
const { mondayOf } = require('../kitchen/mealplan.js');
const { suggestRecipes } = require('../kitchen/suggest.js');
const { lookups, pantryOf } = require('../tools/kitchen.js');
const { localizeAction, localizeData, sessionTitle } = require('../training/texts.js');
const { shiftDay } = require('../training/training.js');
const { daySummary } = require('./diary.js');

const MAX_TEXT = 1000;
const HISTORY = 6;

function coachRoutes(ctx, engine) {
  const { ok, store, catalog } = ctx;

  async function say(accountId, messages) {
    return store.transact((tx) => {
      const own = tx.forOwner(accountId);
      return messages.map((message) => own.insert('coachMessages', { ...message, createdAt: ctx.now().toISOString() }));
    });
  }

  /** Nach einer Entscheidung: die Nachricht des Coaches aus dem gespeicherten Ergebnis. */
  async function afterDecision(accountId, action) {
    if (action?.origin !== 'coach') return;
    await say(accountId, [{ role: 'coach', kind: action.status === 'confirmed' ? 'confirmed' : 'rejected', tool: action.tool, actionId: action.id, data: action.result ?? null }]);
  }

  /** Eine freie Frage: der KI-Dienst des Projekts, ohne jede Faehigkeit, etwas zu aendern. */
  async function general(accountId, text) {
    if (!ctx.ai) return { role: 'coach', kind: 'general_unavailable', data: null };
    const history = await store.read((tx) =>
      tx
        .forOwner(accountId)
        .list('coachMessages', (row) => row.kind === 'text' || row.role === 'user')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(-HISTORY),
    );
    const messages = [...history.map((row) => ({ role: row.role === 'user' ? 'user' : 'assistant', text: String(row.text ?? '').slice(0, MAX_TEXT) })).filter((row) => row.text), { role: 'user', text }];
    // Die letzte Nachricht muss von der Person sein und darf nicht doppelt stehen.
    const deduped = messages.filter((row, index) => !(index === messages.length - 2 && row.role === 'user' && row.text === text));
    const reply = await ctx.ai.reply({ accountId, app: 'bettergym', messages: deduped });
    if (reply.status === 200 && typeof reply.body?.response === 'string') return { role: 'coach', kind: 'text', text: reply.body.response.slice(0, 2000), data: null };
    // Der Grund mit dem, was die App fuer einen ehrlichen Satz braucht (Plan, Datum, Preis).
    const { plan = null, resetsOn = null, priceChf = null } = reply.body ?? {};
    return { role: 'coach', kind: 'general_unavailable', data: { reason: reply.body?.error ?? 'error', details: { plan, resetsOn, priceChf } } };
  }

  /** Nachrichten in der Sprache der Anfrage — gespeichert sind nur Ids und deutsche Titel. */
  const localizeMessages = (rows, language) => rows.map((row) => ({ ...row, data: localizeData(row.data, language) }));

  async function message({ auth, body, language }) {
    const text = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_TEXT) : '';
    if (!text) return ok(400, { error: 'text_required' });
    const accountId = auth.accountId;
    const today = await store.read((tx) => ctx.todayIn(tx.forOwner(accountId).list('profiles')[0]?.profile?.timezone, ctx.now()));
    await say(accountId, [{ role: 'user', kind: 'text', text }]);
    const intent = detectIntent(text, today);
    const replies = [];

    const propose = async (tool, args) => {
      const proposal = await engine.propose(accountId, tool, args, 'coach');
      if (proposal.status === 201) replies.push({ role: 'coach', kind: 'proposal', tool, actionId: proposal.body.action.id, data: proposal.body.action.preview.summary });
      else replies.push({ role: 'coach', kind: 'proposal_failed', tool, data: { error: proposal.body.error } });
    };

    if (intent.safety) {
      replies.push({ role: 'coach', kind: 'safety', data: null });
    } else if (['reschedule_workout', 'skip_workout', 'log_weight', 'create_weekly_meal_plan'].includes(intent.tool)) {
      await propose(intent.tool, intent.args);
    } else if (intent.tool === 'generate_shopping_list') {
      const plan = await store.read((tx) => tx.forOwner(accountId).list('mealPlans', (row) => row.status === 'confirmed' && row.weekStart === mondayOf(today))[0] ?? null);
      if (plan) await propose('generate_shopping_list', { planId: plan.id });
      else replies.push({ role: 'coach', kind: 'no_plan', data: null });
    } else if (intent.tool === 'pantry_text') {
      // „Ich habe Bananen, Mehl und Eier“: Vorrat vorschlagen und gleich zeigen, was daraus wird.
      const found = await store.read((tx) => {
        const env = { ctx, tx, own: tx.forOwner(accountId) };
        const { customFoods } = lookups(env);
        const parsed = parsePantryText(text, (term) => catalog.match(term, { customFoods }));
        const hypothetical = [...pantryOf(env), ...parsed.lines.map((line) => ({ foodId: line.foodId, grams: null, confirmed: true }))];
        const profile = env.own.list('profiles')[0]?.profile ?? {};
        const summary = daySummary(ctx, env.own, today);
        const suggestions = parsed.lines.length > 0 ? suggestRecipes({ catalog, profile, pantry: hypothetical, remaining: summary.remaining, userRecipes: env.own.list('recipes'), customFoods, today, limit: 3 }).suggestions : [];
        return { parsed, suggestions };
      });
      if (found.parsed.lines.length === 0) replies.push({ role: 'coach', kind: 'pantry_unknown', data: { unknown: found.parsed.unknown } });
      else {
        await propose('add_to_pantry', { lines: found.parsed.lines.map((line) => ({ foodId: line.foodId, amount: line.amount, unit: line.unit })), source: body.voice === true ? 'voice' : 'text' });
        if (found.parsed.unknown.length > 0) replies.push({ role: 'coach', kind: 'pantry_unknown', data: { unknown: found.parsed.unknown } });
        replies.push({ role: 'coach', kind: 'suggestions', data: { items: found.suggestions.map(suggestionData) } });
      }
    } else if (intent.tool !== 'general') {
      const result = await engine.read(accountId, intent.tool, intent.args ?? {});
      const data = ['suggest_recipes_from_pantry', 'find_meals_for_remaining_macros'].includes(intent.tool) && result.ok ? { items: result.data.suggestions?.map(suggestionData) ?? [], emptyPantry: result.data.emptyPantry === true } : result.data;
      replies.push({ role: 'coach', kind: result.ok ? intent.tool : 'read_failed', data: data ?? null });
    } else {
      replies.push(await general(accountId, text));
    }
    const saved = await say(accountId, replies);
    return ok(201, { messages: localizeMessages(saved, language) });
  }

  const suggestionData = (entry) => ({
    id: entry.recipe.id,
    title: entry.recipe.title,
    timeMinutes: entry.recipe.timeMinutes,
    perServing: entry.nutrition.perServing,
    have: entry.have.map((item) => item.name),
    missing: entry.missing.map((item) => ({ name: item.name, basic: item.basic, optional: item.optional })),
    substitutions: entry.recipe.substitutions,
  });

  /** Eine Antwort mit Aktion (oder neuer Vorschau) in der Sprache der Anfrage. */
  const localized = (result, language) => {
    if (!result?.body || typeof result.body !== 'object') return result;
    const body = { ...result.body };
    if (body.action) body.action = localizeAction(body.action, language);
    if (body.preview?.summary) body.preview = { ...body.preview, summary: localizeData(body.preview.summary, language) };
    return ok(result.status, body);
  };

  /**
   * Hinweise des Tages, nach festen Regeln und ohne KI: ein verpasstes Training
   * (morgen nachholen?), nach dem Training das fehlende Eiweiss, an einem
   * Trainingstag der halbe Liter mehr. Hoechstens drei, das Wichtigste zuerst.
   */
  function todayCards(own, today, language) {
    const cards = [];
    const tomorrow = shiftDay(today, 1);
    const active = (day) => own.list('scheduledWorkouts', (row) => row.day === day && row.status !== 'skipped').length > 0;
    const missed = own
      .list('scheduledWorkouts', (row) => row.status === 'planned' && row.day < today && row.day >= shiftDay(today, -3))
      .sort((a, b) => b.day.localeCompare(a.day))[0];
    if (missed && own.list('workoutLogs', (row) => row.workoutId === missed.id).length === 0)
      cards.push({ kind: 'missed', workoutId: missed.id, title: sessionTitle(missed.title, language), day: missed.day, tomorrow, tomorrowFree: !active(tomorrow) });
    if (own.list('profiles').length === 0) return cards;
    const summary = daySummary(ctx, own, today);
    const doneToday = own.list('scheduledWorkouts', (row) => row.day === today && row.status === 'done').length > 0;
    const proteinLeft = summary.remaining ? Math.round(summary.remaining.proteinG) : 0;
    if (doneToday && proteinLeft >= 20) cards.push({ kind: 'protein', proteinG: proteinLeft });
    if (active(today)) cards.push({ kind: 'water', extraMl: 500, targetMl: summary.waterTargetMl });
    return cards.slice(0, 3);
  }

  return [
    {
      method: 'GET',
      path: /^\/v1\/fit\/coach\/today$/,
      handler: ({ auth, language }) =>
        store.read((tx) => {
          const own = tx.forOwner(auth.accountId);
          const today = ctx.todayIn(own.list('profiles')[0]?.profile?.timezone, ctx.now());
          return ok(200, { day: today, cards: todayCards(own, today, language) });
        }),
    },
    {
      method: 'GET',
      path: /^\/v1\/fit\/actions$/,
      handler: ({ auth, url, language }) =>
        store.read((tx) => {
          const status = url.searchParams.get('status');
          const rows = tx
            .forOwner(auth.accountId)
            .list('coachActions', (row) => !status || row.status === status)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 50);
          return ok(200, { actions: rows.map((row) => localizeAction(row, language)) });
        }),
    },
    {
      method: 'POST',
      path: /^\/v1\/fit\/actions$/,
      body: true,
      handler: async ({ auth, body, language }) => localized(await engine.propose(auth.accountId, String(body.tool ?? ''), body.args ?? {}), language),
    },
    {
      method: 'POST',
      path: /^\/v1\/fit\/actions\/([^/]+)\/confirm$/,
      handler: async ({ auth, params: [id], idempotencyKey, language }) => {
        const result = await ctx.once(auth.accountId, idempotencyKey, () => engine.confirm(auth.accountId, id));
        if (result.status === 200) await afterDecision(auth.accountId, result.body.action);
        return localized(result, language);
      },
    },
    {
      method: 'POST',
      path: /^\/v1\/fit\/actions\/([^/]+)\/reject$/,
      handler: async ({ auth, params: [id], language }) => {
        const result = await engine.reject(auth.accountId, id);
        if (result.status === 200) await afterDecision(auth.accountId, result.body.action);
        return localized(result, language);
      },
    },
    // Wie im Masterplan benannt: dieselbe Bestaetigung unter dem Weg des Coaches.
    {
      method: 'POST',
      path: /^\/v1\/fit\/coach\/actions\/([^/]+)\/confirm$/,
      handler: async ({ auth, params: [id], language }) => {
        const result = await engine.confirm(auth.accountId, id);
        if (result.status === 200) await afterDecision(auth.accountId, result.body.action);
        return localized(result, language);
      },
    },
    { method: 'POST', path: /^\/v1\/fit\/coach\/message$/, body: true, handler: message },
    {
      method: 'GET',
      path: /^\/v1\/fit\/coach\/messages$/,
      handler: ({ auth, language }) =>
        store.read((tx) => {
          const rows = tx
            .forOwner(auth.accountId)
            .list('coachMessages')
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            .slice(-60);
          const actions = tx.forOwner(auth.accountId).list('coachActions', (row) => rows.some((message) => message.actionId === row.id));
          return ok(200, { messages: localizeMessages(rows, language), actions: actions.map((row) => localizeAction(row, language)) });
        }),
    },
  ];
}

module.exports = { coachRoutes };
