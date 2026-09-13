/** Die letzten Suchen eines Kontos — ohne Speicher, damit es sich rechnen laesst. */

/** So viele stehen unter „Zuletzt gesucht“. */
export const RECENT_LIMIT = 3;

/** Je Konto ein eigener Eintrag: wer sich abmeldet, nimmt seine Suchen nicht mit. */
export function recentStorageKey(accountId: string): string {
  return `better-life/search-recent/v1/${accountId}`;
}

/**
 * Legt eine Suche nach vorn. Gross und klein zaehlen gleich, doppelt steht sie
 * nie da, und Leeres wird nicht gemerkt.
 */
export function rememberQuery(
  list: readonly string[],
  query: string,
  limit: number = RECENT_LIMIT,
): readonly string[] {
  const text = query.trim();
  if (text.length === 0) return list;
  const lower = text.toLocaleLowerCase('de-CH');
  const rest = list.filter((entry) => entry.toLocaleLowerCase('de-CH') !== lower);
  return [text, ...rest].slice(0, limit);
}

/** Was im Speicher steht, als Liste — alles andere als Texte faellt weg. */
export function parseRecent(raw: string | null, limit: number = RECENT_LIMIT): readonly string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      .slice(0, limit);
  } catch {
    return [];
  }
}
