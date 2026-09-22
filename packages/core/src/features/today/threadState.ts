/**
 * Wie eine Karte mit Uhrzeit im Tagesband steht, gemessen an jetzt. Rein,
 * getestet.
 *
 * - `past` — vorbei: das Ende ist erreicht (ohne Ende: der Zeitpunkt).
 * - `live` — dran: genau ab Beginn bis zum Ende, also erst, wenn die
 *   Jetzt-Linie die Karte beruehrt. Die Karte ist Better-Gruen und leicht
 *   groesser, die Linie wandert durch sie — ein laufender Termin wird nie
 *   uebersprungen.
 * - `next` — der naechste, der noch nicht begonnen hat.
 * - `later` — alles Weitere.
 */
export type ThreadState = 'past' | 'live' | 'next' | 'later';

const MINUTE = 60_000;

export type ThreadTimed = { at: string; until?: string | null };

/** Je Eintrag sein Zustand — die Eintraege nach Beginn sortiert. */
export function threadStates(entries: readonly ThreadTimed[], now: Date): ThreadState[] {
  const moment = now.getTime();
  let nextGiven = false;
  return entries.map((entry) => {
    const start = Date.parse(entry.at);
    const until = entry.until ? Date.parse(entry.until) : Number.NaN;
    const end = Number.isNaN(until) ? start : Math.max(until, start);
    if (moment >= end) return 'past';
    if (moment >= start) return 'live';
    if (nextGiven) return 'later';
    nextGiven = true;
    return 'next';
  });
}

/** Wo die Jetzt-Linie steht: vor dem ersten Eintrag, der nicht vorbei ist. */
export function nowIndexOf(states: readonly ThreadState[]): number {
  const index = states.findIndex((state) => state !== 'past');
  return index === -1 ? states.length : index;
}

/**
 * Wie weit ein laufender Eintrag ist — 0 am Beginn, 1 am Ende. Null, wenn er
 * nicht laeuft (noch nicht begonnen, schon vorbei, oder ohne Ende). Daran
 * wandert die Jetzt-Linie durch seine Karte.
 */
export function progressOf(entry: ThreadTimed, now: Date): number | null {
  const start = Date.parse(entry.at);
  const end = entry.until ? Date.parse(entry.until) : Number.NaN;
  const moment = now.getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  if (moment < start || moment >= end) return null;
  return (moment - start) / (end - start);
}

/** Wie viele Minuten ein laufender Eintrag noch geht, aufgerundet — oder null. */
export function minutesLeftOf(entry: ThreadTimed, now: Date): number | null {
  if (progressOf(entry, now) === null || !entry.until) return null;
  return Math.ceil((Date.parse(entry.until) - now.getTime()) / MINUTE);
}

/** In wie vielen Minuten ein Eintrag beginnt, aufgerundet — null, wenn er schon begonnen hat. */
export function minutesUntilOf(entry: ThreadTimed, now: Date): number | null {
  const start = Date.parse(entry.at);
  const moment = now.getTime();
  if (Number.isNaN(start) || start <= moment) return null;
  return Math.ceil((start - moment) / MINUTE);
}
