import { useSyncExternalStore } from 'react';

/**
 * Welche Ortsseite gerade offen ist, als Schluessel (`placeKey` oder
 * `LOCATION_KEY`). Die Orte-Liste liegt als eigener Bildschirm darueber: ein
 * Tipp dort setzt die Seite hier und geht zurueck, die Seiten darunter
 * blaettern dann dorthin.
 */

export const LOCATION_KEY = 'location';

class PageSelection {
  private key: string | null = null;
  private readonly listeners = new Set<() => void>();

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly get = (): string | null => this.key;

  select(key: string | null) {
    if (this.key === key) return;
    this.key = key;
    this.listeners.forEach((listener) => listener());
  }
}

export const pageSelection = new PageSelection();

export function useSelectedPage(): string | null {
  return useSyncExternalStore(pageSelection.subscribe, pageSelection.get, pageSelection.get);
}
