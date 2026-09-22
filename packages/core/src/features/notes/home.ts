import type { NoteRow } from '../../db/types';

/**
 * Notizen auf der Startseite: angeheftet (`homeAt`) und nicht im Papierkorb.
 * Rein gerechnet — getestet in `home.test.ts`.
 */
export function isOnHome(row: Pick<NoteRow, 'homeAt' | 'deletedAt'>): boolean {
  return Boolean(row.homeAt) && !row.deletedAt;
}

/** Was zuletzt angeheftet wurde, steht vorne. */
export function byHomeAt(a: Pick<NoteRow, 'homeAt'>, b: Pick<NoteRow, 'homeAt'>): number {
  return (b.homeAt ?? '').localeCompare(a.homeAt ?? '');
}

/** Die Vorschau auf der Karte: der Text ohne Leerzeilen und ohne Leerraum am Rand. */
export function homePreviewOf(body: string): string {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}
