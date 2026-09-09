import * as Crypto from 'expo-crypto';

import { db, newId, notifyDataChanged } from '@/db';
import type { Account } from '@/db';

/**
 * Passwoerter liegen als SHA-256 ueber Salt + Passwort. Das ist bewusst
 * einfach und reicht fuer einen lokalen Speicher — sobald ein Server
 * dazukommt, uebernimmt dessen Anmeldung samt richtigem Verfahren.
 */
async function hash(password: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);
}

function makeSalt(): string {
  return Crypto.randomUUID();
}

/**
 * Die Kennung wird aus der E-Mail abgeleitet, nicht gewuerfelt. So traegt
 * dieselbe Person in jeder Better-App dieselbe Id — das ist die Grundlage
 * dafuer, dass ein Server die fuenf Ablagen spaeter zusammenfuehren kann.
 */
export async function accountIdFor(email: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    normaliseEmail(email),
  );
  return `acc_${digest.slice(0, 24)}`;
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normaliseUsername(input: string): string {
  return input.trim().toLowerCase().replace(/^@/, '');
}

/** Aus der E-Mail abgeleitet und bei Bedarf durchnummeriert. */
async function makeUsername(email: string): Promise<string> {
  const base = (email.split('@')[0] ?? 'nutzer').replace(/[^a-z0-9._-]/g, '') || 'nutzer';
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}${suffix}`;
    const taken = await db.accounts.findBy((row) => row.username === candidate);
    if (!taken) return candidate;
  }
  return newId('user').toLowerCase();
}

export async function findByUsername(username: string): Promise<Account | undefined> {
  const wanted = normaliseUsername(username);
  return db.accounts.findBy((row) => row.username === wanted);
}

export type AuthError =
  'email_invalid' | 'email_taken' | 'password_too_short' | 'not_found' | 'wrong_password';

export type AuthResult = { ok: true; account: Account } | { ok: false; error: AuthError };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MIN_PASSWORD_LENGTH = 8;

export async function signUp(emailInput: string, password: string): Promise<AuthResult> {
  const email = normaliseEmail(emailInput);
  if (!EMAIL_PATTERN.test(email)) return { ok: false, error: 'email_invalid' };
  if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, error: 'password_too_short' };

  const existing = await db.accounts.findBy((row) => row.email === email);
  if (existing) return { ok: false, error: 'email_taken' };

  const salt = makeSalt();
  const account: Account = {
    id: await accountIdFor(email),
    email,
    username: await makeUsername(email),
    passwordHash: await hash(password, salt),
    passwordSalt: salt,
    firstName: '',
    language: 'de',
    onboarded: false,
    selectedAreas: [],
    favouriteModuleIds: [],
    householdId: null,
    createdAt: new Date().toISOString(),
  };

  await db.accounts.insert(account);
  notifyDataChanged();
  return { ok: true, account };
}

export async function signIn(emailInput: string, password: string): Promise<AuthResult> {
  const email = normaliseEmail(emailInput);
  const account = await db.accounts.findBy((row) => row.email === email);
  if (!account) return { ok: false, error: 'not_found' };

  const attempt = await hash(password, account.passwordSalt);
  if (attempt !== account.passwordHash) return { ok: false, error: 'wrong_password' };

  return { ok: true, account };
}

export async function findAccount(id: string): Promise<Account | undefined> {
  return db.accounts.find(id);
}

export async function updateAccount(
  id: string,
  patch: Partial<Omit<Account, 'id' | 'email' | 'passwordHash' | 'passwordSalt'>>,
): Promise<Account | undefined> {
  const updated = await db.accounts.update(id, patch);
  notifyDataChanged();
  return updated;
}

/**
 * Konten aus der Zeit vor den Benutzernamen bekommen einen. Laeuft einmal
 * beim Start und ist danach ein Nulldurchlauf.
 */
export async function backfillUsernames(): Promise<void> {
  const missing = await db.accounts.list({
    where: (row) => !row.username || row.username.length === 0,
  });
  for (const account of missing) {
    await db.accounts.update(account.id, { username: await makeUsername(account.email) });
  }
  if (missing.length > 0) notifyDataChanged();
}

export async function accountCount(): Promise<number> {
  return db.accounts.count();
}
