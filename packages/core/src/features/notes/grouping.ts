/**
 * Ordnen und Gruppieren der Notizliste: Angeheftet, Heute, Letzte 7 Tage,
 * dann Monate dieses Jahres, dann fruehere Jahre. Alles in Ortszeit, `now`
 * kommt immer von aussen — so rechnen die Tests mit festen Tagen.
 */

export type NoteSort = 'edited' | 'created' | 'title';

export type NoteGroup =
  | { kind: 'pinned' }
  | { kind: 'all' }
  | { kind: 'today' }
  | { kind: 'week' }
  | { kind: 'month'; year: number; month: number }
  | { kind: 'year'; year: number };

export type NoteSection<T> = { key: string; group: NoteGroup; notes: T[] };

export type SortableNote = {
  title: string;
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** „Letzte 7 Tage“ reicht so viele Tage vor heute zurueck. */
const WEEK_DAYS = 7;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Ganze Kalendertage zwischen zwei Zeitpunkten, unabhaengig von Sommerzeit. */
function calendarDaysBetween(earlier: Date, later: Date): number {
  const a = startOfDay(earlier);
  const b = startOfDay(later);
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function dateOf(note: SortableNote, sort: NoteSort): string {
  return sort === 'created' ? note.createdAt : note.updatedAt;
}

/** Ohne Titel stehen beim Sortieren nach Titel am Ende. */
export function sortNotes<T extends SortableNote>(notes: readonly T[], sort: NoteSort): T[] {
  return [...notes].sort((a, b) => {
    if (sort === 'title') {
      const aTitle = a.title.trim();
      const bTitle = b.title.trim();
      if (!aTitle !== !bTitle) return aTitle ? -1 : 1;
      return aTitle.localeCompare(bTitle) || b.updatedAt.localeCompare(a.updatedAt);
    }
    return dateOf(b, sort).localeCompare(dateOf(a, sort));
  });
}

export function groupOf(iso: string, now: Date): NoteGroup {
  const date = new Date(iso);
  const days = calendarDaysBetween(date, now);
  if (days <= 0) return { kind: 'today' };
  if (days <= WEEK_DAYS) return { kind: 'week' };
  if (date.getFullYear() === now.getFullYear()) {
    return { kind: 'month', year: date.getFullYear(), month: date.getMonth() };
  }
  return { kind: 'year', year: date.getFullYear() };
}

function keyOf(group: NoteGroup): string {
  switch (group.kind) {
    case 'month':
      return `month-${group.year}-${group.month}`;
    case 'year':
      return `year-${group.year}`;
    default:
      return group.kind;
  }
}

/**
 * Die Abschnitte der Liste. Angeheftete stehen immer zuerst; nach Titel oder
 * ohne Gruppieren folgt der Rest in einem einzigen Abschnitt.
 */
export function sectionNotes<T extends SortableNote>(
  notes: readonly T[],
  options: { sort: NoteSort; groupByDate: boolean; now: Date },
): NoteSection<T>[] {
  const sorted = sortNotes(notes, options.sort);
  const pinned = sorted.filter((note) => note.pinned);
  const rest = sorted.filter((note) => !note.pinned);
  const sections: NoteSection<T>[] = [];
  if (pinned.length > 0) sections.push({ key: 'pinned', group: { kind: 'pinned' }, notes: pinned });

  if (options.sort === 'title' || !options.groupByDate) {
    if (rest.length > 0) sections.push({ key: 'all', group: { kind: 'all' }, notes: rest });
    return sections;
  }

  // Sortiert nach Datum folgen gleiche Gruppen direkt aufeinander.
  return rest.reduce<NoteSection<T>[]>((list, note) => {
    const group = groupOf(dateOf(note, options.sort), options.now);
    const key = keyOf(group);
    const last = list[list.length - 1];
    if (last && last.key === key) {
      return [...list.slice(0, -1), { ...last, notes: [...last.notes, note] }];
    }
    return [...list, { key, group, notes: [note] }];
  }, sections);
}

/** Wie eine Zeile ihre Zeit zeigt: „09:14“, „Gestern“, „Di“ oder „3.9.25“. */
export type RowStamp = 'time' | 'yesterday' | 'weekday' | 'date';

export function rowStampOf(iso: string, now: Date): RowStamp {
  const days = calendarDaysBetween(new Date(iso), now);
  if (days <= 0) return 'time';
  if (days === 1) return 'yesterday';
  if (days < WEEK_DAYS) return 'weekday';
  return 'date';
}
