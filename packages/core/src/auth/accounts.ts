import * as Crypto from 'expo-crypto';

import { db, notifyDataChanged } from '@/db';
import type { Account } from '@/db';

import {
  authenticate,
  fetchAccount,
  fetchByUsername,
  pushProfile,
  register,
  type RemoteAccount,
  type ServiceError,
} from '@/db/service';

/**
 * Konten liegen im Kontodienst (`services/accounts`), nicht mehr in jeder App
 * einzeln. Damit gilt dieselbe Anmeldung in allen Better-Apps.
 *
 * Lokal bleibt eine Abschrift: Vorname, Sprache, Aussehen und alles, was nur
 * diese App angeht (Favoriten, aktiver Haushalt). Sie ist es auch, an der die
 * Daten dieser App haengen — der Dienst kennt nur die Person.
 */

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normaliseUsername(input: string): string {
  return input.trim().toLowerCase().replace(/^@/, '');
}

export type AuthError = ServiceError;
export type AuthResult = { ok: true; account: Account } | { ok: false; error: AuthError };

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Die Abschrift auf den Stand des Dienstes bringen. Was diese App dazugelegt
 * hat, bleibt stehen — der Dienst weiss nichts von Favoriten und Haushalten.
 */
async function mirror(remote: RemoteAccount): Promise<Account> {
  const existing =
    (await db.accounts.find(remote.id)) ??
    (await db.accounts.findBy((row) => row.email === remote.email));

  // Ein frisch angelegtes Konto hat noch keinen Vornamen — der lokale bleibt
  // dann stehen, statt von einer leeren Zeichenkette ueberschrieben zu werden.
  const shared = {
    email: remote.email,
    username: remote.username,
    firstName: remote.firstName || (existing?.firstName ?? ''),
    language: remote.language,
    ...(remote.themeMode ? { themeMode: remote.themeMode as Account['themeMode'] } : {}),
    ...(remote.accentKey ? { accentKey: remote.accentKey } : {}),
    ...(remote.themePreset ? { themePreset: remote.themePreset } : {}),
  };

  if (existing) {
    const updated = await db.accounts.update(existing.id, shared);
    notifyDataChanged();
    return updated ?? existing;
  }

  const account: Account = {
    id: remote.id,
    ...shared,
    onboarded: false,
    selectedAreas: [],
    householdId: null,
    createdAt: remote.createdAt,
  };
  await db.accounts.insert(account);
  notifyDataChanged();
  return account;
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const result = await register(email, password);
  if (!result.ok) return result;
  return { ok: true, account: await mirror(result.account) };
}

/**
 * Konten aus der Zeit vor dem Dienst pruefen ihr Passwort noch selbst:
 * SHA-256 ueber Salt und Passwort. Stimmt es, wandert das Konto in den Dienst.
 */
async function adoptLegacy(email: string, password: string): Promise<AuthResult | null> {
  const local = await db.accounts.findBy((row) => row.email === normaliseEmail(email));
  if (!local?.passwordHash || !local.passwordSalt) return null;

  const attempt = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${local.passwordSalt}:${password}`,
  );
  if (attempt !== local.passwordHash) return { ok: false, error: 'wrong_password' };

  const created = await register(email, password);
  if (!created.ok) return { ok: false, error: created.error };

  // Was das alte Konto schon wusste, gehoert jetzt in den Dienst.
  await pushProfile(created.account.id, {
    firstName: local.firstName,
    language: local.language,
    ...(local.themeMode ? { themeMode: local.themeMode } : {}),
    ...(local.accentKey ? { accentKey: local.accentKey } : {}),
    ...(local.themePreset ? { themePreset: local.themePreset } : {}),
  });

  return { ok: true, account: await mirror({ ...created.account, firstName: local.firstName }) };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const result = await authenticate(email, password);
  if (result.ok) return { ok: true, account: await mirror(result.account) };

  // Der Dienst kennt das Konto nicht — vielleicht ist es noch ein altes.
  if (result.error === 'not_found') {
    const adopted = await adoptLegacy(email, password);
    if (adopted) return adopted;
  }
  return result;
}

/**
 * Beim Start: erst die Abschrift, damit die App sofort steht, dann beim Dienst
 * nachfragen. Laeuft er gerade nicht, bleibt man mit der Abschrift angemeldet.
 */
export async function findAccount(id: string): Promise<Account | undefined> {
  const local = await db.accounts.find(id);

  const byId = await fetchAccount(id);
  if (byId.ok) return mirror(byId.account);

  // Aeltere Abschriften tragen noch ihre alte Kennung — dann hilft der Name.
  if (local?.username) {
    const byName = await fetchByUsername(local.username);
    if (byName.ok && byName.account.email === local.email) return mirror(byName.account);
  }
  return local;
}

/** Fuer Einladungen: der Dienst kennt alle, die lokale Ablage nur die eigenen. */
export async function findByUsername(username: string): Promise<Account | undefined> {
  const wanted = normaliseUsername(username);
  const remote = await fetchByUsername(wanted);
  if (remote.ok) return mirror(remote.account);
  return db.accounts.findBy((row) => row.username === wanted);
}

export async function updateAccount(
  id: string,
  patch: Partial<Omit<Account, 'id' | 'email'>>,
): Promise<Account | undefined> {
  const updated = await db.accounts.update(id, patch);
  notifyDataChanged();

  // Was in allen Apps gleich aussehen soll, geht auch an den Dienst.
  const shared = {
    ...(patch.firstName !== undefined ? { firstName: patch.firstName } : {}),
    ...(patch.language !== undefined ? { language: patch.language } : {}),
    ...(patch.username !== undefined ? { username: patch.username } : {}),
    ...(patch.themeMode !== undefined ? { themeMode: patch.themeMode } : {}),
    ...(patch.accentKey !== undefined ? { accentKey: patch.accentKey } : {}),
    ...(patch.themePreset !== undefined ? { themePreset: patch.themePreset } : {}),
  };
  if (Object.keys(shared).length > 0) void pushProfile(id, shared);

  return updated;
}

export async function accountCount(): Promise<number> {
  return db.accounts.count();
}
