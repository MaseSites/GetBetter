import { notifyDataChanged } from './live';
import { db, newId } from './store';
import type { Account, HouseholdMemberRow, HouseholdRole, HouseholdRow } from './types';

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
      where: (row) => row.accountId === accountId,
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
    return db.householdMembers.count((row) => row.accountId === accountId);
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
      joinedAt: now(),
    });
    await db.accounts.update(accountId, { householdId: household.id });
    await adoptExistingData(accountId, household.id);
    notifyDataChanged();
    return { ok: true, household };
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

  const personalEvents = await db.events.list({
    where: (row) => row.accountId === accountId && !row.householdId,
  });
  await Promise.all(personalEvents.map((row) => db.events.update(row.id, { householdId })));
}
