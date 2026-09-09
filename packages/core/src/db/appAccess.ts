import { notifyDataChanged } from './live';
import { db, newId } from './store';
import type { AppAccessRow } from './types';

function now(): string {
  return new Date().toISOString();
}

/**
 * Welche Better-Apps jemand schon benutzt hat. Jede App traegt sich beim
 * Anmelden ein; GetBetter liest daran ab, welche freigeschaltet sind.
 */
export const appAccess = {
  async markSeen(accountId: string, appId: string): Promise<void> {
    const existing = await db.appAccess.findBy(
      (row) => row.accountId === accountId && row.appId === appId,
    );
    if (existing) {
      await db.appAccess.update(existing.id, { lastSeenAt: now() });
    } else {
      await db.appAccess.insert({
        id: newId('aa'),
        accountId,
        appId,
        firstSeenAt: now(),
        lastSeenAt: now(),
      });
    }
    notifyDataChanged();
  },

  /** Die Ids der Apps, in denen dieses Konto schon war. */
  async appsOf(accountId: string): Promise<string[]> {
    const rows: AppAccessRow[] = await db.appAccess.list({
      where: (row) => row.accountId === accountId,
    });
    return rows.map((row) => row.appId);
  },
};
