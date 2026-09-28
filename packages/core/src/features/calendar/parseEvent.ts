// Relative Pfade mit Absicht: so laeuft die Datei auch in den Tests unter Node.
import { whenOf } from '../assistant/understand';
import { clockText, readClock } from '../shared/clock';

/**
 * Ein Termin in einem Satz: „Zahnarzt morgen 9 @Bahnhofstrasse“ wird zu
 * Titel, Tag, Von/Bis und Ort. Tag und Uhrzeit liest dieselbe Regel wie der
 * Assistent (`whenOf` → `parseTaskInput`, Spannen wie „15–17“ und „von 15 bis
 * 17 Uhr“, „um 3“ ist bei Terminen 15 Uhr); die Uhrzeit nach einem Tag ohne
 * „um“ („morgen 9“, „Freitag 1830“) liest `readClock`. Rein, getestet.
 */
export type ParsedEvent = {
  title: string;
  /** `YYYY-MM-DD` oder null, wenn kein Tag dasteht. */
  day: string | null;
  /** `HH:MM` oder null. */
  start: string | null;
  /** `HH:MM` nur bei einer Spanne; sonst null (der Editor nimmt eine Stunde). */
  end: string | null;
  /** Nur, wenn es dasteht: „ganztägig“, „den ganzen Tag“. */
  allDay: boolean;
  location: string | null;
};

const pad = (value: number) => String(value).padStart(2, '0');

function todayOf(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const DAY_WORD =
  '(?:heute|morgen|übermorgen|uebermorgen|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|Mo|Di|Mi|Do|Fr|Sa|So|\\d{1,2}\\.\\d{1,2}\\.(?:\\d{4}|\\d{2})?)';
/**
 * „morgen 9“, „Freitag 1830“, „24.9. 14:30“: eine Uhrzeit gleich nach dem Tag,
 * ohne „um“. Nur, wenn danach nichts mehr kommt, ein Satzzeichen oder der Ort —
 * „morgen 3 Bananen“ bleibt Text.
 */
const BARE_CLOCK = new RegExp(
  `(?<![\\p{L}\\d])(${DAY_WORD})\\s+(\\d{1,2}(?:[:.h]\\d{2})?|\\d{3,4})(?=\\s*(?:$|[,;@]|-(?!\\s*\\d)))`,
  'giu',
);

const ALL_DAY = /(?<![\p{L}])(?:ganztägig|ganztaegig|ganztags|den\s+ganzen\s+tag)(?![\p{L}])/iu;

/** `@Ort` bis zum Ende des Titels; `_` und `-` in einem Wort sind Leerzeichen. */
const PLACE = /(?:^|\s)@(\S.*)$/u;

function withBareClock(text: string): string {
  return text.replace(BARE_CLOCK, (match, day: string, raw: string) => {
    const clock = readClock(raw.replace('h', ':'));
    return clock ? `${day} um ${clockText(clock)}` : match;
  });
}

function capitalized(text: string): string {
  return text.charAt(0).toLocaleUpperCase('de') + text.slice(1);
}

function tidy(text: string): string {
  return text
    .replace(/\s+/gu, ' ')
    .replace(/^[\s,;:–-]+|[\s,;:–-]+$/gu, '')
    .trim();
}

/** Zerlegt die Eingabe. Dieselbe Eingabe mit demselben `now` gibt immer dasselbe. */
export function parseEventInput(text: string, now: Date): ParsedEvent {
  const allDay = ALL_DAY.test(text);
  const prepared = withBareClock(text.replace(ALL_DAY, ' '));
  const when = whenOf(prepared, todayOf(now), true);

  let title = when.title;
  let location: string | null = null;
  const place = PLACE.exec(title);
  if (place?.[1]) {
    location = tidy(place[1].replace(/(?<=\S)[_](?=\S)/gu, ' ')) || null;
    title = title.slice(0, place.index);
  }

  return {
    title: capitalized(tidy(title)),
    day: when.day,
    start: allDay ? null : when.time,
    end: allDay ? null : when.end,
    allDay,
    location,
  };
}

/** Was ein neuer Stand des Satzes an den Feldern aendert. */
export type QuickPatch = {
  title?: string;
  day?: string;
  allDay?: boolean;
  start?: string;
  end?: string;
  location?: string;
};

/** Ohne eigenes Ende dauert ein Termin eine Stunde — wie im Editor. */
export const QUICK_DEFAULT_MINUTES = 60;

function later(time: string, minutes: number): string {
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  const total = (hour * 60 + minute + minutes) % (24 * 60);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/**
 * Nur, was sich zwischen zwei Staenden des Satzes geaendert hat, landet in den
 * Feldern — so bleibt, was man darunter von Hand geaendert hat. Ein Tag, der
 * aus dem Satz verschwindet, laesst das Datum stehen.
 */
export function quickPatch(previous: ParsedEvent, next: ParsedEvent): QuickPatch {
  const patch: QuickPatch = {};
  if (next.title !== previous.title) patch.title = next.title;
  if (next.day && next.day !== previous.day) patch.day = next.day;
  if (next.allDay !== previous.allDay) patch.allDay = next.allDay;
  if (next.start && (next.start !== previous.start || next.end !== previous.end)) {
    patch.start = next.start;
    patch.end = next.end ?? later(next.start, QUICK_DEFAULT_MINUTES);
  }
  if (next.location !== previous.location) patch.location = next.location ?? '';
  return patch;
}

/** Hat der Satz etwas erkannt, das die Felder fuellt? */
export function hasEventParts(parsed: ParsedEvent): boolean {
  return (
    parsed.day !== null || parsed.start !== null || parsed.allDay || parsed.location !== null
  );
}
