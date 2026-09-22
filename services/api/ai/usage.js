/**
 * Was die KI kostet: jede Anfrage an `/v1/ai/reply` wird eine Zeile in
 * `<datenordner>/ai-usage.jsonl` — auch die gescheiterten. Nie der Text einer
 * Nachricht, nie der Schluessel, nie die Adresse des Anbieters.
 *
 * Zeile: `{ at, accountId, app, tier, model, intent, voice, ok, error,
 * promptTokens, completionTokens, costChf, durationMs }`. Ein Aufruf beim
 * Gratis-Anbieter (`free: true` beim Schreiben) kostet 0. Waechst die Datei
 * ueber 5 MB, wird sie zu `ai-usage.1.jsonl` (die vorige faellt weg).
 */
const { MAX_FILE_BYTES, appendJsonLine, readJsonLines } = require('../jsonl.js');

/** CHF je Million Tokens, Eingabe und Ausgabe (Safe Swiss Cloud, Private AI). */
const PRICES = {
  'gemma4-31b': { input: 0.136, output: 0.374 },
  'gpt-oss-120b': { input: 0.133, output: 0.531 },
  'deepseek-v4-flash': { input: 0.168, output: 0.451 },
  'qwen3-8b': { input: 0.031, output: 0.122 },
  'llama4-maverick': { input: 0.31, output: 1.239 },
  'apertus-v1.5-70b': { input: 0.712, output: 2.553 },
  'qwen3-vl-235b': { input: 0.805, output: 2.3 },
  'deepseek-ocr': { input: 0.443, output: 1.77 },
  'mistral-7B-Instruct-v03': { input: 0.177, output: 0.177 },
};

const USAGE_FILE = 'ai-usage.jsonl';
const ROTATED_FILE = 'ai-usage.1.jsonl';
const NAMES = { file: USAGE_FILE, rotated: ROTATED_FILE };
const TOKENS_PER_PRICE = 1_000_000;
const MAX_ID_LENGTH = 100;

const roundChf = (value) => Math.round(value * 1e6) / 1e6;
const isTokenCount = (value) => Number.isInteger(value) && value >= 0;

/** Kosten in CHF, auf sechs Stellen; unbekanntes Modell oder fehlende Zahlen -> null. */
function costOf(model, promptTokens, completionTokens) {
  const price = Object.hasOwn(PRICES, model) ? PRICES[model] : null;
  if (!price || !isTokenCount(promptTokens) || !isTokenCount(completionTokens)) return null;
  return roundChf(
    (promptTokens * price.input + completionTokens * price.output) / TOKENS_PER_PRICE,
  );
}

/** `usage` einer OpenAI-kompatiblen Antwort -> Zahlen oder null. */
function tokensOf(usage) {
  const prompt = usage?.prompt_tokens;
  const completion = usage?.completion_tokens;
  return {
    promptTokens: isTokenCount(prompt) ? prompt : null,
    completionTokens: isTokenCount(completion) ? completion : null,
  };
}

const textOrNull = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH ? value : null;

/** Nur die bekannten Felder, in fester Reihenfolge — nichts Weiteres rutscht mit. */
function lineOf(entry) {
  const promptTokens = isTokenCount(entry.promptTokens) ? entry.promptTokens : null;
  const completionTokens = isTokenCount(entry.completionTokens) ? entry.completionTokens : null;
  return {
    at: typeof entry.at === 'string' ? entry.at : new Date().toISOString(),
    accountId: textOrNull(entry.accountId),
    app: textOrNull(entry.app),
    tier: textOrNull(entry.tier),
    model: textOrNull(entry.model),
    intent: textOrNull(entry.intent),
    voice: entry.voice === true,
    ok: entry.ok === true,
    error: entry.ok === true ? null : textOrNull(entry.error),
    promptTokens,
    completionTokens,
    costChf: entry.free === true ? 0 : costOf(entry.model, promptTokens, completionTokens),
    durationMs: Number.isFinite(entry.durationMs) ? Math.max(0, Math.round(entry.durationMs)) : null,
  };
}

/**
 * Haengt eine Zeile an. `maxBytes` nur fuer Tests; die Kosten rechnet die
 * Funktion selbst aus Modell und Tokens.
 */
async function recordUsage(dataDir, entry, { maxBytes = MAX_FILE_BYTES } = {}) {
  const line = lineOf(entry ?? {});
  await appendJsonLine(dataDir, NAMES, line, { maxBytes });
  return line;
}

/**
 * Alle Zeilen, aelteste zuerst (die gedrehte Datei vor der aktuellen).
 * `from` gilt einschliesslich, `to` ausschliesslich; kaputte Zeilen fallen weg.
 */
async function readUsage(dataDir, { from, to, accountId, app } = {}) {
  const entries = await readJsonLines(dataDir, NAMES, { from, to });
  return entries.filter(
    (entry) =>
      (accountId === undefined || entry.accountId === accountId) &&
      (app === undefined || entry.app === app),
  );
}

const emptyBucket = () => ({
  requests: 0,
  errors: 0,
  promptTokens: 0,
  completionTokens: 0,
  tokens: 0,
  costChf: 0,
});

function addTo(bucket, entry) {
  const prompt = isTokenCount(entry.promptTokens) ? entry.promptTokens : 0;
  const completion = isTokenCount(entry.completionTokens) ? entry.completionTokens : 0;
  const cost = Number.isFinite(entry.costChf) ? entry.costChf : 0;
  return {
    requests: bucket.requests + 1,
    errors: bucket.errors + (entry.ok === true ? 0 : 1),
    promptTokens: bucket.promptTokens + prompt,
    completionTokens: bucket.completionTokens + completion,
    tokens: bucket.tokens + prompt + completion,
    costChf: roundChf(bucket.costChf + cost),
  };
}

function groupBy(entries, keyOf) {
  const groups = {};
  for (const entry of entries) {
    const key = keyOf(entry) ?? 'unknown';
    groups[key] = addTo(groups[key] ?? emptyBucket(), entry);
  }
  return groups;
}

/**
 * Summen je App, Konto, Stufe und Tag (UTC, `YYYY-MM-DD`), dazu gesamt.
 * Jede Summe: `{ requests, errors, promptTokens, completionTokens, tokens, costChf }`.
 */
function summarizeUsage(entries) {
  const list = Array.isArray(entries) ? entries : [];
  return {
    total: list.reduce(addTo, emptyBucket()),
    byApp: groupBy(list, (entry) => entry.app),
    byAccount: groupBy(list, (entry) => entry.accountId),
    byTier: groupBy(list, (entry) => entry.tier),
    byDay: groupBy(list, (entry) =>
      typeof entry.at === 'string' ? entry.at.slice(0, 10) : null,
    ),
  };
}

module.exports = {
  MAX_FILE_BYTES,
  PRICES,
  ROTATED_FILE,
  USAGE_FILE,
  costOf,
  readUsage,
  recordUsage,
  summarizeUsage,
  tokensOf,
};
