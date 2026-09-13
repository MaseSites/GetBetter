import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

import { approximate } from './places';

/**
 * „Mein Standort“: ungefaehr und nur, solange die App offen ist. Gefragt wird
 * erst, wenn jemand auf „Erlauben“ tippt — nie beim Oeffnen.
 *
 * Es geht ueber `navigator.geolocation`, also nur im Browser. Auf dem Geraet
 * fehlt dafuer noch `expo-location`; dort ist der Standort `unsupported`.
 * Die Koordinaten bleiben auf dem Geraet und landen nie am Konto.
 */

export type LocationState =
  | { status: 'checking' }
  | { status: 'unsupported' }
  /** Noch nie gefragt: die Seite zeigt einmal „Wetter für deinen Standort · Erlauben“. */
  | { status: 'ask' }
  /** Die Zeile wurde weggetippt, ohne zu erlauben. */
  | { status: 'dismissed' }
  | { status: 'locating' }
  | { status: 'granted'; lat: number; lon: number }
  | { status: 'denied' }
  /** Erlaubt, aber gerade nicht zu finden. */
  | { status: 'failed' };

type Remembered = 'granted' | 'denied' | 'dismissed';

const STORAGE_KEY = 'better-life/weather/location/v1';
/** Ein Standort bis zu einer halben Stunde alt reicht fuers Wetter. */
const MAX_AGE_MS = 30 * 60_000;
const TIMEOUT_MS = 15_000;
/** `GeolocationPositionError.PERMISSION_DENIED` */
const PERMISSION_DENIED = 1;

function geolocation(): Geolocation | null {
  return typeof navigator !== 'undefined' && navigator.geolocation ? navigator.geolocation : null;
}

async function browserPermission(): Promise<PermissionState | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions) return null;
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state;
  } catch {
    // Nicht jeder Browser kennt die Abfrage; dann zaehlt, was wir uns gemerkt haben.
    return null;
  }
}

async function remembered(): Promise<Remembered | null> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    return value === 'granted' || value === 'denied' || value === 'dismissed' ? value : null;
  } catch {
    return null;
  }
}

function remember(value: Remembered) {
  AsyncStorage.setItem(STORAGE_KEY, value).catch(() => {
    // Vergisst das Geraet es, fragt die Seite beim naechsten Mal eben noch einmal.
  });
}

class LocationStore {
  private state: LocationState = { status: 'checking' };
  private started = false;
  private readonly listeners = new Set<() => void>();

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly get = (): LocationState => this.state;

  /** Einmal pro App-Start: nachsehen, ohne zu fragen. */
  start() {
    if (this.started) return;
    this.started = true;
    void this.check();
  }

  /** Der Tipp auf „Erlauben“. */
  readonly request = () => {
    this.locate();
  };

  readonly dismiss = () => {
    this.set({ status: 'dismissed' });
    remember('dismissed');
  };

  private async check() {
    if (!geolocation()) {
      this.set({ status: 'unsupported' });
      return;
    }
    const [permission, memory] = await Promise.all([browserPermission(), remembered()]);
    if (permission === 'denied' || (permission === null && memory === 'denied')) {
      this.set({ status: 'denied' });
      return;
    }
    if (permission === 'granted' || (permission === null && memory === 'granted')) {
      this.locate();
      return;
    }
    this.set({ status: memory === 'dismissed' ? 'dismissed' : 'ask' });
  }

  private locate() {
    const geo = geolocation();
    if (!geo) {
      this.set({ status: 'unsupported' });
      return;
    }
    this.set({ status: 'locating' });
    geo.getCurrentPosition(
      (position) => {
        this.set({
          status: 'granted',
          lat: approximate(position.coords.latitude),
          lon: approximate(position.coords.longitude),
        });
        remember('granted');
      },
      (error) => {
        if (error.code === PERMISSION_DENIED) {
          this.set({ status: 'denied' });
          remember('denied');
          return;
        }
        this.set({ status: 'failed' });
      },
      { enableHighAccuracy: false, maximumAge: MAX_AGE_MS, timeout: TIMEOUT_MS },
    );
  }

  private set(next: LocationState) {
    this.state = next;
    this.listeners.forEach((listener) => listener());
  }
}

export const locationStore = new LocationStore();

export function useMyLocation(): LocationState {
  const state = useSyncExternalStore(locationStore.subscribe, locationStore.get, locationStore.get);
  useEffect(() => {
    locationStore.start();
  }, []);
  return state;
}
