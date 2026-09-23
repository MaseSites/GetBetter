const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { applyReference } = require('./guard.js');

/** Ein Referenzwissen, das nur `portionHint` kann — mehr braucht der Pruefer nicht. */
const referenceOf = (hints) => ({
  portionHint(slot, text) {
    const key = String(text).toLowerCase();
    const found = Object.entries(hints).find(([word]) => key.includes(word));
    return found ? { slot, requestedSlot: slot, source: 'menuch', ...found[1] } : null;
  },
});

const reference = referenceOf({
  reis: { category: 'Reis', median: 112, n: 376 },
  rice: { category: 'Reis', median: 112, n: 376 },
  brot: { category: 'Brot', median: 64.5, n: 1936 },
  fondue: { category: 'Fondue', median: 200, n: 3 },
});

const item = (over) => ({
  term: 'Reis',
  searchTerm: 'rice, white, cooked',
  grams: 150,
  minGrams: 120,
  maxGrams: 200,
  added: false,
  ...over,
});

describe('Portionspruefer', () => {
  test('laesst eine plausible Portion, wie sie ist', () => {
    const [found] = applyReference([item()], { reference, slot: 'lunch' });
    assert.equal(found.grams, 150);
    assert.equal(found.reference.applied, null);
    assert.equal(found.reference.category, 'Reis');
  });

  test('hebt eine unmoegliche kleine Portion auf die untere Grenze', () => {
    const [found] = applyReference([item({ grams: 20, minGrams: 10, maxGrams: 30 })], {
      reference,
      slot: 'lunch',
    });
    assert.equal(found.grams, 45); // 112 × 0.4
    assert.equal(found.reference.applied, 'raised');
    // Die Spanne wandert mit, ihr Verhaeltnis bleibt.
    assert.equal(found.minGrams, 22);
    assert.equal(found.maxGrams, 67);
  });

  test('kappt eine unmoegliche grosse Portion', () => {
    const [found] = applyReference([item({ grams: 900, minGrams: 700, maxGrams: 1100 })], {
      reference,
      slot: 'lunch',
    });
    assert.equal(found.grams, 280); // 112 × 2.5
    assert.equal(found.reference.applied, 'lowered');
  });

  test('traut einem Median aus wenigen Nennungen nicht', () => {
    const [found] = applyReference([item({ term: 'Fondue', grams: 30 })], {
      reference,
      slot: 'lunch',
    });
    assert.equal(found.grams, 30);
    assert.equal(found.reference, undefined);
  });

  test('laesst Ergaenztes und Standardrezept in Ruhe', () => {
    const items = applyReference(
      [item({ term: 'Brot', grams: 5, added: true }), item({ term: 'Brot', grams: 5, from: 'dish' })],
      { reference, slot: 'breakfast' },
    );
    assert.deepEqual(
      items.map((entry) => entry.grams),
      [5, 5],
    );
  });

  test('ohne Treffer und ohne Referenzwissen bleibt alles gleich', () => {
    const unknown = applyReference([item({ term: 'Quinoa', searchTerm: 'quinoa' })], {
      reference,
      slot: 'lunch',
    });
    assert.equal(unknown[0].grams, 150);
    assert.equal(unknown[0].reference, undefined);
    assert.deepEqual(applyReference([item()], {}), [item()]);
  });

  test('sucht auch ueber den englischen Begriff', () => {
    const [found] = applyReference([item({ term: 'Unbekannt', searchTerm: 'rice, cooked' })], {
      reference,
      slot: 'dinner',
    });
    assert.equal(found.reference.category, 'Reis');
  });
});
