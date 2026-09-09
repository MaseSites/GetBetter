import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Der Draht zum Kontodienst (`services/accounts`). Er fuehrt die Konten aller
 * Better-Apps an einer Stelle — deshalb gilt dieselbe Anmeldung ueberall.
 *
 * Die Daten der Apps bleiben davon unberuehrt: Termine, Listen und Haushalte
 * liegen weiter auf dem Geraet. Hier geht es nur um "wer bist du".
 */
export const ACCOUNTS_PORT = 8090;

/**
 * Im Browser laeuft der Dienst neben den Apps auf demselben Rechner. Auf einem
 * Geraet nehmen wir den Rechner, von dem Expo geladen hat — das ist derselbe.
 */
export function serviceUrl(): string {
  if (Platform.OS === 'web') return `http://localhost:${ACCOUNTS_PORT}`;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:${ACCOUNTS_PORT}`;
}

/** Was der Dienst ueber ein Konto herausgibt — nie Salt oder Hash. */
export type RemoteAccount = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  language: string;
  themeMode?: string;
  accentKey?: string;
  themePreset?: string;
  createdAt: string;
};

export type ServiceError =
  | 'email_invalid'
  | 'email_taken'
  | 'password_too_short'
  | 'not_found'
  | 'wrong_password'
  | 'offline';

export type ServiceResult =
  { ok: true; account: RemoteAccount } | { ok: false; error: ServiceError };

async function call(
  path: string,
  init?: { method: string; body?: unknown },
): Promise<ServiceResult> {
  try {
    const response = await fetch(`${serviceUrl()}${path}`, {
      method: init?.method ?? 'GET',
      ...(init?.body === undefined
        ? {}
        : {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(init.body),
          }),
    });
    const data: unknown = await response.json();
    const payload = data as { account?: RemoteAccount; error?: ServiceError };
    if (payload.account) return { ok: true, account: payload.account };
    return { ok: false, error: payload.error ?? 'offline' };
  } catch {
    // Der Dienst laeuft nicht — das ist ein eigener Fall, kein falsches Passwort.
    return { ok: false, error: 'offline' };
  }
}

export function register(email: string, password: string): Promise<ServiceResult> {
  return call('/v1/accounts', { method: 'POST', body: { email, password } });
}

export function authenticate(email: string, password: string): Promise<ServiceResult> {
  return call('/v1/sessions', { method: 'POST', body: { email, password } });
}

export function fetchAccount(id: string): Promise<ServiceResult> {
  return call(`/v1/accounts/${encodeURIComponent(id)}`);
}

export function fetchByUsername(username: string): Promise<ServiceResult> {
  return call(`/v1/accounts/by-username/${encodeURIComponent(username)}`);
}

/** Vorname, Sprache, Benutzername und Aussehen gelten in allen Apps. */
export function pushProfile(
  id: string,
  changes: Partial<Pick<RemoteAccount, 'firstName' | 'language' | 'username'>> & {
    themeMode?: string;
    accentKey?: string;
    themePreset?: string;
  },
): Promise<ServiceResult> {
  return call(`/v1/accounts/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes });
}

export async function isReachable(): Promise<boolean> {
  try {
    const response = await fetch(`${serviceUrl()}/v1/health`);
    return response.ok;
  } catch {
    return false;
  }
}
