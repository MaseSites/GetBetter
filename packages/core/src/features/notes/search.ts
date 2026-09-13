import type { NoteBlock } from '../../db/types';
import { tagsOfNote } from './tags';

/**
 * Suche in Notizen: Titel, Text und Tags, ohne Gross und Klein. Treffer im
 * Text zeigen die Fundstelle; im Editor springt man von Stelle zu Stelle.
 */

/** So viele Zeichen stehen hoechstens vor dem Suchwort in der Vorschau. */
const SNIPPET_BEFORE = 24;

export type Snippet = {
  before: string;
  match: string;
  after: string;
  /** Vorne abgeschnitten — die Oberflaeche setzt „…“ davor. */
  cut: boolean;
};

export type NoteMatch = { field: 'title' | 'body' | 'tag'; snippet: Snippet | null };

function lower(text: string): string {
  return text.toLocaleLowerCase();
}

/** Alle Stellen eines Suchworts, ohne Ueberlappung. */
export function indexesOf(text: string, query: string): number[] {
  const needle = lower(query);
  if (needle.length === 0) return [];
  const haystack = lower(text);
  const found: number[] = [];
  let from = haystack.indexOf(needle);
  while (from >= 0) {
    found.push(from);
    from = haystack.indexOf(needle, from + needle.length);
  }
  return found;
}

/** Die Zeile um eine Fundstelle, vorne gekuerzt an einer Wortgrenze. */
export function snippetAt(text: string, start: number, length: number): Snippet {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const lineEndRaw = text.indexOf('\n', start + length);
  const lineEnd = lineEndRaw < 0 ? text.length : lineEndRaw;

  let from = Math.max(lineStart, start - SNIPPET_BEFORE);
  if (from > lineStart) {
    const space = text.indexOf(' ', from);
    from = space >= 0 && space < start ? space + 1 : from;
  }
  return {
    before: text.slice(from, start),
    match: text.slice(start, start + length),
    after: text.slice(start + length, lineEnd),
    cut: from > lineStart,
  };
}

function snippetOf(text: string, query: string): Snippet | null {
  const [first] = indexesOf(text, query);
  return first === undefined ? null : snippetAt(text, first, query.length);
}

/**
 * Ob und wo eine Notiz passt. `#rez` sucht nur Tags (auch angefangene),
 * sonst zaehlen Titel, Text und Tags.
 */
export function matchNote(
  note: { title: string; body: string },
  rawQuery: string,
): NoteMatch | null {
  const query = rawQuery.trim();
  if (query.length === 0) return null;

  if (query.startsWith('#')) {
    const wanted = lower(query.slice(1));
    const tag = tagsOfNote(note).find((candidate) => candidate.startsWith(wanted));
    if (!tag) return null;
    return { field: 'tag', snippet: snippetOf(note.body, `#${tag}`) };
  }

  const bodySnippet = snippetOf(note.body, query);
  if (indexesOf(note.title, query).length > 0) return { field: 'title', snippet: bodySnippet };
  if (bodySnippet) return { field: 'body', snippet: bodySnippet };
  const wanted = lower(query);
  if (tagsOfNote(note).includes(wanted)) return { field: 'tag', snippet: null };
  return null;
}

/** Ein Stueck Text zwischen den Fundstellen: markiert, die aktuelle, oder schlicht. */
export type Segment = { text: string; mark: 'none' | 'hit' | 'current' };

/** Zerlegt einen Text an seinen Fundstellen, damit die Oberflaeche sie hervorheben kann. */
export function segmentsOf(
  text: string,
  hits: readonly { start: number; length: number; current: boolean }[],
): Segment[] {
  const ordered = [...hits].sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let position = 0;
  for (const hit of ordered) {
    if (hit.start < position || hit.length <= 0) continue;
    if (hit.start > position)
      segments.push({ text: text.slice(position, hit.start), mark: 'none' });
    segments.push({
      text: text.slice(hit.start, hit.start + hit.length),
      mark: hit.current ? 'current' : 'hit',
    });
    position = hit.start + hit.length;
  }
  if (position < text.length) segments.push({ text: text.slice(position), mark: 'none' });
  return segments;
}

/** Eine Fundstelle im Editor. */
export type TextHit = { blockId: string; start: number; length: number };

export function findHits(blocks: readonly NoteBlock[], rawQuery: string): TextHit[] {
  const query = rawQuery.trim();
  if (query.length === 0) return [];
  return blocks
    .filter((block) => block.kind !== 'image')
    .flatMap((block) =>
      indexesOf(block.text, query).map((start) => ({
        blockId: block.id,
        start,
        length: query.length,
      })),
    );
}
