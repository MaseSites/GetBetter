/**
 * Was ein Satz will — ohne App, ohne Brücke, damit es unter Node getestet
 * werden kann. Kein Sprachmodell, sondern eine Handvoll Muster: genug, damit der
 * Weg von GetBetter zu den anderen Apps sichtbar wird. Was nicht passt, bleibt
 * liegen, statt geraten zu werden.
 *
 * Die Muster kennen alle vier Sprachen der App: wer auf Englisch, Französisch
 * oder Italienisch schreibt, soll nicht an einem deutschen Wort scheitern.
 */
export type Intent = { kind: 'shopping' | 'chore'; subject: string };

const SHOPPING =
  /(einkaufsliste|einkaufen|einkauf|besorgen|kaufen|shopping|groceries|\bbuy\b|liste de courses|courses|acheter|lista della spesa|spesa|comprare)/i;
const CHORE =
  /(ämtli|aemtli|putzplan|hausarbeit|\bchores?\b|tâches ménagères|taches menageres|faccende)/i;

/** Fuellwoerter am Anfang, die im Eintrag nichts verloren haben. */
const LEADING = [
  'bitte',
  'kannst du mir',
  'kannst du',
  'könntest du',
  'schreib(?:e)?',
  'pack(?:e)?',
  'setz(?:e)?',
  'tu(?:e)?',
  'mach(?:e)?',
  'füg(?:e)?',
  'nimm',
  'please',
  'can you',
  'could you',
  'add',
  'put',
  "s[’']il te plaît",
  'peux-tu',
  'ajoute',
  'mets',
  'per favore',
  'puoi',
  'aggiungi',
  'metti',
];
const TRIM = new RegExp(`^(?:${LEADING.map((word) => `${word}\\s+`).join('|')})+`, 'i');

/** „… auf die Einkaufsliste“ am Ende — je Sprache ein Muster. */
const TAILS = [
  /\s*(?:auf|in|zu)\s+(?:die|den|das|meine|meinen|unsere|unseren)?\s*(?:einkaufsliste|liste|ämtli|aemtli|putzplan)\s*(?:hinzu|drauf|dazu|setzen|schreiben|packen|tun|hinzufügen)?\s*[.!?]?$/i,
  /\s*(?:to|on|onto)\s+(?:the\s+|my\s+|our\s+)?(?:shopping\s+list|list|chores?)\s*[.!]?$/i,
  /\s*(?:sur|à|dans)\s+(?:la\s+|ma\s+|notre\s+|les\s+|mes\s+|nos\s+)?(?:liste\s+de\s+courses|liste|tâches\s+ménagères|taches\s+menageres)\s*[.!]?$/i,
  /\s*(?:nella|sulla|alla|nelle|alle|in)\s+(?:mia\s+|nostra\s+)?(?:lista\s+della\s+spesa|lista|faccende)\s*[.!]?$/i,
];

function subjectOf(text: string): string {
  const withoutTail = TAILS.reduce((rest, tail) => rest.replace(tail, ''), text);
  return withoutTail
    .replace(TRIM, '')
    .trim()
    .replace(/^(mir|uns)\s+/i, '');
}

export function intentOf(text: string): Intent | null {
  const clean = text.trim();
  if (clean.length === 0) return null;

  const kind = SHOPPING.test(clean) ? 'shopping' : CHORE.test(clean) ? 'chore' : null;
  if (kind === null) return null;

  const subject = subjectOf(clean);
  return subject.length > 0 ? { kind, subject } : null;
}
