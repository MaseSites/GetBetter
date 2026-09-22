/**
 * Eine Uhrzeit, wie man sie tippt: „18“ ist 18:00, „1830“ und „930“ sind 18:30
 * und 09:30, dazu „18:30“, „18.30“, „18,30“, „18h30“, „18 30“ und „18 Uhr“.
 * Kalender, Aufgaben und Schlaf lesen alle damit — ueberall dieselbe Regel.
 * Rein, getestet.
 */
export type Clock = { hour: number; minute: number };

const HOUR_ONLY = /^(\d{1,2})\s*(?:uhr|h)?$/u;
const HOUR_MINUTE = /^(\d{1,2})\s*(?:[:.,h]|uhr)?\s*(\d{2})(?:\s*uhr)?$/u;
const DIGITS_ONLY = /^(\d{3,4})$/u;

/** Die Uhrzeit aus dem Getippten — oder null, wenn es keine ist. */
export function readClock(input: string): Clock | null {
  const text = input.trim().toLocaleLowerCase('de');
  // „930“ und „1830“: die letzten zwei Ziffern sind die Minuten.
  const digits = DIGITS_ONLY.exec(text)?.[1];
  if (digits) return valid(Number(digits.slice(0, -2)), Number(digits.slice(-2)));
  const hourOnly = HOUR_ONLY.exec(text);
  if (hourOnly) return valid(Number(hourOnly[1]), 0);
  const both = HOUR_MINUTE.exec(text);
  if (both) return valid(Number(both[1]), Number(both[2]));
  return null;
}

/** `HH:MM` — so steht eine Uhrzeit im Feld, sobald man es verlaesst. */
export function clockText({ hour, minute }: Clock): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function valid(hour: number, minute: number): Clock | null {
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}
