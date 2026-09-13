import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { NoteBlock } from '../../db/types';
import { findHits, indexesOf, matchNote, segmentsOf, snippetAt } from './search';

test('Suche: Text an den Fundstellen zerlegen', () => {
  assert.deepEqual(
    segmentsOf('Brot und Brot', [
      { start: 9, length: 4, current: true },
      { start: 0, length: 4, current: false },
    ]),
    [
      { text: 'Brot', mark: 'hit' },
      { text: ' und ', mark: 'none' },
      { text: 'Brot', mark: 'current' },
    ],
  );
  assert.deepEqual(segmentsOf('abc', []), [{ text: 'abc', mark: 'none' }]);
  assert.deepEqual(segmentsOf('', []), []);
});

test('Suche: alle Stellen, ohne Gross und Klein', () => {
  assert.deepEqual(indexesOf('Offerte offerte OFFERTE', 'offerte'), [0, 8, 16]);
  assert.deepEqual(indexesOf('aaaa', 'aa'), [0, 2]);
  assert.deepEqual(indexesOf('abc', ''), []);
});

test('Suche: Vorschau um die Fundstelle, vorne an einer Wortgrenze gekuerzt', () => {
  const text = 'Erste Zeile\nWir brauchen für die Wohnung eine neue Offerte vom Maler\nLetzte';
  const start = text.indexOf('Offerte');
  assert.deepEqual(snippetAt(text, start, 7), {
    before: 'die Wohnung eine neue ',
    match: 'Offerte',
    after: ' vom Maler',
    cut: true,
  });
  assert.deepEqual(snippetAt('kurz Maler', 5, 5), {
    before: 'kurz ',
    match: 'Maler',
    after: '',
    cut: false,
  });
});

test('Suche: Titel, Text und Tags', () => {
  const note = { title: 'Offerte Maler', body: '3 Zimmer\nDecke inkl. #wohnung' };
  assert.equal(matchNote(note, 'maler')?.field, 'title');
  assert.deepEqual(matchNote(note, 'decke'), {
    field: 'body',
    snippet: { before: '', match: 'Decke', after: ' inkl. #wohnung', cut: false },
  });
  assert.equal(matchNote(note, '#wohn')?.field, 'tag');
  assert.equal(matchNote(note, '#garten'), null);
  assert.equal(matchNote(note, 'velo'), null);
  assert.equal(matchNote(note, '   '), null);
});

test('Suche im Editor: Stellen je Block, ohne Bilder', () => {
  const blocks: NoteBlock[] = [
    { id: 't', kind: 'title', text: 'Brot' },
    { id: 'i', kind: 'image', text: '', uploadId: 'u' },
    { id: 'a', kind: 'check', text: 'Brot und brot', checked: false },
  ];
  assert.deepEqual(findHits(blocks, 'brot'), [
    { blockId: 't', start: 0, length: 4 },
    { blockId: 'a', start: 0, length: 4 },
    { blockId: 'a', start: 9, length: 4 },
  ]);
});
