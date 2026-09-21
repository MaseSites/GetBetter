import { useEffect, useState } from 'react';

import { plans, type PlanStatus } from '@/db';

import { rememberPricedApps } from './pricedApps';

/**
 * Wie es um das Abo dieser App steht — beim ersten Gebrauch gefragt und neu,
 * sobald sich `refreshKey` aendert (eine Anfrage, ein neues Abo am Konto).
 * Waehrend neu gefragt wird, bleibt der letzte Stand stehen. `null`, solange
 * es noch keinen gibt, `accountId` fehlt oder der Dienst nicht antwortet.
 */
export function usePlanStatus(
  accountId: string | null,
  app: string,
  refreshKey = '',
): PlanStatus | null {
  const scope = accountId === null ? null : `${accountId}:${app}`;
  const key = scope === null ? null : `${scope}|${refreshKey}`;
  const [loaded, setLoaded] = useState<{ key: string; status: PlanStatus } | null>(null);

  useEffect(() => {
    if (accountId === null || key === null) return undefined;
    let alive = true;
    void plans.status(accountId, app).then((result) => {
      if (!alive || !result.ok) return;
      rememberPricedApps(result.data.pricedApps);
      setLoaded({ key, status: result.data });
    });
    return () => {
      alive = false;
    };
  }, [accountId, app, key]);

  return loaded !== null && scope !== null && loaded.key.startsWith(`${scope}|`)
    ? loaded.status
    : null;
}
