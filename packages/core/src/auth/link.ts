import { db, notifyDataChanged } from '@/db';
import type { Account } from '@/db';

/**
 * Ein Konto von einer Better-App zur naechsten reichen.
 *
 * Jede App hat ihren eigenen Speicher — ohne Server gibt es kein gemeinsames
 * Konto, sondern nur dieselbe Person in fuenf Ablagen. Damit man sich nicht
 * fuenfmal registrieren muss, schickt die eine App der anderen die Kennung
 * samt Passwortpruefung; danach funktioniert dort dieselbe Anmeldung.
 *
 * Was mitgeht, ist die Person: Kennung, E-Mail, Benutzername, Vorname,
 * Sprache und Aussehen. Was nicht mitgeht, sind die Daten der App —
 * Termine, Listen und Haushalte bleiben, wo sie sind.
 *
 * Der Salt und der Hash reisen mit, damit die Anmeldung in der anderen App
 * auch ohne diesen Weg noch geht. Beides liegt ohnehin schon auf demselben
 * Geraet; mit einem Server faellt dieser Umweg ersatzlos weg.
 */
export type LinkPayload = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  language: string;
  themeMode?: string;
  accentKey?: string;
  themePreset?: string;
  passwordHash: string;
  passwordSalt: string;
};

export function toPayload(account: Account): LinkPayload {
  return {
    id: account.id,
    email: account.email,
    username: account.username,
    firstName: account.firstName,
    language: account.language,
    ...(account.themeMode ? { themeMode: account.themeMode } : {}),
    ...(account.accentKey ? { accentKey: account.accentKey } : {}),
    ...(account.themePreset ? { themePreset: account.themePreset } : {}),
    passwordHash: account.passwordHash,
    passwordSalt: account.passwordSalt,
  };
}

/** In die Adresse hinein und wieder heraus. */
export function encodeLink(account: Account): string {
  return encodeURIComponent(JSON.stringify(toPayload(account)));
}

export function decodeLink(raw: string): LinkPayload | null {
  try {
    const value: unknown = JSON.parse(decodeURIComponent(raw));
    if (typeof value !== 'object' || value === null) return null;
    const payload = value as Partial<LinkPayload>;
    if (!payload.id || !payload.email || !payload.passwordHash || !payload.passwordSalt) {
      return null;
    }
    return {
      id: payload.id,
      email: payload.email,
      username: payload.username ?? payload.email.split('@')[0] ?? 'nutzer',
      firstName: payload.firstName ?? '',
      language: payload.language ?? 'de',
      ...(payload.themeMode ? { themeMode: payload.themeMode } : {}),
      ...(payload.accentKey ? { accentKey: payload.accentKey } : {}),
      ...(payload.themePreset ? { themePreset: payload.themePreset } : {}),
      passwordHash: payload.passwordHash,
      passwordSalt: payload.passwordSalt,
    };
  } catch {
    return null;
  }
}

/**
 * Uebernimmt das Konto lokal: neu anlegen, oder ein vorhandenes mit derselben
 * Kennung oder E-Mail auf denselben Stand bringen. Was diese App an eigenen
 * Daten dazugelegt hat (Favoriten, Haushalt), bleibt unangetastet.
 */
export async function adoptAccount(payload: LinkPayload): Promise<Account> {
  const existing =
    (await db.accounts.find(payload.id)) ??
    (await db.accounts.findBy((row) => row.email === payload.email));

  const shared = {
    email: payload.email,
    username: payload.username,
    firstName: payload.firstName,
    language: payload.language,
    passwordHash: payload.passwordHash,
    passwordSalt: payload.passwordSalt,
    ...(payload.themeMode ? { themeMode: payload.themeMode as Account['themeMode'] } : {}),
    ...(payload.accentKey ? { accentKey: payload.accentKey } : {}),
    ...(payload.themePreset ? { themePreset: payload.themePreset } : {}),
  };

  if (existing) {
    const updated = await db.accounts.update(existing.id, shared);
    notifyDataChanged();
    return updated ?? existing;
  }

  const account: Account = {
    id: payload.id,
    ...shared,
    // Wer sein Konto mitbringt, hat das Einrichten schon hinter sich.
    onboarded: true,
    selectedAreas: [],
    favouriteModuleIds: [],
    householdId: null,
    createdAt: new Date().toISOString(),
  };
  await db.accounts.insert(account);
  notifyDataChanged();
  return account;
}
