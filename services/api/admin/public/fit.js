/*
 * Better Admin: Better Fit (Masterplan §25). Foto-Analysen, Ampel, Fehler,
 * Korrekturen, Kosten je Analyse und je aktivem Konto, Hochrechnung und Budget
 * — nur Zahlen aus `/api/fit`, nie Mahlzeiten, Bilder oder Konten.
 *
 * Eigenes Modul wie billing.js: die Bausteine kommen von app.js herein.
 * Nur createElement, textContent und setAttribute, kein innerHTML.
 */

export function createFitUi(ui) {
  const { h, page, card, stats, createTable, reloadButton, api, fmtInt, fmtChf, fmtPct, fmtDayShort, asArray } = ui;

  const LEVELS = [
    ['green', 'Grün — direkt bestätigbar'],
    ['orange', 'Orange — Mengen prüfen'],
    ['red', 'Rot — selbst bestätigen'],
  ];
  const STATUS = { open: 'offen', confirmed: 'bestätigt', cancelled: 'verworfen', failed: 'gescheitert', label: 'Nährwerttabelle' };

  function budgetCard(budget) {
    if (!budget) return card({ title: 'Budget', note: 'Nur für den laufenden Monat.' });
    const tone = budget.state === 'exhausted' ? 'danger' : budget.state === 'warn' ? 'warn' : null;
    const note =
      budget.state === 'exhausted'
        ? 'Aufgebraucht: bezahlte Analysen stehen still, Eintragen von Hand geht weiter.'
        : budget.state === 'warn'
          ? 'Über 80 % des Monatsbudgets — Kostenalarm.'
          : 'Im Rahmen.';
    return card(
      { title: 'Monatsbudget KI (MONTHLY_AI_BUDGET_CHF)', note },
      stats([
        ['Verbraucht', fmtChf(budget.spentChf), tone],
        ['Budget', fmtChf(budget.limitChf)],
        ['Anteil', fmtPct(budget.share), tone],
      ]),
    );
  }

  function content(data) {
    const analyses = data?.analyses ?? {};
    const costs = data?.costs ?? {};
    const total = analyses.total ?? 0;
    const levels = analyses.byLevel ?? {};
    const levelSum = LEVELS.reduce((sum, [key]) => sum + (levels[key] ?? 0), 0);

    const perDay = createTable({
      caption: 'Analysen pro Tag',
      columns: [
        { key: 'day', label: 'Tag', sortValue: (row) => row.day, render: (row) => fmtDayShort(row.day) },
        { key: 'count', label: 'Analysen', type: 'num', sortValue: (row) => row.count, render: (row) => fmtInt(row.count) },
      ],
      sort: { key: 'day', dir: 'desc' },
      emptyText: 'In diesem Monat keine Analysen.',
    });
    perDay.setRows(Object.entries(analyses.perDay ?? {}).map(([day, count]) => ({ day, count })));

    const byKind = createTable({
      caption: 'Kosten nach Art und Modell',
      columns: [
        { key: 'name', label: 'Art / Modell', sortValue: (row) => row.name, render: (row) => row.name },
        { key: 'chf', label: 'Kosten', type: 'num', sortValue: (row) => row.chf, render: (row) => fmtChf(row.chf) },
      ],
      sort: { key: 'chf', dir: 'desc' },
      emptyText: 'Keine Kosten in diesem Monat.',
    });
    byKind.setRows([
      ...Object.entries(costs.byKind ?? {}).map(([name, chf]) => ({ name, chf })),
      ...Object.entries(costs.byModel ?? {}).map(([name, chf]) => ({ name: `Modell ${name}`, chf })),
    ]);

    return [
      card(
        { title: 'Foto-Analysen', note: `Anbieter: ${Object.entries(analyses.byProvider ?? {}).map(([key, count]) => `${key} ${count}`).join(' · ') || '—'}` },
        stats([
          ['Analysen', fmtInt(total)],
          ['Bestätigt', fmtInt(analyses.confirmed ?? 0)],
          ['Fehlerquote', fmtPct(analyses.failedShare ?? 0), (analyses.failedShare ?? 0) > 0.1 ? 'warn' : null],
          ['Korrekturen je Bestätigung', String(analyses.correctionsPerConfirmed ?? 0)],
          ['Ø Abweichung KI → bestätigt', `${fmtInt(analyses.gramsDeltaPerConfirmed ?? 0)} g`],
          ['Aktive Konten', fmtInt(data?.activeUsers ?? 0)],
        ]),
        h(
          'ul',
          { class: 'list' },
          LEVELS.map(([key, label]) => h('li', { text: `${label}: ${fmtInt(levels[key] ?? 0)} (${fmtPct(levelSum > 0 ? (levels[key] ?? 0) / levelSum : 0)})` })),
          Object.entries(analyses.byStatus ?? {}).map(([key, count]) => h('li', { text: `${STATUS[key] ?? key}: ${fmtInt(count)}` })),
        ),
      ),
      card(
        { title: 'Kosten' },
        stats([
          ['Total', fmtChf(costs.chf ?? 0)],
          ['Je Analyse', fmtChf(costs.perAnalysisChf ?? 0)],
          ['Je aktivem Konto', fmtChf(costs.perActiveUserChf ?? 0)],
          ['Hochrechnung Monat', fmtChf(costs.projectedMonthChf ?? 0)],
          ['Aufrufe', fmtInt(costs.calls ?? 0)],
          ['Gescheitert', fmtInt(costs.failedCalls ?? 0)],
        ]),
        byKind.el,
      ),
      budgetCard(data?.budget ?? null),
      card({ title: 'Verlauf' }, perDay.el),
    ];
  }

  async function renderFit(ctx) {
    const month = ctx.route.query.get('month');
    const data = await api(`/api/fit${month ? `?month=${encodeURIComponent(month)}` : ''}`);
    if (data?.available === false) {
      return page({ title: 'Better Fit', subtitle: 'Der Dienst läuft ohne Better Fit.' });
    }
    return page(
      { title: 'Better Fit', subtitle: `Foto-Analysen und KI-Kosten im ${data.month}. Nur Zahlen — keine Mahlzeiten, Bilder oder Konten.`, actions: [reloadButton(ctx.reload)] },
      content(data),
    );
  }

  return { renderFit, asArray };
}
