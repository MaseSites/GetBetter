/**
 * Gemini fuer Bildverstaendnis — nur im Dienst, der Schluessel verlaesst ihn nie.
 *
 * Verlangt JSON nach `RESPONSE_SCHEMA`, begrenzt Zeit und Wiederholungen und
 * rechnet die Kosten aus den gemeldeten Tokens. Bilder und Schluessel landen in
 * keinem Log; Fehler tragen nur einen Schluessel (`provider_error` …).
 *
 * Preise je Million Tokens in USD, ueberschreibbar, weil sie sich aendern:
 * FIT_GEMINI_PRICE_IN / _OUT (Flash) und FIT_GEMINI_LITE_PRICE_IN / _OUT.
 */
const { RESPONSE_SCHEMA, systemInstruction } = require('./schema.js');

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Was ohne eigenen Zusatz neben dem Bild steht. Die Systemanweisung sagt das
 * Meiste; hier steht noch einmal kurz, woran der Benchmark scheiterte — beim
 * Bild selbst gelesen wirkt es staerker als weit oben in der Anweisung.
 */
const DEFAULT_PROMPT =
  'Analysiere diese Mahlzeit. Schätze die Mengen am Geschirr (Essteller 26–28 cm) und nenne jedes Fett — Öl, Butter, Rahm, Dressing — als eigenen Eintrag. Lieber die wahrscheinlichste Menge als die kleinstmögliche.';
const TIMEOUT_MS = 30_000;
/** Wartezeit vor der zweiten und dritten Runde, wenn Google ueberlastet ist (429/5xx). */
const RETRY_DELAYS_MS = [1_000, 2_500];
/** Laenger wartet niemand auf ein Foto; danach gilt es als gescheitert. */
const DEADLINE_MS = 55_000;

function prices(model, env = process.env) {
  const lite = /lite/.test(model);
  const read = (name, fallback) => {
    const value = Number(env[name]);
    return Number.isFinite(value) && value >= 0 && env[name] !== '' && env[name] !== undefined
      ? value
      : fallback;
  };
  return lite
    ? {
        input: read('FIT_GEMINI_LITE_PRICE_IN', 0.3),
        output: read('FIT_GEMINI_LITE_PRICE_OUT', 2.5),
      }
    : { input: read('FIT_GEMINI_PRICE_IN', 1.5), output: read('FIT_GEMINI_PRICE_OUT', 7.5) };
}

function usdToChf(env = process.env) {
  const value = Number(env.BETTER_USD_CHF);
  return Number.isFinite(value) && value > 0 ? value : 0.92;
}

/** Kosten eines Aufrufs in CHF, bewusst auf sechs Stellen. */
function costOf(model, inputTokens, outputTokens, env) {
  const price = prices(model, env);
  const usd = (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
  return Math.round(usd * usdToChf(env) * 1_000_000) / 1_000_000;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `images`: [{ mime, bytes }]. `context`: kurzer Text (z. B. die erste Analyse
 * beim zweiten Bild). Gibt `{ ok, raw, usage }` oder `{ ok: false, error, usage? }`.
 */
async function geminiAnalyze({
  apiKey,
  model,
  fallbackModel = null,
  images,
  context = '',
  language = 'de',
  schema = RESPONSE_SCHEMA,
  instruction = systemInstruction(language),
  baseUrl = API_BASE,
  env = process.env,
  fetchImpl = fetch,
  retryDelays = RETRY_DELAYS_MS,
}) {
  if (!apiKey) return { ok: false, error: 'not_configured' };
  const body = {
    systemInstruction: { parts: [{ text: instruction }] },
    contents: [
      {
        role: 'user',
        parts: [
          ...images.map((image) => ({
            inline_data: { mime_type: image.mime, data: image.bytes.toString('base64') },
          })),
          { text: context || DEFAULT_PROMPT },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      temperature: 0.2,
      maxOutputTokens: 2048,
    },
  };
  // Denken nur begrenzt: die Antwort ist kurzes JSON, kein Aufsatz.
  const configFor = (name) => ({
    ...body,
    generationConfig: {
      ...body.generationConfig,
      ...(/lite/.test(name) ? {} : { thinkingConfig: { thinkingBudget: 512 } }),
    },
  });

  const started = Date.now();
  let lastError = 'provider_error';
  // Ist Google ueberlastet, erst dasselbe Modell mit Pause, dann einmal das Ersatzmodell.
  const tries = [
    ...[0, ...retryDelays].map((delay) => ({ name: model, delay })),
    ...(fallbackModel && fallbackModel !== model ? [{ name: fallbackModel, delay: 0 }] : []),
  ];
  for (const [attempt, { name, delay }] of tries.entries()) {
    if (attempt > 0 && delay > 0) await wait(delay);
    const left = DEADLINE_MS - (Date.now() - started);
    if (left < 3_000) break;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(TIMEOUT_MS, left));
    try {
      const response = await fetchImpl(
        `${baseUrl}/models/${encodeURIComponent(name)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(configFor(name)),
          signal: controller.signal,
        },
      );
      clearTimeout(timer);
      if (response.status === 429 || response.status >= 500) {
        lastError = response.status === 429 ? 'provider_busy' : 'provider_error';
        continue;
      }
      if (response.status === 401 || response.status === 403)
        return { ok: false, error: 'provider_auth' };
      if (!response.ok) return { ok: false, error: 'provider_error' };
      const data = await response.json();
      const inputTokens = Number(data?.usageMetadata?.promptTokenCount) || 0;
      const outputTokens =
        (Number(data?.usageMetadata?.candidatesTokenCount) || 0) +
        (Number(data?.usageMetadata?.thoughtsTokenCount) || 0);
      const usage = {
        model: name,
        inputTokens,
        outputTokens,
        costChf: costOf(name, inputTokens, outputTokens, env),
        durationMs: Date.now() - started,
      };
      const text = data?.candidates?.[0]?.content?.parts?.find(
        (part) => typeof part?.text === 'string',
      )?.text;
      if (typeof text !== 'string') return { ok: false, error: 'provider_empty', usage };
      try {
        return { ok: true, raw: JSON.parse(text), usage };
      } catch {
        return { ok: false, error: 'provider_invalid_json', usage };
      }
    } catch (error) {
      clearTimeout(timer);
      lastError = error?.name === 'AbortError' ? 'provider_timeout' : 'provider_unreachable';
    }
  }
  return { ok: false, error: lastError };
}

module.exports = { API_BASE, DEFAULT_PROMPT, costOf, geminiAnalyze, prices };
