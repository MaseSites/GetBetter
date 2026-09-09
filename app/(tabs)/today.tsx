import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { useLiveQuery } from '@/db';
import {
  alarms as alarmRepo,
  events as eventRepo,
  notes as noteRepo,
  shopping as shoppingRepo,
  tasks as taskRepo,
} from '@/db/repositories';
import { formatLongDate, formatTime, useI18n } from '@/i18n';
import { useAccount, useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Badge, Card, Divider, EmptyState, Header, ListItem, Loading, Screen, Text } from '@/ui';

export default function TodayScreen() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const { household } = useApp();
  const householdId = household?.id ?? null;

  const todayIso = new Date().toISOString();

  // Alles hier kommt aus der Datenbank — keine Beispielzahlen mehr.
  const upcoming = useLiveQuery(
    () => eventRepo.listUpcoming(account.id, householdId, todayIso, 5),
    [account.id, householdId],
  );
  const openTasks = useLiveQuery(
    () => taskRepo.listOpen(account.id, householdId),
    [account.id, householdId],
  );
  const shoppingItems = useLiveQuery(
    () => shoppingRepo.list(account.id, householdId),
    [account.id, householdId],
  );
  const noteCount = useLiveQuery(() => noteRepo.count(account.id), [account.id]);
  const nextAlarm = useLiveQuery(() => alarmRepo.nextEnabled(account.id), [account.id]);

  const events = upcoming.data ?? [];
  const tasks = openTasks.data ?? [];
  const shoppingOpen = (shoppingItems.data ?? []).filter((item) => !item.done);
  const notes = noteCount.data ?? 0;

  const stillLoading = upcoming.loading && openTasks.loading;
  const everythingEmpty =
    events.length === 0 && tasks.length === 0 && shoppingOpen.length === 0 && notes === 0;

  return (
    <Screen
      header={
        <Header
          title={t('today.greeting', { name: account.firstName || t('today.greetingFallback') })}
          subtitle={formatLongDate(language, todayIso)}
        />
      }
    >
      {stillLoading ? <Loading /> : null}

      {!stillLoading && everythingEmpty ? (
        <EmptyState
          icon="grid"
          title={t('today.blank.title')}
          body={t('today.blank.body')}
          actionLabel={t('today.blank.action')}
          onAction={() => router.push('/modules')}
        />
      ) : null}

      {events.length > 0 ? (
        <Card title={t('today.appointments')} onPress={() => router.push('/run/calendar')}>
          <View>
            {events.map((event, index) => (
              <View key={event.id}>
                {index > 0 ? <Divider /> : null}
                <ListItem
                  title={event.title}
                  subtitle={event.location ?? undefined}
                  right={
                    <Text variant="label" tone="muted">
                      {event.allDay ? t('today.allDay') : formatTime(language, event.startsAt)}
                    </Text>
                  }
                />
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {tasks.length > 0 ? (
        <Card
          title={t('today.tasks')}
          subtitle={t('today.tasks.remaining', { count: tasks.length })}
          onPress={() => router.push('/run/tasks')}
        >
          <View>
            {tasks.slice(0, 5).map((task, index) => (
              <View key={task.id}>
                {index > 0 ? <Divider /> : null}
                <ListItem
                  title={task.title}
                  icon="circle"
                  right={
                    task.shared ? <Badge label={t('today.household')} icon="people" /> : undefined
                  }
                />
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {shoppingOpen.length > 0 ? (
        <Card
          title={t('today.shopping')}
          subtitle={t('shopping.openCount', { count: shoppingOpen.length })}
          onPress={() => router.push('/run/shopping')}
        >
          <Text variant="label" tone="muted">
            {shoppingOpen
              .slice(0, 6)
              .map((item) => item.name)
              .join(', ')}
          </Text>
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        {nextAlarm.data ? (
          <View style={{ flex: 1 }}>
            <Card title={t('today.alarm')} onPress={() => router.push('/run/alarm')}>
              <Text variant="display">{nextAlarm.data.time}</Text>
              <Text variant="caption" tone="muted">
                {nextAlarm.data.label}
              </Text>
            </Card>
          </View>
        ) : null}

        {notes > 0 ? (
          <View style={{ flex: 1 }}>
            <Card title={t('today.notes')} onPress={() => router.push('/run/notes')}>
              <Text variant="display">{notes}</Text>
              <Text variant="caption" tone="muted">
                {t('notes.count', { count: notes })}
              </Text>
            </Card>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
