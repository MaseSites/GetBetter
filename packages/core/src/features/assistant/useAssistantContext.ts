import { currentApp } from '@/app/identity';
import {
  bills as billRepo,
  contacts as contactRepo,
  dayKey,
  drinks as drinkRepo,
  expenses as expenseRepo,
  habits as habitRepo,
  meals as mealRepo,
  monthKey,
  notes as noteRepo,
  priorityOf,
  sleepMinutes,
  sleeps as sleepRepo,
  subscriptions as subscriptionRepo,
  tasks as taskRepo,
  useLiveQuery,
  workouts as workoutRepo,
  type AiContext,
} from '@/db';
import {
  alarms as alarmRepo,
  chores as choreRepo,
  events as eventRepo,
  groupOf,
  shopping as shoppingRepo,
} from '@/db/repositories';
import { useCalendarAccess } from '@/features/calendar/useCalendarAccess';
import { nextBirthday, shiftDay } from '@/features/shared/days';
import { formatMoney, useI18n } from '@/i18n';
import { moduleName } from '@/mocks/moduleText';
import { useApp } from '@/state/AppContext';

import { contextOf, type ContextRefs } from './context';

/** So weit schaut der Assistent nach vorne: Termine zwei Wochen, Geburtstage einen Monat. */
const EVENT_DAYS = 14;
const BIRTHDAY_DAYS = 30;
const DAY_MS = 86_400_000;

export type AssistantSnapshot = { context: AiContext; refs: ContextRefs };

/** Nichts zu holen — eine leere Liste, die zu jedem Typ passt. */
const none = (): Promise<never[]> => Promise.resolve([]);

/**
 * Sammelt, was der Assistent in dieser App wissen darf — und gibt eine
 * Funktion zurueck, die im Moment der Frage die Liste baut. So steht „jetzt“
 * genau fuer den Augenblick, in dem gefragt wird, und nichts Unreines laeuft
 * im Rendern.
 *
 * Jede App zeigt ihm ihre eigenen Dinge: GetBetter Termine, Aufgaben, Wecker,
 * Geburtstage, Gewohnheiten, Notizen und die Einkaufsliste; BetterFamily den
 * Familienkalender, Einkauf und Aemtli; BetterGym die Zahlen des Tages;
 * BetterMoney den Monat und offene Rechnungen.
 */
export function useAssistantContext(): () => AssistantSnapshot {
  const { t, language } = useI18n();
  const { account, household } = useApp();
  const { access } = useCalendarAccess();
  const app = currentApp().id;
  const accountId = account?.id ?? null;
  const householdId = household?.id ?? null;
  const organizer = app === 'getbetter' && accountId !== null;
  const family = app === 'betterfamily' && accountId !== null;
  const gym = app === 'bettergym' && accountId !== null;
  const money = app === 'bettermoney' && accountId !== null;

  const events = useLiveQuery(() => {
    if (organizer) return eventRepo.listUpcoming(access, new Date().toISOString());
    if (!family || access.householdIds.length === 0) return none();
    return eventRepo.listBetween(
      access,
      new Date().toISOString(),
      new Date(Date.now() + EVENT_DAYS * DAY_MS).toISOString(),
      access.householdIds.map((id) => `house:${id}` as const),
    );
  }, [organizer, family, access.accountId, access.householdIds]);
  const tasks = useLiveQuery(
    () => (organizer && accountId ? taskRepo.listOpen(accountId, householdId) : none()),
    [organizer, accountId, householdId],
  );
  const alarms = useLiveQuery(
    () => (organizer && accountId ? alarmRepo.list(accountId) : none()),
    [organizer, accountId],
  );
  const contacts = useLiveQuery(
    () => (organizer && accountId ? contactRepo.list(accountId) : none()),
    [organizer, accountId],
  );
  const habits = useLiveQuery(
    () => (organizer && accountId ? habitRepo.list(accountId) : none()),
    [organizer, accountId],
  );
  const ticks = useLiveQuery(
    () => (organizer && accountId ? habitRepo.ticks(accountId) : none()),
    [organizer, accountId],
  );
  const notes = useLiveQuery(
    () => (organizer && accountId ? noteRepo.list(accountId) : none()),
    [organizer, accountId],
  );
  const shopping = useLiveQuery(
    () => ((organizer || family) && accountId ? shoppingRepo.list(accountId, householdId) : none()),
    [organizer, family, accountId, householdId],
  );
  const chores = useLiveQuery(
    () => ((organizer || family) && householdId ? choreRepo.list(householdId) : none()),
    [organizer, family, householdId],
  );
  const gymToday = useLiveQuery(async () => {
    if (!gym || !accountId) return null;
    const today = dayKey();
    const [kcal, dl, minutes, nights] = await Promise.all([
      mealRepo.kcalOf(accountId, today),
      drinkRepo.ofDay(accountId, today),
      workoutRepo.minutesSince(accountId, shiftDay(-6)),
      sleepRepo.list(accountId, 1),
    ]);
    const night = nights[0];
    return { kcal, dl, minutes, slept: night ? sleepMinutes(night) : null };
  }, [gym, accountId]);
  const moneyNow = useLiveQuery(async () => {
    if (!money || !accountId) return null;
    const [spent, monthly, open] = await Promise.all([
      expenseRepo.totalOf(accountId, monthKey()),
      subscriptionRepo.monthlyTotal(accountId),
      billRepo.listOpen(accountId),
    ]);
    return { spent, monthly, open };
  }, [money, accountId]);

  function facts(): { label: string; value: string }[] {
    const day = gymToday.data;
    if (day) {
      return [
        { label: t('field.calories'), value: t('meals.kcal', { kcal: day.kcal }) },
        { label: moduleName(t, 'water'), value: t('water.add', { amount: day.dl }) },
        {
          label: `${t('field.training')} · ${t('profile.stat.week')}`,
          value: t('gym.minutes', { minutes: day.minutes }),
        },
        ...(day.slept === null
          ? []
          : [
              {
                label: t('field.sleep'),
                value: t('sleep.duration', { hours: Math.floor(day.slept / 60), minutes: day.slept % 60 }),
              },
            ]),
      ];
    }
    const month = moneyNow.data;
    if (month) {
      return [
        { label: moduleName(t, 'budget'), value: formatMoney(language, month.spent) },
        { label: moduleName(t, 'subscriptions'), value: formatMoney(language, month.monthly) },
      ];
    }
    return [];
  }

  return () => {
    const now = new Date();
    const until = new Date(now.getTime() + EVENT_DAYS * DAY_MS).toISOString();
    const today = dayKey(now);
    const tickedToday = new Set(
      (ticks.data ?? []).filter((tick) => tick.day === today).map((tick) => tick.habitId),
    );
    const birthdays = (contacts.data ?? [])
      .flatMap((row) => {
        if (!row.birthday) return [];
        const next = nextBirthday(row.birthday, now);
        if (next.days > BIRTHDAY_DAYS) return [];
        return [{ name: row.name, day: next.day, age: row.birthYearKnown === false ? null : next.age, days: next.days }];
      })
      .sort((a, b) => a.days - b.days);

    return contextOf({
      now,
      events: (events.data ?? [])
        .filter((row) => row.startsAt < until)
        .map((row) => ({
          groupId: groupOf(row),
          title: row.title,
          startsAt: row.startsAt,
          endsAt: row.endsAt ?? null,
          allDay: row.allDay ?? false,
        })),
      tasks: (tasks.data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        dueAt: row.dueAt,
        dueTime: row.dueTime ?? null,
        priority: priorityOf(row.priority),
      })),
      alarms: alarms.data ?? [],
      birthdays,
      habits: (habits.data ?? []).map((row) => ({ name: row.name, doneToday: tickedToday.has(row.id) })),
      notes: (notes.data ?? []).map((row) => ({ title: row.title })),
      shopping: (shopping.data ?? [])
        .filter((row) => !row.done)
        .map((row) => ({ name: row.name, quantity: row.quantity ?? null })),
      chores: (chores.data ?? []).map((row) => ({ title: row.title })),
      bills: (moneyNow.data?.open ?? []).map((row) => ({
        title: row.title,
        amount: formatMoney(language, row.amountChf),
        dueDay: row.dueDay,
      })),
      facts: facts(),
    });
  };
}
