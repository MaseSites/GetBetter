/**
 * Die Rechnung hinter dem grossen Zeitstrahl: wo jede Karte im Stundenraster
 * steht und wohin er beim Oeffnen rollt. Rein, ohne Bildschirm, getestet.
 */

/** Eine Stunde im grossen Zeitstrahl — Platz fuer Titel und Zeit. */
export const TIMELINE_HOUR = 72;
/** Keine Karte ist niedriger als ein Finger breit. */
export const MIN_CARD = 48;

const MINUTE = 60_000;
export const DAY_MINUTES = 24 * 60;

/** Was im Raster steht: ein Zeitpunkt, und wo es eines gibt, sein Ende. */
export type Timed = { key: string; at: string; until?: string | null };

export type Placement = {
  key: string;
  /** Minute seit Mitternacht, an der die Karte beginnt. */
  start: number;
  top: number;
  height: number;
  /** Nebeneinander, wenn sich Karten ueberschneiden: Spalte und wie viele es sind. */
  column: number;
  columns: number;
};

/** Minuten seit Mitternacht von `dayStart`, auf den Tag begrenzt. */
export function minutesIn(iso: string, dayStart: Date): number {
  const minutes = (new Date(iso).getTime() - dayStart.getTime()) / MINUTE;
  return Math.min(DAY_MINUTES, Math.max(0, minutes));
}

/** Wie weit unten eine Minute im Raster steht. */
export const offsetOf = (minutes: number, hour = TIMELINE_HOUR) => (minutes / 60) * hour;

/**
 * Wo jede Karte steht: so hoch, wie sie dauert, mindestens `minHeight`.
 * Ueberschneidungen — auch die, die erst durch die Mindesthoehe entstehen —
 * stehen nebeneinander: erst in Gruppen, die sich beruehren, dann innerhalb der
 * Gruppe die erste freie Spalte. Wie im Kalender.
 */
export function placeDay(
  items: readonly Timed[],
  dayStart: Date,
  hour = TIMELINE_HOUR,
  minHeight = MIN_CARD,
): Placement[] {
  const shortest = (minHeight / hour) * 60;
  const spans = items
    .map((item) => {
      const from = Math.min(minutesIn(item.at, dayStart), DAY_MINUTES - shortest);
      const to = item.until ? minutesIn(item.until, dayStart) : from;
      return {
        key: item.key,
        start: from,
        end: Math.min(DAY_MINUTES, Math.max(to, from + shortest)),
      };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const placed: Placement[] = [];
  let group: typeof spans = [];
  let groupEnd = -1;

  const flush = () => {
    const ends: number[] = [];
    const columns = group.map((span) => {
      const free = ends.findIndex((end) => end <= span.start);
      const column = free === -1 ? ends.length : free;
      ends[column] = span.end;
      return column;
    });
    group.forEach((span, index) =>
      placed.push({
        key: span.key,
        start: span.start,
        top: offsetOf(span.start, hour),
        height: offsetOf(span.end - span.start, hour),
        column: columns[index] ?? 0,
        columns: ends.length,
      }),
    );
    group = [];
    groupEnd = -1;
  };

  for (const span of spans) {
    if (group.length > 0 && span.start >= groupEnd) flush();
    group.push(span);
    groupEnd = Math.max(groupEnd, span.end);
  }
  if (group.length > 0) flush();
  return placed;
}

/**
 * Wohin der Zeitstrahl beim Oeffnen rollt: zum angetippten Eintrag, sonst zu
 * jetzt, sonst zum ersten des Tages, sonst zum Morgen — mit einer Stunde Luft
 * darueber, damit man sieht, was davor war.
 */
export function scrollTargetOf(
  focus: number | null,
  now: number | null,
  first: number | null,
  hour = TIMELINE_HOUR,
): number {
  const minutes = focus ?? now ?? first ?? 7 * 60;
  return Math.max(0, offsetOf(minutes - 60, hour));
}
