import { calendars as calendarRepo, useLiveQuery, type CalendarWithRole } from '@/db';
import type { CalendarAccess } from '@/db/repositories';
import { useAccount, useApp } from '@/state/AppContext';

export type CalendarAccessValue = {
  access: CalendarAccess;
  /** Die eigenen Kalender, Reihenfolge wie angelegt. */
  calendars: CalendarWithRole[];
  loading: boolean;
};

/**
 * Alles, was eine Terminabfrage braucht: wer fragt, in welchem Haushalt,
 * und welche eigenen Kalender angenommen sind.
 */
export function useCalendarAccess(): CalendarAccessValue {
  const account = useAccount();
  const { household } = useApp();

  const list = useLiveQuery(() => calendarRepo.mine(account.id), [account.id]);
  const calendars = list.data ?? [];

  return {
    access: {
      accountId: account.id,
      householdId: household?.id ?? null,
      calendarIds: calendars.map((entry) => entry.calendar.id),
    },
    calendars,
    loading: list.loading,
  };
}
