const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { isAutoName, searchHistory, streakOf } = require('./diary.js');
const { currentWeightKg } = require('./goals.js');
const { sumOptional } = require('./nutrition.js');

/** Eine Sicht wie `forOwner`, nur mit Mahlzeiten. */
const ownOf = (meals) => ({ list: (_name, where = () => true) => meals.filter(where) });
const meal = (day, extra = {}) => ({ day, createdAt: `${day}T12:00:00Z`, items: [], ...extra });

describe('Tagebuch: reine Rechnung', () => {
  test('Serie: Tage in Folge, ein leerer heutiger Tag zaehlt ab gestern', () => {
    const own = ownOf([meal('2026-09-20'), meal('2026-09-21'), meal('2026-09-18')]);
    assert.equal(streakOf(own, '2026-09-21'), 2);
    assert.equal(streakOf(own, '2026-09-22'), 2);
    assert.equal(streakOf(own, '2026-09-24'), 0);
  });

  test('Suchverlauf: normalisiert, das Haeufigste gewinnt', () => {
    const own = ownOf([
      meal('2026-09-01', { items: [{ foodId: 'a', term: 'Brot' }] }),
      meal('2026-09-02', { items: [{ foodId: 'b', term: 'brot ' }] }),
      meal('2026-09-03', { items: [{ foodId: 'b', term: 'BROT' }] }),
    ]);
    assert.deepEqual(searchHistory(own), { brot: 'b' });
  });

  test('gebauter Name: neu per Flag, alt am Inhalt erkannt', () => {
    assert.equal(isAutoName({ nameAuto: true, name: 'x', items: [] }), true);
    assert.equal(isAutoName({ name: 'A, B', items: [{ name: 'A' }, { name: 'B' }] }), true);
    assert.equal(isAutoName({ name: 'Zmorge', items: [{ name: 'A' }] }), false);
  });

  test('Gewicht: der neuere Eintrag gilt, ein neueres Profil auch', () => {
    const row = { profile: { weightKg: 70 }, updatedAt: '2026-09-10T08:00:00Z' };
    assert.equal(currentWeightKg(row, [{ day: '2026-09-12', weightKg: 72 }]), 72);
    assert.equal(currentWeightKg(row, [{ day: '2026-09-01', weightKg: 75 }]), 70);
    assert.equal(currentWeightKg(row, []), 70);
  });

  test('Ballaststoffe, Zucker, Salz: nur was bekannt ist', () => {
    assert.deepEqual(sumOptional([{ fiberG: 1.25 }, { fiberG: 2, saltG: 0.3 }, {}]), {
      fiberG: 3.3,
      saltG: 0.3,
    });
  });
});
