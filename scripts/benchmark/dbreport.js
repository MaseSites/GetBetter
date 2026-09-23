/** Die Zusammenfassung des Datenbank-Benchmarks als Markdown — Datei und Konsole. */

const f = (value, digits = 1) =>
  value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits);
const pct = (value) =>
  value === null || value === undefined || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(0)} %`;
const signed = (value, digits = 1) =>
  !Number.isFinite(value) ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;

function markdown(meta, summary) {
  const s = summary;
  const lines = [];
  lines.push(`# Better Fit Datenbank-Benchmark — ${meta.label} (${meta.date})`);
  lines.push('');
  lines.push(
    `Nutrition5k (CC BY 4.0), **alle** Gerichte beider Cafés, n=${s.dishes}. Kein KI-Aufruf: die Zutaten und Gramm der Wahrheit gehen direkt in unsere Pipeline (\`catalog.match\` → \`cooking.js\` → \`computeMeal\`). Gemessen wird damit nur, was **unser Code** an Fehler beisteuert — Datenbankzuordnung, roh/gekocht, Werte je 100 g.`,
  );
  lines.push('');
  lines.push(
    `Katalog: ${meta.catalog.foods} Datensätze, Schweizer Version ${meta.catalog.swissVersion ?? '—'}, Modus \`${meta.catalog.mode}\`, Fingerabdruck \`${meta.catalog.fingerprint ?? '—'}\`. Umrechnung roh→gekocht: **${meta.cooking ? 'an' : 'aus'}**. Posten unter 1 g übersprungen: ${s.skippedTiny}.`,
  );
  lines.push('');
  lines.push('| Kennzahl | Wert |');
  lines.push('| --- | --- |');
  lines.push(`| Gerichte / Zutatenposten | ${s.dishes} / ${s.ingredients} |`);
  lines.push(`| kcal-Fehler Median / Mittel / p90 | ${f(s.kcal.medianPct)} % / ${f(s.kcal.meanPct)} % / ${f(s.kcal.p90Pct)} % |`);
  lines.push(`| kcal-Verzerrung Mittel / Median | ${signed(s.kcal.biasPct)} % / ${signed(s.kcal.medianBiasPct)} % (unterschätzt: ${pct(s.kcal.under)}) |`);
  lines.push(`| innerhalb ±10 % / ±15 % / ±25 % | ${pct(s.kcal.within10)} / ${pct(s.kcal.within15)} / ${pct(s.kcal.within25)} |`);
  lines.push(`| MAE Protein / KH / Fett | ${f(s.maeG.protein)} g / ${f(s.maeG.carbs)} g / ${f(s.maeG.fat)} g |`);
  lines.push(`| Verzerrung Protein / KH / Fett | ${signed(s.biasG.protein)} g / ${signed(s.biasG.carbs)} g / ${signed(s.biasG.fat)} g |`);
  lines.push(`| Ohne Treffer im Katalog | ${s.match.noHit} (${pct(s.match.noHitShare)}), entgangene Wahrheit ${s.match.lostKcal} von ${s.match.truthKcal} kcal |`);
  lines.push(`| Treffer als unsicher markiert | ${s.match.uncertain} (${pct(s.match.uncertainShare)}) |`);
  lines.push(`| Auf roh/trocken gelandet | ${s.match.rawState} (${pct(s.match.rawShare)}) |`);
  lines.push(`| Von \`cooking.js\` umgerechnet | ${s.match.converted} (${pct(s.match.convertedShare)}) |`);
  lines.push(`| Echter gekochter Datensatz | ${s.match.cookedState} |`);
  lines.push(`| Treffergüte im Mittel | ${f(s.match.meanScore, 2)} |`);
  lines.push('');
  lines.push('## Die 30 teuersten Zutaten');
  lines.push('');
  lines.push('Sortiert nach dem Betrag, den sie über alle Gerichte an kcal danebenlagen — das ist die Arbeitsliste.');
  lines.push('');
  lines.push('| Zutat | n | kcal-Fehler gesamt | Mittel je Vorkommen | Wahrheit ⌀ | ⌀ g | zugeordnet zu | Treffer |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |');
  for (const entry of s.worstIngredients) {
    const hit = entry.missRate >= 0.99 ? 'kein Treffer' : `${pct(1 - entry.missRate)}${entry.convertedRate > 0 ? ` · umgerechnet ${pct(entry.convertedRate)}` : ''}${entry.rawRate > 0 ? ` · roh ${pct(entry.rawRate)}` : ''}`;
    lines.push(
      `| ${entry.name} | ${entry.n} | ${entry.absKcal} | ${signed(entry.meanSignedKcal, 0)} | ${entry.meanTruthKcal} | ${entry.meanGrams} | ${entry.picked} | ${hit} |`,
    );
  }
  lines.push('');
  lines.push('## Die fünf schlechtesten Gerichte (kcal)');
  lines.push('');
  for (const dish of s.worstDishes) {
    lines.push(`- **${dish.dishId}** — ${signed(dish.signedPct, 0)} % (${dish.kcal} statt ${dish.truthKcal} kcal)`);
  }
  lines.push('');
  return lines.join('\n');
}

/** Zwei Laeufe nebeneinander — nur die Zahlen, die eine Aenderung bewegen soll. */
const ROWS = [
  ['kcal-Fehler Median %', (s) => s.kcal.medianPct, (v) => f(v), 'down'],
  ['kcal-Fehler Mittel %', (s) => s.kcal.meanPct, (v) => f(v), 'down'],
  ['kcal-Fehler p90 %', (s) => s.kcal.p90Pct, (v) => f(v), 'down'],
  ['kcal-Verzerrung %', (s) => s.kcal.biasPct, (v) => signed(v), 'zero'],
  ['innerhalb ±10 %', (s) => s.kcal.within10, pct, 'up'],
  ['innerhalb ±15 %', (s) => s.kcal.within15, pct, 'up'],
  ['innerhalb ±25 %', (s) => s.kcal.within25, pct, 'up'],
  ['MAE Protein g', (s) => s.maeG.protein, (v) => f(v), 'down'],
  ['MAE Kohlenhydrate g', (s) => s.maeG.carbs, (v) => f(v), 'down'],
  ['MAE Fett g', (s) => s.maeG.fat, (v) => f(v), 'down'],
  ['Ohne Treffer', (s) => s.match.noHitShare, pct, 'down'],
  ['Auf roh/trocken gelandet', (s) => s.match.rawShare, pct, 'down'],
  ['Umgerechnet', (s) => s.match.convertedShare, pct, 'up'],
];

function verdict(a, b, direction) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return '·';
  const left = direction === 'zero' ? Math.abs(a) : a;
  const right = direction === 'zero' ? Math.abs(b) : b;
  if (Math.abs(right - left) < 1e-9) return '·';
  return (direction === 'up' ? right > left : right < left) ? '↑ besser' : '↓ schlechter';
}

function compareMarkdown(a, b) {
  const lines = [];
  lines.push(`# Vergleich — ${a.meta.label} gegen ${b.meta.label}`);
  lines.push('');
  lines.push(`A: ${a.meta.label} (Umrechnung ${a.meta.cooking ? 'an' : 'aus'}), n=${a.summary.dishes}, Katalog \`${a.meta.catalog?.fingerprint ?? '—'}\``);
  lines.push(`B: ${b.meta.label} (Umrechnung ${b.meta.cooking ? 'an' : 'aus'}), n=${b.summary.dishes}, Katalog \`${b.meta.catalog?.fingerprint ?? '—'}\``);
  lines.push('');
  // Am Katalog wird gearbeitet: zwei Laeufe auf verschiedenen Staenden messen
  // zwei verschiedene Dinge, und die Tabelle sagt dann gar nichts.
  if ((a.meta.catalog?.fingerprint ?? null) !== (b.meta.catalog?.fingerprint ?? null)) {
    lines.push('> **Achtung: verschiedene Katalogstände.** Der Unterschied unten ist nicht allein die Umrechnung. Beide Läufe neu machen.');
    lines.push('');
  }
  lines.push('| Kennzahl | A | B | |');
  lines.push('| --- | ---: | ---: | --- |');
  for (const [title, get, show, direction] of ROWS) {
    lines.push(`| ${title} | ${show(get(a.summary))} | ${show(get(b.summary))} | ${verdict(get(a.summary), get(b.summary), direction)} |`);
  }
  lines.push('');
  return lines.join('\n');
}

module.exports = { markdown, compareMarkdown };
