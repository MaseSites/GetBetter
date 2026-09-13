import type { NoteBlock, NoteBlockKind } from '../../db/types';

/**
 * Der Blockeditor ohne Oberflaeche: jede Handlung nimmt die Bloecke und gibt
 * neue zurueck, dazu, wo der Cursor danach stehen soll. Nie wird ein Block
 * veraendert — immer kopiert.
 */

/** Tiefer als vier Stufen liest sich keine Liste mehr. */
export const MAX_INDENT = 4;

export type IdMaker = () => string;

/** Wo der Cursor nach einer Handlung steht. */
export type Focus = { id: string; cursor: number };

export type EditResult = { blocks: readonly NoteBlock[]; focus: Focus | null };

const LIST_KINDS: readonly NoteBlockKind[] = ['bullet', 'number', 'check'];

export function createBlockId(): string {
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function isListKind(kind: NoteBlockKind): boolean {
  return LIST_KINDS.includes(kind);
}

/** Einruecken geht bei Listen, Text und Zitat — nicht beim Titel, Ueberschriften und Bildern. */
export function canIndent(kind: NoteBlockKind): boolean {
  return kind !== 'title' && kind !== 'heading' && kind !== 'image';
}

/** Die erste Zeile einer Notiz ist der Titel, jede andere schlichter Text. */
function plainKindAt(index: number): NoteBlockKind {
  return index === 0 ? 'title' : 'text';
}

/** Eine neue Notiz: ein leerer Titel. */
export function emptyBlocks(nextId: IdMaker): NoteBlock[] {
  return [{ id: nextId(), kind: 'title', text: '' }];
}

/** Ob in der Notiz nichts steht — kein Zeichen und kein Bild. */
export function isBlank(blocks: readonly NoteBlock[]): boolean {
  return blocks.every((block) => block.kind !== 'image' && block.text.trim().length === 0);
}

export function wordCount(blocks: readonly NoteBlock[]): number {
  return blocks
    .filter((block) => block.kind !== 'image')
    .reduce((sum, block) => sum + block.text.split(/\s+/).filter(Boolean).length, 0);
}

/** Ein Block mit genau den Feldern, die zu seiner Art gehoeren. */
export function shapeBlock(
  base: Pick<NoteBlock, 'id' | 'text'> & Partial<NoteBlock>,
  kind: NoteBlockKind,
): NoteBlock {
  const indent = canIndent(kind) ? (base.indent ?? 0) : 0;
  return {
    id: base.id,
    kind,
    text: kind === 'image' ? '' : base.text,
    ...(kind === 'check' ? { checked: base.checked ?? false } : {}),
    ...(indent > 0 ? { indent } : {}),
    ...(kind === 'image' && base.uploadId ? { uploadId: base.uploadId } : {}),
  };
}

function replaceAt(
  blocks: readonly NoteBlock[],
  index: number,
  ...items: readonly NoteBlock[]
): NoteBlock[] {
  return [...blocks.slice(0, index), ...items, ...blocks.slice(index + 1)];
}

function indexOfId(blocks: readonly NoteBlock[], id: string): number {
  return blocks.findIndex((block) => block.id === id);
}

/** Enter in einer Liste fuehrt die Liste fort; nach Titel und Ueberschrift kommt Text. */
function continuationKind(kind: NoteBlockKind): NoteBlockKind {
  if (isListKind(kind) || kind === 'quote') return kind;
  return 'text';
}

type Shortcut = { kind: NoteBlockKind; rest: string; checked?: boolean };

const SHORTCUTS: readonly { pattern: RegExp; make: (match: RegExpExecArray) => Shortcut }[] = [
  {
    pattern: /^\[( |x|X)?\] /,
    make: (match) => ({
      kind: 'check',
      rest: '',
      checked: (match[1] ?? '').toLowerCase() === 'x',
    }),
  },
  { pattern: /^[-*•] /, make: () => ({ kind: 'bullet', rest: '' }) },
  { pattern: /^\d+[.)] /, make: () => ({ kind: 'number', rest: '' }) },
  { pattern: /^#{1,3} /, make: () => ({ kind: 'heading', rest: '' }) },
  { pattern: /^> /, make: () => ({ kind: 'quote', rest: '' }) },
];

/**
 * Kuerzel am Anfang eines Blocks: „- “ Liste, „1. “ nummeriert, „[] “
 * Checkliste, „# “ Ueberschrift, „> “ Zitat. Nur, wenn das Kuerzel gerade
 * getippt wurde — ein Text, der schon so anfing, bleibt, wie er ist.
 */
export function detectShortcut(previous: string, next: string): Shortcut | null {
  for (const { pattern, make } of SHORTCUTS) {
    const match = pattern.exec(next);
    if (!match || pattern.test(previous)) continue;
    return { ...make(match), rest: next.slice(match[0].length) };
  }
  return null;
}

function commonPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let length = 0;
  while (length < limit && a[length] === b[length]) length += 1;
  return length;
}

function commonSuffixLength(a: string, b: string, limit: number): number {
  let length = 0;
  while (length < limit && a[a.length - 1 - length] === b[b.length - 1 - length]) length += 1;
  return length;
}

/**
 * Neuer Text fuer einen Block. Enthaelt er Zeilenumbrueche — Enter oder
 * Eingefuegtes —, wird daraus je Zeile ein Block. Enter in einem leeren
 * Listenpunkt beendet die Liste.
 */
export function applyText(
  blocks: readonly NoteBlock[],
  id: string,
  nextText: string,
  nextId: IdMaker,
): EditResult {
  const index = indexOfId(blocks, id);
  const block = blocks[index];
  if (!block || block.kind === 'image') return { blocks, focus: null };

  const [first = '', ...rest] = nextText.split(/\r?\n/);

  if (rest.length === 0) {
    const shortcut = detectShortcut(block.text, first);
    if (shortcut && block.kind !== shortcut.kind) {
      const shaped = shapeBlock(
        { ...block, text: shortcut.rest, checked: shortcut.checked },
        shortcut.kind,
      );
      return { blocks: replaceAt(blocks, index, shaped), focus: { id: block.id, cursor: 0 } };
    }
    return { blocks: replaceAt(blocks, index, { ...block, text: first }), focus: null };
  }

  const leavesList =
    (isListKind(block.kind) || block.kind === 'quote') &&
    block.text === '' &&
    first === '' &&
    rest.length === 1 &&
    rest[0] === '';
  if (leavesList) {
    const plain = shapeBlock({ id: block.id, text: '' }, plainKindAt(index));
    return { blocks: replaceAt(blocks, index, plain), focus: { id: block.id, cursor: 0 } };
  }

  const kind = continuationKind(block.kind);
  const tail = rest.map((text) =>
    shapeBlock({ id: nextId(), text, indent: block.indent, checked: false }, kind),
  );
  const last = tail[tail.length - 1];
  if (!last) return { blocks, focus: null };

  // Was hinter dem Cursor stand, steht jetzt am Ende der letzten Zeile.
  const prefix = commonPrefixLength(block.text, nextText);
  const behind = commonSuffixLength(
    block.text,
    nextText,
    Math.min(block.text.length, nextText.length) - prefix,
  );
  const cursor = Math.max(0, last.text.length - behind);

  return {
    blocks: replaceAt(blocks, index, { ...block, text: first }, ...tail),
    focus: { id: last.id, cursor },
  };
}

/**
 * Backspace am Anfang eines Blocks: erst ausruecken, dann die Art aufgeben,
 * zuletzt mit dem Block davor verbinden.
 */
export function backspaceAtStart(blocks: readonly NoteBlock[], id: string): EditResult {
  const index = indexOfId(blocks, id);
  const block = blocks[index];
  if (!block || block.kind === 'image') return { blocks, focus: null };

  const indent = block.indent ?? 0;
  if (indent > 0) {
    const outdented = shapeBlock({ ...block, indent: indent - 1 }, block.kind);
    return { blocks: replaceAt(blocks, index, outdented), focus: { id: block.id, cursor: 0 } };
  }

  const plain = plainKindAt(index);
  if (block.kind !== plain) {
    const converted = shapeBlock({ id: block.id, text: block.text }, plain);
    return { blocks: replaceAt(blocks, index, converted), focus: { id: block.id, cursor: 0 } };
  }

  const previous = blocks[index - 1];
  if (!previous) return { blocks, focus: null };

  if (previous.kind === 'image') {
    // Ein Bild verschwindet nicht mit Backspace — nur die leere Zeile darunter.
    const above = blocks
      .slice(0, index - 1)
      .map((candidate, position) => ({ candidate, position }))
      .reverse()
      .find(({ candidate }) => candidate.kind !== 'image');
    if (block.text !== '' || !above) return { blocks, focus: null };
    return {
      blocks: [...blocks.slice(0, index), ...blocks.slice(index + 1)],
      focus: { id: above.candidate.id, cursor: above.candidate.text.length },
    };
  }

  const merged = { ...previous, text: previous.text + block.text };
  return {
    blocks: [...blocks.slice(0, index - 1), merged, ...blocks.slice(index + 1)],
    focus: { id: previous.id, cursor: previous.text.length },
  };
}

/** Eine Art fuer den Block setzen. Nochmals dieselbe Art heisst: zurueck zu Text. */
export function toggleKind(
  blocks: readonly NoteBlock[],
  id: string,
  kind: NoteBlockKind,
): readonly NoteBlock[] {
  const index = indexOfId(blocks, id);
  const block = blocks[index];
  if (!block || block.kind === 'image' || kind === 'image') return blocks;
  const target = block.kind === kind && kind !== plainKindAt(index) ? plainKindAt(index) : kind;
  return replaceAt(blocks, index, shapeBlock(block, target));
}

export function setKind(
  blocks: readonly NoteBlock[],
  id: string,
  kind: NoteBlockKind,
): readonly NoteBlock[] {
  const index = indexOfId(blocks, id);
  const block = blocks[index];
  if (!block || block.kind === 'image' || kind === 'image' || block.kind === kind) return blocks;
  return replaceAt(blocks, index, shapeBlock(block, kind));
}

export function indentBlock(
  blocks: readonly NoteBlock[],
  id: string,
  delta: number,
): readonly NoteBlock[] {
  const index = indexOfId(blocks, id);
  const block = blocks[index];
  if (!block || !canIndent(block.kind)) return blocks;
  const indent = Math.min(MAX_INDENT, Math.max(0, (block.indent ?? 0) + delta));
  if (indent === (block.indent ?? 0)) return blocks;
  return replaceAt(blocks, index, shapeBlock({ ...block, indent }, block.kind));
}

export function toggleChecked(blocks: readonly NoteBlock[], id: string): readonly NoteBlock[] {
  const index = indexOfId(blocks, id);
  const block = blocks[index];
  if (!block || block.kind !== 'check') return blocks;
  return replaceAt(blocks, index, { ...block, checked: !block.checked });
}

/**
 * Ein Bild hinter dem Block `afterId` (oder am Ende). Steht es dann zuletzt,
 * folgt eine leere Zeile, damit man darunter weiterschreiben kann.
 */
export function insertImage(
  blocks: readonly NoteBlock[],
  afterId: string | null,
  uploadId: string,
  nextId: IdMaker,
): readonly NoteBlock[] {
  const found = afterId ? indexOfId(blocks, afterId) : -1;
  const at = found >= 0 ? found + 1 : blocks.length;
  const image: NoteBlock = { id: nextId(), kind: 'image', text: '', uploadId };
  const needsLine = at >= blocks.length;
  const line = needsLine ? [shapeBlock({ id: nextId(), text: '' }, 'text')] : [];
  return [...blocks.slice(0, at), image, ...line, ...blocks.slice(at)];
}

export function removeBlock(blocks: readonly NoteBlock[], id: string): readonly NoteBlock[] {
  const next = blocks.filter((block) => block.id !== id);
  return next.length > 0 ? next : blocks.length > 0 ? [shapeBlock({ id, text: '' }, 'title')] : [];
}

/** Die Nummer eines nummerierten Punkts: gezaehlt ab dem Beginn seiner Liste, je Stufe. */
export function listNumber(blocks: readonly NoteBlock[], index: number): number {
  const block = blocks[index];
  if (!block || block.kind !== 'number') return 0;
  const indent = block.indent ?? 0;
  let count = 1;
  for (let position = index - 1; position >= 0; position -= 1) {
    const candidate = blocks[position];
    if (!candidate) break;
    const candidateIndent = candidate.indent ?? 0;
    if (candidate.kind === 'number' && candidateIndent === indent) {
      count += 1;
    } else if (!(isListKind(candidate.kind) && candidateIndent > indent)) {
      break;
    }
  }
  return count;
}

/** Haengt `#tag` an die Notiz — an die letzte Textzeile oder als neue Zeile. */
export function appendTag(
  blocks: readonly NoteBlock[],
  tag: string,
  nextId: IdMaker,
): readonly NoteBlock[] {
  const word = `#${tag}`;
  const lastIndex = blocks.length - 1;
  const last = blocks[lastIndex];
  if (last && last.kind === 'text') {
    const text = last.text.trim().length === 0 ? word : `${last.text.trimEnd()} ${word}`;
    return replaceAt(blocks, lastIndex, { ...last, text });
  }
  return [...blocks, shapeBlock({ id: nextId(), text: word }, 'text')];
}
