/**
 * Die KI der Better-Apps: der Dienst spricht mit dem Anbieter, die Apps nie.
 *
 * Zwei Anbieter, beide mit der OpenAI-Schnittstelle (`POST <url>/chat/completions`):
 *
 * - **Safe Swiss Cloud** („Private AI“, Modelle in der Schweiz, kostet) —
 *   `SAFESWISSCLOUD_API_KEY` / `SAFESWISSCLOUD_API_URL` oder die Dateien
 *   `safeswisscloud.key` / `safeswisscloud.url` im Datenordner. Welches Modell
 *   antwortet, entscheidet `router.js` ohne Modellaufruf.
 * - **Groq** (gratis, `openai/gpt-oss-20b` fuer alles, keine Bilder) —
 *   `GROQ_API_KEY` oder `groq.key` im Datenordner. Kostet nichts, darum
 *   zaehlt es nicht gegen das Kontingent; die Grenzen setzt Groq selbst (429).
 *
 * Ohne `BETTER_AI_PROVIDER` antwortet Safe Swiss Cloud, wenn eingerichtet,
 * sonst Groq.
 *
 * Mit `tools: true` bekommt das Modell die Funktionen der App (`tools.js`) und
 * mit `context` eine kurze Liste der Daten (`context.js`). Was es aufruft, geht
 * geprueft als `actions` an die App zurueck — ausgefuehrt wird dort. Schluessel werden bei jeder Anfrage neu gelesen und gehen nie in
 * eine Antwort, ins Log oder in `ai-usage.jsonl`.
 */
const fs = require('node:fs/promises');
const path = require('node:path');

const { affordableTokens, estimatePromptTokens, worstCaseChf } = require('../billing/costs.js');
const { accountInStore, createBilling } = require('../billing/service.js');
const { MAX_TEXT: SPEECH_MAX_TEXT } = require('../speech/service.js');
const { readUpload: readStoredUpload } = require('../uploads.js');
const { cleanContext, contextText } = require('./context.js');
const { APPS, COST_LEVELS, MAX_CHARS, routeRequest } = require('./router.js');
const { limitChars, plainText, spokenText, stripReasoning } = require('./text.js');
const { actionsOf, toolsFor } = require('./tools.js');
const { recordUsage, tokensOf } = require('./usage.js');

const PROVIDER = 'safeswisscloud';
/** Die beiden Anbieter, in der Reihenfolge, in der sie ohne Vorgabe gefragt werden. */
const PROVIDERS = ['safeswisscloud', 'groq'];
/**
 * Gratis bei Groq: das kleinste Modell, das Groq noch fuehrt — die Llama-Modelle
 * sind dort weg. Es denkt kurz nach; `low` haelt das knapp und schnell.
 */
const GROQ_BASE = 'https://api.groq.com/openai/v1';
const GROQ_MODEL = 'openai/gpt-oss-20b';
const GROQ_LOW_EFFORT = /(^|\/)gpt-oss/i;
/** Mit `low` denkt es nur kurz nach — mehr Platz dafuer kostet bei Groq nur Minuten-Tokens. */
const GROQ_THINKING_BUDGET = 384;
/** So lange wartet der Dienst hoechstens, wenn der Anbieter „gleich nochmal“ sagt. */
const MAX_RETRY_WAIT_MS = 8000;
/** Nur fuer Tests: ein nachgebauter Anbieter auf dem eigenen Rechner. */
const TEST_BASE = /^http:\/\/127\.0\.0\.1:\d{1,5}$/;
const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/;
/** Druckbares ASCII ohne Leerzeichen — alles andere gehoert nicht in einen Header. */
const KEY_PATTERN = /^[\x21-\x7e]{8,512}$/;

const DEFAULT_MODELS = {
  cheap_model: 'gemma4-31b',
  chat_model: 'gpt-oss-120b',
  reasoning_model: 'deepseek-v4-flash',
  vision_model: 'gemma4-31b',
};
const MODEL_ENV = {
  cheap_model: 'BETTER_AI_MODEL_CHEAP',
  chat_model: 'BETTER_AI_MODEL_CHAT',
  reasoning_model: 'BETTER_AI_MODEL_REASONING',
  vision_model: 'BETTER_AI_MODEL_VISION',
};

const MAX_MESSAGES = 20;
/** Mehr Funktionen hat keine App. */
const MAX_TOOL_NAMES = 30;
const MAX_MESSAGE_TEXT = 4000;
const HISTORY = 12;
const CHARS_PER_TOKEN = 3;
const MIN_TOKENS = 64;
/**
 * Modelle, die vor der Antwort nachdenken: das Nachdenken zaehlt gegen
 * `max_tokens`. Ohne Zuschlag kaeme bei kurzen Grenzen eine leere Antwort. Die
 * Grenze deckelt nur — abgerechnet wird, was wirklich entsteht.
 */
const THINKING_MODEL = /^(?:[a-z0-9-]+\/)?(gpt-oss|deepseek-v4|deepseek-r|qwq|qwen3(?!-vl))/i;
const THINKING_BUDGET = 1024;

function tokenBudget(model, maxChars, thinking = THINKING_BUDGET) {
  const answer = Math.max(MIN_TOKENS, Math.ceil(maxChars / CHARS_PER_TOKEN));
  return THINKING_MODEL.test(model) ? answer + thinking : answer;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** `retry-after` in Millisekunden — nur Sekunden als Zahl, sonst null. */
function retryAfterOf(response) {
  const raw = response.headers.get('retry-after');
  const seconds = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds * 1000) : null;
}

/**
 * Darunter lohnt keine Antwort: so viele Ausgabe-Tokens muessen ins Budget
 * passen (denkende Modelle dazu ihr Nachdenken), sonst `budget_exhausted`.
 */
const MIN_ANSWER_TOKENS = 150;

function minimumTokens(model) {
  return THINKING_MODEL.test(model) ? MIN_ANSWER_TOKENS + THINKING_BUDGET : MIN_ANSWER_TOKENS;
}

/** Ohne Abo antwortet immer die guenstige Stufe, mit ihrer Hoechstlaenge. */
function cheapRoute(route) {
  if (route.tier === 'cheap_model') return route;
  return {
    ...route,
    tier: 'cheap_model',
    maxChars: MAX_CHARS[route.tts ? 'voice' : 'text'].cheap_model,
    costLevel: COST_LEVELS.cheap_model,
  };
}
const TIMEOUTS = { standard: 30_000, reasoning: 60_000 };
const TEMPERATURE = { standard: 0.4, reasoning: 0.2 };

const STATUS = {
  bad_request: 400,
  budget_exhausted: 402,
  plan_required: 403,
  account_not_found: 404,
  upload_not_found: 404,
  not_configured: 503,
  vision_unavailable: 400,
  auth_failed: 502,
  rate_limited: 429,
  timeout: 504,
  unreachable: 502,
  upstream_failed: 502,
};

const reply = (status, body) => ({ status, body });
/** `refusal` traegt beim Kontingent Plan, Datum und Preis mit. */
const failure = (error, refusal) => reply(STATUS[error], refusal ?? { error });

/** Was der Anbieter meldet, als eigener Schluessel — nie der Text seiner Antwort. */
function upstreamError(status) {
  if (status === 401 || status === 403) return 'auth_failed';
  if (status === 429) return 'rate_limited';
  return 'upstream_failed';
}

/** `https://…/v1/` -> `https://…/v1`; alles ausser HTTPS ohne Zugangsdaten -> null. */
function normaliseBaseUrl(raw) {
  if (typeof raw !== 'string') return null;
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    return null;
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

async function fromEnvOrFile(name, file) {
  const fromEnv = process.env[name]?.trim();
  if (fromEnv) return fromEnv;
  try {
    const first = (await fs.readFile(file, 'utf8')).split(/\r?\n/)[0]?.trim() ?? '';
    return first.length > 0 ? first : null;
  } catch {
    return null;
  }
}

const modelOrNull = (value) =>
  typeof value === 'string' && MODEL_PATTERN.test(value.trim()) ? value.trim() : null;

function turnOf(message) {
  if (!message || typeof message !== 'object') return null;
  if (message.role !== 'user' && message.role !== 'assistant') return null;
  if (typeof message.text !== 'string' || message.text.length > MAX_MESSAGE_TEXT) return null;
  const text = message.text.trim();
  return text.length > 0 ? { role: message.role, text } : null;
}

/** Die Anfrage in sauberer Form oder null (-> 400). */
function requestOf(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const { accountId, app, messages, voice, imageUploadId, tools, toolNames, context } = input;
  if (typeof accountId !== 'string' || accountId.trim().length === 0) return null;
  if (!APPS.includes(app)) return null;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > MAX_MESSAGES) {
    return null;
  }
  const turns = messages.map(turnOf);
  if (turns.some((turn) => turn === null) || turns.at(-1).role !== 'user') return null;
  if (voice !== undefined && typeof voice !== 'boolean') return null;
  if (tools !== undefined && typeof tools !== 'boolean') return null;
  const named = toolNames !== undefined && toolNames !== null;
  if (
    named &&
    (!Array.isArray(toolNames) ||
      toolNames.length > MAX_TOOL_NAMES ||
      toolNames.some((name) => typeof name !== 'string' || name.length > 40))
  ) {
    return null;
  }
  const hasUpload = imageUploadId !== undefined && imageUploadId !== null;
  if (hasUpload && (typeof imageUploadId !== 'string' || imageUploadId.length === 0)) return null;
  return {
    accountId,
    app,
    turns,
    voice: voice === true,
    imageUploadId: hasUpload ? imageUploadId : null,
    // BetterAi hat keine Funktionen und sieht keine Daten.
    tools: tools === true && toolsFor(app).length > 0,
    // Nur diese Funktionen anbieten — die App waehlt, was zum Satz passt.
    toolNames: named ? toolNames : null,
    context: app === 'betterai' || context === undefined || context === null ? null : cleanContext(context),
  };
}

/**
 * Die letzten Zuege, so wie strenge Chat-Vorlagen sie wollen: beginnt mit der
 * Person, und zwei Zuege derselben Rolle werden einer.
 */
function historyOf(turns) {
  const recent = turns.slice(-HISTORY);
  const firstUser = recent.findIndex((turn) => turn.role === 'user');
  return recent.slice(firstUser).reduce((merged, turn) => {
    const previous = merged.at(-1);
    if (previous?.role !== turn.role) return [...merged, turn];
    return [...merged.slice(0, -1), { role: turn.role, text: `${previous.text}\n\n${turn.text}` }];
  }, []);
}

const APP_ROLES = {
  getbetter: 'Du bist der Assistent von GetBetter, der App für Kalender, Aufgaben, Notizen und den Alltag.',
  betterfamily:
    'Du bist der Assistent von BetterFamily, der App für Familienkalender, Einkaufsliste, Ämtli, Rezepte und den Haushalt.',
  bettergym:
    'Du bist der Assistent von BetterGym, der App für Training, Ernährung, Trinken, Schlaf und Gesundheit.',
  bettermoney:
    'Du bist der Assistent von BetterMoney, der App für Budget, Rechnungen, Abos und Sparziele.',
  betterai: 'Du bist ein hilfsbereiter KI-Assistent in der App BetterAi.',
};

const APP_LIMITS = {
  bettergym: 'Stelle keine Diagnosen; bei ernsten Beschwerden rätst du zu einer Fachperson.',
  bettermoney: 'Gib keine persönliche Anlageberatung.',
  betterai: 'Du siehst keine Daten aus den anderen Better-Apps.',
};

const INTENT_HINTS = {
  command: 'Die Person möchte etwas erledigt haben: sag kurz, wie sie es in der App selbst tut.',
  simple_query: 'Antworte direkt mit dem Ergebnis, ohne lange Herleitung.',
  coaching: 'Sei ermutigend, ehrlich und konkret: wenige Tipps, die sich sofort umsetzen lassen.',
  planning: 'Gliedere den Plan in klare, machbare Schritte.',
  vision: 'Sag, was auf dem Bild für die Frage wichtig ist, und beantworte sie.',
};

/**
 * Was er mit Funktionen tun darf — und was nicht. Kurz gehalten: jede Zeile
 * geht bei jeder Frage mit hinaus.
 */
const TOOL_RULES = [
  'Bediene die App mit den Funktionen: Will die Person etwas eintragen, ändern, löschen, abhaken, öffnen oder umstellen — auch beiläufig („ich muss morgen um 3 zum Zahnarzt“) —, rufe die Funktion auf und schreib nichts dazu. Sag nie, du hättest etwas getan — das sagt die App.',
  'Löschen, verschieben und abhaken gilt nur für Einträge aus den Listen, über ihre Kennung. Ist nicht eindeutig, welcher gemeint ist, frag kurz nach und nenne die Möglichkeiten. Leg nie etwas an, wenn die Person etwas löschen, verschieben oder abhaken will, und nie etwas, das wie der Befehl selbst heisst.',
  'Fragen beantwortest du mit Text aus den Listen unten, ohne Funktion. Erfinde nichts; fehlt der Tag, frag kurz nach. Ohne Uhrzeit wird ein Termin ganztägig.',
  'Tage als YYYY-MM-DD aus der Liste der nächsten Tage, Uhrzeiten als HH:MM, Kennungen wie [T1] nur aus den Listen — nenne sie nie in der Antwort.',
].join('\n');

const NO_TOOLS =
  'Du kannst in den Apps nichts ausführen, eintragen, ändern oder löschen. Behaupte nie, etwas getan zu haben, und du siehst die Daten der Person nur, wenn sie im Gespräch stehen.';

const TOOL_HINT = 'Die Person möchte etwas erledigt haben: ruf die passende Funktion auf.';

/** Deutsch als Grundlage; geantwortet wird in der Sprache der Person. */
function systemPrompt(app, route, { tools = false, context = null } = {}) {
  const inApps = app !== 'betterai';
  const hint =
    route.intent === 'command' && tools
      ? TOOL_HINT
      : route.intent === 'command' && !inApps
        ? null
        : INTENT_HINTS[route.intent];
  return [
    APP_ROLES[app],
    'Antworte immer in der Sprache der letzten Nachricht der Person, auch wenn sie nicht Deutsch ist.',
    'Sprich die Person mit „du“ an, auf Französisch und Italienisch mit „tu“.',
    `Deine ganze Antwort hat höchstens ${route.maxChars} Zeichen.`,
    route.tts
      ? 'Deine Antwort wird laut vorgelesen: nur schlichte, gesprochene Sätze. Kein Markdown, keine Listen, keine Emojis, keine Links oder Webadressen.'
      : tools
        ? // Der Assistent zeigt schlichten Text — Sternchen stuenden dort wortwoertlich.
          'Schreib klar und knapp, als schlichten Text ohne Markdown und ohne Sternchen.'
        : 'Schreib klar und knapp; Markdown nur, wo es wirklich hilft.',
    inApps ? (tools ? TOOL_RULES : NO_TOOLS) : null,
    APP_LIMITS[app] ?? null,
    hint ?? null,
    context
      ? `Was du über die Person weisst — nur das, alles andere weisst du nicht:\n${contextText(context)}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function messagesFor(request, route, image) {
  const history = historyOf(request.turns);
  const last = history.length - 1;
  const turns = history.map((turn, index) =>
    index === last && image
      ? {
          role: 'user',
          content: [
            { type: 'text', text: turn.text },
            { type: 'image_url', image_url: { url: image } },
          ],
        }
      : { role: turn.role, content: turn.text },
  );
  return [{ role: 'system', content: systemPrompt(request.app, route, request) }, ...turns];
}

/** Der Text der Antwort — `reasoning_content` bleibt bewusst liegen. */
function contentOf(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return null;
  return content.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('');
}

const failureOfThrown = (error) =>
  error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'timeout' : 'unreachable';

/** Die Funktionsaufrufe der Antwort — oder eine leere Liste. */
function toolCallsOf(data) {
  const calls = data?.choices?.[0]?.message?.tool_calls;
  return Array.isArray(calls) ? calls : [];
}

/**
 * Ein Aufruf beim Anbieter -> `{ content, toolCalls, usage }` oder
 * `{ error, status?, usage: null }`. Mit Funktionen darf der Text fehlen.
 */
async function complete({ apiKey, base }, body, timeoutMs) {
  const signal = AbortSignal.timeout(timeoutMs);
  let response;
  try {
    response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      redirect: 'error',
      signal,
    });
  } catch (error) {
    return { error: failureOfThrown(error), usage: null };
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    return {
      error: upstreamError(response.status),
      status: response.status,
      retryAfterMs: response.status === 429 ? retryAfterOf(response) : null,
      usage: null,
    };
  }
  let data;
  try {
    data = await response.json();
  } catch (error) {
    return { error: signal.aborted ? failureOfThrown(error) : 'upstream_failed', usage: null };
  }
  const content = contentOf(data);
  const toolCalls = toolCallsOf(data);
  return content === null && toolCalls.length === 0
    ? { error: 'upstream_failed', usage: data?.usage ?? null }
    : { content: content ?? '', toolCalls, usage: data?.usage ?? null };
}

/**
 * Wie viel diese Anfrage hoechstens kosten darf. Synchron — nach
 * `await ledger.ready()` gerufen, damit Pruefen und Reservieren ein Zug sind.
 * -> `{ maxTokens, hold }` oder `{ error: 'budget_exhausted', refusal }`.
 */
function reserveFor(billing, { account, app, model, messages, desiredTokens }) {
  const standing = billing.standingOf(account, app);
  const exhausted = { error: 'budget_exhausted', refusal: billing.refusalOf('budget_exhausted', standing) };
  if (!(standing.remainingChf > 0)) return exhausted;
  const promptTokens = estimatePromptTokens(messages);
  const affordable = affordableTokens({ model, promptTokens, remainingChf: standing.remainingChf });
  if (affordable < Math.min(desiredTokens, minimumTokens(model))) return exhausted;
  const maxTokens = Math.min(desiredTokens, affordable);
  const chf = worstCaseChf({ model, promptTokens, maxTokens });
  return { maxTokens, hold: { id: billing.ledger.hold(account.id, app, chf), chf } };
}

/** `BETTER_AI_PROVIDER` -> ein bekannter Anbieter oder null (dann der erste eingerichtete). */
function providerFromEnv() {
  const wanted = process.env.BETTER_AI_PROVIDER?.trim().toLowerCase();
  return PROVIDERS.includes(wanted) ? wanted : null;
}

/** Bei Groq antwortet auf jeder Stufe dasselbe Modell (`BETTER_AI_GROQ_MODEL`). */
function groqModels() {
  const model = modelOrNull(process.env.BETTER_AI_GROQ_MODEL) ?? GROQ_MODEL;
  return Object.fromEntries(Object.keys(DEFAULT_MODELS).map((tier) => [tier, model]));
}

/**
 * `createAiService({ dataDir, baseUrl?, readKey?, readUrl?, readGroqKey?,
 * groqBaseUrl?, provider?, models?, timeouts?, findAccount?, readUpload?,
 * record?, billing? })` — alles ausser `dataDir` nur fuer Tests. `billing`
 * teilt der Dienst mit den Stimmen (ein Kassenbuch).
 */
function createAiService({
  dataDir,
  baseUrl,
  readKey,
  readUrl,
  readGroqKey,
  groqBaseUrl,
  provider,
  models,
  timeouts,
  findAccount = accountInStore,
  readUpload = readStoredUpload,
  record,
  billing = createBilling({ dataDir, findAccount }),
} = {}) {
  const testBase = typeof baseUrl === 'string' && TEST_BASE.test(baseUrl) ? baseUrl : null;
  const key =
    readKey ?? (() => fromEnvOrFile('SAFESWISSCLOUD_API_KEY', path.join(dataDir, 'safeswisscloud.key')));
  const url =
    readUrl ?? (() => fromEnvOrFile('SAFESWISSCLOUD_API_URL', path.join(dataDir, 'safeswisscloud.url')));
  const groqKey = readGroqKey ?? (() => fromEnvOrFile('GROQ_API_KEY', path.join(dataDir, 'groq.key')));
  const groqBase =
    typeof groqBaseUrl === 'string' && TEST_BASE.test(groqBaseUrl) ? groqBaseUrl : GROQ_BASE;
  const forced = PROVIDERS.includes(provider) ? provider : null;
  const limits = { ...TIMEOUTS, ...timeouts };
  const write = record ?? ((entry) => recordUsage(dataDir, entry));
  let lastError = null;

  async function swissSettings() {
    const apiKey = String((await key()) ?? '').trim();
    if (!KEY_PATTERN.test(apiKey)) return null;
    const base = testBase ?? normaliseBaseUrl(await url());
    return base
      ? { name: 'safeswisscloud', apiKey, base, free: false, vision: true, models: currentModels() }
      : null;
  }

  async function groqSettings() {
    const apiKey = String((await groqKey()) ?? '').trim();
    if (!KEY_PATTERN.test(apiKey)) return null;
    return { name: 'groq', apiKey, base: groqBase, free: true, vision: false, models: groqModels() };
  }

  /** Der vorgegebene Anbieter — sonst Safe Swiss Cloud, wenn eingerichtet, und dann Groq. */
  async function settings() {
    const wanted = forced ?? providerFromEnv();
    if (wanted === 'groq') return groqSettings();
    const swiss = await swissSettings();
    if (swiss || wanted === 'safeswisscloud') return swiss;
    return groqSettings();
  }

  function currentModels() {
    return Object.fromEntries(
      Object.keys(DEFAULT_MODELS).map((tier) => [
        tier,
        modelOrNull(models?.[tier]) ?? modelOrNull(process.env[MODEL_ENV[tier]]) ?? DEFAULT_MODELS[tier],
      ]),
    );
  }

  async function status() {
    const config = await settings();
    const wanted = forced ?? providerFromEnv();
    return reply(200, {
      provider: config?.name ?? wanted ?? PROVIDER,
      configured: config !== null,
      models: config?.models ?? (wanted === 'groq' ? groqModels() : currentModels()),
      lastError: config !== null ? lastError : null,
    });
  }

  /**
   * Eine Zeile Verbrauch, gleich ins Kassenbuch; scheitert das Schreiben, bleibt
   * die Antwort trotzdem — und gebucht wird die Zeile auch dann.
   */
  async function track(entry) {
    let line = null;
    try {
      line = await write(entry);
    } catch (error) {
      process.stderr.write(`[ai] Verbrauch: ${error?.name ?? 'Error'}\n`);
    }
    billing.ledger.addAi(line && typeof line === 'object' ? line : entry);
  }

  /** Konto und Bild pruefen -> `{ account, image }` (data-URL oder null) oder `{ error }`. */
  async function prepare(request) {
    const account = await findAccount(request.accountId);
    if (!account) return { error: 'account_not_found' };
    if (request.imageUploadId === null) return { account, image: null };
    const upload = await readUpload(request.imageUploadId);
    if (!upload) return { error: 'upload_not_found' };
    return { account, image: `data:${upload.type};base64,${upload.bytes.toString('base64')}` };
  }

  /**
   * Die Stufe fuer diese Anfrage. Ohne Abo immer die guenstige — und ein Bild
   * geht dann gar nicht: das braucht das Vision-Modell.
   */
  function routeFor(request, prepared) {
    const plan = billing.standingOf(prepared.account, request.app).plan;
    if (plan !== 'paid' && prepared.image !== null) return { error: 'plan_required' };
    const route = routeRequest({
      app: request.app,
      text: request.turns.at(-1).text,
      hasImage: prepared.image !== null,
      voice: request.voice,
      historyLength: request.turns.length - 1,
    });
    return { route: plan === 'paid' ? route : cheapRoute(route) };
  }

  /** -> `{ route, model, response, usage, hold }` oder `{ error, upstream?, refusal?, route?, model?, usage?, hold? }`. */
  async function answer(request) {
    const prepared = await prepare(request);
    if (prepared.error) return prepared;
    const config = await settings();
    if (!config) return { error: 'not_configured' };
    // Das Gratis-Modell sieht keine Bilder.
    if (prepared.image !== null && !config.vision) return { error: 'vision_unavailable' };
    await billing.ledger.ready();

    const routed = routeFor(request, prepared);
    if (routed.error) {
      const standing = billing.standingOf(prepared.account, request.app);
      return { error: routed.error, refusal: billing.refusalOf(routed.error, standing) };
    }
    const { route } = routed;
    const model = config.models[route.tier];
    const messages = messagesFor(request, route, prepared.image);
    const offered = request.tools
      ? toolsFor(request.app).filter(
          (tool) => request.toolNames === null || request.toolNames.includes(tool.function.name),
        )
      : [];
    const tools = offered.length > 0 ? offered : null;
    const desiredTokens = tokenBudget(
      model,
      route.maxChars,
      config.name === 'groq' && GROQ_LOW_EFFORT.test(model) ? GROQ_THINKING_BUDGET : THINKING_BUDGET,
    );
    // Gratis kostet nichts: kein Kontingent, nichts zu reservieren. Sonst zaehlen
    // die Funktionen mit, sie gehen ja mit hinaus.
    const budget = config.free
      ? { maxTokens: desiredTokens, hold: null }
      : reserveFor(billing, {
          account: prepared.account,
          app: request.app,
          model,
          messages: tools ? [...messages, { role: 'system', content: JSON.stringify(tools) }] : messages,
          desiredTokens,
        });
    if (budget.error) return { route, model, error: budget.error, refusal: budget.refusal };

    const reasoning = route.tier === 'reasoning_model';
    const body = {
      model,
      messages,
      max_tokens: budget.maxTokens,
      temperature: reasoning ? TEMPERATURE.reasoning : TEMPERATURE.standard,
      ...(config.name === 'groq' && GROQ_LOW_EFFORT.test(model) ? { reasoning_effort: 'low' } : {}),
    };
    const timeout = reasoning ? limits.reasoning : limits.standard;
    const full = tools ? { ...body, tools, tool_choice: 'auto' } : body;
    let result = await complete(config, full, timeout);
    // „Gleich nochmal“ (429 mit kurzem retry-after): einmal warten statt aufgeben.
    if (result.status === 429 && result.retryAfterMs !== null && result.retryAfterMs <= MAX_RETRY_WAIT_MS) {
      await wait(result.retryAfterMs);
      result = await complete(config, full, timeout);
    }
    // Verhaspelt sich das Modell beim Funktionsaufruf, lehnt der Anbieter mit
    // 400 ab — dann einmal ohne Funktionen, damit wenigstens eine Antwort kommt.
    if (tools && result.status === 400) result = await complete(config, body, timeout);
    const known = { route, model, free: config.free, usage: result.usage, hold: budget.hold };
    if (result.error) return { ...known, error: result.error, upstream: true };
    // Der Assistent zeigt schlichten Text: ohne Sternchen und Kennungen.
    const cleaned = stripReasoning(result.content);
    const refs = (request.context?.items ?? []).map((item) => item.ref).filter(Boolean);
    const response = limitChars(tools ? plainText(cleaned, refs) : cleaned, route.maxChars);
    const { actions } = tools
      ? actionsOf(result.toolCalls, request.app, tools.map((tool) => tool.function.name))
      : { actions: [] };
    if (response.length === 0 && actions.length === 0) {
      return { ...known, error: 'upstream_failed', upstream: true };
    }
    return { ...known, response, actions };
  }

  /**
   * Die Reservierung freigeben, sobald die echte Zeile gebucht ist. Lief die
   * Anfrage ins Zeitlimit, kann der Anbieter trotzdem gerechnet haben: dann
   * bleibt der schlimmste Fall im Kassenbuch (bis zum Neustart).
   */
  function settle(request, outcome) {
    if (!outcome.hold) return;
    if (outcome.error === 'timeout') billing.ledger.charge(request.accountId, request.app, outcome.hold.chf);
    billing.ledger.release(outcome.hold.id);
  }

  async function replyTo(input) {
    const startedAt = Date.now();
    const request = requestOf(input);
    const outcome = request ? await answer(request) : { error: 'bad_request' };
    if (outcome.upstream) lastError = outcome.error;
    else if (!outcome.error) lastError = null;

    try {
      await track({
        at: new Date(startedAt).toISOString(),
        accountId: request?.accountId ?? (typeof input?.accountId === 'string' ? input.accountId : null),
        app: request?.app ?? (APPS.includes(input?.app) ? input.app : null),
        tier: outcome.route?.tier ?? null,
        model: outcome.model ?? null,
        intent: outcome.route?.intent ?? null,
        voice: request ? request.voice : input?.voice === true,
        ok: !outcome.error,
        error: outcome.error ?? null,
        free: outcome.free === true,
        ...tokensOf(outcome.usage),
        durationMs: Date.now() - startedAt,
      });
    } finally {
      if (request) settle(request, outcome);
    }

    if (outcome.error) return failure(outcome.error, outcome.refusal);
    const { route, model, response, actions } = outcome;
    return reply(200, {
      selected_model: route.tier,
      model,
      intent: route.intent,
      response,
      ...(route.tts && response.length > 0
        ? { voice_text: spokenText(response, Math.min(route.maxChars, SPEECH_MAX_TEXT)) }
        : {}),
      ...(actions.length > 0 ? { actions } : {}),
      estimated_cost_level: route.costLevel,
    });
  }

  return { status, reply: replyTo, budget: (query) => billing.budget(query) };
}

module.exports = {
  DEFAULT_MODELS,
  GROQ_BASE,
  GROQ_MODEL,
  MIN_ANSWER_TOKENS,
  PROVIDER,
  PROVIDERS,
  createAiService,
  normaliseBaseUrl,
  upstreamError,
};
