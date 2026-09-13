/**
 * Tags schreibt man als `#wort` in den Text — ohne Dialog. Ein Tag beginnt
 * nicht mitten in einem Wort (`C#`) oder einer Adresse (`seite.ch/#teil`)
 * und hat mindestens einen Buchstaben (`#1` ist eine Nummer, kein Tag).
 */
const TAG = /(^|[^\p{L}\p{N}_&/#])#([\p{L}\p{N}_-]+)/gu;
const HAS_LETTER = /\p{L}/u;

function normalizeTag(raw: string): string | null {
  const tag = raw.replace(/[-_]+$/u, '').toLowerCase();
  return tag.length > 0 && HAS_LETTER.test(tag) ? tag : null;
}

/** Die Tags in einem Text, klein geschrieben, jeder einmal, in der Reihenfolge des Auftretens. */
export function extractTags(text: string): string[] {
  const found = [...text.matchAll(TAG)]
    .map((match) => normalizeTag(match[2] ?? ''))
    .filter((tag): tag is string => tag !== null);
  return [...new Set(found)];
}

export function tagsOfNote(note: { title: string; body: string }): string[] {
  return extractTags(`${note.title}\n${note.body}`);
}

/** Ein getipptes Wort als Tag, ohne `#` davor — oder null, wenn es keines sein kann. */
export function cleanTag(input: string): string | null {
  return normalizeTag(input.trim().replace(/^#+/u, '').replace(/\s+/gu, '-'));
}

export type TagCount = { tag: string; count: number };

/** Alle Tags ueber viele Notizen: die haeufigsten zuerst, sonst alphabetisch. */
export function tagCounts(notes: readonly { title: string; body: string }[]): TagCount[] {
  const counts = new Map<string, number>();
  for (const note of notes) {
    for (const tag of tagsOfNote(note)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
