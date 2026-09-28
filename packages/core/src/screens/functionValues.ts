import { currentApp } from '@/app/identity';
import {
  bills as billRepo,
  drinks as drinkRepo,
  expenses as expenseRepo,
  meals as mealRepo,
  meds as medRepo,
  monthKey,
  plantDueDay,
  plants as plantRepo,
  recipes as recipeRepo,
  savings as savingsRepo,
  sleepMinutes,
  sleeps as sleepRepo,
  subscriptions as subscriptionRepo,
  useLiveQuery,
  vitals as vitalRepo,
} from '@/db';
import { fit } from '@/db/fit';
import type { ServiceCall } from '@/db/service';
import { chores as choreRepo, shopping as shoppingRepo } from '@/db/repositories';
import { useFit } from '@/features/fit/useFit';
import { useZurichToday } from '@/features/fit/useZurichToday';
import { TARGET_DL } from '@/features/gym/WaterView';
import { formatMoney, useI18n } from '@/i18n';
import { useAccount, useApp } from '@/state/AppContext';

/** Was rechts in einer Zeile steht: ein Wert, laut oder still. */
export type FunctionValue = { text: string; quiet?: boolean };

const QUIET_NONE: FunctionValue = { text: '—', quiet: true };

/** In den anderen Apps fragt niemand den Dienst von Better Fit. */
const skipped = <T>(): Promise<ServiceCall<T>> => Promise.resolve({ ok: false, error: 'skipped' });

/**
 * Was eine Funktion in BetterGym, BetterFamily und BetterMoney gerade weiss —
 * dieselben Zahlen wie auf ihrer Startseite, gelesen ueber die Repositories.
 * GetBetter rechnet seine Werte selbst im `FunctionsScreen`.
 */
export function useFunctionValues(): (id: string) => FunctionValue | null {
  const { t, language } = useI18n();
  const account = useAccount();
  const { household } = useApp();
  const app = currentApp().id;
  const gym = app === 'bettergym';
  const householdId = household?.id ?? null;
  // Dieselbe Tagesgrenze wie die Startseite von BetterGym: Mitternacht in Zuerich.
  const today = useZurichToday();
  const month = monthKey();

  // BetterGym
  const fitDay = useFit(
    (): ReturnType<typeof fit.day> => (gym ? fit.day(today) : skipped()),
    [account.id, today, gym],
  );
  const fitWeights = useFit(
    (): ReturnType<typeof fit.weights> => (gym ? fit.weights() : skipped()),
    [account.id, gym],
    ['training', 'profile'],
  );
  const mealKcal = useLiveQuery(() => mealRepo.kcalOf(account.id, today), [account.id, today]);
  const drunk = useLiveQuery(() => drinkRepo.ofDay(account.id, today), [account.id, today]);
  const lastSleep = useLiveQuery(() => sleepRepo.list(account.id, 1), [account.id]);
  const lastWeight = useLiveQuery(() => vitalRepo.list(account.id, 'weight', 1), [account.id]);
  const medList = useLiveQuery(() => medRepo.list(account.id), [account.id]);
  const takeList = useLiveQuery(() => medRepo.takes(account.id, today), [account.id, today]);

  // BetterFamily
  const shoppingList = useLiveQuery(
    () => shoppingRepo.list(account.id, householdId),
    [account.id, householdId],
  );
  const choreList = useLiveQuery(
    () => (householdId ? choreRepo.list(householdId) : Promise.resolve([])),
    [householdId],
  );
  const recipeList = useLiveQuery(
    () => recipeRepo.list(account.id, householdId),
    [account.id, householdId],
  );
  const plantList = useLiveQuery(
    () => plantRepo.list(account.id, householdId),
    [account.id, householdId],
  );

  // BetterMoney
  const spent = useLiveQuery(() => expenseRepo.totalOf(account.id, month), [account.id, month]);
  const openBills = useLiveQuery(() => billRepo.listOpen(account.id), [account.id]);
  const monthly = useLiveQuery(() => subscriptionRepo.monthlyTotal(account.id), [account.id]);
  const goalList = useLiveQuery(() => savingsRepo.list(account.id), [account.id]);

  const whole = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });
  const oneDecimal = new Intl.NumberFormat(`${language}-CH`, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const count = (value: number, key: 'field.open' | 'fixes.value.due' | 'fixes.value.water') =>
    value > 0 ? { text: t(key, { count: value }) } : QUIET_NONE;

  return (id) => {
    switch (id) {
      case 'nutrition': {
        // Better Fit zuerst, sonst der einfache Menueplan — wie auf der Startseite.
        const day = fitDay.data;
        const eaten =
          day && day.meals.length > 0
            ? Math.round(day.meals.reduce((sum, meal) => sum + meal.total.kcal, 0))
            : (mealKcal.data ?? 0);
        return day?.target
          ? {
              text: t('fixes.value.kcalOf', {
                kcal: whole.format(eaten),
                target: whole.format(Math.round(day.target.kcal)),
              }),
              quiet: eaten === 0,
            }
          : { text: t('meals.kcal', { kcal: whole.format(eaten) }), quiet: eaten === 0 };
      }
      case 'water': {
        const dl = drunk.data ?? 0;
        const target = fitDay.data?.hasProfile ? fitDay.data.waterTargetMl / 100 : TARGET_DL;
        return {
          text: t('health.drinkOf', {
            amount: oneDecimal.format(dl / 10),
            target: oneDecimal.format(target / 10),
          }),
          quiet: dl === 0,
        };
      }
      case 'sleep': {
        const night = lastSleep.data?.[0];
        if (!night) return QUIET_NONE;
        const minutes = sleepMinutes(night);
        return {
          text: t('sleep.duration', { hours: Math.floor(minutes / 60), minutes: minutes % 60 }),
        };
      }
      case 'vitals': {
        // Mit Better Fit steht das Gewicht dort; sonst in den Werten.
        const fitLast = [...(fitWeights.data?.entries ?? [])].sort((a, b) =>
          b.day.localeCompare(a.day),
        )[0];
        const kg = fitLast?.weightKg ?? lastWeight.data?.[0]?.value;
        return kg === undefined
          ? QUIET_NONE
          : { text: t('fixes.value.kg', { kg: oneDecimal.format(kg) }) };
      }
      case 'meds': {
        const total = (medList.data ?? []).reduce((sum, med) => sum + med.slots.length, 0);
        if (total === 0) return QUIET_NONE;
        const done = new Set((takeList.data ?? []).map((take) => `${take.medId}:${take.slot}`))
          .size;
        return { text: t('value.ofTotal', { done, total }), quiet: done >= total };
      }
      case 'shopping':
        return count((shoppingList.data ?? []).filter((item) => !item.done).length, 'field.open');
      case 'chores': {
        const due = (choreList.data ?? []).filter(
          (chore) => chore.dueAt !== null && chore.dueAt.slice(0, 10) <= today,
        ).length;
        return count(due, 'fixes.value.due');
      }
      case 'recipes': {
        const total = recipeList.data?.length ?? 0;
        return total > 0 ? { text: whole.format(total), quiet: true } : QUIET_NONE;
      }
      case 'plants':
        return count(
          (plantList.data ?? []).filter((plant) => plantDueDay(plant) <= today).length,
          'fixes.value.water',
        );
      case 'budget': {
        const value = spent.data ?? 0;
        return { text: formatMoney(language, value), quiet: value === 0 };
      }
      case 'bills':
        return count(openBills.data?.length ?? 0, 'field.open');
      case 'subscriptions': {
        const value = monthly.data ?? 0;
        return value > 0
          ? { text: t('money.perMonth', { amount: formatMoney(language, value) }) }
          : QUIET_NONE;
      }
      case 'savings': {
        const goals = goalList.data ?? [];
        if (goals.length === 0) return QUIET_NONE;
        // Gespart ueber alle Ziele, gegen die Summe der Ziele.
        const saved = goals.reduce((sum, goal) => sum + goal.savedChf, 0);
        const target = goals.reduce((sum, goal) => sum + goal.targetChf, 0);
        return {
          text: t('fixes.value.savedOf', {
            saved: formatMoney(language, saved),
            target: formatMoney(language, target),
          }),
          quiet: saved === 0,
        };
      }
      default:
        return null;
    }
  };
}
