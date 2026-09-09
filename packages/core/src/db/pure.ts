/**
 * Reine Rechnung ohne Speicher — was sich ohne App, Datenbank oder Browser
 * pruefen laesst. Die Repositories ziehen es von hier, die Tests auch.
 */

/** Der Tag als `YYYY-MM-DD` — danach wird gruppiert und gezaehlt. */
export function dayKey(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Der Monat als `YYYY-MM` — die Einheit, in der Geld gezaehlt wird. */
export function monthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const MINUTES_PER_DAY = 24 * 60;

function minutesOf(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

/** Wie lange eine Nacht war — ueber Mitternacht hinweg gerechnet. */
export function sleepMinutes(row: { bedtime: string; wakeTime: string }): number {
  return (minutesOf(row.wakeTime) - minutesOf(row.bedtime) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** So lang darf ein Titel aus der ersten Nachricht werden. */
const TITLE_LENGTH = 48;

/** Der Titel eines Gespraechs: die erste Frage, gekuerzt. */
export function chatTitleOf(text: string): string {
  const line = text.trim().split('\n')[0] ?? '';
  return line.length > TITLE_LENGTH ? `${line.slice(0, TITLE_LENGTH - 1)}…` : line;
}
