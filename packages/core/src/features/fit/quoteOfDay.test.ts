import assert from 'node:assert/strict';
import { test } from 'node:test';

import { de } from '../../i18n/de';
import { QUOTE_COUNT, quoteNumberOf } from './quoteOfDay';

const dayAfter = (day: string, offset: number) =>
  new Date(Date.parse(`${day}T12:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);

test('derselbe Tag gibt denselben Spruch, der nächste einen anderen', () => {
  assert.equal(quoteNumberOf('2026-09-22'), quoteNumberOf('2026-09-22'));
  assert.notEqual(quoteNumberOf('2026-09-22'), quoteNumberOf('2026-09-23'));
});

test('in 40 Tagen kommt jeder Spruch genau einmal', () => {
  const seen = new Set<number>();
  for (let offset = 0; offset < QUOTE_COUNT; offset++)
    seen.add(quoteNumberOf(dayAfter('2026-09-22', offset)));
  assert.equal(seen.size, QUOTE_COUNT);
  assert.ok([...seen].every((n) => n >= 1 && n <= QUOTE_COUNT));
});

test('für jede Nummer gibt es einen Text', () => {
  for (let n = 1; n <= QUOTE_COUNT; n++) assert.ok(`fit.quote.${n}` in de, `fit.quote.${n}`);
  assert.ok(!(`fit.quote.${QUOTE_COUNT + 1}` in de));
});

test('ein kaputter Tag wirft nicht', () => {
  const n = quoteNumberOf('kein-tag');
  assert.ok(n >= 1 && n <= QUOTE_COUNT);
});
