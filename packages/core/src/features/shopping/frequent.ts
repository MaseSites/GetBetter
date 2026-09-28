/**
 * Oft gekauft — die Vorschläge über dem Feld, rein gerechnet (`frequent.test.ts`).
 *
 * Gezählt wird über die ganze Geschichte der Liste: offene, erledigte und
 * weggeräumte Zeilen (`clearedAt`, siehe `shopping.clearDone`). Jüngeres zählt
 * mehr — ein Kauf verliert alle 60 Tage die Hälfte seines Gewichts —, damit
 * das Sommer-Glacé im Winter nicht mehr oben steht. Was gerade offen ist,
 * fehlt: das steht ja schon drauf.
 */

import { itemKey } from './merge';

export type HistoryItem = {
  name: string;
  done: boolean;
  createdAt: string;
  clearedAt?: string | null;
};

export const FREQUENT_LIMIT = 12;
const HALF_LIFE_DAYS = 60;
const DAY_MS = 86_400_000;

export function frequentItems(
  history: readonly HistoryItem[],
  now: Date,
  limit: number = FREQUENT_LIMIT,
): string[] {
  const open = new Set(
    history.filter((row) => !row.done && !row.clearedAt).map((row) => itemKey(row.name)),
  );
  const scores = new Map<string, { score: number; name: string; latest: string }>();
  for (const row of history) {
    const key = itemKey(row.name);
    if (key.length === 0 || open.has(key)) continue;
    const at = Date.parse(row.createdAt);
    const ageDays = Number.isFinite(at) ? Math.max(0, (now.getTime() - at) / DAY_MS) : 0;
    const weight = 0.5 ** (ageDays / HALF_LIFE_DAYS);
    const entry = scores.get(key);
    if (!entry) {
      scores.set(key, { score: weight, name: row.name.trim(), latest: row.createdAt });
      continue;
    }
    // Der Name, wie er zuletzt geschrieben wurde.
    const newer = row.createdAt > entry.latest;
    scores.set(key, {
      score: entry.score + weight,
      name: newer ? row.name.trim() : entry.name,
      latest: newer ? row.createdAt : entry.latest,
    });
  }
  return [...scores.values()]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'de-CH'))
    .slice(0, limit)
    .map((entry) => entry.name);
}
