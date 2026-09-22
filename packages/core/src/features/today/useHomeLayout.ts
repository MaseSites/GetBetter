import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { homeLayoutKey, parseLayout, type HomeBlock } from './homeLayout';

type Stored = { accountId: string; layout: HomeBlock[] | null };

export type HomeLayoutStore = {
  /** Null heisst: noch nichts gebaut — dann kommt die Vorlagenwahl. */
  layout: HomeBlock[] | null;
  /** Geladen? Vorher zeigt die Ansicht nichts, statt kurz „leer“ zu blitzen. */
  ready: boolean;
  save: (layout: HomeBlock[] | null) => void;
};

/** Die eigene Ansicht, je Konto auf dem Geraet gemerkt — wie die gewaehlte Ansicht. */
export function useHomeLayout(accountId: string): HomeLayoutStore {
  const [stored, setStored] = useState<Stored | null>(null);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(homeLayoutKey(accountId)).then(
      (raw) => {
        if (!alive) return;
        // Wer schon gebaut hat, bevor der Speicher antwortete, behaelt sein Werk.
        setStored((current) =>
          current?.accountId === accountId ? current : { accountId, layout: parseLayout(raw) },
        );
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [accountId]);

  const mine = stored?.accountId === accountId ? stored : null;

  function save(layout: HomeBlock[] | null) {
    setStored({ accountId, layout });
    const key = homeLayoutKey(accountId);
    const write =
      layout && layout.length > 0
        ? AsyncStorage.setItem(key, JSON.stringify(layout))
        : AsyncStorage.removeItem(key);
    void write.catch(() => undefined);
  }

  return { layout: mine?.layout ?? null, ready: mine !== null, save };
}
