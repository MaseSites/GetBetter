import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  dayKey,
  drinks as drinkRepo,
  meals as mealRepo,
  useLiveQuery,
  vitals as vitalRepo,
  workouts as workoutRepo,
} from '@/db';
import { weekDays } from '@/features/calendar/dates';
import { MedsPanel, MindPanel, SleepPanel } from '@/features/gym/HealthPanels';
import { DAILY_TARGET, SLOTS } from '@/features/gym/MealsView';
import { PORTIONS, TARGET_DL } from '@/features/gym/WaterView';
import { parseDay } from '@/features/shared/days';
import {
  formatDayMonth,
  formatWeekday,
  formatWeekdayLong,
  useI18n,
  type TranslationKey,
} from '@/i18n';
import { MODULES } from '@/mocks/modules';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  BigFigure,
  Header,
  Icon,
  Legend,
  Panel,
  Screen,
  SegmentBar,
  Text,
  Trend,
  type IconName,
  type LegendItem,
  type Segment,
} from '@/ui';

const WEEK_BAR = 56;
const MIN_BAR = 4;
/** Zehn Glaeser wie im Entwurf — zusammen das Tagesziel. */
const GLASSES = 10;
const GLASS_HEIGHT = 38;
const GLASS_BORDER = 1.5;
const ACTION_HEIGHT = 44;

/**
 * Die Startseite von BetterGym, wie im Entwurf «Gesundheit»: der Tag als
 * Titel, darunter die Bloecke — gegessen, getrunken, trainiert, gewogen —,
 * danach Schlaf, Medikamente und Kopf frei im selben Format. Jeder Nebenwert
 * fuehrt in die volle Ansicht; trinken und Einnahmen abhaken geht direkt hier.
 */
export function HealthHomeScreen() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const today = dayKey();

  const mealList = useLiveQuery(() => mealRepo.listDay(account.id, today), [account.id, today]);
  const drunk = useLiveQuery(() => drinkRepo.ofDay(account.id, today), [account.id, today]);
  const workoutList = useLiveQuery(() => workoutRepo.listRecent(account.id, 60), [account.id]);
  const weightList = useLiveQuery(() => vitalRepo.list(account.id, 'weight', 30), [account.id]);

  const whole = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });
  const oneDecimal = new Intl.NumberFormat(`${language}-CH`, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const signed = new Intl.NumberFormat(`${language}-CH`, {
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  });
  const nameOf = (id: string) => MODULES.find((module) => module.id === id)?.name ?? id;

  // Gegessen — erst was schon drin ist, dann was noch offen ist, wie im Entwurf.
  const meals = mealList.data ?? [];
  const kcal = meals.reduce((sum, row) => sum + row.kcal, 0);
  const bySlot = SLOTS.map((slot) => ({
    slot,
    kcal: meals.filter((row) => row.slot === slot).reduce((sum, row) => sum + row.kcal, 0),
  }));
  const ordered = [...bySlot.filter((entry) => entry.kcal > 0), ...bySlot.filter((entry) => entry.kcal === 0)];
  const slotLabel = (slot: string) => t(`meals.slot.${slot}` as TranslationKey);
  const mealSegments: Segment[] = [
    ...ordered.map((entry) => ({ key: entry.slot, value: entry.kcal, kind: 'ink' as const })),
    { key: 'rest', value: Math.max(0, DAILY_TARGET - kcal), kind: 'rest' },
  ];
  const mealLegend: LegendItem[] = ordered.map((entry) =>
    entry.kcal > 0
      ? {
          key: entry.slot,
          label: t('health.slotKcal', { slot: slotLabel(entry.slot), kcal: whole.format(entry.kcal) }),
          kind: 'ink',
        }
      : { key: entry.slot, label: t('health.slotOpen', { slot: slotLabel(entry.slot) }), kind: 'rest' },
  );

  // Getrunken — das Tagesziel in zehn Glaeser geteilt.
  const dl = drunk.data ?? 0;
  const glass = TARGET_DL / GLASSES;
  const filled = Math.min(GLASSES, Math.floor(dl / glass));
  const drinkText = t('health.drinkOf', {
    amount: oneDecimal.format(dl / 10),
    target: oneDecimal.format(TARGET_DL / 10),
  });

  // Training — die Woche als sieben Saeulen, heute im Signal.
  const minutesByDay = new Map<string, number>();
  for (const row of workoutList.data ?? []) {
    minutesByDay.set(row.day, (minutesByDay.get(row.day) ?? 0) + row.minutes);
  }
  const week = weekDays(new Date()).map((date) => {
    const key = dayKey(date);
    return {
      key,
      label: formatWeekday(language, date.toISOString()).replace('.', ''),
      minutes: minutesByDay.get(key) ?? 0,
    };
  });
  const weekMinutes = week.reduce((sum, day) => sum + day.minutes, 0);
  const peak = Math.max(60, ...week.map((day) => day.minutes));

  // Gewicht — der Verlauf der letzten Messungen, aelteste zuerst.
  const weights = [...(weightList.data ?? [])].reverse();
  const firstWeight = weights[0];
  const lastWeight = weights[weights.length - 1];
  const delta = firstWeight && lastWeight ? lastWeight.value - firstWeight.value : 0;

  return (
    <Screen
      gap={theme.spacing.sm}
      contentStyle={{ paddingTop: theme.spacing.xs }}
      header={
        <Header
          crumb={{ label: t('area.health') }}
          title={formatWeekdayLong(language, new Date())}
        />
      }
    >
      <Panel label={t('health.eaten')} more={nameOf('meals')} onMore={() => router.push('/run/meals')}>
        <BigFigure
          value={whole.format(kcal)}
          unit={t('health.ofKcal', { target: whole.format(DAILY_TARGET) })}
        />
        <SegmentBar segments={mealSegments} />
        <Legend items={mealLegend} />
      </Panel>

      <Panel label={t('health.drunk')} more={drinkText} onMore={() => router.push('/run/water')}>
        <View
          accessible
          accessibilityLabel={drinkText}
          style={[styles.row, { gap: theme.spacing.xs, marginTop: theme.spacing.md }]}
        >
          {Array.from({ length: GLASSES }, (_, index) => (
            <View
              key={`glass-${index}`}
              style={[
                styles.glass,
                {
                  borderRadius: theme.radii.xs,
                  borderColor: index < filled ? theme.colors.accentStrong : theme.colors.borderStrong,
                  backgroundColor: index < filled ? theme.colors.accent : 'transparent',
                },
              ]}
            />
          ))}
        </View>
        <View style={[styles.row, { gap: theme.spacing.sm, marginTop: theme.spacing.md }]}>
          {PORTIONS.map((amount) => (
            <Action
              key={amount}
              icon="plus"
              label={t('water.add', { amount })}
              primary
              onPress={() => void drinkRepo.add(account.id, today, amount)}
            />
          ))}
          <Action
            label={t('health.undo')}
            disabled={dl === 0}
            onPress={() => void drinkRepo.undoLast(account.id, today)}
          />
        </View>
      </Panel>

      <Panel
        label={t('health.training')}
        more={t('health.weekMinutes', { minutes: weekMinutes })}
        onMore={() => router.push('/run/fitness')}
      >
        <View style={[styles.week, { gap: theme.spacing.sm, marginTop: theme.spacing.md }]}>
          {week.map((day) => {
            const isToday = day.key === today;
            const height =
              day.minutes > 0
                ? Math.max(MIN_BAR, Math.round((day.minutes / peak) * WEEK_BAR))
                : MIN_BAR;
            return (
              <View
                key={day.key}
                accessible
                accessibilityLabel={`${day.label}: ${t('gym.minutes', { minutes: day.minutes })}`}
                style={[styles.day, { gap: theme.spacing.sm }]}
              >
                <View
                  style={{
                    width: '100%',
                    height,
                    borderRadius: theme.radii.xs,
                    backgroundColor: isToday
                      ? theme.colors.accent
                      : day.minutes === 0
                        ? theme.colors.border
                        : theme.colors.text,
                  }}
                />
                <Text
                  variant="caption"
                  tone={isToday ? 'default' : 'faint'}
                  style={{
                    fontSize: theme.fontSize.micro,
                    lineHeight: theme.lineHeight.micro,
                    fontWeight: theme.fontWeight.semibold,
                  }}
                >
                  {day.label}
                </Text>
              </View>
            );
          })}
        </View>
      </Panel>

      <Panel
        label={t('vitals.kind.weight')}
        more={t('health.days30')}
        onMore={() => router.push('/run/vitals')}
      >
        {firstWeight && lastWeight ? (
          <>
            <Trend values={weights.map((row) => row.value)} />
            <View style={[styles.baseline, { gap: theme.spacing.md, marginTop: theme.spacing.sm }]}>
              <Text
                variant="display"
                style={{ fontSize: theme.fontSize.xl, lineHeight: theme.lineHeight.xl }}
              >
                {oneDecimal.format(lastWeight.value)}
              </Text>
              {weights.length > 1 ? (
                <Text
                  variant="caption"
                  tone={delta < 0 ? 'accent' : 'muted'}
                  style={{
                    fontSize: theme.fontSize.caption,
                    lineHeight: theme.lineHeight.caption,
                    fontWeight: theme.fontWeight.semibold,
                  }}
                >
                  {t('health.deltaKg', { delta: signed.format(delta) })}
                </Text>
              ) : null}
              <View style={styles.grow} />
              <Text
                variant="caption"
                tone="faint"
                numberOfLines={1}
                style={{ fontSize: theme.fontSize.caption, lineHeight: theme.lineHeight.caption }}
              >
                {t('health.since', { date: formatDayMonth(language, parseDay(firstWeight.day)) })}
              </Text>
            </View>
          </>
        ) : (
          <Text variant="label" tone="faint" style={{ marginTop: theme.spacing.sm }}>
            {t('vitals.empty.title')}
          </Text>
        )}
      </Panel>

      <SleepPanel />
      <MedsPanel />
      <MindPanel />
    </Screen>
  );
}

/** Ein Knopf im Block: Tinte fuer das, was man meistens tut, sonst Papier. */
function Action({
  label,
  icon,
  primary = false,
  disabled = false,
  onPress,
}: {
  label: string;
  icon?: IconName;
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const color = primary ? theme.colors.onInverse : theme.colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          gap: theme.spacing.xs,
          borderRadius: theme.radii.sm,
          backgroundColor: primary ? theme.colors.inverse : theme.colors.surfaceMuted,
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale: pressed ? theme.motion.pressScale.button : 1 }],
        },
      ]}
    >
      {icon ? <Icon name={icon} size={16} color={color} /> : null}
      <Text
        variant="label"
        style={{
          color,
          fontSize: theme.fontSize.lede,
          lineHeight: theme.lineHeight.lede,
          fontWeight: theme.fontWeight.semibold,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  baseline: { flexDirection: 'row', alignItems: 'baseline' },
  grow: { flex: 1, minWidth: 0 },
  glass: { flex: 1, height: GLASS_HEIGHT, borderWidth: GLASS_BORDER },
  week: { flexDirection: 'row', alignItems: 'flex-end' },
  day: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  action: {
    flex: 1,
    minHeight: ACTION_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
