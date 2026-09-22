/**
 * Obergrenzen je Konto, damit `fit.json` nicht ohne Ende waechst. Laeuft
 * nach jeder Transaktion auf dem Entwurf (`store.js`), bevor er gespeichert wird.
 *
 * - `coachMessages`: die letzten 200 je Konto
 * - `coachActions`: 200 je Konto; zuerst fallen die aeltesten, die nicht mehr
 *   offen sind — ein offener Vorschlag bleibt immer
 * - `mealAnalyses`: die Zahlen bleiben (Auswertung, Tageslimit), die Rohdaten
 *   der KI (`vision`) fallen nach 30 Tagen weg
 * - `usageLedger`: Zeilen aelter als 400 Tage fallen weg (Budget und Kosten
 *   brauchen nur Monate), hoechstens 5000 je Konto
 * - `foodCache`: abgelaufene Zeilen fallen weg — auch „Barcode unbekannt“
 */
const DAY_MS = 24 * 60 * 60 * 1000;

const LIMITS = {
  coachMessages: 200,
  coachActions: 200,
  usageLedger: 5000,
  visionDays: 30,
  ledgerDays: 400,
};

const timeOf = (row, field) => {
  const value = Date.parse(row?.[field] ?? '');
  return Number.isNaN(value) ? 0 : value;
};

/** Behaelt je Konto hoechstens `max` Zeilen; `droppable` sagt, welche zuerst gehen duerfen. */
function capPerOwner(rows, max, field, droppable = () => true) {
  const byOwner = new Map();
  for (const row of rows) byOwner.set(row.ownerId, (byOwner.get(row.ownerId) ?? 0) + 1);
  if (![...byOwner.values()].some((count) => count > max)) return rows;
  const drop = new Set();
  for (const [owner, count] of byOwner) {
    if (count <= max) continue;
    const candidates = rows
      .filter((row) => row.ownerId === owner && droppable(row))
      .sort((a, b) => timeOf(a, field) - timeOf(b, field));
    for (const row of candidates.slice(0, count - max)) drop.add(row);
  }
  return rows.filter((row) => !drop.has(row));
}

/** Wendet alle Grenzen auf die Tabellen an (veraendert `tables`), gibt sie zurueck. */
function applyRetention(tables, nowMs = Date.now(), limits = LIMITS) {
  if (Array.isArray(tables.coachMessages)) tables.coachMessages = capPerOwner(tables.coachMessages, limits.coachMessages, 'createdAt');
  if (Array.isArray(tables.coachActions)) {
    tables.coachActions = capPerOwner(tables.coachActions, limits.coachActions, 'createdAt', (row) => row.status !== 'proposed');
  }
  if (Array.isArray(tables.mealAnalyses)) {
    const visionBefore = nowMs - limits.visionDays * DAY_MS;
    tables.mealAnalyses = tables.mealAnalyses.map((row) => {
      if (row.vision === undefined || timeOf(row, 'createdAt') >= visionBefore) return row;
      const { vision: _vision, ...rest } = row;
      return rest;
    });
  }
  if (Array.isArray(tables.usageLedger)) {
    const ledgerBefore = nowMs - limits.ledgerDays * DAY_MS;
    const recent = tables.usageLedger.filter((row) => timeOf(row, 'at') >= ledgerBefore);
    tables.usageLedger = capPerOwner(recent, limits.usageLedger, 'at');
  }
  if (Array.isArray(tables.foodCache)) {
    tables.foodCache = tables.foodCache.filter((row) => !(typeof row.expiresAt === 'number' && row.expiresAt <= nowMs));
  }
  return tables;
}

module.exports = { applyRetention, capPerOwner, RETENTION_LIMITS: LIMITS };
