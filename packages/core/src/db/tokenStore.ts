import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Wo das Sitzungs-Token liegt. Im Browser gibt es keinen sicheren Speicher —
 * dort bleibt es in AsyncStorage (localStorage). Auf dem Telefon nimmt
 * `tokenStore.native.ts` den Schluesselbund bzw. Keystore.
 */
export const tokenStore = {
  get: (key: string) => AsyncStorage.getItem(key),
  set: (key: string, value: string) => AsyncStorage.setItem(key, value),
  remove: (key: string) => AsyncStorage.removeItem(key),
};
