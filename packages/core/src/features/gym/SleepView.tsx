import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { dayKey, sleepMinutes, sleeps as sleepRepo, useLiveQuery, type SleepRow } from '@/db';
import { events as eventRepo } from '@/db/repositories';
import { addDays, formatTimeValue, parseTime, startOfDay } from '@/features/calendar/dates';
import { useCalendarAccess } from '@/features/calendar/useCalendarAccess';
import { DayPicker } from '@/features/shared/DayPicker';
import { relativeDay } from '@/features/shared/days';
import { formatTime, useI18n, type TranslationKey } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  FloatingButton,
  Header,
  Input,
  ListItem,
  ProgressBar,
  Screen,
  Sheet,
  Text,
} from '@/ui';

import { RemoveButton } from '../money/parts';

const BEDTIMES = ['21:30', '22:00', '22:30', '23:00', '23:30', '00:00'] as const;
const WAKE_TIMES = ['05:30', '06:00', '06:30', '07:00', '07:30', '08:00'] as const;
const QUALITIES = [1, 2, 3] as const;
/** Acht Stunden gelten als voll; die Stunde davor ist zum Runterkommen. */
export const TARGET_MINUTES = 8 * 60;
const WIND_DOWN_MINUTES = 60;
const AVERAGE_NIGHTS = 7;

function durationText(
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
  minutes: number,
): string {
  return t('sleep.duration', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
}

/** Schlaf: wann ins Bett, wann raus — und ein Tipp aus dem Kalender. */
export function SleepView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const { access } = useCalendarAccess();

  const [adding, setAdding] = useState(false);

  const list = useLiveQuery(() => sleepRepo.list(account.id), [account.id]);
  const tomorrow = startOfDay(addDays(new Date(), 1));
  const firstTomorrow = useLiveQuery(
    () =>
      eventRepo.listBetween(access, tomorrow.toISOString(), addDays(tomorrow, 1).toISOString(), [
        'personal',
      ]),
    [access.accountId],
  );
  const rows = list.data ?? [];
  const last = rows[0];
  const recent = rows.slice(0, AVERAGE_NIGHTS);
  const average =
    recent.length > 0
      ? Math.round(recent.reduce((sum, row) => sum + sleepMinutes(row), 0) / recent.length)
      : null;
  const nextEvent = (firstTomorrow.data ?? []).find((event) => !event.allDay);
  const bedtimeTip = nextEvent
    ? formatTimeValue(
        new Date(
          new Date(nextEvent.startsAt).getTime() - (TARGET_MINUTES + WIND_DOWN_MINUTES) * 60_000,
        ),
      )
    : null;

  const qualityLabel = (quality: number) => t(`sleep.quality.${quality}` as TranslationKey);

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={
            average !== null
              ? t('sleep.average', { hours: Math.floor(average / 60), minutes: average % 60 })
              : t('sleep.empty.title')
          }
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      }
    >
      {last ? (
        <Card title={t('sleep.lastNight')}>
          <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
            <Text variant="display">{durationText(t, sleepMinutes(last))}</Text>
            <ProgressBar share={sleepMinutes(last) / TARGET_MINUTES} />
            <Text variant="caption" tone="muted">
              {`${last.bedtime} – ${last.wakeTime} · ${qualityLabel(last.quality)}`}
            </Text>
          </View>
        </Card>
      ) : (
        <EmptyState icon="sleep" title={t('sleep.empty.title')} body={t('sleep.empty.body')} />
      )}

      {/* Der Tipp: vom ersten Termin morgen zurueckgerechnet. */}
      <Card>
        <Text variant="label" tone={bedtimeTip ? 'accent' : 'muted'}>
          {bedtimeTip && nextEvent
            ? t('sleep.tip', {
                time: formatTime(language, nextEvent.startsAt),
                bedtime: bedtimeTip,
              })
            : t('sleep.tipFree')}
        </Text>
      </Card>

      {rows.length > 1 ? (
        <Card>
          {rows.slice(1).map((row, index) => (
            <View key={row.id}>
              {index > 0 ? <Divider /> : null}
              <ListItem
                title={durationText(t, sleepMinutes(row))}
                subtitle={`${relativeDay(t, language, row.day)} · ${row.bedtime} – ${row.wakeTime} · ${qualityLabel(row.quality)}`}
                right={<RemoveButton onPress={() => void sleepRepo.remove(row.id)} />}
              />
            </View>
          ))}
        </Card>
      ) : null}

      <FloatingButton label={t('sleep.add')} onPress={() => setAdding(true)} />

      <SleepAdd
        visible={adding}
        accountId={account.id}
        last={last ?? null}
        onClose={() => setAdding(false)}
      />
    </Screen>
  );
}

function SleepAdd({
  visible,
  accountId,
  last,
  onClose,
}: {
  visible: boolean;
  accountId: string;
  last: SleepRow | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();

  const [bedtime, setBedtime] = useState<string>(last?.bedtime ?? BEDTIMES[3]);
  const [wakeTime, setWakeTime] = useState<string>(last?.wakeTime ?? WAKE_TIMES[2]);
  const [quality, setQuality] = useState<number>(2);
  const [day, setDay] = useState<string | null>(dayKey());
  const [error, setError] = useState<'bed' | 'wake' | null>(null);

  async function save() {
    const bed = parseTime(bedtime);
    const wake = parseTime(wakeTime);
    if (!bed) {
      setError('bed');
      return;
    }
    if (!wake) {
      setError('wake');
      return;
    }
    if (!day) return;
    await sleepRepo.save({
      accountId,
      day,
      bedtime: `${String(bed.hour).padStart(2, '0')}:${String(bed.minute).padStart(2, '0')}`,
      wakeTime: `${String(wake.hour).padStart(2, '0')}:${String(wake.minute).padStart(2, '0')}`,
      quality,
    });
    setError(null);
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={t('sleep.add')}>
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" tone="muted">
            {t('sleep.bedtime')}
          </Text>
          <View style={[styles.chips, { gap: theme.spacing.sm }]}>
            {BEDTIMES.map((time) => (
              <Chip
                key={time}
                label={time}
                selected={bedtime === time}
                onPress={() => setBedtime(time)}
              />
            ))}
          </View>
          <Input
            value={bedtime}
            onChangeText={setBedtime}
            keyboardType="numbers-and-punctuation"
            accessibilityLabel={t('sleep.bedtime')}
            {...(error === 'bed' ? { error: t('sleep.timeError') } : {})}
          />
        </View>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" tone="muted">
            {t('sleep.wake')}
          </Text>
          <View style={[styles.chips, { gap: theme.spacing.sm }]}>
            {WAKE_TIMES.map((time) => (
              <Chip
                key={time}
                label={time}
                selected={wakeTime === time}
                onPress={() => setWakeTime(time)}
              />
            ))}
          </View>
          <Input
            value={wakeTime}
            onChangeText={setWakeTime}
            keyboardType="numbers-and-punctuation"
            accessibilityLabel={t('sleep.wake')}
            {...(error === 'wake' ? { error: t('sleep.timeError') } : {})}
          />
        </View>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" tone="muted">
            {t('sleep.quality')}
          </Text>
          <View style={[styles.chips, { gap: theme.spacing.sm }]}>
            {QUALITIES.map((value) => (
              <Chip
                key={value}
                label={t(`sleep.quality.${value}` as TranslationKey)}
                selected={quality === value}
                onPress={() => setQuality(value)}
              />
            ))}
          </View>
        </View>
        <DayPicker value={day} onChange={setDay} allowNone={false} />
        <Button label={t('common.done')} icon="check" onPress={save} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
