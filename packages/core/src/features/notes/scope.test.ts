import assert from 'node:assert/strict';
import { test } from 'node:test';

import { notesInScope, sameScope } from './scope';

const notes = [
  { id: 'a', title: 'Rezept', body: '#essen', folderId: 'f1' },
  { id: 'b', title: 'Ferien', body: '', folderId: null },
  { id: 'c', title: 'Znacht #Essen', body: '' },
];

test('Auswahl: alle, Ordner, Tag, Papierkorb', () => {
  assert.equal(notesInScope(notes, { kind: 'all' }).length, 3);
  assert.deepEqual(
    notesInScope(notes, { kind: 'folder', id: 'f1' }).map((note) => note.id),
    ['a'],
  );
  assert.deepEqual(
    notesInScope(notes, { kind: 'tag', tag: 'essen' }).map((note) => note.id),
    ['a', 'c'],
  );
  assert.deepEqual(notesInScope(notes, { kind: 'trash' }), []);
});

test('Auswahl vergleichen', () => {
  assert.equal(sameScope({ kind: 'folder', id: 'x' }, { kind: 'folder', id: 'x' }), true);
  assert.equal(sameScope({ kind: 'folder', id: 'x' }, { kind: 'folder', id: 'y' }), false);
  assert.equal(sameScope({ kind: 'tag', tag: 'a' }, { kind: 'all' }), false);
  assert.equal(sameScope({ kind: 'trash' }, { kind: 'trash' }), true);
});
