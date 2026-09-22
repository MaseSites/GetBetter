import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Auf dem Telefon liegt das Token verschluesselt im Schluesselbund (iOS) bzw.
 * im Keystore (Android), nur auf diesem Geraet. Ein Token aus einer aelteren
 * Fassung, das noch in AsyncStorage steht, zieht beim ersten Lesen um.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

// SecureStore erlaubt nur Buchstaben, Ziffern, `.`, `-` und `_` im Schluessel.
const secureKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

export const tokenStore = {
  async get(key: string): Promise<string | null> {
    const stored = await SecureStore.getItemAsync(secureKey(key), OPTIONS);
    if (stored !== null) return stored;
    const legacy = await AsyncStorage.getItem(key);
    if (legacy !== null) {
      await SecureStore.setItemAsync(secureKey(key), legacy, OPTIONS);
      await AsyncStorage.removeItem(key);
    }
    return legacy;
  },
  async set(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(secureKey(key), value, OPTIONS);
  },
  async remove(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(secureKey(key), OPTIONS);
    await AsyncStorage.removeItem(key);
  },
};
