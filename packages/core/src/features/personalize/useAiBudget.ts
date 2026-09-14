import { useEffect, useState } from 'react';

import { ai, type AiApp, type AiBudget } from '@/db/ai';

/** `YYYY-MM-DD` als Tag in der Ortszeit — fuer „am 1. Oktober“. */
export function dateOfDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, date ?? 1);
}

/**
 * Das KI-Kontingent dieses Kontos in dieser App — einmal beim Oeffnen gefragt.
 * `null`, solange es laedt oder ein alter Dienst die Route nicht kennt.
 */
export function useAiBudget(accountId: string | null, app: AiApp): AiBudget | null {
  const key = accountId === null ? null : `${accountId}:${app}`;
  const [loaded, setLoaded] = useState<{ key: string; budget: AiBudget } | null>(null);

  useEffect(() => {
    if (accountId === null || key === null) return undefined;
    let alive = true;
    void ai.budget(accountId, app).then((result) => {
      if (alive && result.ok) setLoaded({ key, budget: result.data });
    });
    return () => {
      alive = false;
    };
  }, [accountId, app, key]);

  return loaded !== null && loaded.key === key ? loaded.budget : null;
}
