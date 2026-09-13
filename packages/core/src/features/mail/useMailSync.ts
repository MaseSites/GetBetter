import { useCallback, useEffect, useState } from 'react';

import { mail, type MailError } from '@/db/mail';

type SyncState = { syncing: boolean; failure: MailError | null };

/** Gleicht beim Oeffnen ab und auf Zug nach unten. Der Dienst gleicht ohnehin alle 2 Minuten ab. */
export function useMailSync(accountId: string) {
  // Der Bildschirm gleicht beim Oeffnen ab — deshalb beginnt er ladend.
  const [state, setState] = useState<SyncState>({ syncing: true, failure: null });

  useEffect(() => {
    let cancelled = false;
    void mail.sync(accountId).then((result) => {
      if (!cancelled) setState({ syncing: false, failure: result.ok ? null : result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const syncNow = useCallback(async () => {
    setState((current) => ({ ...current, syncing: true }));
    const result = await mail.sync(accountId);
    setState({ syncing: false, failure: result.ok ? null : result.error });
  }, [accountId]);

  return { syncing: state.syncing, failure: state.failure, syncNow };
}
