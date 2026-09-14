/**
 * Was die Stimmen kosten: jeder abgespielte Satz von ElevenLabs wird eine Zeile
 * in `<datenordner>/speech-usage.jsonl`. Nie der Text, nie der Schluessel.
 *
 * Zeile: `{ at, accountId, app, purpose, model, voiceId, characters, credits,
 * cached, ok, error }`. `purpose` ist `speech` (ein Satz) oder `sample` (die
 * Probe beim Aussuchen einer Stimme). ElevenLabs rechnet je Zeichen: Flash und
 * Turbo einen halben Credit, alle anderen Modelle einen ganzen. Aus dem
 * Zwischenspeicher kostet ein Satz nichts (`cached: true`, `credits: 0`).
 * Lehnt ElevenLabs ab, kostet er auch nichts; bricht der Strom erst ab, als
 * ElevenLabs schon lieferte, zaehlen die Credits trotzdem (`ok: false`).
 * Ueber 5 MB wird die Datei zu `speech-usage.1.jsonl` (die vorige faellt weg).
 */
const { MAX_FILE_BYTES, appendJsonLine, readJsonLines } = require('../jsonl.js');

const SPEECH_USAGE_FILE = 'speech-usage.jsonl';
const SPEECH_ROTATED_FILE = 'speech-usage.1.jsonl';
const NAMES = { file: SPEECH_USAGE_FILE, rotated: SPEECH_ROTATED_FILE };
const PURPOSES = new Set(['speech', 'sample']);
const HALF_CREDIT_MODELS = /^eleven_(flash|turbo)_/;
const VOICE_ID = /^[A-Za-z0-9]{8,64}$/;
const MAX_ID_LENGTH = 100;

/** Credits je Zeichen: Flash und Turbo 0.5, Multilingual, v3 und alles Unbekannte 1. */
function creditsPerCharacter(model) {
  return typeof model === 'string' && HALF_CREDIT_MODELS.test(model) ? 0.5 : 1;
}

const textOrNull = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH ? value : null;
const countOf = (value) => (Number.isInteger(value) && value >= 0 ? value : 0);

/**
 * Nur die bekannten Felder. `credits` rechnet die Zeile selbst: 0 aus dem
 * Zwischenspeicher, sonst Zeichen × Satz des Modells, sobald ElevenLabs
 * geliefert hat (`billed`, sonst gilt `ok`).
 */
function lineOf(entry) {
  const characters = countOf(entry.characters);
  const cached = entry.cached === true;
  const ok = entry.ok === true;
  const billed = !cached && (entry.billed ?? ok) === true;
  return {
    at: typeof entry.at === 'string' ? entry.at : new Date().toISOString(),
    accountId: textOrNull(entry.accountId),
    app: textOrNull(entry.app),
    purpose: PURPOSES.has(entry.purpose) ? entry.purpose : 'speech',
    model: textOrNull(entry.model),
    voiceId: typeof entry.voiceId === 'string' && VOICE_ID.test(entry.voiceId) ? entry.voiceId : null,
    characters,
    credits: billed ? characters * creditsPerCharacter(entry.model) : 0,
    cached,
    ok,
    error: ok ? null : textOrNull(entry.error),
  };
}

/** Haengt eine Zeile an und gibt sie zurueck. `maxBytes` nur fuer Tests. */
async function recordSpeechUsage(dataDir, entry, { maxBytes = MAX_FILE_BYTES } = {}) {
  const line = lineOf(entry ?? {});
  await appendJsonLine(dataDir, NAMES, line, { maxBytes });
  return line;
}

/** Alle Zeilen, aelteste zuerst; `from` einschliesslich, `to` ausschliesslich. */
async function readSpeechUsage(dataDir, { from, to, accountId, app } = {}) {
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
  cached: 0,
  characters: 0,
  credits: 0,
  savedCredits: 0,
  samples: 0,
  sampleCredits: 0,
});

/**
 * `characters` zaehlt nur, was ElevenLabs erzeugt hat; `savedCredits` ist, was
 * die Saetze aus dem Zwischenspeicher sonst gekostet haetten.
 */
function addTo(bucket, entry) {
  const characters = countOf(entry.characters);
  const credits = Number.isFinite(entry.credits) && entry.credits > 0 ? entry.credits : 0;
  const cached = entry.cached === true;
  const sample = entry.purpose === 'sample';
  return {
    requests: bucket.requests + 1,
    errors: bucket.errors + (entry.ok === true ? 0 : 1),
    cached: bucket.cached + (cached ? 1 : 0),
    characters: bucket.characters + (credits > 0 ? characters : 0),
    credits: bucket.credits + credits,
    savedCredits: bucket.savedCredits + (cached ? characters * creditsPerCharacter(entry.model) : 0),
    samples: bucket.samples + (sample ? 1 : 0),
    sampleCredits: bucket.sampleCredits + (sample ? credits : 0),
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
 * Summen gesamt, je App, Konto und Tag (UTC). Jede Summe: `{ requests, errors,
 * cached, characters, credits, savedCredits, samples, sampleCredits }`.
 */
function summarizeSpeech(entries) {
  const list = Array.isArray(entries) ? entries : [];
  return {
    total: list.reduce(addTo, emptyBucket()),
    byApp: groupBy(list, (entry) => entry.app),
    byAccount: groupBy(list, (entry) => entry.accountId),
    byDay: groupBy(list, (entry) => (typeof entry.at === 'string' ? entry.at.slice(0, 10) : null)),
  };
}

module.exports = {
  SPEECH_ROTATED_FILE,
  SPEECH_USAGE_FILE,
  creditsPerCharacter,
  readSpeechUsage,
  recordSpeechUsage,
  summarizeSpeech,
};
