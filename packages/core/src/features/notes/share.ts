import type { NoteBlock } from '../../db/types';
import { listNumber } from './blocks';

/** Zwei Leerzeichen je Stufe, wie in Markdown. */
const INDENT = '  ';

/**
 * Eine Notiz als reiner Text zum Teilen, nah an Markdown: Ueberschriften mit
 * `#`, Listen mit `-` und `1.`, Checklisten mit `[ ]` und `[x]`, Zitate mit
 * `>`. Der Titel steht schlicht in der ersten Zeile; Bilder fallen weg.
 */
export function noteToText(blocks: readonly NoteBlock[]): string {
  const lines = blocks.flatMap((block, index): string[] => {
    const pad = INDENT.repeat(block.indent ?? 0);
    switch (block.kind) {
      case 'image':
        return [];
      case 'heading':
        return [`# ${block.text}`];
      case 'bullet':
        return [`${pad}- ${block.text}`];
      case 'number':
        return [`${pad}${listNumber(blocks, index)}. ${block.text}`];
      case 'check':
        return [`${pad}[${block.checked ? 'x' : ' '}] ${block.text}`];
      case 'quote':
        return [`${pad}> ${block.text}`];
      default:
        return [`${pad}${block.text}`];
    }
  });

  const first = lines.findIndex((line) => line.trim().length > 0);
  if (first < 0) return '';
  const last = lines.length - 1 - [...lines].reverse().findIndex((line) => line.trim().length > 0);
  return lines
    .slice(first, last + 1)
    .map((line) => line.trimEnd())
    .join('\n');
}
