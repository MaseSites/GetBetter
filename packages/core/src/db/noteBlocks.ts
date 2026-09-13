import type { NoteBlock, NoteRow } from './types';

/**
 * Notizen bestehen aus Bloecken. `title` und `body` bleiben daneben stehen —
 * als reiner Text fuer Suche, Vorschau und die Apps, die Bloecke nicht kennen.
 */

function hasText(block: NoteBlock): boolean {
  return block.kind !== 'image' && block.text.trim().length > 0;
}

/**
 * Der Titel ist der erste Titelblock, sonst die erste Zeile mit Text. Der Rest
 * wird zum Text, eine Zeile je Block, ohne Bilder und leere Zeilen.
 */
export function noteTextOf(blocks: readonly NoteBlock[]): { title: string; body: string } {
  const titleBlock =
    blocks.find((block) => block.kind === 'title' && hasText(block)) ?? blocks.find(hasText);
  const body = blocks
    .filter((block) => block !== titleBlock && hasText(block))
    .map((block) => block.text.trim())
    .join('\n');
  return { title: titleBlock?.text.trim() ?? '', body };
}

/**
 * Die Bloecke einer Notiz. Aeltere Zeilen haben keine — dann wird der Titel
 * zum Titelblock und jede Zeile des Textes zu einem Textblock.
 */
export function blocksOf(
  row: Pick<NoteRow, 'id' | 'title' | 'body' | 'blocks'>,
): readonly NoteBlock[] {
  if (row.blocks && row.blocks.length > 0) return row.blocks;

  const title = row.title.trim();
  const titleBlocks: NoteBlock[] = title
    ? [{ id: `${row.id}-title`, kind: 'title', text: title }]
    : [];
  const lines = row.body.length > 0 ? row.body.split('\n') : title ? [] : [''];
  const textBlocks = lines.map((line, index): NoteBlock => ({
    id: `${row.id}-${index}`,
    kind: 'text',
    text: line,
  }));
  return [...titleBlocks, ...textBlocks];
}
