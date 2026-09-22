/**
 * Den Benutzernamen gibt es einmal im Monat neu — so bleibt man fuer andere
 * auffindbar. Das letzte Wort hat der Dienst (`services/api/auth.js`,
 * dieselbe Zahl, `test/username-client.test.js` haelt beide gleich); die App
 * rechnet nur vor, damit das Feld es gleich sagt. Rein, getestet.
 */
export const USERNAME_COOLDOWN_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Ab wann der Benutzername wieder geaendert werden darf — null heisst: jetzt.
 * Beim Anlegen zaehlt nichts; erst eine Aenderung setzt `usernameChangedAt`.
 */
export function usernameFreeAt(
  changedAt: string | null | undefined,
  now: Date = new Date(),
): Date | null {
  const changed = Date.parse(changedAt ?? '');
  if (Number.isNaN(changed)) return null;
  const free = changed + USERNAME_COOLDOWN_DAYS * DAY_MS;
  return free > now.getTime() ? new Date(free) : null;
}
