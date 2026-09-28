const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { fitProblems, mustRefuse, PROBLEM_TEXT } = require('./readiness.js');

const LIVE = { mode: 'live', geminiKey: 'k', aiDisabled: false };
const SWISS = { foods: 1200, swissVersion: '7.1', mode: 'live' };

describe('fitProblems', () => {
  test('live mit Schluessel und Schweizer Datenbank ist bereit', () => {
    assert.deepEqual(fitProblems(LIVE, SWISS), []);
  });

  test('Mock-Modus und fehlende Datenbank werden gemeldet', () => {
    assert.deepEqual(fitProblems({ ...LIVE, mode: 'mock' }, { swissVersion: null }), [
      'mock_mode',
      'swiss_catalog_missing',
    ]);
  });

  test('live ohne Schluessel', () => {
    assert.deepEqual(fitProblems({ ...LIVE, geminiKey: null }, SWISS), ['gemini_key_missing']);
  });

  test('jede Luecke hat einen Satz', () => {
    for (const problem of fitProblems({ mode: 'mock', geminiKey: null, aiDisabled: true }, null)) {
      assert.equal(typeof PROBLEM_TEXT[problem], 'string');
    }
  });
});

describe('mustRefuse', () => {
  test('nur in der Produktion', () => {
    assert.equal(mustRefuse(['mock_mode'], {}), false);
    assert.equal(mustRefuse(['mock_mode'], { NODE_ENV: 'production' }), true);
  });

  test('FIT_ALLOW_MOCK=1 laesst eine Vorfuehrung starten', () => {
    assert.equal(mustRefuse(['mock_mode'], { NODE_ENV: 'production', FIT_ALLOW_MOCK: '1' }), false);
  });

  test('der Kill-Switch allein haelt den Start nicht auf', () => {
    assert.equal(mustRefuse(['ai_disabled'], { NODE_ENV: 'production' }), false);
  });
});
