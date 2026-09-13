import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { parseRecent, recentStorageKey, rememberQuery } from './recent';

type Stored = { accountId: string; list: readonly string[] };

export type RecentSearches = {
  /** Die letzten drei, die neueste zuerst. */
  recent: readonly string[];
  /** Merkt sich eine Suche — beim Abschicken oder beim Oeffnen eines Treffers. */
  remember: (query: string) => void;
};

/** „Zuletzt gesucht“ je Konto, auf dem Geraet gemerkt. */
export function useRecentSearches(accountId: string): RecentSearches {
  const [stored, setStored] = useState<Stored>({ accountId, list: [] });

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(recentStorageKey(accountId)).then(
      (raw) => {
        if (!alive) return;
        const loaded = parseRecent(raw);
        // Wer schon gesucht hat, bevor der Speicher antwortete, behaelt das vorn.
        setStored((current) => ({
          accountId,
          list:
            current.accountId === accountId
              ? current.list.reduceRight((list, query) => rememberQuery(list, query), loaded)
              : loaded,
        }));
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [accountId]);

  const recent = stored.accountId === accountId ? stored.list : [];

  function remember(query: string) {
    const next = rememberQuery(recent, query);
    if (next === recent) return;
    setStored({ accountId, list: next });
    void AsyncStorage.setItem(recentStorageKey(accountId), JSON.stringify(next)).catch(
      () => undefined,
    );
  }

  return { recent, remember };
}
