import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Die Sitzung auf dem Geraet: Konto-Id und das Geheimnis vom Dienst
 * (`session` beim Anmelden). Ohne beides muss man sich neu anmelden.
 *
 * Auf dem Geraet liegt sie im Schluesselbund (`expo-secure-store`, iOS
 * Keychain / Android Keystore), im Browser in dessen Ablage — `storage` ist
 * die eine Stelle, die das unterscheidet.
 */
const WEB_KEY = 'better-life/session/v2';
/** Der Schluesselbund erlaubt keine Schraegstriche im Namen. */
const DEVICE_KEY = 'better-life.session.v2';
/** Vor den Sitzungen lag nur die Konto-Id da — die reicht nicht mehr. */
const LEGACY_KEY = 'better-life/session/v1';

export type StoredSession = { accountId: string; token: string };

const storage =
  Platform.OS === 'web'
    ? {
        key: WEB_KEY,
        get: (key: string) => AsyncStorage.getItem(key),
        set: (key: string, value: string) => AsyncStorage.setItem(key, value),
        remove: (key: string) => AsyncStorage.removeItem(key),
      }
    : {
        key: DEVICE_KEY,
        get: (key: string) => SecureStore.getItemAsync(key),
        set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
        remove: (key: string) => SecureStore.deleteItemAsync(key),
      };

function parse(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const { accountId, token } = value as { accountId?: unknown; token?: unknown };
    if (typeof accountId !== 'string' || typeof token !== 'string') return null;
    return accountId.length > 0 && token.length > 0 ? { accountId, token } : null;
  } catch {
    return null;
  }
}

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const stored = parse(await storage.get(storage.key));
    // Die alte Ablage ohne Geheimnis raeumen wir weg — einmal neu anmelden.
    if (!stored) await AsyncStorage.removeItem(LEGACY_KEY).catch(() => undefined);
    return stored;
  } catch {
    return null;
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  await storage.set(storage.key, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await storage.remove(storage.key).catch(() => undefined);
}
