import assert from 'node:assert/strict';
import { test } from 'node:test';

import { blocksOf, noteTextOf } from './noteBlocks';
import type { NoteBlock } from './types';

test('Notiz: Titel und Text aus den Bloecken', () => {
  const blocks: NoteBlock[] = [
    { id: 'a', kind: 'title', text: ' Einkauf ' },
    { id: 'b', kind: 'check', text: 'Milch', checked: true },
    { id: 'c', kind: 'image', text: '', uploadId: 'up_1' },
    { id: 'd', kind: 'bullet', text: '  ' },
    { id: 'e', kind: 'text', text: 'Brot' },
  ];
  assert.deepEqual(noteTextOf(blocks), { title: 'Einkauf', body: 'Milch\nBrot' });
});

test('Notiz: ohne Titelblock ist die erste Zeile der Titel', () => {
  const blocks: NoteBlock[] = [
    { id: 'a', kind: 'text', text: '' },
    { id: 'b', kind: 'heading', text: 'Ferien' },
    { id: 'c', kind: 'text', text: 'Zug buchen' },
  ];
  assert.deepEqual(noteTextOf(blocks), { title: 'Ferien', body: 'Zug buchen' });
  assert.deepEqual(noteTextOf([]), { title: '', body: '' });
});

test('Notiz: alte Zeilen werden zu Bloecken', () => {
  const blocks = blocksOf({ id: 'nt_1', title: 'Ideen', body: 'eins\nzwei' });
  assert.deepEqual(blocks, [
    { id: 'nt_1-title', kind: 'title', text: 'Ideen' },
    { id: 'nt_1-0', kind: 'text', text: 'eins' },
    { id: 'nt_1-1', kind: 'text', text: 'zwei' },
  ]);
  assert.deepEqual(noteTextOf(blocks), { title: 'Ideen', body: 'eins\nzwei' });
});

test('Notiz: eine leere alte Notiz hat einen leeren Textblock', () => {
  assert.deepEqual(blocksOf({ id: 'n', title: '', body: '' }), [
    { id: 'n-0', kind: 'text', text: '' },
  ]);
  assert.deepEqual(blocksOf({ id: 'n', title: 'Nur Titel', body: '' }), [
    { id: 'n-title', kind: 'title', text: 'Nur Titel' },
  ]);
});

test('Notiz: vorhandene Bloecke bleiben, wie sie sind', () => {
  const own: NoteBlock[] = [{ id: 'x', kind: 'quote', text: 'Zitat' }];
  assert.equal(blocksOf({ id: 'n', title: 'alt', body: 'alt', blocks: own }), own);
});
