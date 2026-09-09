import { COMMANDS, type AppCommand } from '@/app/bridge';

/**
 * Aus einem Satz einen Auftrag machen. Das ist kein Sprachmodell, sondern eine
 * Handvoll Muster — genug, damit der Weg von GetBetter zu den anderen Apps
 * sichtbar wird. Was nicht passt, bleibt liegen, statt geraten zu werden.
 */
export type Routed = { command: AppCommand; subject: string };

const SHOPPING = /(einkaufsliste|einkaufen|einkauf|besorgen|kaufen)/i;
const CHORE = /(ämtli|aemtli|putzplan|hausarbeit)/i;

/** Fuellwoerter am Rand, die im Eintrag nichts verloren haben. */
const TRIM =
  /^(?:bitte\s+|kannst du\s+|könntest du\s+|kannst du mir\s+|schreib(?:e)?\s+|pack(?:e)?\s+|setz(?:e)?\s+|tu(?:e)?\s+|mach(?:e)?\s+|füg(?:e)?\s+|nimm\s+)+/i;
const TAIL =
  /\s*(?:auf|in|zu)\s+(?:die|den|das|meine|meinen|unsere|unseren)?\s*(?:einkaufsliste|liste|ämtli|aemtli|putzplan)\s*(?:hinzu|drauf|dazu)?\s*[.!]?$/i;

function subjectOf(text: string): string {
  return text
    .replace(TAIL, '')
    .replace(TRIM, '')
    .trim()
    .replace(/^(mir|uns)\s+/i, '');
}

export function route(text: string): Routed | null {
  const clean = text.trim();
  if (clean.length === 0) return null;

  if (SHOPPING.test(clean)) {
    const subject = subjectOf(clean);
    if (subject.length === 0) return null;
    return { command: COMMANDS.shoppingAdd(subject), subject };
  }

  if (CHORE.test(clean)) {
    const subject = subjectOf(clean);
    if (subject.length === 0) return null;
    return { command: COMMANDS.choreAdd(subject), subject };
  }

  return null;
}
