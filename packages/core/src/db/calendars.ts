import { findByUsername } from '@/auth/accounts';

import { notifyDataChanged } from './live';
import { db, newId } from './store';
import type { Account, CalendarMemberRow, CalendarRow } from './types';

function now(): string {
  return new Date().toISOString();
}

/** Mehr wuerde die Leiste unlesbar machen — und niemand fuehrt zehn Kalender. */
export const MAX_CALENDARS = 5;

export type CalendarWithRole = {
  calendar: CalendarRow;
  membership: CalendarMemberRow;
  isOwner: boolean;
};

export type CalendarInvite = {
  membership: CalendarMemberRow;
  calendar: CalendarRow | undefined;
  invitedByName: string;
};

export type CalendarMember = {
  membership: CalendarMemberRow;
  account: Account | undefined;
  displayName: string;
};

export type InviteError = 'unknown_user' | 'already_invited' | 'self';
export type InviteResult = { ok: true } | { ok: false; error: InviteError };

function nameOf(account: Account | undefined): string {
  return account?.firstName?.trim() || account?.username || '—';
}

export const calendars = {
  find(id: string) {
    return db.calendars.find(id);
  },

  /** Alle Kalender, die jemand fuehrt oder angenommen hat. */
  async mine(accountId: string): Promise<CalendarWithRole[]> {
    const memberships = await db.calendarMembers.list({
      where: (row) => row.accountId === accountId && row.status === 'accepted',
      sort: (a, b) => a.createdAt.localeCompare(b.createdAt),
    });

    const result: CalendarWithRole[] = [];
    for (const membership of memberships) {
      const calendar = await db.calendars.find(membership.calendarId);
      // Ein geloeschter Kalender laesst die Mitgliedschaft zurueck.
      if (!calendar) continue;
      result.push({ calendar, membership, isOwner: membership.role === 'owner' });
    }
    return result;
  },

  async count(accountId: string): Promise<number> {
    return db.calendarMembers.count(
      (row) => row.accountId === accountId && row.status === 'accepted',
    );
  },

  async canAddMore(accountId: string): Promise<boolean> {
    return (await calendars.count(accountId)) < MAX_CALENDARS;
  },

  /** Offene Einladungen — daraus entsteht die Benachrichtigung. */
  async invitesFor(accountId: string): Promise<CalendarInvite[]> {
    const memberships = await db.calendarMembers.list({
      where: (row) => row.accountId === accountId && row.status === 'pending',
      sort: (a, b) => b.createdAt.localeCompare(a.createdAt),
    });

    const result: CalendarInvite[] = [];
    for (const membership of memberships) {
      const calendar = await db.calendars.find(membership.calendarId);
      const inviter = await db.accounts.find(membership.invitedBy);
      result.push({ membership, calendar, invitedByName: nameOf(inviter) });
    }
    return result;
  },

  async members(calendarId: string): Promise<CalendarMember[]> {
    const memberships = await db.calendarMembers.list({
      where: (row) => row.calendarId === calendarId,
      sort: (a, b) => {
        if (a.role !== b.role) return a.role === 'owner' ? -1 : 1;
        return a.createdAt.localeCompare(b.createdAt);
      },
    });

    const result: CalendarMember[] = [];
    for (const membership of memberships) {
      const account = await db.accounts.find(membership.accountId);
      result.push({ membership, account, displayName: nameOf(account) });
    }
    return result;
  },

  async create(ownerId: string, name: string, color: string): Promise<CalendarRow | null> {
    if (!(await calendars.canAddMore(ownerId))) return null;

    const calendar: CalendarRow = {
      id: newId('cal'),
      ownerId,
      name: name.trim() || 'Kalender',
      color,
      createdAt: now(),
    };
    await db.calendars.insert(calendar);
    await db.calendarMembers.insert({
      id: newId('cm'),
      calendarId: calendar.id,
      accountId: ownerId,
      role: 'owner',
      status: 'accepted',
      invitedBy: ownerId,
      createdAt: now(),
      respondedAt: now(),
    });
    notifyDataChanged();
    return calendar;
  },

  async rename(calendarId: string, name: string, color: string) {
    const updated = await db.calendars.update(calendarId, { name: name.trim(), color });
    notifyDataChanged();
    return updated;
  },

  /**
   * Einladen. Wer im selben Haushalt ist, kommt direkt dazu; Externe muessen
   * erst zustimmen und bekommen dafuer eine offene Einladung.
   */
  async invite(
    calendarId: string,
    invitedBy: string,
    accountId: string,
    autoAccept: boolean,
  ): Promise<InviteResult> {
    if (accountId === invitedBy) return { ok: false, error: 'self' };

    const existing = await db.calendarMembers.findBy(
      (row) => row.calendarId === calendarId && row.accountId === accountId,
    );
    if (existing) return { ok: false, error: 'already_invited' };

    await db.calendarMembers.insert({
      id: newId('cm'),
      calendarId,
      accountId,
      role: 'member',
      status: autoAccept ? 'accepted' : 'pending',
      invitedBy,
      createdAt: now(),
      respondedAt: autoAccept ? now() : null,
    });
    notifyDataChanged();
    return { ok: true };
  },

  async inviteByUsername(
    calendarId: string,
    invitedBy: string,
    username: string,
  ): Promise<InviteResult> {
    const account = await findByUsername(username);
    if (!account) return { ok: false, error: 'unknown_user' };
    // Externe bestaetigen selbst.
    return calendars.invite(calendarId, invitedBy, account.id, false);
  },

  async respond(membershipId: string, accept: boolean) {
    if (accept) {
      const membership = await db.calendarMembers.find(membershipId);
      // Das Limit gilt auch beim Annehmen.
      if (membership && !(await calendars.canAddMore(membership.accountId))) return false;
      await db.calendarMembers.update(membershipId, {
        status: 'accepted',
        respondedAt: now(),
      });
    } else {
      await db.calendarMembers.remove(membershipId);
    }
    notifyDataChanged();
    return true;
  },

  /** Austreten. Wer den Kalender fuehrt, loest ihn auf. */
  async leave(calendarId: string, accountId: string) {
    const calendar = await db.calendars.find(calendarId);
    if (calendar && calendar.ownerId === accountId) {
      await db.calendarMembers.removeWhere((row) => row.calendarId === calendarId);
      await db.events.removeWhere((row) => row.calendarId === calendarId);
      await db.calendars.remove(calendarId);
    } else {
      await db.calendarMembers.removeWhere(
        (row) => row.calendarId === calendarId && row.accountId === accountId,
      );
    }
    notifyDataChanged();
  },

  async removeMember(calendarId: string, accountId: string) {
    await db.calendarMembers.removeWhere(
      (row) => row.calendarId === calendarId && row.accountId === accountId && row.role !== 'owner',
    );
    notifyDataChanged();
  },
};
