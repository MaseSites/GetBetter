import * as Linking from 'expo-linking';
import { Platform, View } from 'react-native';

import { appUrl } from '@/app/bridge';
import { APPS, APP_IDS, currentApp, storeUrl, type AppId } from '@/app/identity';
import {
  appAccess,
  bills as billRepo,
  dayKey,
  expenses as expenseRepo,
  meals as mealRepo,
  monthKey,
  sleepMinutes,
  sleeps as sleepRepo,
  useLiveQuery,
  workouts as workoutRepo,
} from '@/db';
import {
  chores as choreRepo,
  events as eventRepo,
  shopping as shoppingRepo,
} from '@/db/repositories';
import { useCalendarAccess } from '@/features/calendar/useCalendarAccess';
import { formatMoney, formatTime, useI18n, type TranslationKey } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { AppIcon, Button, Card, Divider, Text } from '@/ui';

/**
 * Die anderen Better-Apps auf der Startseite von GetBetter.
 *
 * Wo man sich noch nie angemeldet hat, steht die App blass da und sagt in
 * einem Satz, wofuer sie gut ist. Wo man drin war, steht kein Werbetext mehr,
 * sondern was gerade ansteht — moeglich, weil alle dieselbe Datenbank teilen.
 */
export function AppFamily() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const { account, household } = useApp();
  const { access } = useCalendarAccess();
  const me = currentApp().id;
  const others = APP_IDS.filter((id) => id !== me);
  const householdId = household?.id ?? null;

  const unlockedList = useLiveQuery(
    () => (account ? appAccess.appsOf(account.id) : Promise.resolve([])),
    [account?.id],
  );
  const unlocked = unlockedList.data ?? [];

  const shoppingOpen = useLiveQuery(
    () => (account ? shoppingRepo.countOpen(account.id, householdId) : Promise.resolve(0)),
    [account?.id, householdId],
  );
  const choreList = useLiveQuery(
    () => (householdId ? choreRepo.list(householdId) : Promise.resolve([])),
    [householdId],
  );
  const gymMinutes = useLiveQuery(
    () => (account ? workoutRepo.minutesSince(account.id, dayKey()) : Promise.resolve(0)),
    [account?.id],
  );
  const gymKcal = useLiveQuery(
    () => (account ? mealRepo.kcalOf(account.id, dayKey()) : Promise.resolve(0)),
    [account?.id],
  );
  const gymSleep = useLiveQuery(
    () => (account ? sleepRepo.list(account.id, 1) : Promise.resolve([])),
    [account?.id],
  );
  const moneySpent = useLiveQuery(
    () => (account ? expenseRepo.totalOf(account.id, monthKey()) : Promise.resolve(0)),
    [account?.id],
  );
  const moneyBills = useLiveQuery(
    () => (account ? billRepo.listOpen(account.id) : Promise.resolve([])),
    [account?.id],
  );
  const familyNext = useLiveQuery(
    () =>
      access.householdIds.length > 0
        ? eventRepo.listBetween(
            access,
            new Date().toISOString(),
            new Date(Date.now() + 14 * 86_400_000).toISOString(),
            access.householdIds.map((id) => `house:${id}` as const),
          )
        : Promise.resolve([]),
    [access.accountId, access.householdIds],
  );

  /**
   * Installieren fuehrt in den Store, sobald es die App dort gibt. Bis dahin
   * oeffnet der Knopf sie direkt — in der Entwicklung ist das dasselbe Ziel.
   */
  async function install(id: AppId) {
    const store = storeUrl(APPS[id], Platform.OS);
    await Linking.openURL(store ?? appUrl(id));
  }

  /**
   * Die Felder einer App stehen immer da — auch wenn nichts drin ist. So
   * sieht man, was einen erwartet, statt einer leeren Karte.
   */
  function fields(id: AppId): { label: string; value: string | null }[] {
    if (id === 'betterfamily') {
      const next = familyNext.data?.[0];
      const open = shoppingOpen.data ?? 0;
      const jobs = choreList.data?.length ?? 0;
      return [
        {
          label: t('field.nextAppointment'),
          value: next ? `${formatTime(language, next.startsAt)} · ${next.title}` : null,
        },
        { label: t('field.shopping'), value: open > 0 ? t('field.open', { count: open }) : null },
        { label: t('field.chores'), value: jobs > 0 ? t('field.open', { count: jobs }) : null },
      ];
    }
    if (id === 'bettergym') {
      const trained = gymMinutes.data ?? 0;
      const eaten = gymKcal.data ?? 0;
      const night = gymSleep.data?.[0];
      const slept = night ? sleepMinutes(night) : 0;
      return [
        {
          label: t('field.training'),
          value: trained > 0 ? t('gym.minutes', { minutes: trained }) : null,
        },
        { label: t('field.calories'), value: eaten > 0 ? t('meals.kcal', { kcal: eaten }) : null },
        {
          label: t('field.sleep'),
          value: night
            ? t('sleep.duration', { hours: Math.floor(slept / 60), minutes: slept % 60 })
            : null,
        },
      ];
    }
    if (id === 'bettermoney') {
      const spent = moneySpent.data ?? 0;
      const open = moneyBills.data?.length ?? 0;
      return [
        { label: t('field.budget'), value: spent > 0 ? formatMoney(language, spent) : null },
        { label: t('field.bills'), value: open > 0 ? t('field.open', { count: open }) : null },
      ];
    }
    return [{ label: t('field.chat'), value: null }];
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Text variant="section" tone="muted">
        {t('family.title')}
      </Text>

      {others.map((id) => {
        const app = APPS[id];
        const open = unlocked.includes(id);
        const rows = open ? fields(id) : [];

        return (
          // Freigeschaltet fuehrt die ganze Karte in die App. Ist sie es nicht,
          // gehoert der Tipp dem Installieren-Knopf — ein Knopf im Knopf waere
          // im Browser ungueltiges HTML und faellt beim Rendern auf.
          <Card key={id} {...(open ? { onPress: () => void Linking.openURL(appUrl(id)) } : {})}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              {/* Blass ist nur die App selbst — der Knopf soll auffallen. */}
              <View style={{ opacity: open ? 1 : 0.5 }}>
                <AppIcon appId={id} />
              </View>

              <View style={{ flex: 1, gap: 2, opacity: open ? 1 : 0.5 }}>
                <Text variant="title">{app.name}</Text>
                {open ? null : (
                  <Text variant="caption" tone="faint">
                    {t(app.taglineKey as TranslationKey)}
                  </Text>
                )}
              </View>

              {open ? null : (
                <Button
                  label={t('family.install')}
                  icon="download"
                  size="sm"
                  fullWidth={false}
                  onPress={() => void install(id)}
                />
              )}
            </View>

            {open ? (
              <View style={{ paddingTop: theme.spacing.sm }}>
                {rows.map((row, index) => (
                  <View key={row.label}>
                    {index > 0 ? <Divider /> : null}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: theme.spacing.sm,
                        paddingVertical: theme.spacing.sm,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text variant="label" tone="muted">
                          {row.label}
                        </Text>
                      </View>
                      <Text variant="label" tone={row.value ? 'default' : 'faint'}>
                        {row.value ?? '—'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}
