const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { mealContextLines, systemInstruction } = require('./schema.js');

describe('Anweisung ans Bildmodell: Rolle und Anlass', () => {
  test('nennt die Rolle, bevor es um das Bild geht', () => {
    const lines = systemInstruction('de').split('\n');
    assert.match(lines[0], /Ernährungsberaterin/);
    assert.match(lines[0], /Schweiz/);
  });

  test('ohne Anlass steht keine Zeile dazu', () => {
    assert.deepEqual(mealContextLines(null), []);
    assert.deepEqual(mealContextLines({}), []);
    assert.deepEqual(mealContextLines({ slot: 'zweitfruehstueck' }), []);
  });

  test('nennt die Mahlzeit, wenn sie bekannt ist', () => {
    const [line] = mealContextLines({ slot: 'snack' });
    assert.match(line, /Zwischendurch/);
    assert.match(mealContextLines({ slot: 'lunch' })[0], /Mittagessen/);
  });

  test('sagt am Wochenende, dass die Teller voller sind', () => {
    // 2026-09-19 ist ein Samstag, 2026-09-22 ein Dienstag.
    assert.equal(mealContextLines({ slot: 'dinner', day: '2026-09-19' }).length, 2);
    assert.equal(mealContextLines({ slot: 'dinner', day: '2026-09-22' }).length, 1);
    assert.equal(mealContextLines({ slot: 'dinner', day: 'morgen' }).length, 1);
  });

  test('der Anlass steht in der Anweisung selbst', () => {
    const text = systemInstruction('de', { slot: 'breakfast', day: '2026-09-20' });
    assert.match(text, /Frühstück/);
    assert.match(text, /Wochenende/);
    // Die alten Regeln bleiben, wo sie waren.
    assert.match(text, /26–28 cm/);
  });
});
