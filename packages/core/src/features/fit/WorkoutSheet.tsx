import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { workouts as workoutRepo } from '@/db';
import { fit, type FitAction } from '@/db/fit';
import type { TrainingWorkout } from '@/db/fitTraining';
import { useCelebrate } from '@/features/celebrate/CelebrationLayer';
import { formatShortDate, formatWeekday, useI18n, type Translate } from '@/i18n';
import { useAccount } from '@/state/AppContext';
import { numeric, useTheme } from '@/theme';
import { Chip, Panel, Screen, Text, useUndo } from '@/ui';

import { AreaHeader } from './KitchenKit';
import { ActionCard } from './ActionCard';
import { ExerciseBlock, trainingError } from './ExerciseBlock';
import { FitState } from './FitGate';
import { RestTimer, type Rest } from './RestTimer';
import { InkPill, RecordNote } from './TrainingParts';
import { formatsOf, minutesOf, shortName, type TrainingFormats } from './trainingText';
import { TRAINING } from './trainingType';
import { useFit } from './useFit';
import { shiftDay } from './zurichDay';

export { minutesOf } from './trainingText';

const dayLabel = (language: Parameters<typeof formatShortDate>[0], day: string) =>
  `${formatWeekday(language, `${day}T12:00:00`)} ${formatShortDate(language, `${day}T12:00:00`)}`;

/** Epley: geschaetztes Maximum aus Gewicht und Wiederholungen. */
const EPLEY = 30;
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
/** Die Pause schwebt 12 vom Rand, 26 ueber dem Boden, wie im Entwurf. */
const TIMER_X = 12;
const TIMER_BOTTOM = 26;
/** Platz unter dem Inhalt, damit nichts unter der Pause verschwindet. */
const TIMER_SPACE = 140;

/** Wann der erste Satz kam — der Dienst liefert es, sonst merkt es sich die App. */
const firstSetAt = new Map<string, number>();

function startedAtOf(workout: TrainingWorkout): number | null {
  const served = (workout as TrainingWorkout & { startedAt?: string | null }).startedAt;
  const parsed = served ? Date.parse(served) : Number.NaN;
  if (Number.isFinite(parsed)) return parsed;
  return firstSetAt.get(workout.id) ?? null;
}

/** Die neueste Bestleistung dieses Trainings als Block: Zeile und Nebensatz. */
function recordOf(
  workout: TrainingWorkout,
  t: Translate,
  formats: TrainingFormats,
): { exerciseId: string; line: string; detail: string | null } | null {
  const set = workout.sets.filter((entry) => entry.isRecord && !entry.warmup).at(-1);
  const exercise = set
    ? workout.exercises.find((entry) => entry.exerciseId === set.exerciseId)
    : undefined;
  if (!set || !exercise) return null;
  const count = set.reps ?? 0;
  const kg = set.weightKg;
  const text = set.seconds
    ? `${formats.whole.format(set.seconds)} ${t('fit6.unit.seconds')}`
    : kg
      ? `${formats.kg.format(kg)} ${t('fit6.unit.kg')} × ${formats.whole.format(count)}`
      : `${formats.whole.format(count)} ${t('fit6.input.reps')}`;
  const e1rm = kg && count > 0 ? kg * (1 + count / EPLEY) : null;
  const before = exercise.record?.e1rm ?? null;
  const gain = e1rm !== null && before !== null ? Math.round(e1rm - before) : 0;
  const weeks = exercise.record
    ? Math.round((Date.parse(workout.day) - Date.parse(exercise.record.day)) / DAY_MS / 7)
    : 0;
  const gainText =
    gain > 0
      ? weeks > 1
        ? t('fit6.v.record.gain', { kg: formats.whole.format(gain), weeks })
        : weeks === 1
          ? t('fit6.v.record.gainOne', { kg: formats.whole.format(gain) })
          : t('fit6.v.record.gainShort', { kg: formats.whole.format(gain) })
      : null;
  return {
    exerciseId: exercise.exerciseId,
    line: t('fit6.v.record.line', {
      name: shortName(exercise.name, t('fit6.v.shortSep')),
      set: text,
    }),
    detail:
      [e1rm ? t('fit6.v.record.e1rm', { kg: formats.whole.format(e1rm) }) : null, gainText]
        .filter(Boolean)
        .join(' · ') || null,
  };
}

/**
 * Ein Training als eigener Bildschirm: Kopf mit Zurueck, jede Uebung mit
 * ihren Saetzen, die jetzige offen, die anderen als Zeilen. Nach einem Satz
 * schwebt unten die Pause.
 *
 * - Nur ein geplantes Training von heute oder frueher nimmt Saetze an; ein
 *   kuenftiges wird mit „Heute machen“ zuerst auf heute gelegt.
 * - Abschliessen geht erst mit einem Arbeitssatz — der Knopf steht am Ende der
 *   Liste, unter dem ersten Bildschirm. Dann schreibt es eine Zeile mit
 *   Minuten in den gemeinsamen Speicher (Woche, Profil, GetBetter) — genau
 *   eine je Training, „Wieder öffnen“ nimmt sie weg.
 * - `readOnly` (aus dem Verlauf): nur ansehen.
 */
export function WorkoutSheet({
  workoutId,
  today,
  readOnly = false,
  onClose,
}: {
  workoutId: string;
  today: string;
  readOnly?: boolean;
  onClose: () => void;
}) {
  const { t, language } = useI18n();
  const formats = formatsOf(language);
  const theme = useTheme();
  const undo = useUndo();
  const insets = useSafeAreaInsets();
  const detail = useFit(() => fit.workout(workoutId), [workoutId], ['training']);
  const [rest, setRest] = useState<Rest | null>(null);
  const [moving, setMoving] = useState(false);
  const [action, setAction] = useState<FitAction | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // Welche Uebung offen ist: gewaehlt, sonst die erste mit offenen Saetzen.
  const [chosen, setChosen] = useState<string | null>(null);
  // Hoehe des Bildschirms und des Kopfs: der Abschluss beginnt unter dem ersten Bild.
  const [frame, setFrame] = useState({ total: 0, header: 0, finish: 0 });
  const workout = detail.data?.workout;
  const account = useAccount();
  const router = useRouter();
  const celebrate = useCelebrate();
  // Nach dem Abschliessen: was es war und was das Essen heute noch braucht.
  const [finished, setFinished] = useState<{
    sets: number;
    minutes: number;
    proteinG: number | null;
    kcal: number | null;
  } | null>(null);

  // Zurueck am Telefon schliesst das Training, nicht den ganzen Plan.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  // „seit 18 Minuten“ laeuft mit.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE_MS / 2);
    return () => clearInterval(timer);
  }, []);

  const future = workout ? workout.status === 'planned' && workout.day > today : false;
  const closed = readOnly || !workout || workout.status !== 'planned' || future;
  const workOf = (exerciseId: string) =>
    workout?.sets.filter((set) => set.exerciseId === exerciseId && !set.warmup).length ?? 0;
  const current =
    workout?.exercises.find((exercise) => workOf(exercise.exerciseId) < exercise.sets)
      ?.exerciseId ??
    workout?.exercises.at(-1)?.exerciseId ??
    null;
  const openId = chosen ?? current;
  const planned = workout?.exercises.reduce((sum, exercise) => sum + exercise.sets, 0) ?? 0;
  const startedAt = workout ? startedAtOf(workout) : null;
  const minutes = startedAt ? Math.max(1, Math.round((now - startedAt) / MINUTE_MS)) : null;
  const progress = workout
    ? {
        current: formats.whole.format(Math.min(planned, workout.workSets + 1)),
        total: formats.whole.format(planned),
      }
    : null;
  const subtitle =
    !workout || !progress
      ? undefined
      : closed
        ? dayLabel(language, workout.day)
        : workout.workSets === 0
          ? planned === 1
            ? t('fit6.v.sub.setsOne')
            : t('fit6.v.sub.sets', { total: progress.total })
          : minutes === null
            ? t('fit6.v.sub.nowJust', progress)
            : minutes === 1
              ? t('fit6.v.sub.nowOne', progress)
              : t('fit6.v.sub.now', { ...progress, minutes: formats.whole.format(minutes) });
  const record = workout ? recordOf(workout, t, formats) : null;
  // Wo die Bestleistung steht: unter der offenen Uebung, im Verlauf unter ihrer eigenen.
  const recordAfter = closed ? record?.exerciseId : openId;
  // Der Abschluss beginnt knapp unter dem ersten Bildschirm.
  const viewport = Math.max(0, frame.total - frame.header);
  const minHeight = viewport > 0 ? viewport + frame.finish + TIMER_SPACE : undefined;

  async function complete(current: TrainingWorkout) {
    setBusy(true);
    const result = await fit.setWorkoutStatus(current.id, 'complete');
    setBusy(false);
    if (!result.ok) return setProblem(trainingError(t, result.error));
    setProblem(null);
    setRest(null);
    const minutes = minutesOf(current);
    celebrate('workout');
    await workoutRepo.syncFromFit({
      accountId: account.id,
      fitWorkoutId: current.id,
      day: current.day,
      kind: current.title,
      minutes,
    });
    const day = await fit.day(current.day);
    const left = day.ok ? day.data.remaining : null;
    setFinished({
      sets: current.workSets,
      minutes,
      proteinG: left ? Math.max(0, Math.round(left.proteinG)) : null,
      kcal: left ? Math.max(0, Math.round(left.kcal)) : null,
    });
  }

  async function reopen(current: TrainingWorkout) {
    const result = await fit.setWorkoutStatus(current.id, 'reopen');
    if (!result.ok) return setProblem(trainingError(t, result.error));
    setFinished(null);
    await workoutRepo.removeFromFit(account.id, current.id);
  }

  async function skip(current: TrainingWorkout) {
    const result = await fit.setWorkoutStatus(current.id, 'skip');
    if (!result.ok) return setProblem(trainingError(t, result.error));
    undo.show({
      message: t('fit6.missed.skipped', { title: current.title }),
      onUndo: () => void fit.setWorkoutStatus(current.id, 'reopen'),
    });
    onClose();
  }

  async function doToday(current: TrainingWorkout) {
    setBusy(true);
    const result = await fit.moveNow(current.id, today);
    setBusy(false);
    if (!result.ok) return setProblem(trainingError(t, result.error));
    setProblem(null);
    detail.reload();
  }

  async function move(toDay: string) {
    const result = await fit.proposeReschedule(workoutId, toDay);
    setMoving(false);
    if (result.ok) setAction(result.data.action);
    else setProblem(trainingError(t, result.error));
  }

  const measure = (key: 'total' | 'header' | 'finish') => (event: LayoutChangeEvent) => {
    const height = Math.round(event.nativeEvent.layout.height);
    setFrame((value) => (value[key] === height ? value : { ...value, [key]: height }));
  };

  return (
    <View style={styles.fill} onLayout={measure('total')}>
      <Screen
        gap={theme.spacing.sm}
        contentStyle={{
          paddingTop: TRAINING.headerGap,
          paddingBottom: TIMER_SPACE,
          minHeight,
        }}
        header={
          <View onLayout={measure('header')}>
            <AreaHeader
              crumb={t('fit6.v.crumb')}
              title={workout?.title ?? t('fit.loading')}
              {...(subtitle ? { subtitle } : {})}
              onBack={onClose}
            />
          </View>
        }
      >
        <FitState loading={detail.loading} error={detail.error} onRetry={detail.reload}>
          {workout ? (
            <>
              {future && !readOnly ? (
                <View style={{ gap: theme.spacing.sm }}>
                  <Text variant="body" tone="muted">
                    {t('fit6.today.doHint', { day: dayLabel(language, workout.day) })}
                  </Text>
                  <InkPill
                    label={t('fit6.today.do')}
                    icon="play"
                    tall
                    disabled={busy}
                    onPress={() => void doToday(workout)}
                  />
                </View>
              ) : null}
              {workout.deload ? (
                <Text variant="body" tone="muted">
                  {t('fit6.deload')}
                </Text>
              ) : null}
              {workout.status === 'done' && !finished ? (
                <Text variant="label" tone="muted">
                  {t('fit6.readOnly')}
                </Text>
              ) : null}
              {workout.exercises.map((exercise) => (
                <View key={exercise.exerciseId} style={{ gap: theme.spacing.sm }}>
                  <ExerciseBlock
                    workoutId={workout.id}
                    exercise={exercise}
                    sets={workout.sets.filter((set) => set.exerciseId === exercise.exerciseId)}
                    readOnly={closed}
                    collapsed={!closed && exercise.exerciseId !== openId}
                    onExpand={() => setChosen(exercise.exerciseId)}
                    formats={formats}
                    onLogged={(info) => {
                      if (!firstSetAt.has(workout.id)) firstSetAt.set(workout.id, Date.now());
                      if (info.record) celebrate('record');
                      // Ist die Uebung voll, geht es von selbst mit der naechsten weiter.
                      if (!info.warmup && workOf(exercise.exerciseId) + 1 >= exercise.sets)
                        setChosen(null);
                      if (info.restSeconds > 0) {
                        const startedAt = Date.now();
                        setRest({ startedAt, endsAt: startedAt + info.restSeconds * 1000 });
                      }
                    }}
                  />
                  {record && recordAfter === exercise.exerciseId ? (
                    <RecordNote line={record.line} detail={record.detail} />
                  ) : null}
                </View>
              ))}
              {action ? (
                <ActionCard key={action.id} action={action} onDone={() => detail.reload()} />
              ) : null}
              {moving ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                  {Array.from({ length: 7 }, (_, offset) => shiftDay(today, offset))
                    .filter((day) => day !== workout.day)
                    .map((day) => (
                      <Chip
                        key={day}
                        label={dayLabel(language, day)}
                        onPress={() => void move(day)}
                      />
                    ))}
                </View>
              ) : null}
              {finished ? (
                <View accessibilityLiveRegion="polite">
                  <Panel label={t('fit6.v.doneLabel')}>
                    <Text variant="title" style={{ marginTop: theme.spacing.xs }}>
                      {t(finished.sets === 1 ? 'fit.done.titleOne' : 'fit.done.title', {
                        sets: formats.whole.format(finished.sets),
                        minutes: formats.whole.format(finished.minutes),
                      })}
                    </Text>
                    {finished.proteinG !== null && finished.kcal !== null ? (
                      <Text
                        variant="label"
                        tone="muted"
                        style={[numeric, { marginTop: theme.spacing.xs }]}
                      >
                        {t('fit.done.food', {
                          protein: formats.whole.format(finished.proteinG),
                          kcal: formats.whole.format(finished.kcal),
                        })}
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', marginTop: theme.spacing.md }}>
                      <InkPill
                        label={t('fit.done.log')}
                        icon="meal"
                        onPress={() => {
                          onClose();
                          router.push('/run/nutrition');
                        }}
                      />
                    </View>
                  </Panel>
                </View>
              ) : null}
              {problem ? (
                <View accessibilityLiveRegion="polite">
                  <Text variant="label" tone="danger">
                    {problem}
                  </Text>
                </View>
              ) : null}
              <View style={styles.grow} />
              <View
                onLayout={measure('finish')}
                style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.lg }}
              >
                {readOnly ? null : (
                  <>
                    {workout.status === 'planned' && !future ? (
                      <>
                        <View style={{ flexDirection: 'row' }}>
                          <InkPill
                            label={t('fit.training.complete')}
                            icon="check"
                            tall
                            disabled={busy || workout.workSets === 0}
                            onPress={() => void complete(workout)}
                          />
                        </View>
                        {workout.workSets === 0 ? (
                          <Text variant="caption" tone="muted" align="center">
                            {t('fit6.complete.noSets')}
                          </Text>
                        ) : null}
                      </>
                    ) : null}
                    <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                      {workout.status !== 'planned' ? (
                        <InkPill
                          label={t('fit.training.reopen')}
                          soft
                          onPress={() => void reopen(workout)}
                        />
                      ) : null}
                      {workout.status === 'planned' && workout.sets.length === 0 ? (
                        <InkPill
                          label={t('fit.training.move')}
                          soft
                          onPress={() => setMoving((value) => !value)}
                        />
                      ) : null}
                      {workout.status === 'planned' && workout.sets.length === 0 ? (
                        <InkPill
                          label={t('fit.training.skip')}
                          soft
                          onPress={() => void skip(workout)}
                        />
                      ) : null}
                    </View>
                  </>
                )}
                <Text variant="caption" tone="faint" align="center">
                  {t('fit.training.noDiagnosis')}
                </Text>
              </View>
            </>
          ) : null}
        </FitState>
      </Screen>
      {rest ? (
        <View
          style={[
            styles.timer,
            { left: TIMER_X, right: TIMER_X, bottom: TIMER_BOTTOM + insets.bottom },
          ]}
        >
          <RestTimer key={rest.startedAt} rest={rest} onChange={setRest} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
  timer: { position: 'absolute' },
});
