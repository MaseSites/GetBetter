import { findByUsername } from '@/auth/accounts';

import { notifyDataChanged } from './live';
import { db, newId } from './store';
import type { Account, CalendarShareRow } from './types';

function now(): string {
  return new Date().toISOString();
}

function nameOf(account: Account | undefined): string {
  return account?.firstName?.trim() || account?.username || '—';
}

export type SharePerson = {
  share: CalendarShareRow;
  account: Account | undefined;
  displayName: string;
  username: string;
};

export type ShareError = 'unknown_user' | 'already_asked' | 'self';
export type ShareResult = { ok: true } | { ok: false; error: ShareError };

async function withAccount(rows: CalendarShareRow[], of: 'owner' | 'viewer') {
  const result: SharePerson[] = [];
  for (const share of rows) {
    const account = await db.accounts.find(of === 'owner' ? share.ownerId : share.viewerId);
    result.push({
      share,
      account,
      displayName: nameOf(account),
      username: account?.username ?? '',
    });
  }
  return result;
}

/**
 * Wer darf wessen persoenlichen Kalender sehen. Im Haushalt regelt das die
 * Mitgliedschaft; ausserhalb fragt man an, und die andere Seite entscheidet.
 */
export const shares = {
  /** Angenommene Freigaben: diese Konten kann ich ansehen. */
  async visibleTo(viewerId: string): Promise<SharePerson[]> {
    const rows = await db.calendarShares.list({
      where: (row) => row.viewerId === viewerId && row.status === 'accepted',
      sort: (a, b) => a.createdAt.localeCompare(b.createdAt),
    });
    return withAccount(rows, 'owner');
  },

  /** Eigene Anfragen, auf die noch niemand geantwortet hat. */
  async askedBy(viewerId: string): Promise<SharePerson[]> {
    const rows = await db.calendarShares.list({
      where: (row) => row.viewerId === viewerId && row.status === 'pending',
      sort: (a, b) => a.createdAt.localeCompare(b.createdAt),
    });
    return withAccount(rows, 'owner');
  },

  /** Offene Anfragen an mich — daraus wird die Karte im Kalender. */
  async requestsFor(ownerId: string): Promise<SharePerson[]> {
    const rows = await db.calendarShares.list({
      where: (row) => row.ownerId === ownerId && row.status === 'pending',
      sort: (a, b) => b.createdAt.localeCompare(a.createdAt),
    });
    return withAccount(rows, 'viewer');
  },

  async requestByUsername(viewerId: string, username: string): Promise<ShareResult> {
    const account = await findByUsername(username);
    if (!account) return { ok: false, error: 'unknown_user' };
    if (account.id === viewerId) return { ok: false, error: 'self' };

    const existing = await db.calendarShares.findBy(
      (row) => row.ownerId === account.id && row.viewerId === viewerId,
    );
    if (existing) return { ok: false, error: 'already_asked' };

    await db.calendarShares.insert({
      id: newId('cs'),
      ownerId: account.id,
      viewerId,
      status: 'pending',
      createdAt: now(),
      respondedAt: null,
    });
    notifyDataChanged();
    return { ok: true };
  },

  async respond(shareId: string, accept: boolean) {
    if (accept) {
      await db.calendarShares.update(shareId, { status: 'accepted', respondedAt: now() });
    } else {
      await db.calendarShares.remove(shareId);
    }
    notifyDataChanged();
  },

  /** Zuruecknehmen — von beiden Seiten aus dieselbe Zeile. */
  async remove(shareId: string) {
    await db.calendarShares.remove(shareId);
    notifyDataChanged();
  },
};
