import assert from 'node:assert/strict';
import { test } from 'node:test';

import { frequentItems } from './frequent';

const now = new Date('2026-09-25T12:00:00Z');

function row(name: string, daysAgo: number, extra: { done?: boolean; cleared?: boolean } = {}) {
  return {
    name,
    done: extra.done ?? true,
    createdAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
    clearedAt: extra.cleared ? now.toISOString() : null,
  };
}

test('das Häufigste zuerst, auch aus Weggeräumtem, im jüngsten Wortlaut', () => {
  const history = [
    row('Milch', 1, { cleared: true }),
    row('Milch', 8, { cleared: true }),
    row('milch', 15, { cleared: true }),
    row('Brot', 2, { cleared: true }),
    row('Brot', 9),
    row('Kaffee', 3),
  ];
  assert.deepEqual(frequentItems(history, now), ['Milch', 'Brot', 'Kaffee']);
});

test('was offen ist, fehlt', () => {
  const history = [row('Milch', 1), row('Milch', 5), row('Milch', 0, { done: false })];
  assert.deepEqual(frequentItems(history, now), []);
});

test('Jüngeres zählt mehr als Altes', () => {
  const history = [row('Glacé', 300), row('Glacé', 310), row('Äpfel', 2)];
  assert.deepEqual(frequentItems(history, now), ['Äpfel', 'Glacé']);
});

test('höchstens zwölf', () => {
  const history = Array.from({ length: 20 }, (_, i) =>
    row(`Posten ${String.fromCharCode(65 + i)}`, i),
  );
  assert.equal(frequentItems(history, now).length, 12);
  assert.equal(frequentItems(history, now)[0], 'Posten A');
});
