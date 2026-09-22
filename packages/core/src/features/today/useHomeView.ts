import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { DEFAULT_HOME_VIEW, homeViewKey, parseHomeView, type HomeView } from './homeView';

type Stored = { accountId: string; view: HomeView };

/**
 * Welche Ansicht die Startseite zeigt — je Konto auf dem Geraet gemerkt, wie
 * „Zuletzt gesucht“. Bis der Speicher antwortet, gilt die erste Ansicht.
 */
export function useHomeView(accountId: string): [HomeView, (view: HomeView) => void] {
  const [stored, setStored] = useState<Stored | null>(null);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(homeViewKey(accountId)).then(
      (raw) => {
        if (!alive) return;
        // Wer schon umgeschaltet hat, bevor der Speicher antwortete, behaelt seine Wahl.
        setStored((current) =>
          current?.accountId === accountId ? current : { accountId, view: parseHomeView(raw) },
        );
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [accountId]);

  const view = stored?.accountId === accountId ? stored.view : DEFAULT_HOME_VIEW;

  function choose(next: HomeView) {
    setStored({ accountId, view: next });
    void AsyncStorage.setItem(homeViewKey(accountId), next).catch(() => undefined);
  }

  return [view, choose];
}
