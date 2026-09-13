/**
 * Die Wege in die Notizen. Andere Bildschirme (Heute, Suche) nutzen dieselben
 * Adressen: `/run/notes?new=1` legt an, `/run/notes?note=<id>` oeffnet.
 */
const BASE = '/run/notes';

export function noteHref(id: string, query?: string): string {
  const search = query && query.trim().length > 0 ? `&q=${encodeURIComponent(query.trim())}` : '';
  return `${BASE}?note=${encodeURIComponent(id)}${search}`;
}

export function newNoteHref(folderId: string | null): string {
  return folderId ? `${BASE}?new=1&folder=${encodeURIComponent(folderId)}` : `${BASE}?new=1`;
}

export function tagHref(tag: string): string {
  return `${BASE}?tag=${encodeURIComponent(tag)}`;
}

export const NOTES_HREF = BASE;
