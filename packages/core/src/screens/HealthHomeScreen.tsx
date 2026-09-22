import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  dayKey,
  drinks as drinkRepo,
  meals as mealRepo,
  useLiveQuery,
  vitals as vitalRepo,
  workouts as workoutRepo,
} from '@/db';
import { MEAL_SLOTS, fit, type MealSlot } from '@/db/fit';
import { weekDays } from '@/features/calendar/dates';
import { AddMealSheet, slotForNow } from '@/features/fit/AddMealSheet';
import { DailyQuote } from '@/features/fit/DailyQuote';
import { useFit } from '@/features/fit/useFit';
import { useZurichToday } from '@/features/fit/useZurichToday';
import { shiftDay } from '@/features/fit/zurichDay';
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
import { moduleName } from '@/mocks/moduleText';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  BigFigure,
  FloatingButton,
  GlassTiles,
  Header,
  Legend,
  Panel,
  PanelAction,
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
  // Eine Tagesgrenze fuer alles hier: Mitternacht in Zuerich, wie im Dienst.
  const today = useZurichToday();

  const mealList = useLiveQuery(() => mealRepo.listDay(account.id, today), [account.id, today]);
  const drunk = useLiveQuery(() => drinkRepo.ofDay(account.id, today), [account.id, today]);
  const workoutList = useLiveQuery(() => workoutRepo.listRecent(account.id, 60), [account.id]);
  const weightList = useLiveQuery(() => vitalRepo.list(account.id, 'weight', 30), [account.id]);
  const fitSummary = useFit(() => fit.day(today), [account.id, today]);
  // Mit Better Fit steht das Gewicht nur dort — „Werte → Gewicht“ schreibt auch dorthin.
  const fitWeights = useFit(() => fit.weights(), [account.id], ['training', 'profile']);
  // Eintragen geht direkt von hier: das Plus fragt nach der Mahlzeit, die jetzt dran ist zuerst.
  const [adding, setAdding] = useState<MealSlot | null>(null);

  const whole = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });
  const oneDecimal = new Intl.NumberFormat(`${language}-CH`, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const signed = new Intl.NumberFormat(`${language}-CH`, {
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  });
  const nameOf = (id: string) => moduleName(t, id);

  // Gegessen — erst was schon drin ist, dann was noch offen ist, wie im Entwurf.
  // Better Fit zuerst: das Tagebuch mit persoenlichem Ziel. Ohne Token oder
  // ohne Eintraege dort bleibt es beim einfachen Menueplan von frueher.
  const fitDay = fitSummary.data;
  const useFitDay = fitDay !== undefined && (fitDay.hasProfile || fitDay.meals.length > 0);
  const meals = useFitDay
    ? fitDay.meals.map((meal) => ({ slot: meal.slot, kcal: meal.total.kcal }))
    : (mealList.data ?? []);
  const target = useFitDay && fitDay.target ? fitDay.target.kcal : DAILY_TARGET;
  // Noch nicht eingerichtet: das kommt zuerst, alles andere haengt daran.
  const needsSetup = fitDay !== undefined && !fitDay.hasProfile;
  // Das Trinkziel kommt aus Better Fit (Gewicht, Trainingstag), sonst das feste von frueher.
  const waterTargetDl = fitDay?.hasProfile ? fitDay.waterTargetMl / 100 : TARGET_DL;
  const kcal = meals.reduce((sum, row) => sum + row.kcal, 0);
  const bySlot = SLOTS.map((slot) => ({
    slot,
    kcal: meals.filter((row) => row.slot === slot).reduce((sum, row) => sum + row.kcal, 0),
  }));
  const ordered = [
    ...bySlot.filter((entry) => entry.kcal > 0),
    ...bySlot.filter((entry) => entry.kcal === 0),
  ];
  const slotLabel = (slot: string) => t(`meals.slot.${slot}` as TranslationKey);
  const mealSegments: Segment[] = [
    ...ordered.map((entry) => ({ key: entry.slot, value: entry.kcal, kind: 'ink' as const })),
    { key: 'rest', value: Math.max(0, target - kcal), kind: 'rest' },
  ];
  const mealLegend: LegendItem[] = ordered.map((entry) =>
    entry.kcal > 0
      ? {
          key: entry.slot,
          label: t('health.slotKcal', {
            slot: slotLabel(entry.slot),
            kcal: whole.format(entry.kcal),
          }),
          kind: 'ink',
        }
      : {
          key: entry.slot,
          label: t('health.slotOpen', { slot: slotLabel(entry.slot) }),
          kind: 'rest',
        },
  );

  // Getrunken — das Tagesziel in zehn Glaeser geteilt.
  const dl = drunk.data ?? 0;
  const drinkText = t('health.drinkOf', {
    amount: oneDecimal.format(dl / 10),
    target: oneDecimal.format(waterTargetDl / 10),
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

  // Gewicht — der Verlauf der letzten 30 Tage, aelteste zuerst. Mit Profil aus Better Fit.
  const fitEntries = fitDay?.hasProfile ? (fitWeights.data?.entries ?? null) : null;
  const weights = fitEntries
    ? [...fitEntries]
        .filter((entry) => entry.day >= shiftDay(today, -30))
        .sort((a, b) => a.day.localeCompare(b.day))
        .map((entry) => ({ id: entry.id, day: entry.day, value: entry.weightKg }))
    : [...(weightList.data ?? [])].reverse();
  const firstWeight = weights[0];
  const lastWeight = weights[weights.length - 1];
  const delta = firstWeight && lastWeight ? lastWeight.value - firstWeight.value : 0;

  const now = slotForNow();
  const addMenu = [now, ...MEAL_SLOTS.filter((slot) => slot !== now)].map((slot) => ({
    key: slot,
    label: t(`meals.slot.${slot}` as TranslationKey),
    icon: (slot === 'breakfast'
      ? 'sun'
      : slot === 'lunch'
        ? 'partlySunny'
        : slot === 'dinner'
          ? 'sleep'
          : 'star') as IconName,
    onPress: () => setAdding(slot),
  }));

  return (
    <>
      <Screen
        gap={theme.spacing.sm}
        contentStyle={{ paddingTop: theme.spacing.xs }}
        header={
          <Header
            crumb={{ label: t('area.health'), hue: 'health' }}
            title={formatWeekdayLong(language, new Date())}
          />
        }
      >
        <DailyQuote day={today} />
        {needsSetup ? (
          <Panel
            label={t('fit.quick.welcomeTitle')}
            more={t('fit.quick.welcomeAction')}
            onMore={() => router.push('/run/nutrition')}
          >
            <Text variant="body" tone="muted" style={{ marginTop: theme.spacing.sm }}>
              {t('fit.quick.welcomeBody')}
            </Text>
            <View style={{ marginTop: theme.spacing.md }}>
              <PanelAction
                icon="sparkles"
                label={t('fit.quick.welcomeAction')}
                primary
                onPress={() => router.push('/run/nutrition')}
              />
            </View>
          </Panel>
        ) : null}

        <Panel
          label={t('health.eaten')}
          more={nameOf('nutrition')}
          onMore={() => router.push('/run/nutrition')}
        >
          <BigFigure
            value={whole.format(kcal)}
            unit={t('health.ofKcal', { target: whole.format(target) })}
          />
          <SegmentBar segments={mealSegments} />
          <Legend items={mealLegend} />
        </Panel>

        <Panel label={t('health.drunk')} more={drinkText} onMore={() => router.push('/run/water')}>
          <GlassTiles share={waterTargetDl > 0 ? dl / waterTargetDl : 0} label={drinkText} />
          <View style={[styles.row, { gap: theme.spacing.sm, marginTop: theme.spacing.md }]}>
            {PORTIONS.map((amount) => (
              <PanelAction
                key={amount}
                icon="plus"
                label={t('water.add', { amount: oneDecimal.format(amount) })}
                primary
                onPress={() => void drinkRepo.add(account.id, today, amount)}
              />
            ))}
            <PanelAction
              label={t('health.undo')}
              disabled={dl === 0}
              onPress={() => void drinkRepo.undoLast(account.id, today)}
            />
          </View>
        </Panel>

        <Panel
          label={t('health.training')}
          more={
            fitDay?.workout
              ? t('fit.link.workout', { title: fitDay.workout.title })
              : t('health.weekMinutes', { minutes: weekMinutes })
          }
          onMore={() => router.push('/run/trainingplan')}
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
                        ? theme.colors.accentMark
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
              <View
                style={[styles.baseline, { gap: theme.spacing.md, marginTop: theme.spacing.sm }]}
              >
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
      {fitSummary.data?.hasProfile && !adding ? (
        <FloatingButton
          label={t('fit.add.title')}
          text={t('fit.add.short')}
          menu={addMenu}
          aboveTabBar
        />
      ) : null}
      {adding ? (
        <AddMealSheet initialSlot={adding} day={today} onClose={() => setAdding(null)} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  baseline: { flexDirection: 'row', alignItems: 'baseline' },
  grow: { flex: 1, minWidth: 0 },
  week: { flexDirection: 'row', alignItems: 'flex-end' },
  day: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
});
