const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { adaptiveTarget, confidenceOf, estimateExpenditure, paceKcalOf } = require('./energy.js');

const DAY_MS = 24 * 60 * 60 * 1000;
const dayOf = (offset, from = '2026-09-23') =>
  new Date(Date.parse(`${from}T12:00:00Z`) + offset * DAY_MS).toISOString().slice(0, 10);

/**
 * Ein Verlauf, der genau rechnet: `days` Tage, jeden Tag gewogen, jeden Tag
 * `kcal` gegessen, und das Gewicht faellt gleichmaessig um `kgPerWeek`.
 * Der Tag 0 ist heute, es wird zurueck gerechnet.
 */
function history({ days = 28, kcal = 2100, startKg = 80, kgPerWeek = -0.4, logEvery = 1 }) {
  const weights = [];
  const intake = {};
  for (let back = days; back >= 0; back -= 1) {
    const day = dayOf(-back);
    const passed = days - back;
    weights.push({ day, weightKg: startKg + (kgPerWeek / 7) * passed });
    if (passed % logEvery === 0) intake[day] = kcal;
  }
  return { weights, intake };
}

const PROFILE = { goal: 'lose', pace: 'moderate', birthDate: '1995-05-05' };

describe('Verbrauch aus den eigenen Zahlen', () => {
  test('rechnet den Verbrauch aus Zufuhr und Gewichtsaenderung', () => {
    // 2100 kcal gegessen, 0.4 kg je Woche verloren -> 0.4 × 7700 / 7 = 440 kcal
    // Defizit am Tag, also rund 2540 kcal Verbrauch.
    const { weights, intake } = history({ kcal: 2100, kgPerWeek: -0.4 });
    const found = estimateExpenditure(weights, intake, '2026-09-23');
    assert.ok(found, 'eine Schaetzung');
    // Der geglaettete Trend laeuft dem echten Gewicht nach, darum eine Spanne.
    assert.ok(found.kcal > 2400 && found.kcal < 2600, `unerwartet: ${found.kcal}`);
    assert.equal(found.meanIntakeKcal, 2100);
    assert.equal(found.confidence, 'high');
  });

  test('wer zunimmt, verbraucht weniger als er isst', () => {
    const { weights, intake } = history({ kcal: 3000, kgPerWeek: 0.5, startKg: 70 });
    const found = estimateExpenditure(weights, intake, '2026-09-23');
    assert.ok(found.kcal < 3000, `unerwartet: ${found.kcal}`);
    assert.ok(found.weightChangeKgPerWeek > 0.3);
  });

  test('ohne genug Tage gibt es keine Zahl', () => {
    const { weights, intake } = history({ days: 10 });
    assert.equal(estimateExpenditure(weights, intake, '2026-09-23'), null);
  });

  test('mit Luecken im Tagebuch gibt es keine Zahl', () => {
    // Nur jeden dritten Tag eingetragen — das ist eine Auswahl, kein Schnitt.
    const { weights, intake } = history({ logEvery: 3 });
    assert.equal(estimateExpenditure(weights, intake, '2026-09-23'), null);
  });

  test('vergessene Tage zaehlen nicht als 0 kcal', () => {
    const { weights, intake } = history({ kcal: 2100 });
    const withZero = { ...intake, [dayOf(-3)]: 0, [dayOf(-4)]: 120 };
    const found = estimateExpenditure(weights, withZero, '2026-09-23');
    // Der Schnitt bleibt 2100 — die beiden Tage fallen weg, statt ihn zu ziehen.
    assert.equal(found.meanIntakeKcal, 2100);
  });

  test('Unsinn aus falschen Daten wird nicht ausgegeben', () => {
    // 10 kg in vier Wochen „verloren“ waere ein Verbrauch von weit ueber 6000.
    const { weights, intake } = history({ kcal: 2000, kgPerWeek: -3 });
    assert.equal(estimateExpenditure(weights, intake, '2026-09-23'), null);
  });

  test('ohne Waage und ohne Tagebuch: null, kein Fehler', () => {
    assert.equal(estimateExpenditure([], {}, '2026-09-23'), null);
    assert.equal(estimateExpenditure(null, null, '2026-09-23'), null);
    assert.equal(estimateExpenditure([], {}, 'irgendwann'), null);
  });

  test('Sicherheit sagt, wie gut die Zahl ist', () => {
    assert.equal(confidenceOf(28, 1), 'high');
    assert.equal(confidenceOf(19, 0.75), 'medium');
    assert.equal(confidenceOf(14, 0.6), 'low');
  });
});

describe('Das Ziel, das daraus folgt', () => {
  const estimate = { kcal: 2540, confidence: 'high', days: 28 };

  test('zieht ein zu hoch geschaetztes Ziel nach unten', () => {
    // Verbrauch 2540, Tempo moderat (0.5 kg/Woche = 550 kcal) -> Ziel rund 1990.
    const found = adaptiveTarget(estimate, PROFILE, 2400, '2026-09-23');
    assert.ok(found);
    assert.equal(found.settlesAtKcal, 1990);
    assert.ok(found.kcal < 2400 && found.kcal >= 1990);
    assert.equal(found.confidence, 'high');
  });

  test('bewegt das Ziel nie um mehr als einen Schritt', () => {
    const found = adaptiveTarget(estimate, PROFILE, 3000, '2026-09-23');
    assert.equal(found.kcal, 2700); // 3000 − 300
    assert.equal(found.changeKcal, -300);
    // Sagt trotzdem ehrlich, wohin es laeuft.
    assert.equal(found.settlesAtKcal, 1990);
  });

  test('bei kleiner Abweichung bleibt alles, wie es ist', () => {
    assert.equal(adaptiveTarget(estimate, PROFILE, 2000, '2026-09-23'), null);
  });

  test('unter 1200 kcal geht es nie', () => {
    const hungry = { kcal: 1500, confidence: 'high', days: 28 };
    const found = adaptiveTarget(hungry, PROFILE, 1300, '2026-09-23');
    assert.ok(found === null || found.kcal >= 1200);
  });

  test('eine unsichere Schaetzung aendert kein Ziel', () => {
    assert.equal(
      adaptiveTarget({ ...estimate, confidence: 'low' }, PROFILE, 3000, '2026-09-23'),
      null,
    );
    assert.equal(adaptiveTarget(null, PROFILE, 3000, '2026-09-23'), null);
  });

  test('wer kein Defizit rechnen darf, bekommt auch kein Ziel', () => {
    // Minderjaehrig: `goals.js` bleibt beim Erhalt, also auch hier.
    const young = { ...PROFILE, birthDate: '2012-05-05' };
    assert.equal(adaptiveTarget(estimate, young, 3000, '2026-09-23'), null);
    const pregnant = { ...PROFILE, pregnant: true };
    assert.equal(adaptiveTarget(estimate, pregnant, 3000, '2026-09-23'), null);
  });

  test('Erhalten heisst: Ziel gleich Verbrauch', () => {
    const keep = { goal: 'maintain', pace: 'gentle', birthDate: '1995-05-05' };
    assert.equal(paceKcalOf(keep), 0);
    const found = adaptiveTarget(estimate, keep, 2200, '2026-09-23');
    assert.equal(found.settlesAtKcal, 2540);
  });
});
