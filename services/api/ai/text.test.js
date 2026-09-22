/**
 * Nachbearbeitung der Antworten: Denktext weg, Laenge, Fassung zum Vorlesen.
 */
const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { limitChars, spokenText, stripReasoning } = require('./text.js');

describe('Antworten nachbearbeiten', () => {
  test('stripReasoning entfernt jeden Denkteil', () => {
    assert.equal(stripReasoning('<think>Die Person will …</think>\n\nHallo, ich bin da.'), 'Hallo, ich bin da.');
    assert.equal(stripReasoning('<THINKING>a</THINKING>Ja.<think>b</think> Klar.'), 'Ja. Klar.');
    assert.equal(stripReasoning('erst denken, dann\n</think>\nAntwort.'), 'Antwort.');
    assert.equal(stripReasoning('Antwort.<think>noch nicht fertig'), 'Antwort.');
    assert.equal(
      stripReasoning(
        '<|channel|>analysis<|message|>denken<|end|><|start|>assistant<|channel|>final<|message|>Fertig.',
      ),
      'Fertig.',
    );
    assert.equal(stripReasoning('<think>nur denken</think>'), '');
    assert.equal(stripReasoning(null), '');
  });

  test('limitChars laesst Kurzes stehen und schneidet am Satzende', () => {
    assert.equal(limitChars('  Kurz.  ', 10), 'Kurz.');
    assert.equal(
      limitChars('Erster Satz. Zweiter Satz ist länger. Dritter', 40),
      'Erster Satz. Zweiter Satz ist länger.',
    );
    assert.equal(limitChars('Sie sagte "Hallo." Dann ging sie nach Hause', 30), 'Sie sagte "Hallo."');
    assert.equal(limitChars('Wirklich? Ja! Und dann noch viel mehr', 20), 'Wirklich? Ja!');
  });

  test('limitChars haelt Listennummern nicht fuer Satzenden', () => {
    const cut = limitChars('Tipps für dich heute:\n1. Wasser\n2. Schlaf und noch mehr Text hier', 35);
    assert.ok(cut.length <= 35);
    assert.ok(cut.endsWith('…'), cut);
    assert.doesNotMatch(cut, /\d\.…?$/);
  });

  test('limitChars schneidet sonst an der Wortgrenze mit …', () => {
    assert.equal(limitChars('eins zwei drei vier fuenf', 12), 'eins zwei…');
    assert.equal(limitChars('abcdefghij', 5), 'abcd…');
    assert.equal(limitChars('eins, zwei drei', 7), 'eins…');
    const early = limitChars(`Ja. ${'x '.repeat(50)}`, 60);
    assert.ok(early.endsWith('…'), 'ein Satzende im ersten Drittel zaehlt nicht');
    assert.ok(early.length <= 60);
    for (const max of [1, 2, 50, 99]) {
      assert.ok(limitChars('wort '.repeat(40), max).length <= max, String(max));
    }
  });

  test('spokenText macht aus Markdown gesprochene Saetze', () => {
    const markdown = [
      '## Drei Tipps',
      '',
      '- **Früh** ins Bett 😴',
      '- Kein Handy, lies lieber [ein Buch](https://buch.example.ch)',
      '1. Tee trinken;',
      '',
      '---',
      '> Viel Erfolg! 🎉 Mehr auf www.schlaf.example.ch',
    ].join('\n');
    assert.equal(
      spokenText(markdown, 600),
      'Drei Tipps. Früh ins Bett. Kein Handy, lies lieber ein Buch. Tee trinken. Viel Erfolg! Mehr auf.',
    );
  });

  test('spokenText: Absaetze, Code, Emojis mit Hautton und Flaggen', () => {
    const text = 'Zeile eins\ngeht weiter\n\n`npm test` hilft 👍🏽 🇨🇭\n\n```js\nlet a = 1\n```';
    assert.equal(spokenText(text, 600), 'Zeile eins geht weiter. npm test hilft. let a = 1.');
    assert.equal(spokenText('Siehe (https://x.example.ch) hier.', 600), 'Siehe hier.');
  });

  test('spokenText bleibt unter der Grenze', () => {
    const long = 'Das ist ein ruhiger Satz. '.repeat(100);
    const spoken = spokenText(long, 300);
    assert.ok(spoken.length <= 300);
    assert.ok(spoken.endsWith('.'));
    assert.equal(spokenText('', 300), '');
  });
});

test('plainText: ohne Fett, Ueberschriften und Kennungen — Zeilen bleiben', () => {
  const { plainText } = require('./text.js');
  assert.equal(
    plainText('## Diese Woche\n\n**Kalender:**\n- Mi 23.09. 14:00 Zahnarzt ([T1])\n- Do *Fussball* [T2]\n\n\n\nSonst nichts.'),
    'Diese Woche\n\nKalender:\n- Mi 23.09. 14:00 Zahnarzt\n- Do Fussball\n\nSonst nichts.',
  );
  assert.equal(plainText('* Punkt eins\n* Punkt zwei'), '* Punkt eins\n* Punkt zwei');
  assert.equal(plainText('3 * 4 = 12'), '3 * 4 = 12');
  // Kennungen aus dem Kontext auch ohne Klammern — andere bleiben (die A1 ist eine Autobahn).
  assert.equal(plainText('Welche? T1 Coiffeur oder T2: Zahnarzt?', ['T1', 'T2']), 'Welche? Coiffeur oder Zahnarzt?');
  assert.equal(plainText('Stau auf der A1.', ['T1']), 'Stau auf der A1.');
});
