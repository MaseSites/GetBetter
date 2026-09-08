import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useLiveQuery } from '@/db';
import { events as eventRepo } from '@/db/repositories';
import { useFavouriteAction } from '@/features/modules/useFavouriteAction';
import { formatTime, formatWeekday, useI18n } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Button, Card, Divider, Header, Icon, Input, Loading, Screen, Sheet, Text } from '@/ui';

function startOfDay(offset = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** "18:30" -> ISO an dem gewaehlten Tag. Ungueltiges gibt null. */
function combine(day: Date, time: string): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  const result = new Date(day);
  result.setHours(hour, minute, 0, 0);
  return result.toISOString();
}

export function CalendarView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const favouriteAction = useFavouriteAction(module.id);

  const [composeFor, setComposeFor] = useState<Date | null>(null);

  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => startOfDay(index)), []);
  const from = week[0]?.toISOString() ?? new Date().toISOString();
  const to = useMemo(() => startOfDay(7).toISOString(), []);

  const list = useLiveQuery(
    () => eventRepo.listBetween(account.id, from, to),
    [account.id, from, to],
  );
  const items = list.data ?? [];

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={t('calendar.week')}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
          actions={[favouriteAction]}
        />
      }
      footer={
        <Button
          label={t('calendar.add')}
          icon="plus"
          onPress={() => setComposeFor(week[0] ?? startOfDay())}
        />
      }
    >
      {list.loading && items.length === 0 ? <Loading /> : null}

      {week.map((day) => {
        const dayStart = day.toISOString();
        const next = new Date(day);
        next.setDate(next.getDate() + 1);
        const dayEnd = next.toISOString();
        const entries = items.filter(
          (event) => event.startsAt >= dayStart && event.startsAt < dayEnd,
        );

        return (
          <Card key={dayStart} title={formatWeekday(language, dayStart)}>
            {entries.length === 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t('calendar.add')} — ${formatWeekday(language, dayStart)}`}
                onPress={() => setComposeFor(day)}
                style={[styles.emptyDay, { gap: theme.spacing.sm }]}
              >
                <Icon name="plus" size={16} color={theme.colors.textFaint} />
                <Text variant="label" tone="faint">
                  {t('calendar.empty')}
                </Text>
              </Pressable>
            ) : (
              <View>
                {entries.map((event, index) => (
                  <View key={event.id}>
                    {index > 0 ? <Divider /> : null}
                    <View
                      style={[
                        styles.row,
                        { paddingVertical: theme.spacing.md, gap: theme.spacing.md },
                      ]}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text variant="body">{event.title}</Text>
                        {event.location ? (
                          <Text variant="label" tone="muted">
                            {event.location}
                          </Text>
                        ) : null}
                      </View>
                      <Text variant="label" tone="muted">
                        {event.allDay ? t('today.allDay') : formatTime(language, event.startsAt)}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${t('calendar.remove')}: ${event.title}`}
                        onPress={() => eventRepo.remove(event.id)}
                        hitSlop={8}
                      >
                        <Icon name="trash" size={18} color={theme.colors.textFaint} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>
        );
      })}

      <EventComposer day={composeFor} accountId={account.id} onClose={() => setComposeFor(null)} />
    </Screen>
  );
}

type ComposerProps = { day: Date | null; accountId: string; onClose: () => void };

function EventComposer({ day, accountId, onClose }: ComposerProps) {
  const { t, language } = useI18n();
  const theme = useTheme();

  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00');
  const [location, setLocation] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!day) return;
    if (title.trim().length === 0) {
      setError(t('calendar.error.title'));
      return;
    }
    const startsAt = combine(day, time);
    if (!startsAt) {
      setError(t('calendar.error.time'));
      return;
    }
    await eventRepo.create({ accountId, title, startsAt, location });
    setTitle('');
    setLocation('');
    setError(null);
    onClose();
  }

  return (
    <Sheet
      visible={day !== null}
      onClose={onClose}
      title={t('calendar.add')}
      subtitle={day ? formatWeekday(language, day.toISOString()) : undefined}
    >
      <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}>
        <Input
          label={t('calendar.field.title')}
          placeholder={t('calendar.field.titlePlaceholder')}
          value={title}
          onChangeText={(value) => {
            setTitle(value);
            setError(null);
          }}
          {...(error && title.trim().length === 0 ? { error } : {})}
        />
        <Input
          label={t('calendar.field.time')}
          placeholder="09:00"
          value={time}
          onChangeText={(value) => {
            setTime(value);
            setError(null);
          }}
          keyboardType="numbers-and-punctuation"
          {...(error && title.trim().length > 0 ? { error } : {})}
        />
        <Input
          label={t('calendar.field.location')}
          placeholder={t('calendar.field.locationPlaceholder')}
          value={location}
          onChangeText={setLocation}
        />
        <Button label={t('common.done')} icon="check" onPress={save} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  emptyDay: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
});
