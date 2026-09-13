import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { NoteBlock } from '../../db/types';
import {
  appendTag,
  applyText,
  backspaceAtStart,
  detectShortcut,
  indentBlock,
  insertImage,
  isBlank,
  listNumber,
  MAX_INDENT,
  setKind,
  toggleChecked,
  toggleKind,
  wordCount,
} from './blocks';

function ids() {
  let next = 0;
  return () => {
    next += 1;
    return `n${next}`;
  };
}

const title: NoteBlock = { id: 't', kind: 'title', text: 'Einkauf' };

test('Enter mitten im Text teilt den Block, der Cursor steht am Anfang der neuen Zeile', () => {
  const blocks: NoteBlock[] = [title, { id: 'a', kind: 'text', text: 'hello' }];
  const result = applyText(blocks, 'a', 'hel\nlo', ids());
  assert.deepEqual(result.blocks, [
    title,
    { id: 'a', kind: 'text', text: 'hel' },
    { id: 'n1', kind: 'text', text: 'lo' },
  ]);
  assert.deepEqual(result.focus, { id: 'n1', cursor: 0 });
});

test('Enter im Titel gibt eine Textzeile', () => {
  const result = applyText([title], 't', 'Einkauf\n', ids());
  assert.deepEqual(result.blocks, [title, { id: 'n1', kind: 'text', text: '' }]);
});

test('Enter in einer Liste fuehrt sie fort, mit Einzug und ohne Haken', () => {
  const check: NoteBlock = { id: 'c', kind: 'check', text: 'Milch', checked: true, indent: 1 };
  const result = applyText([title, check], 'c', 'Milch\n', ids());
  assert.deepEqual(result.blocks[2], {
    id: 'n1',
    kind: 'check',
    text: '',
    checked: false,
    indent: 1,
  });
});

test('Enter in einem leeren Listenpunkt beendet die Liste ganz', () => {
  const bullet: NoteBlock = { id: 'b', kind: 'bullet', text: '', indent: 2 };
  const result = applyText([title, bullet], 'b', '\n', ids());
  assert.deepEqual(result.blocks, [title, { id: 'b', kind: 'text', text: '' }]);
  assert.deepEqual(result.focus, { id: 'b', cursor: 0 });
});

test('Eingefuegte Zeilen werden zu Bloecken, der Cursor steht hinter dem Eingefuegten', () => {
  const blocks: NoteBlock[] = [title, { id: 'a', kind: 'text', text: 'xy' }];
  const result = applyText(blocks, 'a', 'x1\n2\n3y', ids());
  assert.deepEqual(
    result.blocks.map((block) => block.text),
    ['Einkauf', 'x1', '2', '3y'],
  );
  assert.deepEqual(result.focus, { id: 'n2', cursor: 1 });
});

test('Kuerzel am Anfang setzen die Art', () => {
  assert.deepEqual(detectShortcut('', '- '), { kind: 'bullet', rest: '' });
  assert.deepEqual(detectShortcut('', '1. '), { kind: 'number', rest: '' });
  assert.deepEqual(detectShortcut('', '[] '), { kind: 'check', rest: '', checked: false });
  assert.deepEqual(detectShortcut('', '[x] '), { kind: 'check', rest: '', checked: true });
  assert.deepEqual(detectShortcut('', '# '), { kind: 'heading', rest: '' });
  assert.deepEqual(detectShortcut('', '> '), { kind: 'quote', rest: '' });
  assert.deepEqual(detectShortcut('Brot', '- Brot'), { kind: 'bullet', rest: 'Brot' });
  assert.equal(detectShortcut('- a', '- ab'), null);
  assert.equal(detectShortcut('', '#rezept'), null);
});

test('Ein getipptes Kuerzel wandelt den Block um', () => {
  const blocks: NoteBlock[] = [title, { id: 'a', kind: 'text', text: '' }];
  const result = applyText(blocks, 'a', '[] ', ids());
  assert.deepEqual(result.blocks[1], { id: 'a', kind: 'check', text: '', checked: false });
  assert.deepEqual(result.focus, { id: 'a', cursor: 0 });
});

test('Backspace am Anfang: erst ausruecken, dann Text, dann verbinden', () => {
  const start: NoteBlock[] = [
    title,
    { id: 'a', kind: 'text', text: 'eins' },
    { id: 'b', kind: 'bullet', text: 'zwei', indent: 1 },
  ];
  const outdented = backspaceAtStart(start, 'b');
  assert.deepEqual(outdented.blocks[2], { id: 'b', kind: 'bullet', text: 'zwei' });
  const plain = backspaceAtStart(outdented.blocks, 'b');
  assert.deepEqual(plain.blocks[2], { id: 'b', kind: 'text', text: 'zwei' });
  const merged = backspaceAtStart(plain.blocks, 'b');
  assert.deepEqual(merged.blocks, [title, { id: 'a', kind: 'text', text: 'einszwei' }]);
  assert.deepEqual(merged.focus, { id: 'a', cursor: 4 });
});

test('Backspace im Titel ganz oben tut nichts', () => {
  const result = backspaceAtStart([title], 't');
  assert.deepEqual(result.blocks, [title]);
  assert.equal(result.focus, null);
});

test('Backspace nach einem Bild loescht nur eine leere Zeile, nie das Bild', () => {
  const image: NoteBlock = { id: 'i', kind: 'image', text: '', uploadId: 'up' };
  const withText: NoteBlock[] = [title, image, { id: 'a', kind: 'text', text: 'x' }];
  assert.equal(backspaceAtStart(withText, 'a').blocks, withText);
  const empty: NoteBlock[] = [title, image, { id: 'a', kind: 'text', text: '' }];
  const result = backspaceAtStart(empty, 'a');
  assert.deepEqual(result.blocks, [title, image]);
  assert.deepEqual(result.focus, { id: 't', cursor: 7 });
});

test('Art umschalten, einruecken, abhaken', () => {
  const blocks: NoteBlock[] = [title, { id: 'a', kind: 'text', text: 'Brot', indent: 1 }];
  const checked = toggleKind(blocks, 'a', 'check');
  assert.deepEqual(checked[1], { id: 'a', kind: 'check', text: 'Brot', checked: false, indent: 1 });
  assert.deepEqual(toggleKind(checked, 'a', 'check')[1], {
    id: 'a',
    kind: 'text',
    text: 'Brot',
    indent: 1,
  });
  assert.deepEqual(toggleChecked(checked, 'a')[1], { ...checked[1], checked: true });
  assert.deepEqual(setKind(blocks, 'a', 'heading')[1], { id: 'a', kind: 'heading', text: 'Brot' });
  assert.equal(indentBlock(blocks, 't', 1), blocks);
  let deep: readonly NoteBlock[] = blocks;
  for (let step = 0; step < 10; step += 1) deep = indentBlock(deep, 'a', 1);
  assert.equal(deep[1]?.indent, MAX_INDENT);
  assert.equal(indentBlock(indentBlock(blocks, 'a', -1), 'a', -1)[1]?.indent, undefined);
});

test('Nummern zaehlen je Liste und Stufe', () => {
  const blocks: NoteBlock[] = [
    { id: '1', kind: 'number', text: 'a' },
    { id: '2', kind: 'number', text: 'a1', indent: 1 },
    { id: '3', kind: 'number', text: 'b' },
    { id: '4', kind: 'text', text: '' },
    { id: '5', kind: 'number', text: 'neu' },
  ];
  assert.deepEqual(
    blocks.map((_, index) => listNumber(blocks, index)),
    [1, 1, 2, 0, 1],
  );
});

test('Ein Bild am Ende bekommt eine Zeile darunter', () => {
  const result = insertImage([title], 't', 'up_1', ids());
  assert.deepEqual(result, [
    title,
    { id: 'n1', kind: 'image', text: '', uploadId: 'up_1' },
    { id: 'n2', kind: 'text', text: '' },
  ]);
  const middle = insertImage(result, 't', 'up_2', ids());
  assert.equal(middle.length, 4);
  assert.equal(middle[1]?.uploadId, 'up_2');
});

test('Leer, Woerter und Tags anhaengen', () => {
  assert.equal(isBlank([{ id: 'a', kind: 'title', text: '  ' }]), true);
  assert.equal(isBlank([{ id: 'a', kind: 'image', text: '', uploadId: 'u' }]), false);
  assert.equal(wordCount([title, { id: 'a', kind: 'text', text: ' zwei  Worte ' }]), 3);
  assert.deepEqual(
    appendTag([title, { id: 'a', kind: 'text', text: 'Brot ' }], 'essen', ids())[1],
    {
      id: 'a',
      kind: 'text',
      text: 'Brot #essen',
    },
  );
  assert.deepEqual(appendTag([title], 'essen', ids())[1], {
    id: 'n1',
    kind: 'text',
    text: '#essen',
  });
});
