/**
 * Zwei Laeufe nebeneinander: `--compare a.json b.json`. Vergleicht nur die
 * Kennzahlen, die eine Aenderung an der Pipeline bewegen soll, und sagt bei
 * jeder Zeile, welche Richtung besser ist (↑ mehr ist besser, ↓ weniger).
 *
 * Verglichen wird ueber die gemeinsamen Gerichte, wenn sich die Stichproben
 * unterscheiden — sonst vergliche man Aepfel mit Birnen.
 */
const fs = require('node:fs');
const { summarize } = require('./metrics.js');

const f = (value, digits = 1) => (value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits));
const pct = (value) => (value === null || value === undefined || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(0)} %`);

/** Was verglichen wird: Titel, Wert aus der Zusammenfassung, Anzeige, Richtung. */
const ROWS = [
  ['Gerichte ok', (s) => s.ok, (v) => String(v), 'up'],
  ['Erfolgsquote', (s) => s.successRate, pct, 'up'],
  ['kcal-Fehler Median %', (s) => s.kcal.medianPct, (v) => f(v), 'down'],
  ['kcal-Fehler Mittel %', (s) => s.kcal.meanPct, (v) => f(v), 'down'],
  ['kcal-Fehler p90 %', (s) => s.kcal.p90Pct, (v) => f(v), 'down'],
  ['kcal-Verzerrung %', (s) => s.kcal.biasPct, (v) => f(v), 'zero'],
  ['innerhalb ±15 %', (s) => s.kcal.within15, pct, 'up'],
  ['innerhalb ±25 %', (s) => s.kcal.within25, pct, 'up'],
  ['Masse-Fehler Median %', (s) => s.mass.medianPct, (v) => f(v), 'down'],
  ['Masse-Verzerrung %', (s) => s.mass.biasPct, (v) => f(v), 'zero'],
  ['MAE Protein g', (s) => s.maeG.protein, (v) => f(v), 'down'],
  ['MAE Kohlenhydrate g', (s) => s.maeG.carbs, (v) => f(v), 'down'],
  ['MAE Fett g', (s) => s.maeG.fat, (v) => f(v), 'down'],
  ['Zutaten-Recall', (s) => s.recall.rate, pct, 'up'],
  ['Öl genannt', (s) => (s.oil.dishesWithOil ? s.oil.oilNamed / s.oil.dishesWithOil : null), pct, 'up'],
  ['Kosten je Gericht CHF', (s) => s.costChf.perDish, (v) => f(v, 5), 'down'],
  ['Latenz Median s', (s) => s.latencyS.median, (v) => f(v), 'down'],
];

/** ↑ besser, ↓ schlechter, · gleich. Bei `zero` zaehlt der Abstand zur Null. */
function verdict(a, b, direction) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return '·';
  const left = direction === 'zero' ? Math.abs(a) : a;
  const right = direction === 'zero' ? Math.abs(b) : b;
  if (Math.abs(right - left) < 1e-9) return '·';
  const better = direction === 'up' ? right > left : right < left;
  return better ? '↑ besser' : '↓ schlechter';
}

const load = (file) => {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { file, meta: parsed.meta ?? {}, summary: parsed.summary ?? {}, records: parsed.records ?? [] };
};

const name = (run) => `${run.meta.label ?? '?'}${run.meta.variant ? ` (${run.meta.variant})` : ''}`;

/** Aeltere Laeufe kennen nur `models`, neuere das gesetzte `mainModel`. */
const modelOf = (run) => {
  if (run.meta.mainModel) return run.meta.mainModel;
  const list = run.meta.models ?? [];
  return list.length ? list.join(', ') : '?';
};

function compare(fileA, fileB, { onlyShared = true } = {}) {
  const a = load(fileA);
  const b = load(fileB);
  const lines = [];
  lines.push(`# Vergleich — ${name(a)} gegen ${name(b)}`);
  lines.push('');
  lines.push(`A: \`${fileA}\` — ${a.meta.date ?? '?'}, n=${a.meta.n ?? '?'}, Modell \`${modelOf(a)}\``);
  lines.push(`B: \`${fileB}\` — ${b.meta.date ?? '?'}, n=${b.meta.n ?? '?'}, Modell \`${modelOf(b)}\``);
  lines.push('');

  // Nur Gerichte, die in beiden Laeufen geklappt haben — sonst vergleicht man
  // die Kennzahlen unterschiedlicher Stichproben.
  let left = a.summary;
  let right = b.summary;
  const okA = new Set(a.records.filter((record) => record.status === 'ok').map((record) => record.dishId));
  const okB = new Set(b.records.filter((record) => record.status === 'ok').map((record) => record.dishId));
  const shared = [...okA].filter((id) => okB.has(id));
  const sameSample = okA.size === okB.size && shared.length === okA.size;
  if (onlyShared && !sameSample && shared.length > 0) {
    const keep = new Set(shared);
    left = summarize(a.records.filter((record) => keep.has(record.dishId)), a.meta.mainModel ?? null);
    right = summarize(b.records.filter((record) => keep.has(record.dishId)), b.meta.mainModel ?? null);
    lines.push(`> Gerechnet über die **${shared.length} Gerichte, die in beiden Läufen geklappt haben** (A: ${okA.size} ok, B: ${okB.size} ok).`);
    lines.push(`> „Gerichte ok“ und „Erfolgsquote“ stehen deshalb hier für die ganzen Läufe.`);
    lines.push('');
  }

  lines.push('| Kennzahl | A | B | |');
  lines.push('| --- | ---: | ---: | --- |');
  for (const [title, get, show, direction] of ROWS) {
    // Erfolg und Anzahl gelten immer fuer den ganzen Lauf, nie fuer die Schnittmenge.
    const whole = title === 'Gerichte ok' || title === 'Erfolgsquote';
    const valueA = get(whole ? a.summary : left);
    const valueB = get(whole ? b.summary : right);
    lines.push(`| ${title} | ${show(valueA)} | ${show(valueB)} | ${verdict(valueA, valueB, direction)} |`);
  }
  lines.push('');
  return lines.join('\n');
}

module.exports = { compare, verdict };
