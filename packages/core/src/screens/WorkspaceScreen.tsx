import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  bills as billRepo,
  dayKey,
  drinks as drinkRepo,
  expenses as expenseRepo,
  meals as mealRepo,
  monthKey,
  savings as savingsRepo,
  subscriptions as subscriptionRepo,
  useLiveQuery,
  workouts as workoutRepo,
} from '@/db';
import {
  alarms as alarmRepo,
  chores as choreRepo,
  events as eventRepo,
  notes as noteRepo,
  shopping as shoppingRepo,
  tasks as taskRepo,
} from '@/db/repositories';
import { useCalendarAccess } from '@/features/calendar/useCalendarAccess';
import { currentApp, hasHouseholds } from '@/app/identity';
import { AppFamily } from '@/features/apps/AppFamily';
import { formatLongDate, formatMoney, formatShortDate, formatTime, useI18n } from '@/i18n';
import { modulesOfApp } from '@/mocks/modules';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount, useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Card, Divider, Header, Icon, Input, ListItem, ModuleIcon, Screen, Text } from '@/ui';

/**
 * Kein Kachelbrett, sondern eine Arbeitsflaeche: jede Funktion steht mit dem
 * da, was sie gerade weiss, und man kann direkt etwas tun — abhaken, eintragen,
 * antippen. Wer mehr will, kommt ueber die Ueberschrift in die volle Ansicht.
 *
 * Was noch nicht gebaut ist, steht unten in einer stillen Zeile, statt als
 * Kachel so zu tun, als koenne es schon etwas.
 */
export function WorkspaceScreen() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const { household } = useApp();
  const { access } = useCalendarAccess();
  const app = currentApp();
  const main = app.id === 'getbetter';
  const householdId = household?.id ?? null;

  const [draft, setDraft] = useState('');

  const upcoming = useLiveQuery(
    () => eventRepo.listUpcoming(access, new Date().toISOString(), 3),
    [access.accountId, access.householdIds, access.calendarIds],
  );
  const openTasks = useLiveQuery(
    () => taskRepo.listOpen(account.id, householdId),
    [account.id, householdId],
  );
  const recentNotes = useLiveQuery(() => noteRepo.list(account.id), [account.id]);
  const nextAlarm = useLiveQuery(() => alarmRepo.nextEnabled(account.id), [account.id]);
  const shoppingList = useLiveQuery(
    () => shoppingRepo.list(account.id, householdId),
    [account.id, householdId],
  );
  const choreList = useLiveQuery(
    () => (householdId ? choreRepo.list(householdId) : Promise.resolve([])),
    [householdId],
  );
  const workoutList = useLiveQuery(() => workoutRepo.listDay(account.id, dayKey()), [account.id]);
  const kcal = useLiveQuery(() => mealRepo.kcalOf(account.id, dayKey()), [account.id]);
  const drunk = useLiveQuery(() => drinkRepo.ofDay(account.id, dayKey()), [account.id]);
  const spentMonth = useLiveQuery(() => expenseRepo.totalOf(account.id, monthKey()), [account.id]);
  const openBills = useLiveQuery(() => billRepo.listOpen(account.id), [account.id]);
  const subscriptionMonthly = useLiveQuery(
    () => subscriptionRepo.monthlyTotal(account.id),
    [account.id],
  );
  const goalList = useLiveQuery(() => savingsRepo.list(account.id), [account.id]);

  const events = upcoming.data ?? [];
  const tasks = openTasks.data ?? [];
  const notes = (recentNotes.data ?? []).slice(0, 3);
  const shopping = (shoppingList.data ?? []).filter((row) => !row.done);
  const chores = choreList.data ?? [];
  const workoutsToday = workoutList.data ?? [];
  const kcalToday = kcal.data ?? 0;
  const drinkToday = drunk.data ?? 0;
  const spent = spentMonth.data ?? 0;
  const bills = openBills.data ?? [];
  const subscriptionsMonthly = subscriptionMonthly.data ?? 0;
  const goals = goalList.data ?? [];
  const money = (value: number) => formatMoney(language, value);

  async function addTask() {
    const title = draft.trim();
    if (title.length === 0) return;
    setDraft('');
    await taskRepo.create({ accountId: account.id, householdId, title });
  }

  /** Was diese App an dieser Stelle schon zeigen kann. */
  function content(id: string) {
    if (id === 'calendar') {
      return events.length === 0 ? (
        <Text variant="label" tone="faint">
          {t('today.noAppointments')}
        </Text>
      ) : (
        events.map((event, index) => (
          <View key={event.id}>
            {index > 0 ? <Divider /> : null}
            <ListItem
              title={event.title}
              subtitle={formatShortDate(language, event.startsAt)}
              right={
                <Text variant="label" tone="muted">
                  {event.allDay ? t('today.allDay') : formatTime(language, event.startsAt)}
                </Text>
              }
            />
          </View>
        ))
      );
    }

    if (id === 'tasks') {
      return (
        <>
          {tasks.length === 0 ? (
            <Text variant="label" tone="faint">
              {t('today.noTasks')}
            </Text>
          ) : (
            tasks.slice(0, 5).map((task, index) => (
              <View key={task.id}>
                {index > 0 ? <Divider /> : null}
                <ListItem
                  title={task.title}
                  icon="circle"
                  // Direkt hier abhaken — dafuer muss man nirgends hin.
                  onPress={() => void taskRepo.setDone(task.id, true)}
                />
              </View>
            ))
          )}
          <View style={{ paddingTop: theme.spacing.sm }}>
            <Input
              placeholder={t('workspace.addTask')}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={addTask}
              returnKeyType="done"
              accessibilityLabel={t('workspace.addTask')}
            />
          </View>
        </>
      );
    }

    if (id === 'notes') {
      return notes.length === 0 ? (
        <Text variant="label" tone="faint">
          {t('today.noNotes')}
        </Text>
      ) : (
        notes.map((note, index) => (
          <View key={note.id}>
            {index > 0 ? <Divider /> : null}
            <ListItem
              title={note.title || t('notes.untitled')}
              subtitle={note.body.slice(0, 60) || undefined}
              onPress={() => router.push('/run/notes')}
            />
          </View>
        ))
      );
    }

    if (id === 'alarm') {
      return nextAlarm.data ? (
        <ListItem title={nextAlarm.data.time} subtitle={nextAlarm.data.label} />
      ) : (
        <Text variant="label" tone="faint">
          {t('today.noAlarm')}
        </Text>
      );
    }

    if (id === 'shopping') {
      return shopping.length === 0 ? (
        <Text variant="label" tone="faint">
          {t('shopping.empty.title')}
        </Text>
      ) : (
        shopping.slice(0, 5).map((item, index) => (
          <View key={item.id}>
            {index > 0 ? <Divider /> : null}
            <ListItem
              title={item.name}
              icon="circle"
              onPress={() => void shoppingRepo.setDone(item.id, true)}
            />
          </View>
        ))
      );
    }

    if (id === 'chores') {
      return chores.length === 0 ? (
        <Text variant="label" tone="faint">
          {t('chores.empty.title')}
        </Text>
      ) : (
        chores.slice(0, 5).map((chore, index) => (
          <View key={chore.id}>
            {index > 0 ? <Divider /> : null}
            <ListItem title={chore.title} icon="broom" />
          </View>
        ))
      );
    }

    if (id === 'fitness') {
      return (
        <Text variant="label" tone={workoutsToday.length > 0 ? 'default' : 'faint'}>
          {workoutsToday.length > 0
            ? t('gym.minutes', {
                minutes: workoutsToday.reduce((sum, row) => sum + row.minutes, 0),
              })
            : t('gym.empty.title')}
        </Text>
      );
    }

    if (id === 'meals') {
      return (
        <Text variant="label" tone={kcalToday > 0 ? 'default' : 'faint'}>
          {kcalToday > 0 ? t('meals.kcal', { kcal: kcalToday }) : t('meals.empty.title')}
        </Text>
      );
    }

    if (id === 'water') {
      return (
        <Text variant="label" tone={drinkToday > 0 ? 'default' : 'faint'}>
          {t('water.amount', { amount: (drinkToday / 10).toFixed(1) })}
        </Text>
      );
    }

    if (id === 'budget') {
      return (
        <Text variant="label" tone={spent > 0 ? 'default' : 'faint'}>
          {spent > 0 ? t('budget.spent', { amount: money(spent) }) : t('budget.empty.title')}
        </Text>
      );
    }

    if (id === 'bills') {
      return bills.length === 0 ? (
        <Text variant="label" tone="faint">
          {t('bills.empty.title')}
        </Text>
      ) : (
        bills.slice(0, 3).map((bill, index) => (
          <View key={bill.id}>
            {index > 0 ? <Divider /> : null}
            <ListItem
              title={bill.title}
              icon="circle"
              subtitle={formatShortDate(language, bill.dueDay)}
              right={
                <Text variant="label" tone="muted">
                  {money(bill.amountChf)}
                </Text>
              }
              // Antippen heisst bezahlt — wie beim Abhaken einer Aufgabe.
              onPress={() => void billRepo.setPaid(bill.id, true)}
            />
          </View>
        ))
      );
    }

    if (id === 'subscriptions') {
      return (
        <Text variant="label" tone={subscriptionsMonthly > 0 ? 'default' : 'faint'}>
          {subscriptionsMonthly > 0
            ? t('money.perMonth', { amount: money(subscriptionsMonthly) })
            : t('subscriptions.empty.title')}
        </Text>
      );
    }

    if (id === 'savings') {
      return goals.length === 0 ? (
        <Text variant="label" tone="faint">
          {t('savings.empty.title')}
        </Text>
      ) : (
        goals.slice(0, 3).map((goal, index) => (
          <View key={goal.id}>
            {index > 0 ? <Divider /> : null}
            <ListItem
              title={goal.name}
              right={
                <Text variant="label" tone="muted">
                  {t('savings.progress', {
                    saved: money(goal.savedChf),
                    target: money(goal.targetChf),
                  })}
                </Text>
              }
            />
          </View>
        ))
      );
    }

    return null;
  }

  const mine = modulesOfApp();
  const built = mine.filter((module) => content(module.id) !== null);
  const pending = mine.filter((module) => content(module.id) === null);

  return (
    <Screen
      header={
        <Header
          large
          title={t('today.greeting', { name: account.firstName || t('today.greetingFallback') })}
          subtitle={formatLongDate(language, new Date().toISOString())}
        />
      }
    >
      {hasHouseholds() ? (
        <Section
          module={{
            id: 'household',
            area: 'household',
            name: t('tabs.household'),
            short: '',
            description: '',
            icon: 'people',
            priority: 1,
            permissions: { read: [], write: [] },
          }}
          onOpen={() => router.push('/household')}
        >
          <Text variant="label" tone={household ? 'default' : 'faint'}>
            {household ? household.name : t('household.none.title')}
          </Text>
        </Section>
      ) : null}

      {built.map((module) => (
        <Section key={module.id} module={module} onOpen={() => router.push(`/run/${module.id}`)}>
          {content(module.id)}
        </Section>
      ))}

      {main ? <AppFamily /> : null}

      {pending.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="section" tone="muted">
            {t('workspace.pending')}
          </Text>
          <Card>
            {pending.map((module, index) => (
              <View key={module.id} style={{ opacity: 0.55 }}>
                {index > 0 ? <Divider /> : null}
                <ListItem
                  title={module.name}
                  subtitle={module.short}
                  onPress={() => router.push(`/module/${module.id}`)}
                />
              </View>
            ))}
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}

/** Eine Funktion mit ihrem Logo, ihrem Namen und dem, was sie gerade weiss. */
function Section({
  module,
  onOpen,
  children,
}: {
  module: ModuleDefinition | undefined;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  if (!module) return null;

  return (
    <Card>
      {/* Nur die Kopfzeile fuehrt weiter — sonst faengt die Karte jeden Tipp
          auf die Zeilen darunter ab. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={module.name}
        onPress={onOpen}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingBottom: theme.spacing.sm,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <ModuleIcon moduleId={module.id} icon={module.icon} size="sm" />
        <View style={{ flex: 1 }}>
          <Text variant="title">{module.name}</Text>
        </View>
        <Icon name="forward" size={18} color={theme.colors.textFaint} />
      </Pressable>
      {children}
    </Card>
  );
}
