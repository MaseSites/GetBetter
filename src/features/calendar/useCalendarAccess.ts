import { useMemo } from 'react';

import {
  calendars as calendarRepo,
  households as householdRepo,
  shares as shareRepo,
  useLiveQuery,
  type CalendarWithRole,
  type HouseholdMember,
  type HouseholdRole,
  type HouseholdRow,
  type SharePerson,
} from '@/db';
import type { CalendarAccess } from '@/db/repositories';
import { useAccount } from '@/state/AppContext';

export type HouseholdWithMembers = {
  household: HouseholdRow;
  role: HouseholdRole;
  members: HouseholdMember[];
};

export type CalendarAccessValue = {
  access: CalendarAccess;
  /** Die eigenen Kalender, Reihenfolge wie angelegt. */
  calendars: CalendarWithRole[];
  /** Alle Haushalte des Kontos samt Mitgliedern, der aelteste zuerst. */
  households: HouseholdWithMembers[];
  /** Konten ausserhalb der Haushalte, die ihren Kalender freigegeben haben. */
  sharedBy: SharePerson[];
  loading: boolean;
};

/**
 * Alles, was eine Terminabfrage braucht: wer fragt, in welchen Haushalten mit
 * welchen Leuten, welche eigenen Kalender es gibt und wer sonst freigegeben hat.
 */
export function useCalendarAccess(): CalendarAccessValue {
  const account = useAccount();

  const calendarList = useLiveQuery(() => calendarRepo.mine(account.id), [account.id]);
  const householdList = useLiveQuery(async () => {
    const mine = await householdRepo.allOf(account.id);
    const result: HouseholdWithMembers[] = [];
    for (const entry of mine) {
      result.push({ ...entry, members: await householdRepo.members(entry.household.id) });
    }
    return result;
  }, [account.id]);
  const shareList = useLiveQuery(() => shareRepo.visibleTo(account.id), [account.id]);

  const calendars = useMemo(() => calendarList.data ?? [], [calendarList.data]);
  const households = useMemo(() => householdList.data ?? [], [householdList.data]);
  const sharedBy = useMemo(() => shareList.data ?? [], [shareList.data]);

  const access = useMemo((): CalendarAccess => {
    // Wen man sehen darf: alle aus den eigenen Haushalten, dazu die Zusagen.
    const canSee = new Set<string>();
    households.forEach((entry) => {
      entry.members.forEach((member) => canSee.add(member.membership.accountId));
    });
    sharedBy.forEach((person) => canSee.add(person.share.ownerId));
    canSee.delete(account.id);

    return {
      accountId: account.id,
      householdIds: households.map((entry) => entry.household.id),
      calendarIds: calendars.map((entry) => entry.calendar.id),
      canSee: [...canSee],
    };
  }, [account.id, households, calendars, sharedBy]);

  return {
    access,
    calendars,
    households,
    sharedBy,
    loading: calendarList.loading || householdList.loading || shareList.loading,
  };
}
