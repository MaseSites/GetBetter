/**
 * Die Auswertung fuer den Admin (Masterplan §25): Analysen je Tag, Ampel,
 * Fehlerquote, Korrekturen, Kosten je Analyse und je aktivem Konto,
 * Hochrechnung auf den Monat und das Budget. Nur Zahlen — keine Konto-Ids,
 * keine Mahlzeiten, keine Bilder.
 */

const monthOf = (iso) => String(iso ?? '').slice(0, 7);

async function fitStats({ store, usage, now = () => new Date() }, requestedMonth) {
  const month = /^\d{4}-\d{2}$/.test(String(requestedMonth ?? '')) ? requestedMonth : now().toISOString().slice(0, 7);

  const analyses = await store.fold(
    'mealAnalyses',
    (acc, row) => {
      if (monthOf(row.createdAt) !== month) return acc;
      acc.total += 1;
      acc.byStatus[row.status] = (acc.byStatus[row.status] ?? 0) + 1;
      if (row.result?.level) acc.byLevel[row.result.level] = (acc.byLevel[row.result.level] ?? 0) + 1;
      acc.byProvider[row.provider ?? 'unknown'] = (acc.byProvider[row.provider ?? 'unknown'] ?? 0) + 1;
      const day = String(row.createdAt).slice(0, 10);
      acc.perDay[day] = (acc.perDay[day] ?? 0) + 1;
      if (row.status === 'confirmed') {
        acc.confirmed += 1;
        acc.corrections += row.corrections ?? 0;
        acc.gramsDelta += row.gramsDelta ?? 0;
      }
      acc.owners.add(row.ownerId);
      return acc;
    },
    { total: 0, confirmed: 0, corrections: 0, gramsDelta: 0, byStatus: {}, byLevel: {}, byProvider: {}, perDay: {}, owners: new Set() },
  );

  const costs = await store.fold(
    'usageLedger',
    (acc, row) => {
      if (monthOf(row.at) !== month) return acc;
      acc.chf += Number(row.costChf) || 0;
      acc.calls += 1;
      if (row.ok === false) acc.failed += 1;
      acc.byKind[row.kind] = Math.round(((acc.byKind[row.kind] ?? 0) + (Number(row.costChf) || 0)) * 1e6) / 1e6;
      acc.byModel[row.model ?? 'unknown'] = Math.round(((acc.byModel[row.model ?? 'unknown'] ?? 0) + (Number(row.costChf) || 0)) * 1e6) / 1e6;
      acc.owners.add(row.ownerId);
      return acc;
    },
    { chf: 0, calls: 0, failed: 0, byKind: {}, byModel: {}, owners: new Set() },
  );

  const activeUsers = new Set([...analyses.owners, ...costs.owners]).size;
  const today = now();
  const isCurrent = month === today.toISOString().slice(0, 7);
  const daysInMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const elapsed = isCurrent ? Math.max(1, today.getUTCDate()) : daysInMonth;
  const round = (value) => Math.round(value * 10000) / 10000;

  return {
    month,
    analyses: {
      total: analyses.total,
      confirmed: analyses.confirmed,
      byStatus: analyses.byStatus,
      byLevel: analyses.byLevel,
      byProvider: analyses.byProvider,
      perDay: analyses.perDay,
      failedShare: analyses.total > 0 ? round((analyses.byStatus.failed ?? 0) / analyses.total) : 0,
      correctionsPerConfirmed: analyses.confirmed > 0 ? round(analyses.corrections / analyses.confirmed) : 0,
      gramsDeltaPerConfirmed: analyses.confirmed > 0 ? Math.round(analyses.gramsDelta / analyses.confirmed) : 0,
    },
    costs: {
      chf: round(costs.chf),
      calls: costs.calls,
      failedCalls: costs.failed,
      byKind: costs.byKind,
      byModel: costs.byModel,
      perAnalysisChf: analyses.total > 0 ? round(costs.chf / analyses.total) : 0,
      perActiveUserChf: activeUsers > 0 ? round(costs.chf / activeUsers) : 0,
      projectedMonthChf: round((costs.chf / elapsed) * daysInMonth),
    },
    activeUsers,
    budget: isCurrent ? await usage.budget() : null,
  };
}

module.exports = { fitStats };
