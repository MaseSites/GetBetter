// Relative Pfade mit Absicht: so laeuft die Datei auch in den Tests unter Node.
import type { TaskPriority, TaskRepeat } from '../../db/types';

import type { ParsedTask } from './parse';

/** Was die Ansicht vorgibt: Heute das Datum, ein Projekt sich selbst, Geplant den Tag. */
export type QuickAddDefaults = {
  day: string | null;
  projectId: string | null;
  section: string | null;
};

/** Was ueber die Leiste gewaehlt wurde. Fehlt ein Feld, gilt, was der Satz sagt. */
export type QuickAddManual = {
  day?: string | null;
  time?: string | null;
  priority?: TaskPriority;
  projectId?: string | null;
  reminder?: number | null;
};

export type TaskDraft = {
  title: string;
  day: string | null;
  time: string | null;
  priority: TaskPriority;
  projectId: string | null;
  section: string | null;
  tags: readonly string[];
  repeat: TaskRepeat | null;
  reminderOffsetMinutes: number | null;
};

export const NO_DEFAULTS: QuickAddDefaults = { day: null, projectId: null, section: null };

/**
 * Setzt Satz, Leiste und Ansicht zu einer Aufgabe zusammen. Die Leiste schlaegt
 * den Satz, der Satz die Ansicht. Eine Uhrzeit oder Wiederholung ohne Tag
 * gilt fuer heute; mit Uhrzeit kommt die Erinnerung zur Uhrzeit.
 */
export function draftOf(
  parsed: ParsedTask,
  manual: QuickAddManual,
  defaults: QuickAddDefaults,
  projects: readonly { id: string; name: string }[],
  today: string,
): TaskDraft {
  const needsDay = parsed.time !== null || parsed.repeat !== null;
  const day =
    manual.day !== undefined
      ? manual.day
      : (parsed.day ?? defaults.day ?? (needsDay ? today : null));
  const time = day === null ? null : manual.time !== undefined ? manual.time : parsed.time;
  const reminderOffsetMinutes =
    time === null ? null : manual.reminder !== undefined ? manual.reminder : 0;
  const parsedProjectId =
    parsed.project === null
      ? null
      : (projects.find((project) => project.name === parsed.project)?.id ?? null);
  const projectId =
    manual.projectId !== undefined ? manual.projectId : (parsedProjectId ?? defaults.projectId);

  return {
    title: parsed.title,
    day,
    time,
    priority: manual.priority ?? parsed.priority,
    projectId,
    section: projectId !== null && projectId === defaults.projectId ? defaults.section : null,
    tags: parsed.tags,
    repeat: day === null ? null : parsed.repeat,
    reminderOffsetMinutes,
  };
}

export type Suggestion = { kind: 'tag' | 'project'; value: string };

const MAX_SUGGESTIONS = 5;

/** Das Wort, an dem gerade getippt wird. */
export function lastWord(text: string): string {
  if (/\s$/u.test(text)) return '';
  return /(\S+)$/u.exec(text)?.[1] ?? '';
}

/** Ersetzt das letzte Wort und laesst ein Leerzeichen fuer das naechste. */
export function replaceLastWord(text: string, word: string): string {
  return `${text.replace(/\S+$/u, '')}${word} `;
}

/** Vorschlaege fuer `#…` und `@…` aus den bekannten Tags und Projekten. */
export function suggestionsFor(
  text: string,
  tags: readonly string[],
  projects: readonly string[],
): Suggestion[] {
  const word = lastWord(text);
  const marker = word.charAt(0);
  if (marker !== '#' && marker !== '@') return [];
  const typed = word.slice(1).toLocaleLowerCase('de');
  const pool = marker === '#' ? tags : projects;
  return pool
    .filter((name) => {
      const lower = name.toLocaleLowerCase('de');
      return lower.startsWith(typed) && lower !== typed;
    })
    .slice(0, MAX_SUGGESTIONS)
    .map((value) => ({ kind: marker === '#' ? 'tag' : 'project', value }));
}

/** Wie ein Vorschlag eingefuegt wird: Leerzeichen im Projektnamen werden zu -. */
export function tokenOf(suggestion: Suggestion): string {
  return suggestion.kind === 'tag'
    ? `#${suggestion.value}`
    : `@${suggestion.value.replace(/\s+/gu, '-')}`;
}
