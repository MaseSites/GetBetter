import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cleanTag, extractTags, tagCounts, tagsOfNote } from './tags';

test('Tags: #wort im Text, klein, jeder einmal', () => {
  assert.deepEqual(extractTags('Rezept #Rezept für #vegi-Tage, nochmals #rezept.'), [
    'rezept',
    'vegi-tage',
  ]);
  assert.deepEqual(extractTags('#älplermagronen\n#Käse'), ['älplermagronen', 'käse']);
});

test('Tags: keine Ueberschrift, keine Nummer, nicht mitten im Wort', () => {
  assert.deepEqual(extractTags('# Ueberschrift'), []);
  assert.deepEqual(extractTags('Ticket #123 und C# und seite.ch/#teil und a##b'), []);
  assert.deepEqual(extractTags('Punkt #2b'), ['2b']);
  assert.deepEqual(extractTags('#ende- und #mitte_'), ['ende', 'mitte']);
});

test('Tags einer Notiz und ueber alle Notizen', () => {
  assert.deepEqual(tagsOfNote({ title: 'Ideen #geburtstag', body: '#anna' }), [
    'geburtstag',
    'anna',
  ]);
  assert.deepEqual(
    tagCounts([
      { title: '', body: '#b #a' },
      { title: '#a', body: '' },
      { title: '', body: '#c' },
    ]),
    [
      { tag: 'a', count: 2 },
      { tag: 'b', count: 1 },
      { tag: 'c', count: 1 },
    ],
  );
});

test('Getippte Tags werden sauber', () => {
  assert.equal(cleanTag('  #Ferien 2026 '), 'ferien-2026');
  assert.equal(cleanTag('###'), null);
  assert.equal(cleanTag('42'), null);
});
