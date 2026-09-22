import { useCallback, useEffect, useRef, useState } from 'react';

import { onFitChanged, type FitTopic } from '@/db/fit';
import type { ServiceCall } from '@/db/service';

export type FitQuery<T> = {
  data: T | undefined;
  /** Schluessel des Dienstes (`auth_required`, `offline` …) oder null. */
  error: string | null;
  /** Wahr beim ersten Laden und wenn sich `deps` geaendert haben — nicht beim stillen Nachladen. */
  loading: boolean;
  reload: () => void;
};

/**
 * Wie `useLiveQuery`, aber fuer die Routen von Better Fit: laedt beim Oeffnen,
 * wenn sich `deps` aendern, und nach Aenderungen ueber `fit.*` — mit `topics`
 * nur nach Aenderungen in diesen Bereichen (`diary`, `kitchen`, `training`,
 * `profile`; `all` trifft immer).
 */
export function useFit<T>(
  run: () => Promise<ServiceCall<T>>,
  deps: readonly unknown[] = [],
  topics?: readonly FitTopic[],
): FitQuery<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify(deps);
  const topicKey = topics ? topics.join(',') : '';

  // Die Abfrage steht meist inline; ohne Ref liefe der Effekt endlos.
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });

  useEffect(() => {
    const list = topicKey ? (topicKey.split(',') as FitTopic[]) : undefined;
    return onFitChanged(() => setRevision((value) => value + 1), list);
  }, [topicKey]);

  useEffect(() => {
    let cancelled = false;
    void runRef.current().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error);
      }
      setLoadedKey(key);
    });
    return () => {
      cancelled = true;
    };
  }, [key, revision]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  // Ein anderer Tag (andere `deps`) zeigt nie die Zahlen des vorigen.
  return { data, error, loading: loadedKey !== key, reload };
}
