import {
  calendars as calendarRepo,
  households as householdRepo,
  shares as shareRepo,
  useLiveQuery,
  type CalendarWithRole,
  type HouseholdRole,
  type HouseholdRow,
  type SharePerson,
} from '@/db';
import type { CalendarAccess } from '@/db/repositories';
import { useAccount, useApp } from '@/state/AppContext';

export type CalendarAccessValue = {
  access: CalendarAccess;
  /** Die eigenen Kalender, Reihenfolge wie angelegt. */
  calendars: CalendarWithRole[];
  /** Alle Haushalte des Kontos, der aelteste zuerst. */
  households: { household: HouseholdRow; role: HouseholdRole }[];
  /** Konten, die ihren Kalender freigegeben haben. */
  sharedBy: SharePerson[];
  loading: boolean;
};

/**
 * Alles, was eine Terminabfrage braucht: wer fragt, in welchen Haushalten,
 * welche eigenen Kalender angenommen sind und wer seinen Kalender freigegeben hat.
 */
export function useCalendarAccess(): CalendarAccessValue {
  const account = useAccount();
  const { household } = useApp();

  const list = useLiveQuery(() => calendarRepo.mine(account.id), [account.id]);
  const householdList = useLiveQuery(() => householdRepo.allOf(account.id), [account.id]);
  const shareList = useLiveQuery(() => shareRepo.visibleTo(account.id), [account.id]);

  const calendars = list.data ?? [];
  const households = householdList.data ?? [];
  const sharedBy = shareList.data ?? [];

  return {
    access: {
      accountId: account.id,
      householdId: household?.id ?? null,
      householdIds: households.map((entry) => entry.household.id),
      calendarIds: calendars.map((entry) => entry.calendar.id),
      sharedBy: sharedBy.map((entry) => entry.share.ownerId),
    },
    calendars,
    households,
    sharedBy,
    loading: list.loading || householdList.loading || shareList.loading,
  };
}
