// Relative Pfade mit Absicht: so laeuft die Datei auch in den Tests unter Node.
import { addDays, nextMonday } from './days';

/** Wohin „Verschieben“ eine Aufgabe legt: Heute, Morgen, Nächste Woche. */
export const POSTPONE_KINDS = ['today', 'tomorrow', 'nextWeek'] as const;

export type PostponeKind = (typeof POSTPONE_KINDS)[number];

/**
 * Der neue Tag — immer ab dem echten Heute, nie ab der alten Frist: wer den
 * Rasen seit drei Tagen nicht gemaeht hat, schiebt ihn auf morgen, nicht auf
 * vorgestern. „Nächste Woche“ ist der Montag danach, an einem Sonntag also morgen.
 */
export function postponeTarget(kind: PostponeKind, today: string): string {
  switch (kind) {
    case 'today':
      return today;
    case 'tomorrow':
      return addDays(today, 1);
    case 'nextWeek':
      return nextMonday(today);
  }
}

/** Die neue Frist: anderer Tag, dieselbe Uhrzeit. */
export function postponeSchedule(
  kind: PostponeKind,
  today: string,
  time: string | null,
): { day: string; time: string | null } {
  return { day: postponeTarget(kind, today), time };
}

/** „Heute“ steht nur bei Ueberfaelligem zur Wahl — sonst ist die Aufgabe schon dort oder spaeter. */
export function postponeKindsFor(dueDay: string | null, today: string): PostponeKind[] {
  return dueDay !== null && dueDay < today
    ? ['today', 'tomorrow', 'nextWeek']
    : ['tomorrow', 'nextWeek'];
}
