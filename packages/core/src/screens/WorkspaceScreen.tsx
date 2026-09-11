import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';

import {
  appAccess,
  bills as billRepo,
  contacts as contactRepo,
  dayKey,
  documents as documentRepo,
  drinks as drinkRepo,
  expenses as expenseRepo,
  habits as habitRepo,
  meals as mealRepo,
  meds as medRepo,
  monthKey,
  moods as moodRepo,
  pets as petRepo,
  plantDueDay,
  plants as plantRepo,
  recipes as recipeRepo,
  savings as savingsRepo,
  sleepMinutes,
  sleeps as sleepRepo,
  subscriptions as subscriptionRepo,
  trips as tripRepo,
  useLiveQuery,
  vehicles as vehicleRepo,
  vitals as vitalRepo,
  workouts as workoutRepo,
} from '@/db';
import { daysUntil, nextBirthday, relativeDay } from '@/features/shared/days';
import {
  alarms as alarmRepo,
  chores as choreRepo,
  events as eventRepo,
  notes as noteRepo,
  shopping as shoppingRepo,
  tasks as taskRepo,
} from '@/db/repositories';
import { useCalendarAccess } from '@/features/calendar/useCalendarAccess';
import { appUrl } from '@/app/bridge';
import { APPS, currentApp, hasHouseholds, storeUrl, type AppId } from '@/app/identity';
import { AppFamily } from '@/features/apps/AppFamily';
import {
  formatLongDate,
  formatMoney,
  formatShortDate,
  formatTime,
  useI18n,
  type TranslationKey,
} from '@/i18n';
import { TARGET_DL } from '@/features/gym/WaterView';
import { DailyQuote } from '@/features/today/DailyQuote';
import { DayStats, type DayStat } from '@/features/today/DayStats';
import { DayThread, THREAD_INDENT, type DayEntry } from '@/features/today/DayThread';
import { MODULES, modulesOfApp } from '@/mocks/modules';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount, useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  Avatar,
  Card,
  Divider,
  Header,
  Icon,
  Input,
  ListItem,
  ModuleIcon,
  Screen,
  Text,
  type IconName,
} from '@/ui';

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
  const documentList = useLiveQuery(() => documentRepo.list(account.id), [account.id]);
  const habitList = useLiveQuery(() => habitRepo.list(account.id), [account.id]);
  const habitTicks = useLiveQuery(() => habitRepo.ticks(account.id), [account.id]);
  const tripList = useLiveQuery(() => tripRepo.list(account.id), [account.id]);
  const contactList = useLiveQuery(() => contactRepo.list(account.id), [account.id]);
  const recipeList = useLiveQuery(
    () => recipeRepo.list(account.id, householdId),
    [account.id, householdId],
  );
  const plantList = useLiveQuery(
    () => plantRepo.list(account.id, householdId),
    [account.id, householdId],
  );
  const petList = useLiveQuery(
    () => petRepo.list(account.id, householdId),
    [account.id, householdId],
  );
  const petEventList = useLiveQuery(
    () => petRepo.events(account.id, householdId),
    [account.id, householdId],
  );
  const vehicleList = useLiveQuery(
    () => vehicleRepo.list(account.id, householdId),
    [account.id, householdId],
  );
  const sleepList = useLiveQuery(() => sleepRepo.list(account.id, 1), [account.id]);
  const medList = useLiveQuery(() => medRepo.list(account.id), [account.id]);
  const medTakes = useLiveQuery(() => medRepo.takes(account.id, dayKey()), [account.id]);
  const weightList = useLiveQuery(() => vitalRepo.list(account.id, 'weight', 1), [account.id]);
  const moodList = useLiveQuery(() => moodRepo.list(account.id, 1), [account.id]);
  const unlockedList = useLiveQuery(() => appAccess.appsOf(account.id), [account.id]);

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
  const today = dayKey();
  const expiring = (documentList.data ?? []).filter(
    (row) => row.expiresOn !== null && daysUntil(row.expiresOn) <= 60,
  );
  const habitRows = habitList.data ?? [];
  const tickedToday = new Set(
    (habitTicks.data ?? []).filter((tick) => tick.day === today).map((tick) => tick.habitId),
  );
  const nextTrip = (tripList.data ?? []).find((trip) => trip.endDay >= today);
  const birthdays = (contactList.data ?? [])
    .flatMap((row) => (row.birthday ? [{ row, next: nextBirthday(row.birthday) }] : []))
    .filter((entry) => entry.next.days <= 30)
    .sort((a, b) => a.next.days - b.next.days);
  const recipeRows = recipeList.data ?? [];
  const plantRows = plantList.data ?? [];
  const plantsDue = plantRows.filter((plant) => plantDueDay(plant) <= today);
  const petRows = petList.data ?? [];
  const petEvents = (petEventList.data ?? []).filter((event) => event.day >= today);
  const vehicleRows = vehicleList.data ?? [];
  const vehicleDue = vehicleRows.flatMap((vehicle) => {
    const lines: { key: string; title: string; day: string | null; missing: boolean }[] = [];
    if (vehicle.serviceOn && daysUntil(vehicle.serviceOn) <= 30) {
      lines.push({
        key: `${vehicle.id}-s`,
        title: `${vehicle.name} · ${t('vehicles.service')}`,
        day: vehicle.serviceOn,
        missing: false,
      });
    }
    if (vehicle.tyresOn && daysUntil(vehicle.tyresOn) <= 30) {
      lines.push({
        key: `${vehicle.id}-t`,
        title: `${vehicle.name} · ${t('vehicles.tyres')}`,
        day: vehicle.tyresOn,
        missing: false,
      });
    }
    if (vehicle.vignetteYear === null || vehicle.vignetteYear < new Date().getFullYear()) {
      lines.push({
        key: `${vehicle.id}-v`,
        title: `${vehicle.name} · ${t('vehicles.vignette')}`,
        day: null,
        missing: true,
      });
    }
    return lines;
  });

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

    if (id === 'documents') {
      return expiring.length === 0 ? (
        <Text variant="label" tone="faint">
          {t('documents.calm')}
        </Text>
      ) : (
        expiring.slice(0, 3).map((row, index) => (
          <View key={row.id}>
            {index > 0 ? <Divider /> : null}
            <ListItem
              title={row.title}
              right={
                <Text
                  variant="label"
                  tone={row.expiresOn && daysUntil(row.expiresOn) < 0 ? 'danger' : 'muted'}
                >
                  {row.expiresOn ? relativeDay(t, language, row.expiresOn) : ''}
                </Text>
              }
            />
          </View>
        ))
      );
    }

    if (id === 'habits') {
      return habitRows.length === 0 ? (
        <Text variant="label" tone="faint">
          {t('habits.empty.title')}
        </Text>
      ) : (
        <>
          <Text variant="caption" tone="muted">
            {t('habits.today', { done: tickedToday.size, total: habitRows.length })}
          </Text>
          {habitRows.slice(0, 5).map((habit, index) => (
            <View key={habit.id}>
              {index > 0 ? <Divider /> : null}
              <ListItem
                title={habit.name}
                icon={tickedToday.has(habit.id) ? 'checkCircle' : 'circle'}
                // Der Haken fuer heute — direkt hier.
                onPress={() => void habitRepo.toggle(habit.id, account.id, today)}
              />
            </View>
          ))}
        </>
      );
    }

    if (id === 'travel') {
      return nextTrip ? (
        <ListItem
          title={nextTrip.name}
          subtitle={nextTrip.destination ?? undefined}
          right={
            <Text variant="label" tone="accent">
              {nextTrip.startDay <= today
                ? t('trips.ongoing')
                : relativeDay(t, language, nextTrip.startDay)}
            </Text>
          }
        />
      ) : (
        <Text variant="label" tone="faint">
          {t('trips.empty.title')}
        </Text>
      );
    }

    if (id === 'contacts') {
      return birthdays.length === 0 ? (
        <Text variant="label" tone="faint">
          {t('contacts.calm')}
        </Text>
      ) : (
        birthdays.slice(0, 3).map(({ row, next }, index) => (
          <View key={row.id}>
            {index > 0 ? <Divider /> : null}
            <ListItem
              title={row.name}
              icon="gift"
              subtitle={t('contacts.turns', { age: next.age })}
              right={
                <Text variant="label" tone={next.days === 0 ? 'accent' : 'muted'}>
                  {relativeDay(t, language, next.day)}
                </Text>
              }
            />
          </View>
        ))
      );
    }

    if (id === 'recipes') {
      return recipeRows.length === 0 ? (
        <Text variant="label" tone="faint">
          {t('recipes.empty.title')}
        </Text>
      ) : (
        recipeRows.slice(0, 3).map((recipe, index) => (
          <View key={recipe.id}>
            {index > 0 ? <Divider /> : null}
            <ListItem
              title={recipe.title}
              subtitle={t('recipes.summary', {
                servings: recipe.servings,
                ingredients: recipe.ingredients.length,
              })}
              onPress={() => router.push('/run/recipes')}
            />
          </View>
        ))
      );
    }

    if (id === 'plants') {
      if (plantRows.length === 0) {
        return (
          <Text variant="label" tone="faint">
            {t('plants.empty.title')}
          </Text>
        );
      }
      return plantsDue.length === 0 ? (
        <Text variant="label" tone="faint">
          {t('plants.calm')}
        </Text>
      ) : (
        plantsDue.slice(0, 5).map((plant, index) => (
          <View key={plant.id}>
            {index > 0 ? <Divider /> : null}
            <ListItem
              title={plant.name}
              subtitle={plant.location ?? undefined}
              icon="water"
              // Ein Tipp heisst gegossen.
              onPress={() => void plantRepo.water(plant.id, today)}
            />
          </View>
        ))
      );
    }

    if (id === 'pets') {
      if (petRows.length === 0) {
        return (
          <Text variant="label" tone="faint">
            {t('pets.empty.title')}
          </Text>
        );
      }
      return petEvents.length === 0 ? (
        <Text variant="label" tone="faint">
          {petRows.map((pet) => pet.name).join(' · ')}
        </Text>
      ) : (
        petEvents.slice(0, 3).map((event, index) => (
          <View key={event.id}>
            {index > 0 ? <Divider /> : null}
            <ListItem
              title={`${petRows.find((pet) => pet.id === event.petId)?.name ?? ''} · ${t(`pets.event.${event.kind}` as TranslationKey)}`}
              right={
                <Text variant="label" tone="muted">
                  {relativeDay(t, language, event.day)}
                </Text>
              }
            />
          </View>
        ))
      );
    }

    if (id === 'vehicles') {
      if (vehicleRows.length === 0) {
        return (
          <Text variant="label" tone="faint">
            {t('vehicles.empty.title')}
          </Text>
        );
      }
      return vehicleDue.length === 0 ? (
        <Text variant="label" tone="faint">
          {t('vehicles.calm')}
        </Text>
      ) : (
        vehicleDue.slice(0, 3).map((line, index) => (
          <View key={line.key}>
            {index > 0 ? <Divider /> : null}
            <ListItem
              title={line.title}
              right={
                <Text variant="label" tone="danger">
                  {line.day ? relativeDay(t, language, line.day) : t('vehicles.vignetteMissing')}
                </Text>
              }
            />
          </View>
        ))
      );
    }

    if (id === 'sleep') {
      const night = sleepList.data?.[0];
      const minutes = night ? sleepMinutes(night) : 0;
      return (
        <Text variant="label" tone={night ? 'default' : 'faint'}>
          {night
            ? t('sleep.duration', { hours: Math.floor(minutes / 60), minutes: minutes % 60 })
            : t('sleep.empty.title')}
        </Text>
      );
    }

    if (id === 'meds') {
      const medRows = medList.data ?? [];
      const takes = medTakes.data ?? [];
      const total = medRows.reduce((sum, med) => sum + med.slots.length, 0);
      const taken = takes.length;
      return medRows.length === 0 ? (
        <Text variant="label" tone="faint">
          {t('meds.empty.title')}
        </Text>
      ) : (
        <>
          <Text variant="caption" tone="muted">
            {taken >= total ? t('meds.allTaken') : t('meds.today', { taken, total })}
          </Text>
          {medRows.slice(0, 5).map((med, index) => {
            const next = med.slots.find(
              (slot) => !takes.some((take) => take.medId === med.id && take.slot === slot),
            );
            return (
              <View key={med.id}>
                {index > 0 ? <Divider /> : null}
                <ListItem
                  title={med.name}
                  subtitle={next ? t(`meds.slot.${next}` as TranslationKey) : undefined}
                  icon={next ? 'circle' : 'checkCircle'}
                  // Der naechste offene Zeitpunkt — ein Tipp heisst genommen.
                  {...(next
                    ? { onPress: () => void medRepo.toggle(med.id, account.id, today, next) }
                    : {})}
                />
              </View>
            );
          })}
        </>
      );
    }

    if (id === 'vitals') {
      const weight = weightList.data?.[0];
      return (
        <Text variant="label" tone={weight ? 'default' : 'faint'}>
          {weight ? `${weight.value} ${t('vitals.unit.weight')}` : t('vitals.empty.title')}
        </Text>
      );
    }

    if (id === 'mind') {
      const mood = moodList.data?.[0];
      const isToday = mood?.day === today;
      return (
        <Text variant="label" tone={isToday ? 'default' : 'faint'}>
          {isToday && mood
            ? `${t(`mind.mood.${mood.mood}` as TranslationKey)}${mood.note ? ` · ${mood.note}` : ''}`
            : t('mind.today')}
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

  /** Name und Symbol einer Funktion — auch einer, die eine andere App fuehrt. */
  const moduleOf = (id: string) => MODULES.find((module) => module.id === id);
  const nameOf = (id: string) => moduleOf(id)?.name ?? id;
  const iconOf = (id: string): IconName => moduleOf(id)?.icon ?? 'circle';
  const owns = (id: string) => mine.some((module) => module.id === id);
  const unlocked = unlockedList.data ?? [];

  /** "06:40" auf heute bezogen, damit der Wecker im Band an seiner Zeit steht. */
  function todayAt(time: string): string {
    const [hours, minutes] = time.split(':');
    const when = new Date();
    when.setHours(Number(hours), Number(minutes), 0, 0);
    return when.toISOString();
  }

  /** Oeffnet eine andere Better-App — im Store, sobald es sie dort gibt. */
  function openApp(id: AppId) {
    void Linking.openURL(storeUrl(APPS[id], Platform.OS) ?? appUrl(id));
  }

  /**
   * Das Tagesband. Es fragt nichts Neues ab — es ordnet, was dieser Bildschirm
   * ohnehin laedt, nach der Zeit statt nach Funktion. Was man vorher auf den
   * Karten direkt tun konnte (abhaken, bezahlen, Gewohnheit setzen), geht hier
   * ueber den Kreis links.
   */
  const thread: DayEntry[] = [];

  if (nextAlarm.data && owns('alarm')) {
    thread.push({
      key: 'alarm',
      moduleId: 'alarm',
      icon: iconOf('alarm'),
      at: todayAt(nextAlarm.data.time),
      title: nextAlarm.data.label || nameOf('alarm'),
      tag: nameOf('alarm'),
      onPress: () => router.push('/run/alarm'),
    });
  }

  const eventsToday = events.filter((row) => row.startsAt.slice(0, 10) === today);

  for (const event of eventsToday) {
    thread.push({
      key: `event-${event.id}`,
      moduleId: 'calendar',
      icon: iconOf('calendar'),
      at: event.allDay ? null : event.startsAt,
      title: event.title,
      meta: event.allDay ? t('today.allDay') : undefined,
      tag: nameOf('calendar'),
      onPress: () => router.push('/run/calendar'),
    });
  }

  for (const task of tasks.slice(0, 5)) {
    thread.push({
      key: `task-${task.id}`,
      moduleId: 'tasks',
      icon: iconOf('tasks'),
      title: task.title,
      tag: nameOf('tasks'),
      // Der Kreis hakt direkt ab — dafuer muss man nirgends hin.
      onToggle: () => void taskRepo.setDone(task.id, true),
    });
  }

  if (owns('habits')) {
    for (const habit of habitRows.filter((row) => !tickedToday.has(row.id)).slice(0, 3)) {
      thread.push({
        key: `habit-${habit.id}`,
        moduleId: 'habits',
        icon: iconOf('habits'),
        title: habit.name,
        tag: nameOf('habits'),
        onToggle: () => void habitRepo.toggle(habit.id, account.id, today),
      });
    }
  }

  for (const bill of bills.filter((row) => row.dueDay <= today).slice(0, 2)) {
    thread.push({
      key: `bill-${bill.id}`,
      moduleId: 'bills',
      icon: iconOf('bills'),
      title: bill.title,
      meta: money(bill.amountChf),
      tag: nameOf('bills'),
      // Antippen heisst bezahlt — wie beim Abhaken einer Aufgabe.
      onToggle: () => void billRepo.setPaid(bill.id, true),
    });
  }

  if (owns('documents')) {
    for (const row of expiring.slice(0, 2)) {
      thread.push({
        key: `doc-${row.id}`,
        moduleId: 'documents',
        icon: iconOf('documents'),
        title: row.title,
        meta: row.expiresOn ? relativeDay(t, language, row.expiresOn) : undefined,
        tag: nameOf('documents'),
        onPress: () => router.push('/run/documents'),
      });
    }
  }

  if (owns('contacts')) {
    for (const { row, next } of birthdays.slice(0, 2)) {
      thread.push({
        key: `birthday-${row.id}`,
        moduleId: 'contacts',
        icon: 'gift',
        title: row.name,
        meta: `${t('contacts.turns', { age: next.age })} · ${relativeDay(t, language, next.day)}`,
        tag: nameOf('contacts'),
        onPress: () => router.push('/run/contacts'),
      });
    }
  }

  if (owns('travel') && nextTrip) {
    thread.push({
      key: `trip-${nextTrip.id}`,
      moduleId: 'travel',
      icon: iconOf('travel'),
      title: nextTrip.name,
      meta:
        nextTrip.startDay <= today
          ? t('trips.ongoing')
          : relativeDay(t, language, nextTrip.startDay),
      tag: nameOf('travel'),
      onPress: () => router.push('/run/travel'),
    });
  }

  if (shopping.length > 0) {
    thread.push({
      key: 'shopping',
      moduleId: 'shopping',
      icon: iconOf('shopping'),
      title: nameOf('shopping'),
      meta: t('today.openCount', { count: String(shopping.length) }),
      tag: nameOf('shopping'),
      onPress: owns('shopping') ? () => router.push('/run/shopping') : () => openApp('betterfamily'),
    });
  }

  // Was eine Uhrzeit hat, passiert ohnehin. Zaehlen tut, was ohne Zeit
  // dasteht — das sind die Dinge, die auf dich warten.
  const waiting = thread.filter((entry) => !entry.at).length;
  const lede =
    waiting === 0
      ? t('today.needsYou.none')
      : waiting === 1
        ? t('today.needsYou.one')
        : t('today.needsYou', { count: waiting });

  /**
   * Die Zahlen des Tages. In GetBetter wie im Entwurf: Wasser, Kalorien und
   * der Monat — gelesen aus der gemeinsamen Datenbank. Fehlt die App dahinter,
   * sagt die Kachel das und fuehrt zum Installieren.
   */
  const minutesToday = workoutsToday.reduce((sum, row) => sum + row.minutes, 0);
  const wholeNumber = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });
  const gymOpen = unlocked.includes('bettergym');
  const moneyOpen = unlocked.includes('bettermoney');
  const install = t('today.stat.install');

  const mainStats: DayStat[] = [
    gymOpen
      ? {
          key: 'water',
          label: t('today.stat.water'),
          value: (drinkToday / 10).toFixed(1),
          unit: t('today.unit.ofLitre', { target: (TARGET_DL / 10).toFixed(1) }),
          // 2.5 Liter am Tag, in Dezilitern gerechnet.
          share: drinkToday / TARGET_DL,
        }
      : {
          key: 'water',
          label: t('today.stat.water'),
          value: '—',
          unit: install,
          onPress: () => openApp('bettergym'),
        },
    gymOpen
      ? {
          key: 'kcal',
          label: t('today.stat.kcal'),
          value: wholeNumber.format(kcalToday),
          unit: t('today.unit.kcal'),
          share: kcalToday / 2000,
          strong: true,
        }
      : {
          key: 'kcal',
          label: t('today.stat.kcal'),
          value: '—',
          unit: install,
          onPress: () => openApp('bettergym'),
        },
    moneyOpen
      ? {
          key: 'month',
          label: t('today.stat.month'),
          value: wholeNumber.format(spent),
          unit: t('today.unit.chf'),
        }
      : {
          key: 'month',
          label: t('today.stat.month'),
          value: '—',
          unit: install,
          onPress: () => openApp('bettermoney'),
        },
  ];

  const ownStats: DayStat[] = [];
  if (owns('water')) {
    ownStats.push({
      key: 'water',
      label: nameOf('water'),
      value: (drinkToday / 10).toFixed(1),
      unit: t('today.unit.litre'),
      share: drinkToday / TARGET_DL,
    });
  }
  if (owns('meals')) {
    ownStats.push({
      key: 'meals',
      label: nameOf('meals'),
      value: wholeNumber.format(kcalToday),
      unit: t('today.unit.kcal'),
      share: kcalToday / 2000,
      strong: true,
    });
  }
  if (owns('fitness')) {
    ownStats.push({
      key: 'fitness',
      label: nameOf('fitness'),
      value: String(minutesToday),
      unit: t('today.unit.min'),
    });
  }
  if (owns('budget')) {
    ownStats.push({
      key: 'month',
      label: t('today.stat.month'),
      value: wholeNumber.format(spent),
      unit: t('today.unit.chf'),
    });
  }

  const dayStats = main ? mainStats : ownStats.slice(0, 3);

  return (
    <Screen
      header={
        <Header
          large
          overline={formatLongDate(language, new Date().toISOString())}
          title={t('today.greeting', { name: account.firstName || t('today.greetingFallback') })}
          right={<Avatar name={account.firstName || '?'} size={36} />}
        >
          <Text
            variant="body"
            tone="muted"
            style={{
              maxWidth: 272,
              fontSize: theme.fontSize.lede,
              lineHeight: theme.lineHeight.lede,
            }}
          >
            {lede}
          </Text>
          {main ? <DailyQuote /> : null}
        </Header>
      }
      // Die Zahlen des Tages stehen fest ueber der Leiste, wie im Entwurf —
      // das Tagesband scrollt darueber, die Zahlen bleiben im Blick.
      footer={dayStats.length > 0 ? <DayStats stats={dayStats} /> : undefined}
    >
      <DayThread entries={thread} />

      {main && owns('tasks') ? (
        <QuickAdd
          value={draft}
          onChangeText={setDraft}
          onSubmit={() => void addTask()}
          placeholder={t('workspace.addTask')}
        />
      ) : null}

      {main ? (
        <AppFamily />
      ) : (
        <>
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
        </>
      )}
    </Screen>
  );
}

/** Eine Aufgabe eintragen, direkt unter dem Band — eingerueckt wie seine Karten. */
function QuickAdd({
  value,
  onChangeText,
  onSubmit,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        theme.elevation.card,
        {
          marginLeft: THREAD_INDENT,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          minHeight: 50,
          borderRadius: theme.radii.item,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <View
        style={{
          width: 21,
          height: 21,
          borderRadius: theme.radii.xs,
          backgroundColor: theme.colors.surfaceMuted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="plus" size={14} color={theme.colors.textMuted} />
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textFaint}
        onSubmitEditing={onSubmit}
        returnKeyType="done"
        accessibilityLabel={placeholder}
        style={{
          flex: 1,
          height: 50,
          fontFamily: theme.fontFamily,
          fontSize: theme.fontSize.md,
          color: theme.colors.text,
          outlineStyle: 'none' as never,
        }}
      />
    </View>
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
