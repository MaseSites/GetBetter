import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { fit } from '@/db/fit';
import { formatShortDate, formatWeekday, useI18n } from '@/i18n';
import { moduleName } from '@/mocks/moduleText';
import type { ModuleDefinition } from '@/mocks/types';
import { useTheme } from '@/theme';
import { Panel, Screen, Text, useUndo } from '@/ui';

import { AreaHeader } from './KitchenKit';
import { FitState } from './FitGate';
import { trainingError } from './ExerciseBlock';
import { gymName } from './GymPicker';
import { MissedWorkouts } from './MissedWorkouts';
import { TrainingHistory } from './TrainingHistory';
import { InkPill } from './TrainingParts';
import { TrainingPlanSetup } from './TrainingPlanSetup';
import { RhythmPanel } from './TrainingRhythm';
import { TodayPanel, UpcomingPanel, WeekStrip } from './TrainingWeek';
import { TRAINING } from './trainingType';
import { useFit } from './useFit';
import { useZurichToday } from './useZurichToday';
import { weekdayLabel } from './WorkoutPlanPreview';
import { WorkoutSheet } from './WorkoutSheet';

/**
 * Der Trainingsplan als Woche: oben die sieben Tage, dann heute — gross, mit
 * einem Tipp zum Starten und dem, was es fuers Essen heisst —, der Rhythmus
 * der letzten acht Wochen, was verpasst ist, was als Naechstes kommt und der
 * Verlauf. Ein neuer Plan entsteht in `TrainingPlanSetup`.
 */
export function TrainingPlanView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const undo = useUndo();
  const today = useZurichToday();
  const data = useFit(() => fit.workouts(), [today], ['training']);
  const profile = useFit(() => fit.profile(), []);
  const day = useFit(() => fit.day(today), [today]);
  const gyms = useFit(() => fit.gyms(), []);
  const [setup, setSetup] = useState(false);
  const [open, setOpen] = useState<{ id: string; readOnly: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // Hoehe des Bildschirms und des Kopfs: Verpasst, Verlauf und „Plan ändern“ beginnen unter dem ersten Bild.
  const [frame, setFrame] = useState({ total: 0, header: 0 });
  const dayText = (value: string) =>
    `${formatWeekday(language, `${value}T12:00:00`)} ${formatShortDate(language, `${value}T12:00:00`)}`;

  /** „Heute machen“ / „Heute nachholen“: ein Tipp legt das Training auf heute. */
  async function moveToToday(id: string, title: string) {
    setBusy(true);
    const result = await fit.moveNow(id, today);
    setBusy(false);
    if (!result.ok) return setProblem(trainingError(t, result.error));
    setProblem(null);
    undo.show({ message: t('fit6.missed.moved', { title }) });
  }

  /** Auslassen ohne Rueckfrage — mit Rueckgaengig. */
  async function skip(id: string, title: string) {
    const result = await fit.setWorkoutStatus(id, 'skip');
    if (!result.ok) return setProblem(trainingError(t, result.error));
    undo.show({
      message: t('fit6.missed.skipped', { title }),
      onUndo: () => void fit.setWorkoutStatus(id, 'reopen'),
    });
  }

  const plan = data.data?.plan ?? null;
  const workouts = data.data?.workouts ?? [];
  const missed = data.data?.missed ?? [];
  const upcoming = workouts.filter(
    (workout) => workout.day >= today && workout.status !== 'skipped',
  );
  const todays = upcoming.find((workout) => workout.day === today) ?? null;
  const nextOne =
    upcoming.find((workout) => workout.day > today && workout.status === 'planned') ?? null;
  const whole = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });
  const planGym = plan?.gym ? gyms.data?.gyms.find((entry) => entry.id === plan.gym) : null;
  const proteinLeft = day.data?.remaining
    ? Math.max(0, Math.round(day.data.remaining.proteinG))
    : null;
  const bonus = day.data?.trainingBonusKcal ?? 0;
  const foodText =
    todays && bonus
      ? proteinLeft !== null && proteinLeft > 0
        ? t('fit.training.foodLink', {
            kcal: whole.format(bonus),
            protein: whole.format(proteinLeft),
          })
        : t('fit.training.foodLinkShort', { kcal: whole.format(bonus) })
      : null;
  const shownId = (todays ?? nextOne)?.id;
  const later = upcoming.filter((workout) => workout.day > today && workout.id !== shownId);
  const editing = setup || !plan;

  // Ein Training ist ein eigener Bildschirm ueber dem Plan, mit Zurueck.
  if (open) {
    return (
      <WorkoutSheet
        key={open.id}
        workoutId={open.id}
        readOnly={open.readOnly}
        today={today}
        onClose={() => {
          setOpen(null);
          data.reload();
          day.reload();
        }}
      />
    );
  }

  const measure = (key: 'total' | 'header') => (event: LayoutChangeEvent) => {
    const height = Math.round(event.nativeEvent.layout.height);
    setFrame((value) => (value[key] === height ? value : { ...value, [key]: height }));
  };
  const fold = Math.max(0, frame.total - frame.header - TRAINING.headerGap);

  return (
    <View style={styles.fill} onLayout={measure('total')}>
      <Screen
        gap={theme.spacing.sm}
        contentStyle={{ paddingTop: TRAINING.headerGap }}
        header={
          <View onLayout={measure('header')}>
            <AreaHeader
              crumb={t('fit6.v.crumb')}
              title={plan && !setup ? t('fit6.v.week.title') : moduleName(t, module.id)}
              subtitle={
                plan
                  ? [plan.name, planGym ? gymName(t, planGym) : null].filter(Boolean).join(' · ')
                  : t('fit.training.noPlan')
              }
              onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            />
          </View>
        }
      >
        <FitState loading={data.loading} error={data.error} onRetry={data.reload}>
          {editing && !setup ? (
            <Panel label={t('fit.training.startTitle')}>
              <Text variant="body" tone="muted" style={{ marginTop: theme.spacing.sm }}>
                {t('fit.training.startBody')}
              </Text>
              <View style={{ flexDirection: 'row', marginTop: theme.spacing.lg }}>
                <InkPill
                  label={t('fit.training.newPlan')}
                  icon="fitness"
                  tall
                  onPress={() => setSetup(true)}
                />
              </View>
            </Panel>
          ) : null}
          {setup ? (
            <TrainingPlanSetup
              plan={plan}
              profileGoal={profile.data?.profile?.goal}
              daysPerWeek={profile.data?.profile?.trainingDaysPerWeek ?? 3}
              onSaved={() => {
                data.reload();
                day.reload();
                setSetup(false);
              }}
              onCancel={() => setSetup(false)}
            />
          ) : null}
          {!editing && plan ? (
            <View style={{ gap: theme.spacing.sm }}>
              <View style={{ gap: theme.spacing.sm, minHeight: fold > 0 ? fold : undefined }}>
                <WeekStrip
                  workouts={workouts}
                  today={today}
                  onOpen={(id) => setOpen({ id, readOnly: false })}
                />
                <TodayPanel
                  todays={todays}
                  nextOne={nextOne}
                  busy={busy}
                  foodText={foodText}
                  onStart={(id) => setOpen({ id, readOnly: false })}
                  onDoToday={(row) => void moveToToday(row.id, row.title)}
                  onFood={() => router.push('/run/nutrition')}
                />
                {problem ? (
                  <View accessibilityLiveRegion="polite">
                    <Text variant="label" tone="danger">
                      {problem}
                    </Text>
                  </View>
                ) : null}
                <RhythmPanel today={today} />
                <UpcomingPanel
                  rows={later}
                  today={today}
                  onOpen={(id) => setOpen({ id, readOnly: false })}
                />
              </View>
              <MissedWorkouts
                missed={missed}
                busy={busy}
                dayText={dayText}
                onCatchUp={(row) => void moveToToday(row.id, row.title)}
                onSkip={(row) => void skip(row.id, row.title)}
              />
              <TrainingHistory today={today} onOpen={(id) => setOpen({ id, readOnly: true })} />
              <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
                <Text variant="caption" tone="muted" align="center">
                  {plan.weekdays.map((weekday) => weekdayLabel(language, weekday)).join(' · ')}
                </Text>
                <View style={{ flexDirection: 'row' }}>
                  <InkPill label={t('fit.training.change')} soft onPress={() => setSetup(true)} />
                </View>
              </View>
            </View>
          ) : null}
        </FitState>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
