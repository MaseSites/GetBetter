import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { currentApp } from '@/app/identity';
import { dayKey, meals as mealRepo, useLiveQuery, workouts as workoutRepo } from '@/db';
import {
  chores as choreRepo,
  shopping as shoppingRepo,
  tasks as taskRepo,
} from '@/db/repositories';
import { useTranslate, type TranslationKey } from '@/i18n';
import { modulesOfApp } from '@/mocks/modules';
import { useAccount, useApp } from '@/state/AppContext';
import { moduleTint, useTheme } from '@/theme';
import { Badge, Card, Header, Icon, Screen, Text } from '@/ui';

/**
 * Die Startseite der kleineren Better-Apps: eine Karte je Modul, mit Zahl,
 * wo es schon eine gibt. Was noch nicht gebaut ist, sagt das auch.
 */
export function AppHomeScreen() {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const { household } = useApp();
  const app = currentApp();
  const householdId = household?.id ?? null;

  const shoppingOpen = useLiveQuery(
    () => shoppingRepo.countOpen(account.id, householdId),
    [account.id, householdId],
  );
  const choresOpen = useLiveQuery(
    () => (householdId ? choreRepo.list(householdId) : Promise.resolve([])),
    [householdId],
  );
  const workoutList = useLiveQuery(() => workoutRepo.listDay(account.id, dayKey()), [account.id]);
  const mealList = useLiveQuery(() => mealRepo.listDay(account.id, dayKey()), [account.id]);
  const tasksOpen = useLiveQuery(
    () => taskRepo.countOpen(account.id, householdId),
    [account.id, householdId],
  );

  /** Zahlen gibt es nur, wo wirklich etwas gespeichert wird. */
  function figure(moduleId: string): number | undefined {
    if (moduleId === 'shopping') return shoppingOpen.data;
    // Ein Aemtli gilt als offen, solange es heute noch nicht erledigt wurde.
    if (moduleId === 'chores') return choresOpen.data?.length;
    if (moduleId === 'tasks') return tasksOpen.data;
    if (moduleId === 'fitness') return workoutList.data?.length;
    if (moduleId === 'meals') return mealList.data?.length;
    return undefined;
  }

  return (
    <Screen
      header={
        <Header
          large
          title={t('today.greeting', { name: account.firstName || t('today.greetingFallback') })}
          subtitle={t(app.taglineKey as TranslationKey)}
        />
      }
    >
      {modulesOfApp()
        .filter((module) => module.id !== 'calendar')
        .map((module) => {
          const tint = moduleTint(theme, module.id);
          const count = figure(module.id);
          return (
            <Card
              key={module.id}
              title={module.name}
              onPress={() => router.push(`/run/${module.id}`)}
              style={count === undefined ? { opacity: 0.55 } : undefined}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: theme.radii.md,
                    backgroundColor: tint.background,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name={module.icon} size={22} color={tint.foreground} />
                </View>
                <View style={{ flex: 1 }}>
                  {count === undefined ? (
                    <Text variant="label" tone="faint">
                      —
                    </Text>
                  ) : (
                    <Badge
                      label={t('today.openCount', { count })}
                      tone={count > 0 ? 'accent' : 'neutral'}
                    />
                  )}
                </View>
              </View>
            </Card>
          );
        })}
    </Screen>
  );
}
