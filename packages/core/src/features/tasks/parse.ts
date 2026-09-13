// Relative Pfade mit Absicht: so laeuft die Datei auch in den Tests unter Node.
import type { TaskPriority, TaskRepeat, TaskRepeatUnit } from '../../db/types';

import {
  addDays,
  addMonths,
  dayFromParts,
  endOfMonth,
  nextMonday,
  nextWeekday,
  startOfNextMonth,
  timeOf,
  weekdayOf,
  weekendDay,
} from './days';

/**
 * Die Satz-Eingabe: „Steuererklärung Freitag 17 Uhr !! #admin“ wird zu Titel,
 * Datum, Uhrzeit, Priorität und Tag.
 *
 * Erkannt wird nur an Wortgrenzen, und nur, was eindeutig ist. „Freitag“ kann
 * ein Nachname sein: ein Wochentag ohne „am“, „bis“ oder „nächsten“ zaehlt nur,
 * wenn nach ihm nichts mehr vom Titel kommt. „Mai“ ohne Tageszahl bleibt Text.
 */

export type TokenKind = 'date' | 'time' | 'repeat' | 'priority' | 'tag' | 'project';

export type ParsedToken = {
  kind: TokenKind;
  /** Bleibt gleich, solange dieselben Woerter dastehen — so merkt sich ✕ die Wahl. */
  key: string;
  text: string;
  start: number;
  end: number;
};

export type ParsedTask = {
  title: string;
  day: string | null;
  time: string | null;
  repeat: TaskRepeat | null;
  priority: TaskPriority;
  tags: readonly string[];
  /** Der Name, wie er im Projekt steht — nicht, wie er getippt wurde. */
  project: string | null;
  tokens: readonly ParsedToken[];
};

export type ParseOptions = {
  /** Heute als `YYYY-MM-DD`; alle relativen Angaben rechnen von hier. */
  today: string;
  /** Die bekannten Projekte; `@Name` zaehlt nur, wenn es eines davon ist. */
  projects?: readonly string[];
  /** Schluessel von Tokens, die per ✕ wieder Text sein sollen. */
  ignored?: ReadonlySet<string>;
};

type Word = { raw: string; core: string; lower: string; start: number; end: number };

type Value = {
  day?: string;
  time?: string;
  repeat?: TaskRepeat;
  priority?: TaskPriority;
  tag?: string;
  project?: string;
};

type Match = { kind: TokenKind; length: number; value: Value };

type Matcher = (words: readonly Word[], index: number, options: ParseOptions) => Match | null;

const WEEKDAYS = new Map([
  ['montag', 1],
  ['dienstag', 2],
  ['mittwoch', 3],
  ['donnerstag', 4],
  ['freitag', 5],
  ['samstag', 6],
  ['sonntag', 7],
]);

/** Abkuerzungen nur gross geschrieben — „so“ und „do“ sind sonst gewoehnliche Woerter. */
const WEEKDAY_SHORT = new Map([
  ['Mo', 1],
  ['Di', 2],
  ['Mi', 3],
  ['Do', 4],
  ['Fr', 5],
  ['Sa', 6],
  ['So', 7],
]);

const MONTHS = new Map([
  ['januar', 1],
  ['jan', 1],
  ['jänner', 1],
  ['februar', 2],
  ['feb', 2],
  ['märz', 3],
  ['mär', 3],
  ['maerz', 3],
  ['april', 4],
  ['apr', 4],
  ['mai', 5],
  ['juni', 6],
  ['jun', 6],
  ['juli', 7],
  ['jul', 7],
  ['august', 8],
  ['aug', 8],
  ['september', 9],
  ['sept', 9],
  ['sep', 9],
  ['oktober', 10],
  ['okt', 10],
  ['november', 11],
  ['nov', 11],
  ['dezember', 12],
  ['dez', 12],
]);

const NUMBER_WORDS = new Map([
  ['ein', 1],
  ['eine', 1],
  ['einem', 1],
  ['einen', 1],
  ['einer', 1],
  ['zwei', 2],
  ['drei', 3],
  ['vier', 4],
  ['fünf', 5],
  ['sechs', 6],
  ['sieben', 7],
  ['acht', 8],
  ['neun', 9],
  ['zehn', 10],
]);

const UNITS = new Map<string, TaskRepeatUnit>([
  ['tag', 'day'],
  ['tage', 'day'],
  ['tagen', 'day'],
  ['woche', 'week'],
  ['wochen', 'week'],
  ['monat', 'month'],
  ['monate', 'month'],
  ['monaten', 'month'],
  ['jahr', 'year'],
  ['jahre', 'year'],
  ['jahren', 'year'],
]);

const ADVERB_REPEATS = new Map<string, TaskRepeatUnit>([
  ['täglich', 'day'],
  ['taeglich', 'day'],
  ['wöchentlich', 'week'],
  ['woechentlich', 'week'],
  ['monatlich', 'month'],
  ['jährlich', 'year'],
  ['jaehrlich', 'year'],
]);

const EACH = new Set(['jeden', 'jede', 'jedes']);
/** Nach „jeden“ steht die Einzahl: jeden Tag, jede Woche. */
const EACH_UNITS = new Map<string, TaskRepeatUnit>([
  ['tag', 'day'],
  ['woche', 'week'],
  ['monat', 'month'],
  ['jahr', 'year'],
]);
const NEXT = new Set([
  'nächste',
  'nächsten',
  'nächster',
  'naechste',
  'naechsten',
  'kommende',
  'kommenden',
]);
const RELATIVE_DAYS = new Map([
  ['heute', 0],
  ['morgen', 1],
  ['übermorgen', 2],
  ['uebermorgen', 2],
]);
const DAY_PARTS = new Map([
  ['früh', '09:00'],
  ['frueh', '09:00'],
  ['morgen', '09:00'],
  ['mittag', '12:00'],
  ['nachmittag', '15:00'],
  ['abend', '18:00'],
]);
/** Vor „Morgen“ heissen diese Woerter: Tageszeit, nicht Datum. */
const MORNING_NOT_DATE = new Set(['am', 'guten', 'jeden', 'heute']);
const DATE_PREPOSITIONS = new Set(['am', 'bis', 'ab', 'zum', 'diesen', 'diesem']);
const WORKDAYS = [1, 2, 3, 4, 5] as const;

const TOKEN_NAME = /^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u;

function wordsOf(text: string): Word[] {
  return [...text.matchAll(/\S+/gu)].map((match) => {
    const raw = match[0];
    const start = match.index ?? 0;
    const core = raw.replace(/[,;]+$/u, '');
    return { raw, core, lower: core.toLocaleLowerCase('de'), start, end: start + raw.length };
  });
}

function lowerAt(words: readonly Word[], index: number): string {
  return words[index]?.lower ?? '';
}

function coreAt(words: readonly Word[], index: number): string {
  return words[index]?.core ?? '';
}

function weekdayOfWord(word: Word | undefined): number | null {
  if (!word) return null;
  return WEEKDAYS.get(word.lower) ?? WEEKDAY_SHORT.get(word.core.replace(/\.$/u, '')) ?? null;
}

function countOf(word: Word | undefined): number | null {
  if (!word) return null;
  if (/^\d{1,3}$/u.test(word.core)) {
    const count = Number(word.core);
    return count > 0 ? count : null;
  }
  return NUMBER_WORDS.get(word.lower) ?? null;
}

function repeatOf(unit: TaskRepeatUnit, every = 1, weekdays?: readonly number[]): TaskRepeat {
  return weekdays
    ? { every, unit, weekdays, fromCompletion: false }
    : { every, unit, fromCompletion: false };
}

function shiftBy(today: string, count: number, unit: TaskRepeatUnit): string {
  if (unit === 'day') return addDays(today, count);
  if (unit === 'week') return addDays(today, count * 7);
  if (unit === 'month') return addMonths(today, count);
  return addMonths(today, count * 12);
}

/** Tag und Monat ohne Jahr: dieses Jahr, oder das naechste, wenn der Tag schon vorbei ist. */
function upcomingDay(today: string, month: number, date: number, year?: string): string | null {
  if (year !== undefined) {
    return dayFromParts(year.length === 2 ? 2000 + Number(year) : Number(year), month, date);
  }
  const thisYear = Number(today.slice(0, 4));
  // Der 29. Februar wartet bis zum naechsten Schaltjahr.
  for (let offset = 0; offset <= 4; offset += 1) {
    const candidate = dayFromParts(thisYear + offset, month, date);
    if (candidate !== null && candidate >= today) return candidate;
  }
  return null;
}

function clockOf(text: string): string | null {
  const match = /^(\d{1,2})(?:[:.](\d{2}))?$/u.exec(text);
  if (!match) return null;
  return timeOf(Number(match[1]), match[2] === undefined ? 0 : Number(match[2]));
}

const date = (length: number, value: Value): Match => ({ kind: 'date', length, value });

const matchPriority: Matcher = (words, index) => {
  const core = coreAt(words, index);
  if (!/^!{1,3}$/u.test(core)) return null;
  return { kind: 'priority', length: 1, value: { priority: core.length as TaskPriority } };
};

const matchTag: Matcher = (words, index) => {
  const core = coreAt(words, index);
  const name = core.slice(1);
  if (!core.startsWith('#') || !TOKEN_NAME.test(name)) return null;
  return { kind: 'tag', length: 1, value: { tag: name } };
};

const matchProject: Matcher = (words, index, options) => {
  const core = coreAt(words, index);
  const name = core.slice(1);
  if (!core.startsWith('@') || !TOKEN_NAME.test(name)) return null;
  // Leerzeichen im Projektnamen tippt man als - oder _.
  const wanted = name.replace(/[-_]/gu, ' ').toLocaleLowerCase('de');
  const known = options.projects?.find((project) => project.toLocaleLowerCase('de') === wanted);
  return known ? { kind: 'project', length: 1, value: { project: known } } : null;
};

const matchRepeat: Matcher = (words, index, options) => {
  const lower = lowerAt(words, index);
  const adverb = ADVERB_REPEATS.get(lower);
  if (adverb) return { kind: 'repeat', length: 1, value: { repeat: repeatOf(adverb) } };

  if (lower === 'werktags') {
    const first = weekdayOf(options.today) <= 5 ? options.today : nextMonday(options.today);
    return {
      kind: 'repeat',
      length: 1,
      value: { repeat: repeatOf('week', 1, WORKDAYS), day: first },
    };
  }

  if (EACH.has(lower)) {
    const unit = EACH_UNITS.get(lowerAt(words, index + 1));
    if (unit) {
      return { kind: 'repeat', length: 2, value: { repeat: repeatOf(unit) } };
    }
    const weekday = weekdayOfWord(words[index + 1]);
    if (weekday === null) return null;
    return {
      kind: 'repeat',
      length: 2,
      value: {
        repeat: repeatOf('week', 1, [weekday]),
        day: nextWeekday(options.today, weekday, true),
      },
    };
  }

  if (lower === 'alle') {
    const count = countOf(words[index + 1]);
    const unit = UNITS.get(lowerAt(words, index + 2));
    if (count === null || !unit) return null;
    return { kind: 'repeat', length: 3, value: { repeat: repeatOf(unit, count) } };
  }
  return null;
};

const matchRelativeDay: Matcher = (words, index, options) => {
  const lower = lowerAt(words, index);
  const offset = RELATIVE_DAYS.get(lower);
  if (offset === undefined) return null;
  if (lower === 'morgen' && MORNING_NOT_DATE.has(lowerAt(words, index - 1))) return null;
  const day = addDays(options.today, offset);
  const part = DAY_PARTS.get(lowerAt(words, index + 1));
  return part ? date(2, { day, time: part }) : date(1, { day });
};

const matchNext: Matcher = (words, index, options) => {
  if (!NEXT.has(lowerAt(words, index))) return null;
  const following = lowerAt(words, index + 1);
  if (following === 'woche') return date(2, { day: nextMonday(options.today) });
  if (following === 'monat') return date(2, { day: startOfNextMonth(options.today) });
  const weekday = weekdayOfWord(words[index + 1]);
  if (weekday === null) return null;
  return date(2, { day: nextWeekday(options.today, weekday, false) });
};

const matchInSome: Matcher = (words, index, options) => {
  if (lowerAt(words, index) !== 'in') return null;
  const count = countOf(words[index + 1]);
  const unit = UNITS.get(lowerAt(words, index + 2));
  if (count === null || !unit) return null;
  return date(3, { day: shiftBy(options.today, count, unit) });
};

const matchMonthEnd: Matcher = (words, index, options) => {
  const lower = lowerAt(words, index);
  const day = endOfMonth(options.today);
  if (lower === 'monatsende') return date(1, { day });
  if (lower !== 'ende') return null;
  const following = lowerAt(words, index + 1);
  if (following === 'monat' || following === 'monats') return date(2, { day });
  if (following === 'des' && lowerAt(words, index + 2) === 'monats') return date(3, { day });
  return null;
};

const matchWeekend: Matcher = (words, index, options) =>
  lowerAt(words, index) === 'wochenende' ? date(1, { day: weekendDay(options.today) }) : null;

const matchNumericDate: Matcher = (words, index, options) => {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})?$/u.exec(coreAt(words, index));
  if (!match) return null;
  const day = upcomingDay(options.today, Number(match[2]), Number(match[1]), match[3]);
  return day ? date(1, { day }) : null;
};

const matchDayMonth: Matcher = (words, index, options) => {
  const match = /^(\d{1,2})\.$/u.exec(coreAt(words, index));
  if (!match) return null;
  const month = MONTHS.get(lowerAt(words, index + 1).replace(/\.$/u, ''));
  if (month === undefined) return null;
  const year = coreAt(words, index + 2);
  if (/^\d{4}$/u.test(year)) {
    const day = upcomingDay(options.today, month, Number(match[1]), year);
    return day ? date(3, { day }) : null;
  }
  const day = upcomingDay(options.today, month, Number(match[1]));
  return day ? date(2, { day }) : null;
};

/** „am Freitag“, „bis Mo“: mit Praeposition ist ein Wochentag eindeutig. */
const matchWeekdayWithContext: Matcher = (words, index, options) => {
  if (!DATE_PREPOSITIONS.has(lowerAt(words, index))) return null;
  const weekday = weekdayOfWord(words[index + 1]);
  if (weekday === null) return null;
  return date(2, { day: nextWeekday(options.today, weekday, true) });
};

const DATE_MATCHERS: readonly Matcher[] = [
  matchRelativeDay,
  matchNext,
  matchInSome,
  matchMonthEnd,
  matchWeekend,
  matchNumericDate,
  matchDayMonth,
];

/** Ein Datum, wahlweise mit „am“, „bis“ oder „bis zum“ davor. */
const matchDate: Matcher = (words, index, options) => {
  const withWeekday = matchWeekdayWithContext(words, index, options);
  if (withWeekday) return withWeekday;
  let skipped = 0;
  while (skipped < 2 && DATE_PREPOSITIONS.has(lowerAt(words, index + skipped))) skipped += 1;
  for (const matcher of DATE_MATCHERS) {
    const found = matcher(words, index + skipped, options);
    if (found) return { ...found, length: found.length + skipped };
  }
  return null;
};

const matchTime: Matcher = (words, index) => {
  const lower = lowerAt(words, index);
  if (lower === 'um') {
    const clock = clockOf(coreAt(words, index + 1));
    if (clock === null) return null;
    const length = lowerAt(words, index + 2) === 'uhr' ? 3 : 2;
    return { kind: 'time', length, value: { time: clock } };
  }
  const glued = /^(\d{1,2}(?:[:.]\d{2})?)uhr$/u.exec(lower);
  if (glued?.[1]) {
    const clock = clockOf(glued[1]);
    return clock ? { kind: 'time', length: 1, value: { time: clock } } : null;
  }
  const core = coreAt(words, index);
  if (lowerAt(words, index + 1) === 'uhr') {
    const clock = clockOf(core);
    if (clock) return { kind: 'time', length: 2, value: { time: clock } };
  }
  if (/^\d{1,2}:\d{2}$/u.test(core)) {
    const clock = clockOf(core);
    if (clock) return { kind: 'time', length: 1, value: { time: clock } };
  }
  return null;
};

const MATCHERS: readonly Matcher[] = [
  matchPriority,
  matchTag,
  matchProject,
  matchRepeat,
  matchDate,
  matchTime,
];

/** Diese Arten gibt es nur einmal; ein zweites Datum bleibt Text. */
const SINGLE_KINDS: ReadonlySet<TokenKind> = new Set([
  'date',
  'time',
  'repeat',
  'priority',
  'project',
]);

type Found = { index: number; match: Match; key: string };

function keyOf(kind: TokenKind, words: readonly Word[], index: number, length: number): string {
  const text = words
    .slice(index, index + length)
    .map((word) => word.lower)
    .join(' ');
  return `${kind}:${text}`;
}

/**
 * Zerlegt die Eingabe. Rein: dieselbe Eingabe mit demselben `today` gibt
 * immer dasselbe.
 */
export function parseTaskInput(text: string, options: ParseOptions): ParsedTask {
  const words = wordsOf(text);
  const ignored = options.ignored ?? new Set<string>();
  const consumed = words.map(() => false);
  const found: Found[] = [];
  const used = new Set<TokenKind>();

  const accept = (index: number, match: Match, key: string) => {
    for (let offset = 0; offset < match.length; offset += 1) consumed[index + offset] = true;
    found.push({ index, match, key });
    used.add(match.kind);
  };

  // Woerter, deren Erkennung per ✕ aufgehoben ist, bleiben Text — auch fuer den Wochentag unten.
  const blocked = words.map(() => false);

  let index = 0;
  while (index < words.length) {
    const matches = MATCHERS.map((matcher) => matcher(words, index, options)).filter(
      (match): match is Match => match !== null,
    );
    const hit = matches.find(
      (match) =>
        !(SINGLE_KINDS.has(match.kind) && used.has(match.kind)) &&
        !ignored.has(keyOf(match.kind, words, index, match.length)),
    );
    if (hit) {
      accept(index, hit, keyOf(hit.kind, words, index, hit.length));
      index += hit.length;
      continue;
    }
    const refused = matches.find((match) =>
      ignored.has(keyOf(match.kind, words, index, match.length)),
    );
    const length = refused?.length ?? 1;
    if (refused) for (let offset = 0; offset < length; offset += 1) blocked[index + offset] = true;
    index += length;
  }

  // Ein Wochentag ohne Praeposition zaehlt nur am Ende des Titels.
  if (!used.has('date')) {
    const candidate = words.findIndex(
      (word, position) =>
        !consumed[position] &&
        !blocked[position] &&
        weekdayOfWord(word) !== null &&
        consumed.slice(position + 1).every(Boolean) &&
        !ignored.has(keyOf('date', words, position, 1)),
    );
    const weekday = weekdayOfWord(words[candidate]);
    if (candidate >= 0 && weekday !== null) {
      accept(
        candidate,
        date(1, { day: nextWeekday(options.today, weekday, true) }),
        keyOf('date', words, candidate, 1),
      );
    }
  }

  const ordered = [...found].sort((a, b) => a.index - b.index);
  const values = ordered.map((entry) => entry.match.value);
  const first = <K extends keyof Value>(key: K): Value[K] | undefined =>
    values.find((value) => value[key] !== undefined)?.[key];
  const explicitDay = ordered.find((entry) => entry.match.kind === 'date')?.match.value.day;

  const tags = values
    .map((value) => value.tag)
    .filter((tag): tag is string => tag !== undefined)
    .filter(
      (tag, position, list) =>
        list.findIndex((other) => other.toLocaleLowerCase('de') === tag.toLocaleLowerCase('de')) ===
        position,
    );

  const title = words
    .filter((_, position) => !consumed[position])
    .map((word) => word.raw)
    .join(' ')
    .replace(/^[\s,;:]+|[\s,;:]+$/gu, '');

  return {
    title,
    day: explicitDay ?? first('day') ?? null,
    time: first('time') ?? null,
    repeat: first('repeat') ?? null,
    priority: first('priority') ?? 0,
    tags,
    project: first('project') ?? null,
    tokens: ordered.map(({ index: position, match, key }) => {
      const last = words[position + match.length - 1];
      const start = words[position]?.start ?? 0;
      const end = last ? last.start + last.core.length : start;
      return { kind: match.kind, key, text: text.slice(start, end), start, end };
    }),
  };
}

export type ParsedChipKind = 'when' | 'repeat' | 'priority' | 'tag' | 'project';

/** Was unter dem Feld als Chip steht. Datum und Uhrzeit teilen sich einen. */
export type ParsedChip = {
  id: string;
  kind: ParsedChipKind;
  keys: readonly string[];
  /** Nur bei `tag`: welcher. */
  tag?: string;
};

export function chipsOf(parsed: ParsedTask): ParsedChip[] {
  const whenKeys = parsed.tokens
    .filter((token) => token.kind === 'date' || token.kind === 'time')
    .map((token) => token.key);
  const when: ParsedChip[] =
    whenKeys.length > 0 ? [{ id: 'when', kind: 'when', keys: whenKeys }] : [];
  const single = (kind: 'repeat' | 'priority' | 'project'): ParsedChip[] =>
    parsed.tokens
      .filter((token) => token.kind === kind)
      .slice(0, 1)
      .map((token) => ({ id: kind, kind, keys: [token.key] }));
  const tags: ParsedChip[] = parsed.tokens
    .filter((token) => token.kind === 'tag')
    .map((token) => ({
      id: token.key,
      kind: 'tag',
      keys: [token.key],
      tag: token.text.replace(/^#/u, ''),
    }));
  return [...when, ...single('repeat'), ...single('priority'), ...single('project'), ...tags];
}
