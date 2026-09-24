'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createLimiter } = require('./ratelimit.js');

test('createLimiter: so viele Versuche im Fenster, dann Pause — je Schluessel', () => {
  const limiter = createLimiter({ limit: 3, windowMs: 1000 });
  const start = 1_000_000;
  assert.equal(limiter.hit('a', start).allowed, true);
  assert.equal(limiter.hit('a', start + 10).allowed, true);
  assert.equal(limiter.hit('a', start + 20).allowed, true);
  const blocked = limiter.hit('a', start + 30);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterMs, 970);
  // Ein anderer Schluessel zaehlt fuer sich.
  assert.equal(limiter.hit('b', start + 30).allowed, true);
  // Nach dem Fenster geht es wieder.
  assert.equal(limiter.hit('a', start + 1001).allowed, true);
});

test('reset: nach einem Erfolg zaehlt der Schluessel von vorne', () => {
  const limiter = createLimiter({ limit: 1, windowMs: 1000 });
  assert.equal(limiter.hit('a', 5).allowed, true);
  assert.equal(limiter.hit('a', 6).allowed, false);
  limiter.reset('a');
  assert.equal(limiter.hit('a', 7).allowed, true);
});
