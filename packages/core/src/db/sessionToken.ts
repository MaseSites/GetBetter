import { tokenStore } from './tokenStore';

/**
 * Das Sitzungs-Token des Dienstes. Anmelden und Registrieren geben es heraus;
 * die Routen mit persoenlichen Daten (Better Fit) verlangen es als
 * `Authorization: Bearer …` und leiten das Konto nur daraus ab.
 *
 * Gemerkt wird es auf dem Geraet (am Telefon verschluesselt, siehe tokenStore.native.ts) — ausser beim „App ansehen“ aus dem Admin:
 * dort lebt ein Nur-Lesen-Token nur im Arbeitsspeicher.
 */
const TOKEN_KEY = 'better-life/token/v1';

let token: string | null = null;

export function sessionToken(): string | null {
  return token;
}

export async function setSessionToken(next: string, { persist = true } = {}): Promise<void> {
  token = next;
  if (persist) await tokenStore.set(TOKEN_KEY, next);
}

/** Beim Start: das gemerkte Token zurueckholen. */
export async function restoreSessionToken(): Promise<string | null> {
  try {
    token = await tokenStore.get(TOKEN_KEY);
  } catch {
    token = null;
  }
  return token;
}

export async function clearSessionToken({ persisted = true } = {}): Promise<void> {
  token = null;
  if (persisted) await tokenStore.remove(TOKEN_KEY);
}

/** Die Kopfzeile, wenn es ein Token gibt. */
export function authHeaders(): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
