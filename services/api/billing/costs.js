/**
 * Was ein Eintrag im Protokoll kostet, in CHF — und wie teuer eine KI-Anfrage
 * hoechstens werden kann, bevor sie losgeht. Rein, getestet.
 *
 * - KI: `costChf` aus `ai-usage.jsonl`. Fehlt er, aber die Tokens sind da
 *   (ein Modell ohne Preis), gilt der teuerste bekannte Preis.
 * - Stimme: `credits × USD je Credit × USD→CHF`. Die Vorgaben sind bewusst zu
 *   hoch geschaetzt (`BETTER_SPEECH_USD_PER_1K_CHARS=0.10`, `BETTER_USD_CHF=0.92`):
 *   lieber zu frueh aufhoeren als draufzahlen. Aus dem Zwischenspeicher 0.
 */
const { PRICES } = require('../ai/usage.js');
const { zurichMonthOf } = require('./month.js');

const SPEECH_DEFAULTS = Object.freeze({ usdPer1kChars: 0.1, usdChf: 0.92, monthlyFixedUsd: 0 });
const TOKENS_PER_PRICE = 1_000_000;
const CHARS_PER_CREDIT_PRICE = 1000;
/** Grob und zur sicheren Seite: ein Token je zwei Zeichen, dazu etwas je Nachricht. */
const CHARS_PER_PROMPT_TOKEN = 2;
const TOKENS_PER_MESSAGE = 8;
/** Ein Bild kostet beim Vision-Modell hoechstens so viele Eingabe-Tokens. */
const IMAGE_TOKENS = 2000;

function numberFrom(raw, fallback, accept) {
  if (typeof raw !== 'string' || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && accept(value) ? value : fallback;
}

/** `BETTER_SPEECH_USD_PER_1K_CHARS`, `BETTER_USD_CHF`, `BETTER_SPEECH_MONTHLY_FIXED_USD`. */
function speechSettings(env = process.env) {
  return {
    usdPer1kChars: numberFrom(env.BETTER_SPEECH_USD_PER_1K_CHARS, SPEECH_DEFAULTS.usdPer1kChars, (v) => v >= 0),
    usdChf: numberFrom(env.BETTER_USD_CHF, SPEECH_DEFAULTS.usdChf, (v) => v > 0),
    monthlyFixedUsd: numberFrom(env.BETTER_SPEECH_MONTHLY_FIXED_USD, SPEECH_DEFAULTS.monthlyFixedUsd, (v) => v >= 0),
  };
}

const roundChf = (value) => Math.round(value * 1e6) / 1e6;

/** Credits von ElevenLabs in CHF. */
function speechChfOf(credits, settings) {
  if (!Number.isFinite(credits) || credits <= 0) return 0;
  return (credits * settings.usdPer1kChars * settings.usdChf) / CHARS_PER_CREDIT_PRICE;
}

const MAX_PRICE = Object.freeze({
  input: Math.max(...Object.values(PRICES).map((price) => price.input)),
  output: Math.max(...Object.values(PRICES).map((price) => price.output)),
});

/** Der Preis eines Modells — ein unbekanntes kostet wie das teuerste bekannte. */
function worstPriceOf(model) {
  return typeof model === 'string' && Object.hasOwn(PRICES, model) ? PRICES[model] : MAX_PRICE;
}

const tokenCount = (value) => (Number.isInteger(value) && value >= 0 ? value : 0);

/** Eine Zeile aus `ai-usage.jsonl` in CHF. */
function aiChfOf(entry) {
  if (Number.isFinite(entry?.costChf)) return Math.max(0, entry.costChf);
  const prompt = tokenCount(entry?.promptTokens);
  const completion = tokenCount(entry?.completionTokens);
  if (prompt + completion === 0) return 0;
  const price = worstPriceOf(entry.model);
  return (prompt * price.input + completion * price.output) / TOKENS_PER_PRICE;
}

/** Eine Zeile aus `speech-usage.jsonl` in CHF. */
const speechEntryChfOf = (entry, settings) => (entry?.cached === true ? 0 : speechChfOf(entry?.credits, settings));

function textLengthOf(content) {
  if (typeof content === 'string') return { chars: content.length, images: 0 };
  if (!Array.isArray(content)) return { chars: 0, images: 0 };
  return content.reduce(
    (total, part) => ({
      chars: total.chars + (typeof part?.text === 'string' ? part.text.length : 0),
      images: total.images + (part?.type === 'image_url' ? 1 : 0),
    }),
    { chars: 0, images: 0 },
  );
}

/** Wie viele Eingabe-Tokens diese Nachrichten hoechstens sind (zu hoch geschaetzt). */
function estimatePromptTokens(messages) {
  const list = Array.isArray(messages) ? messages : [];
  return list.reduce((total, message) => {
    const { chars, images } = textLengthOf(message?.content);
    return total + TOKENS_PER_MESSAGE + Math.ceil(chars / CHARS_PER_PROMPT_TOKEN) + images * IMAGE_TOKENS;
  }, 0);
}

/** Was ein Aufruf hoechstens kostet: alle Eingabe-Tokens und `maxTokens` Ausgabe. */
function worstCaseChf({ model, promptTokens, maxTokens }) {
  const price = worstPriceOf(model);
  return (tokenCount(promptTokens) * price.input + tokenCount(maxTokens) * price.output) / TOKENS_PER_PRICE;
}

/** Wie viele Ausgabe-Tokens bei diesem Rest noch hineinpassen (0, wenn nicht einmal die Eingabe). */
function affordableTokens({ model, promptTokens, remainingChf }) {
  const price = worstPriceOf(model);
  const input = (tokenCount(promptTokens) * price.input) / TOKENS_PER_PRICE;
  const left = remainingChf - input;
  if (!(left > 0) || !(price.output > 0)) return 0;
  return Math.floor((left * TOKENS_PER_PRICE) / price.output);
}

const keyOf = (app, accountId) => `${app}|${accountId}`;

/**
 * Summen je App und Konto fuer einen Monat in Zuerich:
 * `Map<"app|konto", { aiChf, speechChf }>`, dazu, was keinem Konto gehoert.
 */
function monthSums(aiEntries, speechEntries, month, settings) {
  const sums = new Map();
  let unassignedChf = 0;
  const add = (entry, field, chf) => {
    if (chf <= 0 || zurichMonthOf(entry.at) !== month) return;
    if (typeof entry.accountId !== 'string' || typeof entry.app !== 'string') {
      unassignedChf += chf;
      return;
    }
    const key = keyOf(entry.app, entry.accountId);
    const known = sums.get(key) ?? { aiChf: 0, speechChf: 0 };
    sums.set(key, { ...known, [field]: known[field] + chf });
  };
  for (const entry of aiEntries ?? []) add(entry, 'aiChf', aiChfOf(entry));
  for (const entry of speechEntries ?? []) add(entry, 'speechChf', speechEntryChfOf(entry, settings));
  return { sums, unassignedChf };
}

module.exports = {
  IMAGE_TOKENS,
  SPEECH_DEFAULTS,
  affordableTokens,
  aiChfOf,
  estimatePromptTokens,
  keyOf,
  monthSums,
  roundChf,
  speechChfOf,
  speechEntryChfOf,
  speechSettings,
  worstCaseChf,
  worstPriceOf,
};
