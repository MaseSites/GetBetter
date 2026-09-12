import { findByUsername } from '@/auth/accounts';

import { notifyDataChanged } from './live';
import { notifications } from './notifications';
import { db, newId } from './store';
import type {
  Account,
  HouseholdMemberRow,
  HouseholdMemberStatus,
  HouseholdRole,
  HouseholdRow,
} from './types';

function now(): string {
  return new Date().toISOString();
}

/** Ohne I, O, 0 und 1 — die verwechselt man beim Vorlesen. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

async function makeInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let code = '';
    for (let i = 0; i < 6; i += 1) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    const taken = await db.households.findBy((row) => row.inviteCode === code);
    if (!taken) return code;
  }
  // Praktisch unerreichbar; lieber eindeutig als huebsch.
  return newId('code').toUpperCase().slice(-6);
}

export function normaliseInviteCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s/g, '');
}

/** Zeilen von frueher kennen den Status noch nicht. */
export function memberStatus(row: HouseholdMemberRow): HouseholdMemberStatus {
  return row.status === 'pending' ? 'pending' : 'accepted';
}

export type HouseholdInvite = {
  membership: HouseholdMemberRow;
  household: HouseholdRow | undefined;
  invitedByName: string;
};

export type HouseholdInviteError = 'unknown_user' | 'already_member' | 'self' | 'limit';
export type HouseholdInviteResult = { ok: true } | { ok: false; error: HouseholdInviteError };

export type HouseholdMember = {
  membership: HouseholdMemberRow;
  account: Account | undefined;
  /** Was in der Liste steht: Vorname, sonst die E-Mail. */
  displayName: string;
};

/** Mehr als drei Haushalte werden unuebersichtlich. */
export const MAX_HOUSEHOLDS = 3;

export type JoinError = 'code_unknown' | 'already_member' | 'limit';
export type JoinResult = { ok: true; household: HouseholdRow } | { ok: false; error: JoinError };

export const households = {
  find(id: string) {
    return db.households.find(id);
  },

  /** Alle Haushalte, in denen jemand ist — der aktive steht im Konto. */
  async allOf(accountId: string): Promise<{ household: HouseholdRow; role: HouseholdRole }[]> {
    const memberships = await db.householdMembers.list({
      where: (row) => row.accountId === accountId && memberStatus(row) === 'accepted',
      sort: (a, b) => a.joinedAt.localeCompare(b.joinedAt),
    });
    const result: { household: HouseholdRow; role: HouseholdRole }[] = [];
    for (const membership of memberships) {
      const household = await db.households.find(membership.householdId);
      if (household) result.push({ household, role: membership.role });
    }
    return result;
  },

  async countOf(accountId: string): Promise<number> {
    return db.householdMembers.count(
      (row) => row.accountId === accountId && memberStatus(row) === 'accepted',
    );
  },

  async canJoinMore(accountId: string): Promise<boolean> {
    return (await households.countOf(accountId)) < MAX_HOUSEHOLDS;
  },

  /** Zwischen Haushalten wechseln. Alles Geteilte folgt dem aktiven. */
  async setActive(accountId: string, householdId: string | null) {
    await db.accounts.update(accountId, { householdId });
    notifyDataChanged();
  },

  async membership(householdId: string, accountId: string) {
    return db.householdMembers.findBy(
      (row) =>
        row.householdId === householdId &&
        row.accountId === accountId &&
        memberStatus(row) === 'accepted',
    );
  },

  /** Auch offene Einladungen, damit man nicht doppelt einlaedt. */
  async anyMembership(householdId: string, accountId: string) {
    return db.householdMembers.findBy(
      (row) => row.householdId === householdId && row.accountId === accountId,
    );
  },

  async roleOf(householdId: string, accountId: string): Promise<HouseholdRole | undefined> {
    const membership = await households.membership(householdId, accountId);
    return membership?.role;
  },

  /** Mitglieder mit ihrem Konto, Verwalter zuerst. */
  async members(householdId: string): Promise<HouseholdMember[]> {
    const memberships = await db.householdMembers.list({
      where: (row) => row.householdId === householdId,
      sort: (a, b) => {
        if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
        return a.joinedAt.localeCompare(b.joinedAt);
      },
    });

    const result: HouseholdMember[] = [];
    for (const membership of memberships) {
      const account = await db.accounts.find(membership.accountId);
      result.push({
        membership,
        account,
        displayName: account?.firstName?.trim() || account?.email || '—',
      });
    }
    return result;
  },

  async create(accountId: string, name: string): Promise<HouseholdRow | null> {
    if (!(await households.canJoinMore(accountId))) return null;

    const household: HouseholdRow = {
      id: newId('hh'),
      name: name.trim() || 'Zuhause',
      inviteCode: await makeInviteCode(),
      createdBy: accountId,
      createdAt: now(),
    };
    await db.households.insert(household);
    await db.householdMembers.insert({
      id: newId('hm'),
      householdId: household.id,
      accountId,
      // Wer anlegt, verwaltet.
      role: 'admin',
      status: 'accepted',
      invitedBy: accountId,
      joinedAt: now(),
    });
    await db.accounts.update(accountId, { householdId: household.id });
    await adoptExistingData(accountId, household.id);
    notifyDataChanged();
    return household;
  },

  async join(accountId: string, code: string): Promise<JoinResult> {
    const normalised = normaliseInviteCode(code);
    const household = await db.households.findBy((row) => row.inviteCode === normalised);
    if (!household) return { ok: false, error: 'code_unknown' };

    const existing = await households.membership(household.id, accountId);
    if (existing) return { ok: false, error: 'already_member' };
    if (!(await households.canJoinMore(accountId))) return { ok: false, error: 'limit' };

    await db.householdMembers.insert({
      id: newId('hm'),
      householdId: household.id,
      accountId,
      role: 'member',
      status: 'accepted',
      invitedBy: accountId,
      joinedAt: now(),
    });
    await db.accounts.update(accountId, { householdId: household.id });
    await adoptExistingData(accountId, household.id);
    notifyDataChanged();
    return { ok: true, household };
  },

  /** Einladen per Benutzername. Die Person muss zustimmen. */
  async inviteByUsername(
    householdId: string,
    invitedBy: string,
    username: string,
  ): Promise<HouseholdInviteResult> {
    const account = await findByUsername(username);
    if (!account) return { ok: false, error: 'unknown_user' };
    if (account.id === invitedBy) return { ok: false, error: 'self' };

    const existing = await households.anyMembership(householdId, account.id);
    if (existing) return { ok: false, error: 'already_member' };
    if (!(await households.canJoinMore(account.id))) return { ok: false, error: 'limit' };

    const membershipId = newId('hm');
    await db.householdMembers.insert({
      id: membershipId,
      householdId,
      accountId: account.id,
      role: 'member',
      status: 'pending',
      invitedBy,
      joinedAt: now(),
    });
    notifyDataChanged();

    await notifications.announce(async () => {
      const inviter = await db.accounts.find(invitedBy);
      return {
        accountId: account.id,
        kind: 'householdInvite',
        title: inviter?.firstName?.trim() || inviter?.username || '—',
        body: (await db.households.find(householdId))?.name ?? '',
        ref: { membershipId, householdId },
      };
    });
    return { ok: true };
  },

  /** Offene Einladungen — daraus wird die Benachrichtigung. */
  async invitesFor(accountId: string): Promise<HouseholdInvite[]> {
    const memberships = await db.householdMembers.list({
      where: (row) => row.accountId === accountId && memberStatus(row) === 'pending',
      sort: (a, b) => b.joinedAt.localeCompare(a.joinedAt),
    });
    const result: HouseholdInvite[] = [];
    for (const membership of memberships) {
      const household = await db.households.find(membership.householdId);
      const inviter = membership.invitedBy
        ? await db.accounts.find(membership.invitedBy)
        : undefined;
      result.push({
        membership,
        household,
        invitedByName: inviter?.firstName?.trim() || inviter?.username || '—',
      });
    }
    return result;
  },

  async respond(membershipId: string, accept: boolean): Promise<boolean> {
    const membership = await db.householdMembers.find(membershipId);
    if (!membership) {
      // Schon zurueckgenommen — die Mitteilung dazu soll nicht stehen bleiben.
      await forgetInvite(membershipId);
      return false;
    }
    if (!accept) {
      await db.householdMembers.remove(membershipId);
      notifyDataChanged();
      await forgetInvite(membershipId);
      return true;
    }
    // Das Limit gilt auch beim Annehmen — dann bleibt die Einladung offen.
    if (!(await households.canJoinMore(membership.accountId))) return false;
    await db.householdMembers.update(membershipId, {
      status: 'accepted',
      joinedAt: now(),
    });

    // Eine Zusage soll den aktiven Haushalt nicht umstellen — nur wer noch
    // in keinem ist, landet gleich in diesem.
    const account = await db.accounts.find(membership.accountId);
    if (!account?.householdId) {
      await db.accounts.update(membership.accountId, { householdId: membership.householdId });
      await adoptExistingData(membership.accountId, membership.householdId);
    }
    notifyDataChanged();
    await forgetInvite(membershipId);
    return true;
  },

  async removeMember(householdId: string, accountId: string) {
    await db.householdMembers.removeWhere(
      (row) => row.householdId === householdId && row.accountId === accountId,
    );
    const account = await db.accounts.find(accountId);
    if (account?.householdId === householdId) {
      const others = await households.allOf(accountId);
      await db.accounts.update(accountId, { householdId: others[0]?.household.id ?? null });
    }
    notifyDataChanged();
    // Auch eine offene Einladung laesst sich so zuruecknehmen.
    await notifications.removeByRef({
      accountId,
      kind: 'householdInvite',
      key: 'householdId',
      value: householdId,
    });
  },

  async rename(householdId: string, name: string) {
    const updated = await db.households.update(householdId, { name: name.trim() });
    notifyDataChanged();
    return updated;
  },

  async setRole(householdId: string, accountId: string, role: HouseholdRole) {
    const membership = await households.membership(householdId, accountId);
    if (!membership) return;
    // Der letzte Verwalter darf sich nicht selbst herabstufen.
    if (role === 'member' && (await households.adminCount(householdId)) <= 1) return;
    await db.householdMembers.update(membership.id, { role });
    notifyDataChanged();
  },

  async adminCount(householdId: string): Promise<number> {
    return db.householdMembers.count(
      (row) => row.householdId === householdId && row.role === 'admin',
    );
  },

  /** Austreten oder entfernt werden. Geteiltes bleibt beim Haushalt. */
  async leave(householdId: string, accountId: string) {
    const membership = await households.membership(householdId, accountId);
    if (!membership) return;
    if (membership.role === 'admin' && (await households.adminCount(householdId)) <= 1) {
      const others = await db.householdMembers.list({
        where: (row) => row.householdId === householdId && row.accountId !== accountId,
        sort: (a, b) => a.joinedAt.localeCompare(b.joinedAt),
      });
      const heir = others[0];
      // Ein Haushalt ohne Verwalter waere nicht mehr zu aendern.
      if (heir) await db.householdMembers.update(heir.id, { role: 'admin' });
    }

    await db.householdMembers.remove(membership.id);
    // Wer noch in einem anderen Haushalt ist, landet dort statt im Nichts.
    const others = await households.allOf(accountId);
    await db.accounts.update(accountId, { householdId: others[0]?.household.id ?? null });

    // Was nur diese Person betrifft, wandert zurueck in ihren Privatbereich.
    await db.events
      .list({ where: (row) => row.accountId === accountId })
      .then((rows) =>
        Promise.all(
          rows
            .filter((row) => row.householdId === householdId && row.calendar === 'personal')
            .map((row) => db.events.update(row.id, { householdId: null })),
        ),
      );
    await db.tasks
      .list({ where: (row) => row.accountId === accountId })
      .then((rows) =>
        Promise.all(
          rows
            .filter((row) => row.householdId === householdId && !row.shared)
            .map((row) => db.tasks.update(row.id, { householdId: null })),
        ),
      );

    const remaining = await db.householdMembers.count((row) => row.householdId === householdId);
    if (remaining === 0) {
      // Niemand mehr da: Haushalt und alles, was nur ihm gehoert, aufloesen.
      await db.chores.removeWhere((row) => row.householdId === householdId);
      await db.events.removeWhere(
        (row) => row.householdId === householdId && row.calendar === 'family',
      );
      await db.shoppingItems.removeWhere((row) => row.householdId === householdId);
      await db.households.remove(householdId);
    }

    notifyDataChanged();
  },
};

/** Beantwortet oder zurueckgenommen: die Mitteilung zur Einladung hat sich erledigt. */
async function forgetInvite(membershipId: string): Promise<void> {
  await notifications.removeByRef({
    kind: 'householdInvite',
    key: 'membershipId',
    value: membershipId,
  });
}

/**
 * Beim Eintritt wandert mit, was ohnehin geteilt gedacht war: die
 * Einkaufsliste und als geteilt markierte Aufgaben. Private Termine bleiben privat.
 */
async function adoptExistingData(accountId: string, householdId: string): Promise<void> {
  const items = await db.shoppingItems.list({
    where: (row) => row.accountId === accountId && !row.householdId,
  });
  await Promise.all(items.map((row) => db.shoppingItems.update(row.id, { householdId })));

  const sharedTasks = await db.tasks.list({
    where: (row) => row.accountId === accountId && row.shared && !row.householdId,
  });
  await Promise.all(sharedTasks.map((row) => db.tasks.update(row.id, { householdId })));

  // Termine bleiben aussen vor: der private Kalender gehoert GetBetter, der
  // des Haushalts BetterFamily. Ein Beitritt darf das nicht vermischen.
}
