/**
 * Was vom Modell zurueckkommt, bevor es eine App sieht: ohne Denktext, nicht
 * laenger als erlaubt, und fuers Vorlesen ohne Zeichen, Listen, Links und Emojis.
 */

const HARMONY_FINAL = '<|channel|>final<|message|>';
const THINK_BLOCK = /<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi;
const THINK_CLOSE = /<\/(think|thinking|reasoning)>/gi;
const THINK_OPEN = /<(think|thinking|reasoning)>/i;
const SPECIAL_TOKEN = /<\|[a-z_]+\|>/gi;

const TERMINATORS = new Set(['.', '!', '?', '…']);
const CLOSERS = new Set(['"', "'", '“', '”', '’', '»', ')', ']']);
const EMOJI = /\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|‍|️|⃣/gu;
const LIST_MARKER = /^([-*+•]|\d+[.)])\s+/;
const HEADING = /^#{1,6}\s+/;
const RULE = /^([-*_]\s*){3,}$/;

/**
 * Entfernt, was ein Denkmodell vor die Antwort stellt: `<think>…</think>`,
 * einen Denkteil ohne oeffnendes Tag, einen nie geschlossenen und die
 * Kanalmarken von gpt-oss, falls sie durchrutschen.
 */
function stripReasoning(raw) {
  let text = typeof raw === 'string' ? raw : '';
  const final = text.lastIndexOf(HARMONY_FINAL);
  if (final !== -1) text = text.slice(final + HARMONY_FINAL.length);
  text = text.replace(THINK_BLOCK, '');
  const lastClose = [...text.matchAll(THINK_CLOSE)].at(-1);
  if (lastClose) text = text.slice(lastClose.index + lastClose[0].length);
  const open = text.search(THINK_OPEN);
  if (open !== -1) text = text.slice(0, open);
  return text.replace(SPECIAL_TOKEN, '').trim();
}

/** Endet bei `end` (exklusiv) ein Satz? „1.“ vor einem Listenpunkt zaehlt nicht. */
function isSentenceEnd(text, end) {
  const next = text[end];
  if (next !== undefined && !/\s/.test(next)) return false;
  let mark = end - 1;
  if (CLOSERS.has(text[mark]) && TERMINATORS.has(text[mark - 1])) mark -= 1;
  if (!TERMINATORS.has(text[mark])) return false;
  return !(text[mark] === '.' && /(^|\s)\d+$/.test(text.slice(0, mark)));
}

/**
 * Hoechstens `max` Zeichen: am letzten Satzende davor, sonst an einer
 * Wortgrenze mit „…“. Ein Satzende im ersten Drittel waere zu viel Verlust.
 */
function limitChars(text, max) {
  const clean = String(text ?? '').trim();
  if (clean.length <= max) return clean;
  const minimum = Math.floor(max / 3);
  for (let end = max; end > minimum; end -= 1) {
    if (isSentenceEnd(clean, end)) return clean.slice(0, end).trim();
  }
  const room = max - 1;
  const window = clean.slice(0, room + 1);
  const space = Math.max(window.lastIndexOf(' '), window.lastIndexOf('\n'));
  const cut = (space > 0 ? clean.slice(0, space) : clean.slice(0, room))
    // Ein Listenpunkt ohne Inhalt („2.“, „-“) gehoert nicht ans Ende.
    .replace(/(^|\s)(\d+[.)]|[-*+•])$/, '')
    .replace(/[\s,;:(–—-]+$/, '');
  return `${cut}…`;
}

/** Ein Satz zum Vorlesen endet mit einem Zeichen, das eine Pause macht. */
function asSentence(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length === 0) return null;
  if (/[.!?…:]$/.test(clean)) return clean;
  return `${clean.replace(/[,;]+$/, '')}.`;
}

const withoutSymbols = (line) => line.replace(/[*_`#>~|]/g, ' ');

/** Markdown in Zeilen -> gesprochene Saetze. */
function sentencesOf(lines) {
  const sentences = [];
  let paragraph = [];
  const flush = () => {
    const sentence = asSentence(withoutSymbols(paragraph.join(' ')));
    if (sentence) sentences.push(sentence);
    paragraph = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || RULE.test(trimmed)) {
      flush();
    } else if (HEADING.test(trimmed) || LIST_MARKER.test(trimmed)) {
      flush();
      const content = trimmed.replace(HEADING, '').replace(LIST_MARKER, '');
      const sentence = asSentence(withoutSymbols(content));
      if (sentence) sentences.push(sentence);
    } else {
      paragraph = [...paragraph, trimmed.replace(/^>\s?/, '')];
    }
  }
  flush();
  return sentences;
}

/** Die Fassung zum Vorlesen: ohne Markdown, Listen, Links und Emojis, hoechstens `max` Zeichen. */
function spokenText(text, max) {
  const lines = String(text ?? '')
    .replace(/```[a-z0-9_-]*/gi, '\n')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<?\b(?:https?:\/\/|www\.)[^\s>)]+>?/gi, '')
    .replace(EMOJI, '')
    .split(/\r?\n/);
  const spoken = sentencesOf(lines)
    .join(' ')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/([!?:])\./g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return limitChars(spoken, max);
}

/** Kennungen aus dem Kontext wie [T1] — die gehoeren nicht in eine Antwort. */
const REF_TAG = /[ \t]*\(?\[[A-Z]\d{1,3}\]\)?/g;
const STRONG = /(\*\*|__)(.+?)\1/g;
const EMPHASIS = /\*(\S[^*\n]*?)\*/g;

/** Die Kennungen, die im Kontext standen, auch ohne Klammern: „T1 Coiffeur“ ist „Coiffeur“. */
function bareRefs(refs) {
  const known = refs.filter((ref) => /^[A-Z]\d{1,3}$/.test(ref));
  if (known.length === 0) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${known.join('|')})(?![\\p{L}\\p{N}])[:.]?[ \\t]*`, 'gu');
}

/**
 * Fuer den Assistenten, der schlichten Text zeigt: ohne Fett, Kursiv und
 * Ueberschriften, ohne Kennungen wie [T1] — und ohne die Kennungen `refs` aus
 * dem Kontext, auch ohne Klammern. Zeilen und Aufzaehlungen bleiben.
 */
function plainText(text, refs = []) {
  const bare = bareRefs(refs);
  return text
    .split('\n')
    .map((line) => {
      const plain = line.replace(HEADING, '').replace(STRONG, '$2').replace(EMPHASIS, '$1').replace(REF_TAG, '');
      return (bare ? plain.replace(bare, '') : plain).trimEnd();
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = { limitChars, plainText, spokenText, stripReasoning };
