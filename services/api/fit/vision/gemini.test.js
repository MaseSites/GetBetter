const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { geminiAnalyze } = require('./gemini.js');

const IMAGE = { mime: 'image/jpeg', bytes: Buffer.from([0xff, 0xd8, 0xff]) };
const OK = {
  candidates: [{ content: { parts: [{ text: '{"mealName":"x"}' }] } }],
  usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 100, thoughtsTokenCount: 50 },
};

/** Nachgebautes fetch: gibt der Reihe nach die Status zurueck und merkt sich die Modelle. */
function fakeFetch(statuses) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(decodeURIComponent(url.split('/models/')[1].split(':')[0]));
    const status = statuses[calls.length - 1] ?? 200;
    return new Response(status === 200 ? JSON.stringify(OK) : '{}', { status });
  };
  return { calls, fetchImpl };
}

const run = (statuses, extra = {}) => {
  const fake = fakeFetch(statuses);
  return geminiAnalyze({
    apiKey: 'k',
    model: 'gemini-3.8-flash',
    images: [IMAGE],
    retryDelays: [0, 0],
    fetchImpl: fake.fetchImpl,
    ...extra,
  }).then((result) => ({ result, calls: fake.calls }));
};

describe('Gemini: ueberlastet, Ersatzmodell, Kosten', () => {
  test('ueberlastet: dasselbe Modell nochmal, dann klappt es', async () => {
    const { result, calls } = await run([503, 503, 200], { fallbackModel: 'gemini-3.5-flash' });
    assert.equal(result.ok, true);
    assert.deepEqual(calls, ['gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-3.8-flash']);
    // Denken zaehlt als Ausgabe
    assert.equal(result.usage.outputTokens, 150);
  });

  test('bleibt es ueberlastet, springt das Ersatzmodell ein und wird so abgerechnet', async () => {
    const { result, calls } = await run([503, 503, 503, 200], {
      fallbackModel: 'gemini-3.5-flash',
    });
    assert.equal(result.ok, true);
    assert.deepEqual(calls, [
      'gemini-3.8-flash',
      'gemini-3.8-flash',
      'gemini-3.8-flash',
      'gemini-3.5-flash',
    ]);
    assert.equal(result.usage.model, 'gemini-3.5-flash');
  });

  test('ohne Ersatzmodell ehrlich gescheitert', async () => {
    const { result, calls } = await run([429, 429, 429]);
    assert.deepEqual(result, { ok: false, error: 'provider_busy' });
    assert.equal(calls.length, 3);
  });

  test('falscher Schluessel: kein zweiter Versuch', async () => {
    const { result, calls } = await run([403], { fallbackModel: 'gemini-3.5-flash' });
    assert.equal(result.error, 'provider_auth');
    assert.equal(calls.length, 1);
  });
});
