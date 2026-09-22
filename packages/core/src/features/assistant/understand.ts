import type { AiAction, AiContextItem } from '../../db/ai';
import { parseTaskInput } from '../tasks/parse';
import { addDays, nextMonday, nextWeekday, weekdayOf, weekendDay } from '../tasks/days';

/**
 * Was die App selbst aus einem Satz liest — ohne Netz, ohne Tokens. Daraus
 * werden dieselben Aufrufe, die sonst die KI liefert (`AiAction`).
 *
 * Selbst gehandelt wird nur, wo es sich an den Daten nachpruefen laesst
 * (`sure`): loeschen, verschieben und abhaken an genau einem Eintrag, den es
 * gibt, dazu hell/dunkel und Oeffnen. Passen mehrere, fragt sie nach (`pick`)
 * statt zu raten. Ein Satz, der loeschen, verschieben oder abhaken will, legt
 * nie etwas an. Was aus freiem Text etwas Neues macht, ist nur gelesen
 * (`sure: false`): das entscheidet die KI, und das Gelesene gilt nur, wenn
 * sie nicht antwortet. Fragen nach dem Programm beantwortet die App aus der
 * Liste (`agenda`, `when`).
 *
 * Rein gerechnet und getestet. Deutsch zuerst, ein paar englische Woerter;
 * was in anderen Sprachen kommt, versteht die KI.
 */
export type UnderstandInput = {
  text: string;
  /** Heute als `YYYY-MM-DD`. */
  today: string;
  /** Was diese App fuehrt (`APP_MODULES`) — nur das kann er tun oder oeffnen. */
  modules: readonly string[];
  /** Die Liste mit Kennungen, dieselbe, die sonst an die KI ginge. */
  items: readonly AiContextItem[];
  /** Die offene Rueckfrage „Welchen meinst du?“ — der Satz waehlt daraus. */
  pending?: Pending | null;
};

/** Wohin ein Termin geht — beim Verschieben steht das schon fest. */
export type MoveChange = { date?: string; start?: string; end?: string };

/** Gefragt ist nur noch, welcher Termin zwischen `from` und `to` gemeint ist. */
export type Pending = { command: 'delete' | 'move'; from: string; to: string; change?: MoveChange };

export type Understood =
  /**
   * `sure`: an den Daten nachgeprueft — die App tut es selbst. Sonst nur
   * gelesen: das entscheidet die KI, und es gilt nur, wenn sie nicht antwortet.
   */
  | { kind: 'actions'; actions: readonly AiAction[]; sure: boolean }
  /** „Was habe ich morgen?“ — beantwortet aus der Liste, von `from` bis `to`. */
  | { kind: 'agenda'; from: string; to: string }
  /** „Wann ist der Zahnarzt?“ — genau ein Eintrag der Liste. */
  | { kind: 'when'; item: AiContextItem }
  /** Mehrere oder keiner passen: nachfragen statt raten. */
  | { kind: 'pick'; pending: Pending }
  | null;

/** Ein Wort oder eine Wendung, an Wortgrenzen — auch vor und nach Umlauten. */
const words = (pattern: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, 'iu');

const lowerOf = (text: string) => text.toLocaleLowerCase('de').replace(/ß/gu, 'ss');
const pad = (value: number) => String(value).padStart(2, '0');
const capitalized = (text: string) => text.charAt(0).toLocaleUpperCase('de') + text.slice(1);

const HOUR_WORDS: Readonly<Record<string, number>> = {
  eins: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  fuenf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  zwölf: 12,
  zwoelf: 12,
};

/**
 * Uhrzeiten, wie man sie sagt, in Ziffern: „um drei“ → „um 3“, „halb 7“ →
 * „6:30“, „viertel nach 7“ → „7:15“, „viertel vor 7“ → „6:45“, „gegen sechs“
 * → „um 6“.
 */
export function withClock(text: string): string {
  const names = Object.keys(HOUR_WORDS).join('|');
  const hourOf = (raw: string) => HOUR_WORDS[lowerOf(raw)] ?? Number(raw);
  return text
    .replace(new RegExp(`(?<![\\p{L}])(um|halb|nach|vor|gegen|circa|ca\\.?|etwa)\\s+(${names})(?![\\p{L}])`, 'giu'), (_, lead: string, hour: string) =>
      `${lead} ${hourOf(hour)}`,
    )
    .replace(/(?<![\p{L}])(?:gegen|circa|ca\.?|etwa|ab)\s+(\d{1,2}(?:[:.]\d{2})?)(?![\d:.])/giu, (_, clock: string) => `um ${clock}`)
    .replace(/(?<![\p{L}])halb\s+(\d{1,2})(?![\d:])/giu, (_, hour: string) => `${(Number(hour) + 23) % 24}:30`)
    .replace(/(?<![\p{L}])viertel\s+nach\s+(\d{1,2})(?![\d:])/giu, (_, hour: string) => `${Number(hour) % 24}:15`)
    .replace(/(?<![\p{L}])viertel\s+vor\s+(\d{1,2})(?![\d:])/giu, (_, hour: string) => `${(Number(hour) + 23) % 24}:45`);
}

const EARLY = words('morgens|früh|frueh|nachts|in der nacht|am morgen');

/** „um 3“ heisst bei einem Termin 15 Uhr — ausser es steht „morgens“ oder „früh“ dabei. */
export function daytime(time: string, lower: string): string {
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  return hour >= 1 && hour <= 7 && !EARLY.test(lower) ? `${pad(hour + 12)}:${pad(minute)}` : time;
}

/** Tageszeiten ohne Uhrzeit — sie geben die Zeit und fallen aus dem Titel. */
const DAY_PARTS: readonly (readonly [RegExp, string])[] = [
  [words('am morgen|morgens|in der früh|in der frueh|früh|frueh'), '09:00'],
  [words('am mittag|mittags'), '12:00'],
  [words('am nachmittag|nachmittags'), '15:00'],
  [words('am abend|abends|abend'), '18:00'],
];

/** Was vorne und hinten wegfaellt, bevor der Titel stimmt. */
const LEAD = new RegExp(
  `^(?:(?:bitte|trag|trage|mir|uns|ich|wir|muss|müssen|muessen|hab|habe|haben|einen|ein|eine|noch|dann|und|also|kannst|könntest|koenntest|würdest|wuerdest|du|für|fuer|mach|mache)(?![\\p{L}])[\\s,:]*)+`,
  'iu',
);
const TAIL =
  /[\s,]*(?:(?:ein|eintragen|bitte|machen|erstellen|anlegen|setzen|in\s+(?:den|meinen|unseren)\s+kalender|im\s+kalender)(?![\p{L}])[\s,.!]*)+$/iu;
/** „Termin beim Zahnarzt“ heisst Zahnarzt; „Termin mit dem Vermieter“ bleibt so. */
const TERM_LEAD = /^termin\s*(?:[:-]\s*|(?:beim|bei|zum|zur|im|in)\s+)/iu;
const ARTICLE =
  /^(?:zum|zur|beim|bei|ins|in\s+die|in\s+den|in\s+das|nach|an\s+die|an\s+den|an\s+das|an|den|die|das|dem|der)\s+/iu;
const MODAL_TAIL = /\s+(?:muss|soll|sollte|will|möchte|moechte|muss\s+ich|sollte\s+ich)\s*[.!]?$/iu;

/** Was vom Satz als Titel bleibt — Fuellwoerter vorne und hinten weg, bis nichts mehr faellt. */
function titleOf(raw: string): string {
  let title = raw.trim();
  for (let round = 0; round < 3; round += 1) {
    const next = title
      .replace(LEAD, '')
      .replace(TERM_LEAD, '')
      .replace(TAIL, '')
      .replace(MODAL_TAIL, '')
      .trim()
      .replace(ARTICLE, '')
      .replace(/[\s,.;:!?]+$/u, '')
      .trim();
    if (next === title) break;
    title = next;
  }
  return capitalized(title);
}

/** Laengere Titel sind meist ein ganzer Satz — den versteht die KI besser. */
const MAX_TITLE_WORDS = { event: 6, task: 8 } as const;
const wordCount = (text: string) => text.split(/\s+/u).filter(Boolean).length;

type When = { title: string; day: string | null; time: string | null; end: string | null };

const CLOCK = '(\\d{1,2}(?:[:.]\\d{2})?)';
/** „von 15 bis 17 Uhr“, „15–17“, „zwischen 3 und 5“, „9:30 bis 11“. */
const RANGE = new RegExp(
  `(?<![\\p{L}\\d.])(von\\s+|zwischen\\s+)?${CLOCK}\\s*(uhr\\s*)?(bis|-|–|und)\\s*${CLOCK}(\\s*uhr)?(?![\\p{L}\\d.])`,
  'iu',
);

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

function clockOf(raw: string): string | null {
  const [hour = Number.NaN, minute = 0] = raw.split(/[:.]/u).map(Number);
  return hour <= 23 && minute <= 59 ? `${pad(hour)}:${pad(minute)}` : null;
}

/**
 * Beginn und Ende aus einer Spanne — oder null, wenn es keine Uhrzeiten sind
 * („2-3 Stunden“ ist keine). Das Ende liegt nie vor dem Beginn: „3 bis 5“ ist
 * am Nachmittag 15 bis 17 Uhr.
 */
function spanOf(text: string, evening: boolean): { start: string; end: string; match: string } | null {
  const found = RANGE.exec(text);
  if (!found) return null;
  const [match, prefix, from = '', firstUhr, separator = '', to = '', lastUhr] = found;
  const lead = lowerOf(prefix ?? '').trim();
  if (lowerOf(separator) === 'und' && lead !== 'zwischen') return null;
  const start0 = clockOf(from);
  const end0 = clockOf(to);
  if (!start0 || !end0) return null;
  const clockish = Boolean(lead || firstUhr || lastUhr) || /[:.]/u.test(from + to);
  if (!clockish && (Number(start0.slice(0, 2)) < 6 || Number(end0.slice(0, 2)) < 6)) return null;
  const start = evening ? daytime(start0, lowerOf(text)) : start0;
  let end = end0;
  if (minutesOf(end) <= minutesOf(start) && Number(end.slice(0, 2)) + 12 < 24) {
    end = `${pad(Number(end.slice(0, 2)) + 12)}:${end.slice(3, 5)}`;
  }
  return minutesOf(end) > minutesOf(start) ? { start, end, match } : null;
}

/**
 * Tag, Uhrzeit (auch als Spanne) und was dann noch Titel ist. Tageszeiten
 * („abends“) geben eine Uhrzeit, wenn keine genannt ist; `evening` rueckt 1–7
 * Uhr auf den Nachmittag (bei Terminen, nie beim Wecker).
 */
function whenOf(text: string, today: string, evening: boolean): When {
  let rest = withClock(text);
  const span = spanOf(rest, evening);
  if (span) rest = rest.replace(span.match, ' ');
  let partTime: string | null = null;
  for (const [pattern, time] of DAY_PARTS) {
    if (pattern.test(rest)) {
      partTime ??= time;
      rest = rest.replace(pattern, ' ');
    }
  }
  const parsed = parseTaskInput(rest.replace(/\s+/gu, ' ').trim(), { today });
  const lower = lowerOf(text);
  if (span) return { title: parsed.title, day: parsed.day, time: span.start, end: span.end };
  const time = parsed.time ? (evening ? daytime(parsed.time, lower) : parsed.time) : partTime;
  return { title: parsed.title, day: parsed.day, time, end: null };
}

/** Der Tag, den ein Satz nennt — oder null. */
export const dayIn = (text: string, today: string): string | null => whenOf(text, today, true).day;

/** Wohin „auf Freitag um 10“ einen Termin schiebt — null, wenn nichts drinsteht. */
function changeOf(text: string, today: string): MoveChange | null {
  const when = whenOf(text, today, true);
  if (!when.day && !when.time) return null;
  return {
    ...(when.day ? { date: when.day } : {}),
    ...(when.time ? { start: when.time } : {}),
    ...(when.end ? { end: when.end } : {}),
  };
}

/**
 * Tag und Uhrzeit, wie die App sie aus dem Satz rechnet — als Hinweis fuer die
 * KI (`→ 2026-09-23 18:00`). Das kleine Modell verrechnet sich bei „naechsten
 * Mittwoch“ gern; so muss es nicht rechnen. Null, wenn nichts drinsteht.
 */
export function whenHint(text: string, today: string): string | null {
  const { day, time, end } = whenOf(text, today, true);
  if (!day && !time) return null;
  return `→ ${[day, time && end ? `${time}–${end}` : time].filter(Boolean).join(' ')}`;
}

/** Was nach dem Zerlegen nicht in einen Titel gehoert — dann ist der Satz nicht verstanden. */
const LEFTOVER = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:\\d+(?:[:.]\\d+)?|uhr|bis|von(?=\\s+\\d)|ab|um|heute|morgen|übermorgen|uebermorgen|montags?|dienstags?|mittwochs?|donnerstags?|freitags?|samstags?|sonntags?|woche|wochenende|stunden?|minuten|januar|februar|märz|maerz|april|juni|juli|august|september|oktober|november|dezember|nächste[nmrs]?|naechste[nmrs]?|jeden|täglich|taeglich)(?![\\p{L}\\p{N}])`,
  'iu',
);

// ------------------------------------------------------------ Eintraege treffen

const STOP = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'mit',
  'und', 'oder', 'zum', 'zur', 'beim', 'bei', 'auf', 'fuer', 'für', 'von', 'vom', 'mir',
  'mich', 'ich', 'hab', 'habe', 'ist', 'war', 'bitte', 'noch', 'schon', 'mal', 'termin',
  'aufgabe', 'meinen', 'meine', 'mein', 'heute', 'morgen', 'the', 'my', 'and', 'wann',
]);

/** Wortstaemme: „geflickt“ und „flicken“ treffen sich bei „flick“. */
function stemsOf(text: string): string[] {
  return lowerOf(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3 && !STOP.has(word))
    .map((word) => (word.length > 6 && word.startsWith('ge') ? word.slice(2) : word).slice(0, 5));
}

const alike = (a: string, b: string) =>
  a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));

/** Genau ein Eintrag dieser Art, der am besten passt — sonst null. */
export function matchItem(
  subject: string,
  items: readonly AiContextItem[],
  kinds: readonly AiContextItem['kind'][],
): AiContextItem | null {
  const wanted = stemsOf(subject);
  if (wanted.length === 0) return null;
  const scored = items
    .filter((item) => kinds.includes(item.kind))
    .map((item) => {
      const stems = stemsOf(item.title);
      return { item, score: wanted.filter((stem) => stems.some((other) => alike(stem, other))).length };
    })
    .filter((entry) => entry.score > 0);
  const best = Math.max(0, ...scored.map((entry) => entry.score));
  const top = scored.filter((entry) => entry.score === best);
  return top.length === 1 && top[0] ? top[0].item : null;
}

// ------------------------------------------------------------ die Muster

const QUESTION =
  /\?\s*$|^(?:was|wann|welche[rsn]?|wie|wo|wer|warum|wieso|weshalb|gibt\s+es|hab(?:e)?\s+ich|bin\s+ich|what|when|how|why|where|who|do\s+i|have\s+i)(?![\p{L}])/iu;
const AGENDA = words('termine?|steht|stehen|ansteht|geplant|vor|los|hab(?:e)? ich|mache ich|agenda|schedule|plans?|kalender|programm');
const WEEKDAYS: readonly (readonly [RegExp, number])[] = [
  [words('montags?|monday'), 1],
  [words('dienstags?|tuesday'), 2],
  [words('mittwochs?|wednesday'), 3],
  [words('donnerstags?|thursday'), 4],
  [words('freitags?|friday'), 5],
  [words('samstags?|saturday'), 6],
  [words('sonntags?|sunday'), 7],
];

/** Von wann bis wann eine Frage nach dem Programm fragt. */
export function rangeOf(lower: string, today: string): { from: string; to: string } {
  const day = (offset: number) => addDays(today, offset);
  if (words('übermorgen|uebermorgen').test(lower)) return { from: day(2), to: day(2) };
  if (words('morgen|tomorrow').test(lower)) return { from: day(1), to: day(1) };
  if (words('heute|today').test(lower)) return { from: today, to: today };
  if (words('nächste woche|naechste woche|nächsten woche|next week').test(lower)) {
    const monday = nextMonday(today);
    return { from: monday, to: addDays(monday, 6) };
  }
  if (words('wochenende|weekend').test(lower)) {
    const saturday = weekendDay(today);
    return { from: saturday, to: addDays(saturday, 1) };
  }
  if (words('diese woche|die woche|this week').test(lower)) {
    return { from: today, to: addDays(today, 7 - weekdayOf(today)) };
  }
  for (const [pattern, weekday] of WEEKDAYS) {
    if (pattern.test(lower)) {
      const target = nextWeekday(today, weekday, true);
      return { from: target, to: target };
    }
  }
  return { from: today, to: day(6) };
}

function question(text: string, lower: string, input: UnderstandInput): Understood {
  if (/^wann(?![\p{L}])/iu.test(lower)) {
    const item = matchItem(text.replace(/^wann\s+(?:ist|sind|hab(?:e)?\s+ich|war)?\s*/iu, ''), input.items, [
      'event',
      'task',
      'birthday',
    ]);
    return item?.date ? { kind: 'when', item } : null;
  }
  if (!AGENDA.test(lower) || !input.modules.includes('calendar')) return null;
  return { kind: 'agenda', ...rangeOf(lower, input.today) };
}

/** An den Daten nachgeprueft — die App tut es selbst. */
const sure = (name: string, args: Record<string, unknown>): Understood => ({
  kind: 'actions',
  actions: [{ name, args }],
  sure: true,
});

/** Nur gelesen — das entscheidet die KI. */
const guess = (name: string, args: Record<string, unknown>): Understood => ({
  kind: 'actions',
  actions: [{ name, args }],
  sure: false,
});

/** Nur ein Befehl stellt um — „ist es draussen hell“ nicht. */
const THEME_CUE = words('mach(?:e)?|stell(?:e)?|schalt(?:e)?|wechsl?e?|switch|turn|modus|mode|theme|design|aussehen|dunkelmodus|nachtmodus|hellmodus');

function theme(lower: string): Understood {
  const count = lower.split(/\s+/u).length;
  if (count > 6 || (count > 2 && !THEME_CUE.test(lower))) return null;
  if (words('dunkel|dunkelmodus|nachtmodus|dark( mode)?').test(lower)) return sure('set_theme', { mode: 'dark' });
  if (words('hell|hellmodus|light( mode)?').test(lower)) return sure('set_theme', { mode: 'light' });
  if (words('automatisch|wie das gerät|wie das geraet|systemmodus').test(lower)) return sure('set_theme', { mode: 'system' });
  return null;
}

/** Wie man eine Funktion nennt — ihr Name in der App und was man sonst sagt. */
const MODULE_WORDS: Readonly<Record<string, string>> = {
  calendar: 'kalender|termine|calendar',
  tasks: 'aufgaben|todos?|to-dos?|tasks',
  notes: 'notizen|notes',
  alarm: 'wecker|alarm',
  weather: 'wetter|weather',
  documents: 'dokumente|documents',
  habits: 'gewohnheiten|habits',
  travel: 'reisen|ferien|travel',
  contacts: 'kontakte|contacts',
  birthdays: 'geburtstage|birthdays',
  mail: 'e-?mails?|mails?|posteingang|inbox',
  shopping: 'einkaufsliste|einkauf|shopping',
  chores: 'ämtli|aemtli|chores',
  recipes: 'rezepte|recipes',
  plants: 'pflanzen|plants',
  pets: 'haustiere|tiere|pets',
  vehicles: 'fahrzeuge|autos?|vehicles',
  fitness: 'training|trainings|fitness',
  meals: 'menüplan|menueplan|mahlzeiten|meals',
  sleep: 'schlaf|sleep',
  water: 'trinken|wasser|water',
  meds: 'medikamente|meds',
  vitals: 'werte|gewicht|vitals',
  mind: 'kopf frei|mind',
  budget: 'budget|ausgaben',
  bills: 'rechnungen|bills',
  subscriptions: 'abos|subscriptions',
  savings: 'sparziele|sparen|savings',
};

const OPEN = /^(?:bitte\s+)?(?:öffne|oeffne|öffnen|zeig(?:e)?(?:\s+mir)?|geh(?:e)?\s+(?:zu|in)|open|show(?:\s+me)?)\s+(?:die|den|das|meine|meinen|mein|the|my)?\s*(.+?)[.!]?$/iu;

function open(text: string, modules: readonly string[]): Understood {
  const match = OPEN.exec(text);
  if (!match?.[1]) return null;
  const wanted = match[1].trim();
  const module = modules.find((id) => {
    const names = MODULE_WORDS[id];
    return names ? new RegExp(`^(?:${names})$`, 'iu').test(wanted) : false;
  });
  return module ? sure('open_function', { module }) : null;
}

const ALARM = words('weck(?:e)? mich|wecker|alarm');

function alarm(text: string, lower: string, today: string): Understood {
  if (!ALARM.test(lower)) return null;
  const { time } = whenOf(text, today, false);
  if (!time) return null;
  const all = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
  let days: string[] = [];
  if (words('unter der woche|werktags|wochentags|montag bis freitag|weekdays').test(lower)) days = all.slice(0, 5);
  else if (words('am wochenende|wochenende|weekends?').test(lower)) days = all.slice(5);
  else if (words('jeden tag|täglich|taeglich|immer|every day|daily').test(lower)) days = all;
  else days = WEEKDAYS.filter(([pattern]) => pattern.test(lower)).map(([, weekday]) => all[weekday - 1] ?? '');
  return guess('set_alarm', days.length > 0 ? { time, days } : { time });
}

const NOTE = /^(?:bitte\s+)?(?:notier(?:e)?(?:\s+(?:mir|dir))?|notiz|schreib(?:e)?\s+(?:mir\s+|dir\s+)?auf|merk(?:e)?\s+dir|note)(?![\p{L}])\s*[:,-]?\s*(.+)$/iu;

function note(text: string): Understood {
  const match = NOTE.exec(text);
  const content = match?.[1]?.trim();
  if (!content) return null;
  const cut = content.search(/[:,]|\s-\s/u);
  const head = cut > 0 ? content.slice(0, cut).trim() : content;
  const body = cut > 0 ? content.slice(cut + 1).replace(/^[\s-]+/u, '').trim() : '';
  if (head.length === 0 || head.length > 60) {
    return guess('create_note', { title: capitalized(content.slice(0, 60).trim()), text: capitalized(content) });
  }
  return guess('create_note', body ? { title: capitalized(head), text: capitalized(body) } : { title: capitalized(head) });
}

// ------------------------------------------------------------ Bestehendes aendern

/** Was ein Satz mit etwas Bestehendem tun will — und woran. */
export type Asked = { command: 'delete' | 'move' | 'complete'; subject: string; target: string | null };

/** Hoeflich vorneweg: „Kannst du bitte …“ — danach steht, was gewollt ist. */
const REQUEST_LEAD =
  /^(?:(?:bitte|kannst|könntest|koenntest|würdest|wuerdest|kann|magst|du|mir|mal|jetzt|noch|und|dann|also|hey|ok|okay|ja)(?![\p{L}])[\s,]*)+/iu;
/** Eine Bitte, auch mit Fragezeichen — keine Frage nach dem Programm. */
const REQUEST = /^(?:bitte|kannst|könntest|koenntest|würdest|wuerdest|magst)(?![\p{L}])/iu;

const DELETE_HEAD = /^(?:lösch|loesch|streich|entfern|storn|cancel|delete|remove)\p{L}*\s+(.+)$/iu;
const DELETE_TAIL = /^(.+?)\s+(?:löschen|loeschen|entfernen|stornieren|absagen|canceln)$/iu;
const CALL_OFF = /^sag(?:e|t)?\s+(.+?)\s+ab$/iu;
const MOVE_HEAD = /^(?:verschieb|verleg|schieb|move|reschedule)\p{L}*\s+(.+?)(?:\s+(?:auf|nach|to)\s+(.+))?$/iu;
const MOVE_TAIL = /^(.+?)(?:\s+(?:auf|nach)\s+(.+?))?\s+(?:verschieben|verlegen)$/iu;
const DONE_TAIL = /^(.+?)\s+(?:erledigt|abgehakt|abhaken)$/iu;

/**
 * Will der Satz etwas loeschen, verschieben oder abhaken? Dann legt er nie
 * etwas an — egal, ob die App oder die KI ihn liest. „Erinnere mich …“,
 * „Todo: …“ und „Notiz: …“ legen ausdruecklich an und zaehlen nie.
 */
export function commandOf(text: string): Asked | null {
  const said = text.trim().replace(/\s+/gu, ' ');
  if (REMIND.test(said) || TASK_PREFIX.test(said) || NOTE.test(said)) return null;
  const rest = said.replace(REQUEST_LEAD, '').replace(/[\s.!?]+$/u, '');
  const deleted = DELETE_HEAD.exec(rest) ?? CALL_OFF.exec(rest) ?? DELETE_TAIL.exec(rest);
  if (deleted?.[1]) return { command: 'delete', subject: deleted[1], target: null };
  const moved = MOVE_HEAD.exec(rest) ?? MOVE_TAIL.exec(rest);
  if (moved?.[1]) return { command: 'move', subject: moved[1], target: moved[2] ?? null };
  const done = TICK.exec(rest) ?? DONE_TAIL.exec(rest);
  if (done?.[1]) return { command: 'complete', subject: done[1], target: null };
  return null;
}

/** Woerter, die keinen bestimmten Termin nennen — „meinen Termin morgen“ ist der Termin morgen. */
const GENERIC =
  /(?<![\p{L}])(?:termine?|einträge?|eintraege?|eintrag|kalendereintr\p{L}*|sache|ding|alle|alles|beide|nächste[nmrs]?|naechste[nmrs]?|mein(?:e[nmrs]?)?|unser(?:e[nmrs]?)?|diese[nmrs]?|von|vom|am|im|um)(?![\p{L}])/giu;

/** Wie weit „welchen meinst du“ ohne Tag zurueckschaut: so weit wie die Liste. */
const PICK_DAYS = 13;

const orderOf = (item: AiContextItem) => `${item.date ?? ''} ${item.time ?? ''}`;

/** Die Termine mit Kennung in diesem Zeitraum, in der Reihenfolge, in der die App sie nennt. */
function eventsIn(items: readonly AiContextItem[], from: string, to: string): AiContextItem[] {
  return items
    .filter((item) => item.kind === 'event' && item.ref && item.date && item.date >= from && item.date <= to)
    .sort((a, b) => orderOf(a).localeCompare(orderOf(b)));
}

type Target = { item: AiContextItem } | { from: string; to: string };

/**
 * Welcher Termin gemeint ist — nach Name, Tag, Uhrzeit oder allem zusammen.
 * Genau einer gibt ihn; mehrere oder keiner den Zeitraum, aus dem die Person
 * waehlt. Ein Name, den es gar nicht gibt, gibt null: dann sucht die KI,
 * vielleicht ist er vertippt.
 */
function targetOf(subject: string, today: string, items: readonly AiContextItem[]): Target | null {
  const when = whenOf(subject, today, true);
  const range = when.day ? { from: when.day, to: when.day } : { from: today, to: addDays(today, PICK_DAYS) };
  const events = items.filter((item) => item.kind === 'event' && item.ref && item.date);
  const onDay = when.day ? events.filter((item) => item.date === when.day) : events;
  const pool = when.time ? onDay.filter((item) => item.time === when.time) : onDay;
  const named = when.title.replace(GENERIC, ' ').trim();
  if (stemsOf(named).length === 0) {
    const [only, ...others] = pool;
    return only && others.length === 0 ? { item: only } : range;
  }
  const item = matchItem(named, pool, ['event']);
  if (item) return { item };
  return pool.some((event) => matchItem(named, [event], ['event'])) ? range : null;
}

function deleteEvent(asked: Asked, today: string, items: readonly AiContextItem[]): Understood {
  const target = targetOf(asked.subject, today, items);
  if (!target) return null;
  if ('item' in target) return sure('delete_event', { ref: target.item.ref });
  return { kind: 'pick', pending: { command: 'delete', ...target } };
}

function moveEvent(asked: Asked, today: string, items: readonly AiContextItem[]): Understood {
  // Wohin, sagt der Satz — sonst fragt die KI nach.
  const change = asked.target ? changeOf(asked.target, today) : null;
  if (!change) return null;
  const target = targetOf(asked.subject, today, items);
  if (!target) return null;
  if ('item' in target) return sure('move_event', { ref: target.item.ref, ...change });
  return { kind: 'pick', pending: { command: 'move', ...target, change } };
}

/**
 * Was eine Rueckfrage offen laesst, aus einem Satz, den erst die KI nicht
 * sicher verstanden hat — oder null, wenn es nichts zu waehlen gibt.
 */
export function pendingOf(text: string, today: string): Pending | null {
  const asked = commandOf(text);
  if (!asked || asked.command === 'complete') return null;
  const day = dayIn(asked.subject, today);
  const range = day ? { from: day, to: day } : { from: today, to: addDays(today, PICK_DAYS) };
  if (asked.command === 'delete') return { command: 'delete', ...range };
  const change = asked.target ? changeOf(asked.target, today) : null;
  return change ? { command: 'move', ...range, change } : null;
}

const ORDINALS: readonly (readonly [RegExp, number])[] = [
  [words('erste[nmrs]?|first'), 0],
  [words('zweite[nmrs]?|second'), 1],
  [words('dritte[nmrs]?|third'), 2],
  [words('vierte[nmrs]?|fourth'), 3],
];
const LAST = words('letzte[nmrs]?|last');

/** Die Antwort auf „Welchen meinst du?“: der Name, die Uhrzeit oder „der erste“. */
function choose(text: string, pending: Pending, today: string, items: readonly AiContextItem[]): Understood {
  const pool = eventsIn(items, pending.from, pending.to);
  const lower = lowerOf(text);
  const nth = ORDINALS.find(([pattern]) => pattern.test(lower))?.[1];
  const clock = whenOf(text, today, true).time;
  const atClock = clock ? pool.filter((item) => item.time === clock) : [];
  const item =
    (nth === undefined ? undefined : pool[nth]) ??
    (LAST.test(lower) ? pool[pool.length - 1] : undefined) ??
    (atClock.length === 1 ? atClock[0] : undefined) ??
    matchItem(text, pool, ['event']);
  if (!item?.ref) return null;
  return pending.command === 'delete'
    ? sure('delete_event', { ref: item.ref })
    : sure('move_event', { ref: item.ref, ...pending.change });
}

const DONE = words('erledigt|gemacht|geschafft|fertig|abgehakt|done');
const TICK = /^(?:bitte\s+)?hak(?:e)?\s+(.+?)\s+ab[.!]?$/iu;
const HAVE = /^(?:ich\s+)?(?:hab|habe)\s+(.+)$/iu;
const PARTICIPLE = /(?<![\p{L}])(?:ge\p{L}{3,}(?:t|en)|\p{L}{3,}iert)(?![\p{L}])/iu;
const DONE_FILLER = /(?<![\p{L}])(?:ich|hab|habe|ist|sind|schon|jetzt|endlich|erledigt|gemacht|geschafft|fertig|abgehakt|done|hak|ab)(?![\p{L}])/giu;

function completeTask(text: string, lower: string, today: string, items: readonly AiContextItem[]): Understood {
  const ticked = TICK.exec(text)?.[1];
  const had = HAVE.exec(text)?.[1];
  const said = ticked ?? (DONE.test(lower) || (had && PARTICIPLE.test(had)) ? text : null);
  if (!said) return null;
  // „Ich habe morgen um 3 Zahnarzt“ ist ein Termin, kein Abhaken.
  const when = whenOf(text, today, true);
  if (!ticked && (when.day || when.time)) return null;
  const item = matchItem(said.replace(DONE_FILLER, ' '), items, ['task']);
  return item?.ref ? sure('complete_task', { ref: item.ref }) : null;
}

const REMIND = /^(?:bitte\s+)?(?:erinner(?:e)?\s+mich|remind\s+me)(?![\p{L}])[\s,]*(?:bitte\s+)?(?:daran[\s,]*)?(?:(?:dass\s+ich|dass|zu|to)(?![\p{L}]))?\s*/iu;
const TASK_PREFIX = /^(?:aufgabe|todo|to-do|to do)\s*[:-]\s*/iu;
const MUST = /^(?:ich\s+)?(?:muss|sollte|soll)\s+/iu;
const PLACE = words('zum|zur|beim|ins|nach');

function task(text: string, lower: string, today: string): Understood {
  const reminded = REMIND.test(text) ? text.replace(REMIND, '') : TASK_PREFIX.test(text) ? text.replace(TASK_PREFIX, '') : null;
  const must = reminded === null && MUST.test(text) ? text : null;
  const source = reminded ?? must;
  if (source === null) return null;
  const when = whenOf(source, today, true);
  // „Ich muss morgen um 3 zum Coiffeur“ ist ein Termin; das entscheidet `event`.
  if (must !== null && (when.time || (when.day && PLACE.test(lower)))) return null;
  const title = titleOf(when.title);
  if (!title) return null;
  // Ein Rest, der kein Titel ist, oder ein ganzer Satz: das versteht die KI besser.
  if (LEFTOVER.test(title) || wordCount(title) > MAX_TITLE_WORDS.task) return null;
  return guess('create_task', {
    title,
    ...(when.day ? { date: when.day } : {}),
    ...(when.day && when.time ? { time: when.time } : {}),
  });
}

/** Ohne Uhrzeit braucht ein Termin einen Hinweis — sonst ist „morgen wird es regnen“ keiner. */
const EVENT_CUE = words('trag(?:e)?|termin|eintragen|kalender|treffen|meeting|mit|zum|zur|beim|ins|nach');
const STATEMENT = words('wird|werden|ist|sind|war|waren|es|regnet|scheint');

function event(text: string, lower: string, today: string): Understood {
  const when = whenOf(text, today, true);
  if (!when.day && !when.time) return null;
  const title = titleOf(when.title);
  if (!title) return null;
  if (LEFTOVER.test(title) || wordCount(title) > MAX_TITLE_WORDS.event) return null;
  const short = wordCount(title) <= 3 && !STATEMENT.test(title);
  if (!when.time && !EVENT_CUE.test(lower) && !short) return null;
  return guess('create_event', {
    title,
    date: when.day ?? today,
    ...(when.time ? { start: when.time } : {}),
    ...(when.end ? { end: when.end } : {}),
  });
}

// ------------------------------------------------------------ Gym und Geld

const AMOUNT = '(\\d+(?:[.,]\\d+)?)';

function water(lower: string): Understood {
  if (!words('trink\\p{L}*|getrunken|wasser|drank|water').test(lower)) return null;
  const dl = new RegExp(`${AMOUNT}\\s*(?:dl|deziliter)(?![\\p{L}])`, 'iu').exec(lower);
  const liter = new RegExp(`${AMOUNT}\\s*(?:l|liter)(?![\\p{L}])`, 'iu').exec(lower);
  const glass = /(\d+|ein|eins|zwei|drei|vier|fünf|fuenf)\s+(?:glas|gläser|glaeser|glasses?)/iu.exec(lower);
  const numberOf = (raw: string) => Number(raw.replace(',', '.'));
  const glasses = glass?.[1] ? (HOUR_WORDS[glass[1]] ?? (glass[1] === 'ein' ? 1 : Number(glass[1]))) : null;
  const amount = dl?.[1]
    ? numberOf(dl[1])
    : liter?.[1]
      ? numberOf(liter[1]) * 10
      : glasses
        ? glasses * 2.5
        : null;
  return amount && amount >= 0.5 && amount <= 30 ? guess('log_water', { dl: amount }) : null;
}

const SPORTS = 'joggen|gejoggt|laufen|gelaufen|rennen|velo|velofahren|radfahren|biken|schwimmen|geschwommen|yoga|krafttraining|kraft|gym|fitness|wandern|gewandert|spazieren|tennis|fussball|running|cycling|swimming';

function workout(lower: string): Understood {
  const minutes = /(\d{1,3})\s*(?:min|minuten|minutes)(?![\p{L}])/iu.exec(lower);
  const sport = words(SPORTS).exec(lower);
  if (!minutes?.[1] || !sport?.[0]) return null;
  const value = Number(minutes[1]);
  return value >= 1 && value <= 600 ? guess('log_workout', { kind: capitalized(sport[0]), minutes: value }) : null;
}

const CATEGORIES: readonly (readonly [RegExp, string])[] = [
  [words('essen|znacht|zmittag|zmorge|migros|coop|lidl|aldi|denner|restaurant|kaffee|lebensmittel|bäcker|baecker|pizza|food'), 'food'],
  [words('zug|sbb|bus|tram|benzin|tanken|taxi|parkieren|parking|velo|ticket|ga|halbtax'), 'transport'],
  [words('miete|möbel|moebel|ikea|strom|haushalt|putzmittel'), 'home'],
  [words('kino|konzert|ausgang|bar|spiel|games?|ferien|ausflug'), 'fun'],
  [words('apotheke|arzt|medikamente?|zahnarzt|brille|physio'), 'health'],
];

function expense(text: string, lower: string): Understood {
  const amount = new RegExp(`${AMOUNT}\\s*(?:fr\\.?|franken|chf|stutz|\\.-)(?![\\p{L}])|chf\\s*${AMOUNT}`, 'iu').exec(lower);
  const raw = amount?.[1] ?? amount?.[2];
  if (!raw || !words('ausgegeben|bezahlt|gekauft|gezahlt|für|fuer|spent|paid').test(lower)) return null;
  const value = Number(raw.replace(',', '.'));
  if (!(value >= 0.05 && value <= 100_000)) return null;
  const forWhat = /(?:für|fuer|for)\s+(.+?)(?:\s+(?:ausgegeben|bezahlt|gezahlt|gekauft))?[.!]?$/iu.exec(text)?.[1]?.trim();
  const category = CATEGORIES.find(([pattern]) => pattern.test(lower))?.[1] ?? 'other';
  return guess('add_expense', { amount: value, category, ...(forWhat ? { note: capitalized(forWhat) } : {}) });
}

/**
 * Was der Satz will — oder null, dann fragt die App die KI. Die Reihenfolge
 * ist Absicht: erst die Antwort auf eine Rueckfrage, dann was Bestehendes
 * aendert (das legt nie etwas an), dann Fragen (die auch nicht), zuletzt was
 * etwas Neues anlegt — und der Termin, der nur Tag oder Uhrzeit braucht.
 */
export function understand(input: UnderstandInput): Understood {
  const text = input.text.trim().replace(/\s+/gu, ' ');
  if (text.length === 0 || text.length > 200) return null;
  const lower = lowerOf(text);
  const has = (module: string) => input.modules.includes(module);

  const chosen = input.pending ? choose(text, input.pending, input.today, input.items) : null;
  if (chosen) return chosen;

  const asked = commandOf(text);
  if (asked?.command === 'delete') return has('calendar') ? deleteEvent(asked, input.today, input.items) : null;
  if (asked?.command === 'move') return has('calendar') ? moveEvent(asked, input.today, input.items) : null;
  if (asked) return has('tasks') ? completeTask(text, lower, input.today, input.items) : null;

  // „Kannst du …?“ ist eine Bitte, keine Frage nach dem Programm — die versteht die KI.
  if (QUESTION.test(text)) return REQUEST.test(text) ? null : question(text, lower, input);

  const direct =
    theme(lower) ??
    open(text, input.modules) ??
    (has('alarm') ? alarm(text, lower, input.today) : null) ??
    (has('notes') ? note(text) : null) ??
    (has('tasks') ? completeTask(text, lower, input.today, input.items) : null) ??
    (has('tasks') ? task(text, lower, input.today) : null) ??
    (has('water') ? water(lower) : null) ??
    (has('fitness') ? workout(lower) : null) ??
    (has('budget') ? expense(text, lower) : null);
  if (direct) return direct;

  return has('calendar') ? event(text, lower, input.today) : null;
}
