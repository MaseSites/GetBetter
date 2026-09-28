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

describe('Gemini: Kette von Ersatzmodellen', () => {
  test('ist das erste Ersatzmodell auch voll, kommt das naechste', async () => {
    const { result, calls } = await run([503, 503, 503, 503, 200], {
      fallbackModel: ['gemini-3.6-flash', 'gemini-3.5-flash'],
    });
    assert.equal(result.ok, true);
    assert.deepEqual(calls.slice(3), ['gemini-3.6-flash', 'gemini-3.5-flash']);
    assert.equal(result.usage.model, 'gemini-3.5-flash');
  });

  test('ein Modell, das es nicht gibt (404), wird nicht wiederholt', async () => {
    const { result, calls } = await run([404, 200], { fallbackModel: ['gemini-3.6-flash'] });
    assert.equal(result.ok, true);
    assert.deepEqual(calls, ['gemini-3.8-flash', 'gemini-3.6-flash']);
  });

  test('leere Liste heisst: kein Ersatz', async () => {
    const { result, calls } = await run([503, 503, 503], { fallbackModel: [] });
    assert.equal(result.error, 'provider_error');
    assert.equal(calls.length, 3);
  });
});

describe('Gemini: Tageskontingent', () => {
  test('aufgebraucht heisst nicht ueberlastet: kein Warten, gleich das Ersatzmodell', async () => {
    const calls = [];
    const quota = JSON.stringify({
      error: { details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }] },
    });
    const fetchImpl = async (url) => {
      calls.push(decodeURIComponent(url.split('/models/')[1].split(':')[0]));
      return calls.length === 1
        ? new Response(quota, { status: 429 })
        : new Response(JSON.stringify(OK), { status: 200 });
    };
    const result = await geminiAnalyze({
      apiKey: 'k',
      model: 'gemini-3.8-flash',
      fallbackModel: ['gemini-3.6-flash'],
      images: [IMAGE],
      retryDelays: [0, 0],
      fetchImpl,
    });
    assert.equal(result.ok, true);
    assert.deepEqual(calls, ['gemini-3.8-flash', 'gemini-3.6-flash']);
  });

  test('ohne Ersatz sagt der Fehler, was los ist', async () => {
    const quota = '{"quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier"}';
    const result = await geminiAnalyze({
      apiKey: 'k',
      model: 'gemini-3.8-flash',
      images: [IMAGE],
      retryDelays: [0, 0],
      fetchImpl: async () => new Response(quota, { status: 429 }),
    });
    assert.deepEqual(result, { ok: false, error: 'provider_quota' });
  });
});
