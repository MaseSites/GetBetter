import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { useLiveQuery } from '@/db';
import {
  alarms as alarmRepo,
  events as eventRepo,
  notes as noteRepo,
  tasks as taskRepo,
} from '@/db/repositories';
import { AppFamily } from '@/features/apps/AppFamily';
import { useCalendarAccess } from '@/features/calendar/useCalendarAccess';
import { formatLongDate, formatTime, useI18n } from '@/i18n';
import { useAccount, useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Badge, Card, Divider, Header, ListItem, Screen, Text } from '@/ui';

/**
 * Die Startseite zeigt ihre Felder immer — auch leer. Wer nichts eingetragen
 * hat, sieht wenigstens, was hier stehen wird, statt einer weissen Flaeche.
 */
export default function TodayScreen() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const { household } = useApp();
  const householdId = household?.id ?? null;
  const { access } = useCalendarAccess();

  const todayIso = new Date().toISOString();

  const upcoming = useLiveQuery(
    () => eventRepo.listUpcoming(access, todayIso, 5),
    [access.accountId, access.householdIds, access.calendarIds],
  );
  const openTasks = useLiveQuery(
    () => taskRepo.listOpen(account.id, householdId),
    [account.id, householdId],
  );
  const noteCount = useLiveQuery(() => noteRepo.count(account.id), [account.id]);
  const nextAlarm = useLiveQuery(() => alarmRepo.nextEnabled(account.id), [account.id]);

  const events = upcoming.data ?? [];
  const tasks = openTasks.data ?? [];
  const notes = noteCount.data ?? 0;

  return (
    <Screen
      header={
        <Header
          large
          title={t('today.greeting', { name: account.firstName || t('today.greetingFallback') })}
          subtitle={formatLongDate(language, todayIso)}
        />
      }
    >
      <Card title={t('today.appointments')} onPress={() => router.push('/run/calendar')}>
        {events.length === 0 ? (
          <Text variant="label" tone="faint">
            {t('today.noAppointments')}
          </Text>
        ) : (
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
        )}
      </Card>

      <Card
        title={t('today.tasks')}
        {...(tasks.length > 0
          ? { subtitle: t('today.tasks.remaining', { count: tasks.length }) }
          : {})}
        onPress={() => router.push('/run/tasks')}
      >
        {tasks.length === 0 ? (
          <Text variant="label" tone="faint">
            {t('today.noTasks')}
          </Text>
        ) : (
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
        )}
      </Card>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <View style={{ flex: 1 }}>
          <Card title={t('today.alarm')} onPress={() => router.push('/run/alarm')}>
            {nextAlarm.data ? (
              <>
                <Text variant="display">{nextAlarm.data.time}</Text>
                <Text variant="caption" tone="muted">
                  {nextAlarm.data.label}
                </Text>
              </>
            ) : (
              <Text variant="label" tone="faint">
                {t('today.noAlarm')}
              </Text>
            )}
          </Card>
        </View>

        <View style={{ flex: 1 }}>
          <Card title={t('today.notes')} onPress={() => router.push('/run/notes')}>
            {notes > 0 ? (
              <>
                <Text variant="display">{notes}</Text>
                <Text variant="caption" tone="muted">
                  {t('notes.count', { count: notes })}
                </Text>
              </>
            ) : (
              <Text variant="label" tone="faint">
                {t('today.noNotes')}
              </Text>
            )}
          </Card>
        </View>
      </View>

      <AppFamily />
    </Screen>
  );
}
