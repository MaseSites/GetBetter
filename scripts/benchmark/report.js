/** Die Zusammenfassung als Markdown — dieselbe fuer die Datei und die Konsole. */

const f = (value, digits = 1) => (value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits));
const pct = (value) => (value === null || value === undefined ? '—' : `${(value * 100).toFixed(0)} %`);

function describeItems(items) {
  return items.map((item) => `${item.term} ${Math.round(item.grams)} g`).join(', ') || '—';
}

function describeTruth(truth) {
  return [...truth.ingredients]
    .sort((a, b) => b.grams - a.grams)
    .slice(0, 5)
    .map((entry) => `${entry.name} ${Math.round(entry.grams)} g`)
    .join(', ');
}

function markdown(meta, summary, records) {
  const byId = new Map(records.map((record) => [record.dishId, record]));
  const lines = [];
  lines.push(`# Better Fit Foto-Benchmark — ${meta.label} (${meta.date})`);
  lines.push('');
  lines.push(`Nutrition5k (CC BY 4.0), Split \`${meta.split}\`, Seed ${meta.seed}, n=${meta.n}, Sprache \`${meta.language}\`, Hauptmodell \`${meta.mainModel ?? '—'}\`.`);
  if (meta.variant) lines.push(`Variante: **${meta.variant}**.`);
  lines.push(`Echte Pipeline über HTTP (\`POST /v1/fit/meal-analysis/start\`), keine Rückfrage beantwortet (Standard übernommen).`);
  lines.push(`Sequenziell (\`--concurrency ${meta.concurrency}\`), Pause ${meta.pauseMs} ms, bis zu ${meta.retries} Wiederholungen je Gericht; Ersatzmodell im Dienst ${meta.allowFallback ? 'erlaubt' : 'abgeschaltet'}.`);
  lines.push('');
  lines.push(`| Kennzahl | Wert |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Gerichte ok / fehlgeschlagen | ${summary.ok} / ${summary.failed} (Erfolg ${pct(summary.successRate)}) |`);
  lines.push(`| Modell je Gericht | ${Object.entries(summary.models).map(([k, v]) => `${k} ${v}×`).join(', ') || '—'} |`);
  lines.push(`| Auf Ersatzmodell ausgewichen | ${summary.fallback.count}${summary.fallback.models.length ? ` (${summary.fallback.models.join(', ')})` : ''} |`);
  lines.push(`| kcal-Fehler Median / Mittel / p90 | ${f(summary.kcal.medianPct)} % / ${f(summary.kcal.meanPct)} % / ${f(summary.kcal.p90Pct)} % |`);
  lines.push(`| kcal-Verzerrung (Mittel, vorzeichenbehaftet) | ${f(summary.kcal.biasPct)} % (unterschätzt: ${pct(summary.kcal.under)}) |`);
  lines.push(`| innerhalb ±15 % / ±25 % kcal | ${pct(summary.kcal.within15)} / ${pct(summary.kcal.within25)} |`);
  lines.push(`| Masse-Fehler Median / Mittel / Verzerrung | ${f(summary.mass.medianPct)} % / ${f(summary.mass.meanPct)} % / ${f(summary.mass.biasPct)} % |`);
  lines.push(`| MAE Protein / KH / Fett | ${f(summary.maeG.protein)} g / ${f(summary.maeG.carbs)} g / ${f(summary.maeG.fat)} g (Fett-Verzerrung ${f(summary.maeG.fatBias)} g) |`);
  lines.push(`| Zutaten-Recall (≥ 20 % der Masse) | ${pct(summary.recall.rate)} (${summary.recall.found}/${summary.recall.ingredients}) |`);
  lines.push(`| Öl/Fett genannt, wo ≥ 3 g drin | ${summary.oil.oilNamed}/${summary.oil.dishesWithOil} |`);
  lines.push(`| Mit Rückfrage / Stufen | ${summary.questions.dishesAsked} · ${Object.entries(summary.questions.levels).map(([k, v]) => `${k} ${v}`).join(', ')} |`);
  lines.push(`| Kosten gesamt / je Gericht | CHF ${f(summary.costChf.total, 4)} / CHF ${f(summary.costChf.perDish, 5)} |`);
  lines.push(`| Latenz Mittel / Median / p90 | ${f(summary.latencyS.mean)} s / ${f(summary.latencyS.median)} s / ${f(summary.latencyS.p90)} s |`);
  lines.push(`| Versuche Mittel / max / mit Wiederholung | ${f(summary.attempts.mean, 2)} / ${summary.attempts.max} / ${summary.attempts.retried} |`);
  lines.push('');
  if (Object.keys(summary.failureKinds).length) {
    lines.push('## Woran es scheiterte');
    lines.push('');
    lines.push('| Grund | Gerichte |');
    lines.push('| --- | --- |');
    for (const [kind, count] of Object.entries(summary.failureKinds)) lines.push(`| \`${kind}\` | ${count} |`);
    lines.push('');
  }
  lines.push('## Nach dominanter Zutat (≥ 2 Gerichte)');
  lines.push('');
  lines.push('| Zutat | n | kcal Median % | kcal Verzerrung % | Masse Verzerrung % |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const group of summary.byDominant.filter((entry) => entry.n >= 2)) {
    lines.push(`| ${group.name} | ${group.n} | ${f(group.kcalMedianPct)} | ${f(group.kcalBiasPct)} | ${f(group.massBiasPct)} |`);
  }
  lines.push('');
  lines.push('## Die fünf schlechtesten (kcal)');
  lines.push('');
  for (const id of summary.worst) {
    const record = byId.get(id);
    if (!record) continue;
    lines.push(`- **${id}** — ${f(record.score.kcalSignedPct, 0)} % kcal (${record.predicted.kcal} statt ${Math.round(record.truth.kcal)}), Masse ${Math.round(record.predicted.massG)} statt ${Math.round(record.truth.massG)} g, Stufe ${record.predicted.level}, \`${record.model ?? '—'}\``);
    lines.push(`  - KI: „${record.predicted.mealName ?? '—'}“: ${describeItems(record.predicted.items)}`);
    lines.push(`  - Wahrheit: ${describeTruth(record.truth)}`);
  }
  if (summary.failures.length) {
    lines.push('');
    lines.push('## Fehlgeschlagen');
    lines.push('');
    for (const failure of summary.failures) lines.push(`- ${failure.dishId}: ${failure.error}`);
  }
  lines.push('');
  return lines.join('\n');
}

module.exports = { markdown };
