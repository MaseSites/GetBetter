import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  dayKey,
  meds as medRepo,
  moods as moodRepo,
  sleepMinutes,
  sleeps as sleepRepo,
  useLiveQuery,
} from '@/db';
import { TARGET_MINUTES } from '@/features/gym/SleepView';
import { useI18n, type TranslationKey } from '@/i18n';
import { MODULES } from '@/mocks/modules';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Divider, Panel, Text, TickRow, Track } from '@/ui';

/** So viele offene Einnahmen passen in den Block, ohne dass er zur Liste wird. */
const MED_ROWS = 4;

const nameOf = (id: string) => MODULES.find((module) => module.id === id)?.name ?? id;

/**
 * Was BetterGym auf der Startseite ausser den vier Bloecken des Entwurfs weiss:
 * die letzte Nacht, die offenen Einnahmen (antippen heisst genommen) und die
 * Laune von heute — im selben Blockformat darunter.
 */
export function SleepPanel() {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();

  const sleepList = useLiveQuery(() => sleepRepo.list(account.id, 1), [account.id]);
  const night = sleepList.data?.[0];
  const minutes = night ? sleepMinutes(night) : 0;

  return (
    <Panel
      label={nameOf('sleep')}
      more={t('sleep.lastNight')}
      onMore={() => router.push('/run/sleep')}
    >
      {night ? (
        <>
          <View style={[styles.baseline, { gap: theme.spacing.md, marginTop: theme.spacing.sm }]}>
            <Text variant="display" style={{ fontSize: theme.fontSize.xl, lineHeight: theme.lineHeight.xl }}>
              {t('sleep.duration', { hours: Math.floor(minutes / 60), minutes: minutes % 60 })}
            </Text>
            <View style={styles.grow} />
            <Text
              variant="caption"
              tone="faint"
              style={{ fontSize: theme.fontSize.caption, lineHeight: theme.lineHeight.caption }}
            >
              {t('health.sleepSpan', { from: night.bedtime, to: night.wakeTime })}
            </Text>
          </View>
          <Track share={minutes / TARGET_MINUTES} />
        </>
      ) : (
        <Text variant="label" tone="faint" style={{ marginTop: theme.spacing.sm }}>
          {t('sleep.empty.title')}
        </Text>
      )}
    </Panel>
  );
}

export function MedsPanel() {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const today = dayKey();

  const medList = useLiveQuery(() => medRepo.list(account.id), [account.id]);
  const takeList = useLiveQuery(() => medRepo.takes(account.id, today), [account.id, today]);
  const medRows = medList.data ?? [];
  const takes = takeList.data ?? [];

  const total = medRows.reduce((sum, med) => sum + med.slots.length, 0);
  const taken = takes.length;
  // Je Medikament die naechste offene Zeit — ein Tipp heisst genommen.
  const open = medRows.flatMap((med) => {
    const slot = med.slots.find(
      (entry) => !takes.some((take) => take.medId === med.id && take.slot === entry),
    );
    return slot ? [{ med, slot }] : [];
  });

  return (
    <Panel
      label={nameOf('meds')}
      more={
        medRows.length === 0
          ? t('health.write')
          : taken >= total
            ? t('meds.allTaken')
            : t('meds.today', { taken, total })
      }
      onMore={() => router.push('/run/meds')}
    >
      {medRows.length === 0 ? (
        <Text variant="label" tone="faint" style={{ marginTop: theme.spacing.sm }}>
          {t('meds.empty.title')}
        </Text>
      ) : open.length === 0 ? (
        <Text variant="label" tone="faint" style={{ marginTop: theme.spacing.sm }}>
          {t('meds.allTaken')}
        </Text>
      ) : (
        <View style={{ marginTop: theme.spacing.xs }}>
          {open.slice(0, MED_ROWS).map(({ med, slot }, index) => (
            <View key={med.id}>
              {index > 0 ? <Divider /> : null}
              <TickRow
                flush
                label={med.name}
                meta={t(`meds.slot.${slot}` as TranslationKey)}
                checked={false}
                onToggle={() => void medRepo.toggle(med.id, account.id, today, slot)}
              />
            </View>
          ))}
        </View>
      )}
    </Panel>
  );
}

export function MindPanel() {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const today = dayKey();

  const moodList = useLiveQuery(() => moodRepo.list(account.id, 1), [account.id]);
  const mood = moodList.data?.[0];
  const isToday = mood?.day === today;

  return (
    <Panel
      label={nameOf('mind')}
      more={isToday ? t('health.today') : t('health.write')}
      onMore={() => router.push('/run/mind')}
    >
      {isToday && mood ? (
        <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.sm }}>
          <Text variant="display" style={{ fontSize: theme.fontSize.xl, lineHeight: theme.lineHeight.xl }}>
            {t(`mind.mood.${mood.mood}` as TranslationKey)}
          </Text>
          {mood.note ? (
            <Text variant="body" tone="muted" numberOfLines={2}>
              {mood.note}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text variant="label" tone="faint" style={{ marginTop: theme.spacing.sm }}>
          {t('mind.today')}
        </Text>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  baseline: { flexDirection: 'row', alignItems: 'baseline' },
  grow: { flex: 1, minWidth: 0 },
});
