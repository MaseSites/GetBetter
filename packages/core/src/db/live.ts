import { useCallback, useEffect, useRef, useState } from 'react';

import { subscribeDataChanged } from './events';
import { ready } from './store';

export { notifyDataChanged } from './events';

export type LiveQuery<T> = {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
  reload: () => void;
};

/**
 * `deps` verhaelt sich wie bei useEffect, wird intern aber zu einem Schluessel
 * zusammengefasst — so bleibt die Abhaengigkeitsliste des Effekts konstant.
 */
export function useLiveQuery<T>(
  run: () => Promise<T>,
  deps: readonly unknown[] = [],
): LiveQuery<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [revision, setRevision] = useState(0);

  const key = JSON.stringify(deps);

  // Die Abfrage wird meist inline geschrieben; ohne Ref liefe der Effekt endlos.
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });

  // Auf fremde Schreiboperationen hoeren.
  useEffect(() => subscribeDataChanged(() => setRevision((value) => value + 1)), []);

  useEffect(() => {
    let cancelled = false;
    ready()
      .then(() => runRef.current())
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(undefined);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause : new Error(String(cause)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key, revision]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);

  return { data, loading, error, reload };
}
