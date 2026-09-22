import assert from 'node:assert/strict';
import { test } from 'node:test';

import { byHomeAt, homePreviewOf, isOnHome } from './home';

test('isOnHome: nur angeheftet und nicht im Papierkorb', () => {
  assert.equal(isOnHome({ homeAt: '2026-09-22T10:00:00.000Z', deletedAt: null }), true);
  assert.equal(isOnHome({ homeAt: null, deletedAt: null }), false);
  assert.equal(isOnHome({}), false);
  assert.equal(
    isOnHome({ homeAt: '2026-09-22T10:00:00.000Z', deletedAt: '2026-09-22T11:00:00.000Z' }),
    false,
  );
});

test('byHomeAt: das zuletzt Angeheftete zuerst', () => {
  const rows = [
    { id: 'a', homeAt: '2026-09-20T08:00:00.000Z' },
    { id: 'b', homeAt: '2026-09-22T08:00:00.000Z' },
    { id: 'c', homeAt: '2026-09-21T08:00:00.000Z' },
  ];
  assert.deepEqual(
    [...rows].sort(byHomeAt).map((row) => row.id),
    ['b', 'c', 'a'],
  );
});

test('homePreviewOf: ohne Leerzeilen und Leerraum', () => {
  assert.equal(homePreviewOf('\n  Milch \n\n Brot\n'), 'Milch\nBrot');
  assert.equal(homePreviewOf('   \n '), '');
});
