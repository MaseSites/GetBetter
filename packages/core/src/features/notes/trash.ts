/** So lange liegt eine geloeschte Notiz in „Zuletzt gelöscht“. */
export const TRASH_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Ab diesem Zeitpunkt Geloeschtes ist abgelaufen und geht endgueltig. */
export function trashCutoff(now: Date): string {
  return new Date(now.getTime() - TRASH_DAYS * DAY_MS).toISOString();
}

/** Wie viele Tage die Notiz noch bleibt; am letzten Tag 1, nie weniger. */
export function trashDaysLeft(deletedAt: string, now: Date): number {
  const elapsed = now.getTime() - new Date(deletedAt).getTime();
  return Math.max(1, Math.ceil((TRASH_DAYS * DAY_MS - elapsed) / DAY_MS));
}
