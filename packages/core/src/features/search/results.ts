/**
 * Die Rechnung hinter der Suche, ohne Speicher und ohne Oberflaeche: wie gut
 * ein Eintrag passt, welcher Treffer der beste ist und wie die Gruppen stehen.
 */

/** Die Gruppen in fester Reihenfolge — so steht es auch auf dem Bildschirm. */
export const SEARCH_GROUPS = [
  'tasks',
  'notes',
  'mail',
  'people',
  'places',
  // Was eine App sonst noch fuehrt (Termine, Einkauf, Rechnungen …) — ohne
  // eigene Gruppe, damit die Reihenfolge oben ruhig bleibt.
  'entries',
  'functions',
] as const;

export type SearchGroup = (typeof SEARCH_GROUPS)[number];

/** So viele Treffer zeigt eine Gruppe, bevor „Alle“ sie aufklappt. */
export const GROUP_PREVIEW = 3;

export type SearchCandidate<T> = {
  key: string;
  group: SearchGroup;
  /** Der Titel zaehlt mehr als alles andere. */
  title: string;
  /** Was sonst noch durchsucht wird: Text, Absender, Vorschau. */
  extra?: readonly (string | null | undefined)[];
  item: T;
};

export type ScoredHit<T> = SearchCandidate<T> & { score: number };

export type HitGroup<T> = {
  group: SearchGroup;
  /** Alle Treffer der Gruppe, ohne den besten Treffer ganz oben. */
  total: number;
  /** Was gezeigt wird: die ersten drei, aufgeklappt alle. */
  hits: readonly ScoredHit<T>[];
};

export type SearchResults<T> = {
  best: ScoredHit<T> | null;
  groups: readonly HitGroup<T>[];
};

const SCORE = {
  exact: 100,
  prefix: 80,
  wordPrefix: 60,
  contains: 40,
  extraWordPrefix: 25,
  extraContains: 15,
  /** Mehrere Woerter, die einzeln im Titel stehen. */
  titleTerms: 12,
  /** Mehrere Woerter, verteilt ueber Titel und Rest. */
  anyTerms: 6,
} as const;

const WORD_BREAK = /[\s\-_.,:;/()[\]«»"'’‹›“”„@]+/u;

/** Klein, ohne Akzente: „Ämtli“ findet man auch mit „amtli“. */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase('de-CH');
}

function startsAWord(haystack: string, needle: string): boolean {
  return haystack.split(WORD_BREAK).some((word) => word.startsWith(needle));
}

/**
 * Wie gut ein Eintrag zur Suche passt; 0 heisst gar nicht. Der Titel schlaegt
 * den Rest, ein Wortanfang schlaegt ein Stueck mitten im Wort.
 */
export function scoreCandidate(
  query: string,
  title: string,
  extra: readonly (string | null | undefined)[] = [],
): number {
  const needle = foldText(query.trim());
  if (needle.length === 0) return 0;

  const folded = foldText(title);
  if (folded === needle) return SCORE.exact;
  if (folded.startsWith(needle)) return SCORE.prefix;
  if (startsAWord(folded, needle)) return SCORE.wordPrefix;
  if (folded.includes(needle)) return SCORE.contains;

  const rest = extra.flatMap((value) => (value ? [foldText(value)] : []));
  if (rest.some((value) => startsAWord(value, needle))) return SCORE.extraWordPrefix;
  if (rest.some((value) => value.includes(needle))) return SCORE.extraContains;

  // „maler offerte“ findet „Offerte Maler prüfen“: jedes Wort fuer sich.
  const terms = needle.split(WORD_BREAK).filter((term) => term.length > 0);
  if (terms.length < 2) return 0;
  if (terms.every((term) => folded.includes(term))) return SCORE.titleTerms;
  const all = [folded, ...rest];
  if (terms.every((term) => all.some((value) => value.includes(term)))) return SCORE.anyTerms;
  return 0;
}

type Ranked<T> = ScoredHit<T> & { order: number; groupOrder: number };

function byRank<T>(a: Ranked<T>, b: Ranked<T>): number {
  return b.score - a.score || a.groupOrder - b.groupOrder || a.order - b.order;
}

function strip<T>({ order: _order, groupOrder: _groupOrder, ...hit }: Ranked<T>): ScoredHit<T> {
  return hit;
}

/**
 * Ordnet die Treffer: der beste ganz oben, darunter je Gruppe hoechstens drei
 * — ausser die Gruppe ist aufgeklappt. Bei gleichem Wert gilt die Reihenfolge,
 * in der die Eintraege kamen (etwa die neueste E-Mail zuerst).
 */
export function rankResults<T>(
  query: string,
  candidates: readonly SearchCandidate<T>[],
  expanded: readonly SearchGroup[] = [],
): SearchResults<T> {
  if (foldText(query.trim()).length === 0) return { best: null, groups: [] };

  const ranked = candidates
    .flatMap((candidate, order): Ranked<T>[] => {
      const score = scoreCandidate(query, candidate.title, candidate.extra);
      return score > 0
        ? [{ ...candidate, score, order, groupOrder: SEARCH_GROUPS.indexOf(candidate.group) }]
        : [];
    })
    .sort(byRank);

  const best = ranked[0];
  if (!best) return { best: null, groups: [] };

  const groups = SEARCH_GROUPS.flatMap((group): HitGroup<T>[] => {
    const members = ranked.filter((hit) => hit.group === group && hit.key !== best.key);
    if (members.length === 0) return [];
    const shown = expanded.includes(group) ? members : members.slice(0, GROUP_PREVIEW);
    return [{ group, total: members.length, hits: shown.map(strip) }];
  });

  return { best: strip(best), groups };
}
