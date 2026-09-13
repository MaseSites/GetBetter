import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { NoteBlock } from '../../db/types';
import { noteToText } from './share';

test('Teilen: Notiz als Text, nah an Markdown', () => {
  const blocks: NoteBlock[] = [
    { id: '1', kind: 'title', text: 'Umzug' },
    { id: '2', kind: 'heading', text: 'Kaufen' },
    { id: '3', kind: 'check', text: 'Kartons', checked: true },
    { id: '4', kind: 'check', text: 'Klebeband', checked: false, indent: 1 },
    { id: '5', kind: 'image', text: '', uploadId: 'u' },
    { id: '6', kind: 'bullet', text: 'Velo' },
    { id: '7', kind: 'number', text: 'Zuerst' },
    { id: '8', kind: 'number', text: 'Dann' },
    { id: '9', kind: 'quote', text: 'Nie wieder' },
    { id: '10', kind: 'text', text: '' },
  ];
  assert.equal(
    noteToText(blocks),
    [
      'Umzug',
      '# Kaufen',
      '[x] Kartons',
      '  [ ] Klebeband',
      '- Velo',
      '1. Zuerst',
      '2. Dann',
      '> Nie wieder',
    ].join('\n'),
  );
});

test('Teilen: leere Notiz ist leerer Text', () => {
  assert.equal(noteToText([{ id: '1', kind: 'title', text: ' ' }]), '');
});
