import { useState } from 'react';
import { View } from 'react-native';

import { fit } from '@/db/fit';
import type { SetInput, TrainingExercise, TrainingSet, TrainingTarget } from '@/db/fitTraining';
import { useI18n, type Translate, type TranslationKey } from '@/i18n';
import { numeric, useTheme } from '@/theme';
import { Chip, Text, useUndo } from '@/ui';

import { ExerciseRow, rirLabel } from './ExerciseRow';
import { PlateRow } from './PlateRow';
import { CellInput, SetRow, TableHead, type Columns } from './SetTable';
import { parseDecimal } from './setupForm';
import { TrainingBlock } from './TrainingParts';
import { dashRange, describeSets, type TrainingFormats } from './trainingText';
import { TRAINING } from './trainingType';

const KNOWN_ERRORS = ['workout_closed', 'workout_future', 'too_many_sets', 'workout_started', 'no_sets'];

/**
 * Warum heute dieses Ziel steht. `nextTarget` im Dienst nennt den Grund, hier
 * steht der Satz dazu — je Grund genau einer, in allen vier Sprachen.
 */
const WHY_KEYS: Record<TrainingTarget['reason'], TranslationKey> = {
  progress: 'fit8.why.progress',
  repeat: 'fit8.why.repeat',
  reduce: 'fit8.why.reduce',
  reps: 'fit8.why.reps',
  time: 'fit8.why.time',
  deload: 'fit8.why.deload',
};

/** Ein Fehler des Dienstes als Satz — bekannte mit eigenem Text, sonst allgemein. */
export function trainingError(t: Translate, error: string): string {
  return KNOWN_ERRORS.includes(error)
    ? t(`fit6.error.${error}` as TranslationKey)
    : t('fit6.error.generic');
}

const secondsOf = (reps: string) => Number(/^(\d+)\s*s$/.exec(reps)?.[1] ?? 30);

type SetLike = { weightKg: number | null; reps: number | null; seconds: number | null };

export type LoggedInfo = {
  restSeconds: number;
  warmup: boolean;
  /** Schlaegt der Satz die Bestleistung? Dann wird gefeiert. */
  record: boolean;
};

/**
 * Eine Uebung im Trainingsheft: Kopf mit Vorgabe, darunter „Letztes Mal … —
 * heute …“ und die Tabelle SATZ · LETZTES MAL · KG · WDH · ✓ mit den
 * erledigten Saetzen und dem jetzigen. Was danach kommt, sagt der Kopf
 * („3 × 6–8“). Das Kaestchen der jetzigen Zeile traegt den Satz ein, ein Tipp
 * auf ein Haekchen nimmt ihn zurueck (mit Rueckgaengig). Aufwaermsaetze stehen
 * grau und zaehlen nicht mit. Zugeklappt ist sie eine Zeile, die sich mit einem
 * Tipp oeffnet.
 */
export function ExerciseBlock({
  workoutId,
  exercise,
  sets,
  readOnly,
  collapsed = false,
  formats,
  onExpand,
  onLogged,
}: {
  workoutId: string;
  exercise: TrainingExercise;
  sets: TrainingSet[];
  readOnly: boolean;
  collapsed?: boolean;
  formats: TrainingFormats;
  onExpand?: () => void;
  /** Nach einem Satz: Pause starten, bei Rekord feiern. */
  onLogged: (info: LoggedInfo) => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const undo = useUndo();
  const units = { kg: t('fit6.unit.kg'), seconds: t('fit6.unit.seconds') };
  const work = sets.filter((set) => !set.warmup);
  const warmups = sets.filter((set) => set.warmup);
  const lastSets = exercise.last?.sets ?? [];
  const nextLast = lastSets[work.length] ?? null;
  const weighted = exercise.kind === 'weighted';
  const columns: Columns = { kg: !exercise.timed, seconds: exercise.timed };
  const previous = work.at(-1) ?? null;

  // Vorbelegt: das Ziel von heute, sonst der Satz davor, sonst das letzte Mal.
  const [weight, setWeight] = useState(() => {
    const kg =
      exercise.target?.weightKg ??
      previous?.weightKg ??
      nextLast?.weightKg ??
      lastSets[0]?.weightKg;
    return weighted && kg ? String(kg) : '';
  });
  const [reps, setReps] = useState(() => {
    // Beim ersten Mal ohne Ziel: das untere Ende des Bereichs („6-8“ → 6).
    const low = Number.parseInt(String(exercise.reps ?? ''), 10);
    const first =
      exercise.target?.reps ??
      nextLast?.reps ??
      previous?.reps ??
      (Number.isFinite(low) && low > 0 ? low : null);
    return first ? String(first) : '';
  });
  const [seconds, setSeconds] = useState(() =>
    String(exercise.target?.seconds ?? lastSets[0]?.seconds ?? secondsOf(exercise.reps)),
  );
  const [error, setError] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [busy, setBusy] = useState(false);

  /** Kurz fuer die Tabelle: „60 × 8“, „8“, „30 s“. */
  const short = (set: SetLike | null | undefined) => {
    if (!set) return '—';
    if (set.seconds !== null && set.seconds > 0)
      return `${formats.whole.format(set.seconds)} ${units.seconds}`;
    const count = formats.whole.format(set.reps ?? 0);
    return set.weightKg ? `${formats.kg.format(set.weightKg)} × ${count}` : count;
  };

  async function send(input: SetInput, restAfter: boolean) {
    setBusy(true);
    const result = await fit.logSet(workoutId, input);
    setBusy(false);
    if (!result.ok) {
      setError(trainingError(t, result.error));
      return false;
    }
    setError(null);
    onLogged({
      restSeconds: restAfter ? exercise.restSeconds : 0,
      record: result.data.set?.isRecord === true,
      warmup: input.warmup === true,
    });
    return true;
  }

  async function log() {
    if (exercise.timed) {
      const value = Math.round(parseDecimal(seconds) ?? 0);
      if (value < 1 || value > 600) return setError(t('fit6.set.invalidSeconds'));
      await send({ exerciseId: exercise.exerciseId, seconds: value }, true);
      return;
    }
    const count = Math.round(parseDecimal(reps) ?? 0);
    const kg = !weighted || weight.trim() === '' ? null : parseDecimal(weight);
    if (count < 1 || (weighted && weight.trim() !== '' && kg === null))
      return setError(t('fit6.set.invalid'));
    const saved = await send(
      { exerciseId: exercise.exerciseId, reps: count, weightKg: kg, rir: null },
      true,
    );
    // Fuer den naechsten Satz: was letztes Mal an dieser Stelle stand, sonst dasselbe nochmal.
    const upcoming = lastSets[work.length + 1];
    if (saved && upcoming?.reps) setReps(String(upcoming.reps));
  }

  async function remove(set: TrainingSet) {
    const result = await fit.removeSet(workoutId, set.id);
    if (!result.ok) return setError(trainingError(t, result.error));
    undo.show({
      message: t('fit6.set.removed'),
      onUndo: () =>
        void fit.logSet(workoutId, {
          exerciseId: set.exerciseId,
          reps: set.reps,
          seconds: set.seconds,
          weightKg: set.weightKg,
          rir: set.rir,
          warmup: set.warmup,
        }),
    });
  }

  async function swap(to: string) {
    const result = await fit.swapExercise(workoutId, exercise.exerciseId, to);
    setSwapping(false);
    if (!result.ok) setError(trainingError(t, result.error));
  }

  const setText = (set: TrainingSet, number: number) => {
    const count = formats.whole.format(set.reps ?? 0);
    if (set.warmup)
      return set.weightKg
        ? t('fit6.set.warmup', { kg: formats.kg.format(set.weightKg), reps: count })
        : t('fit6.set.warmupReps', { reps: count });
    if (set.seconds)
      return t('fit6.set.seconds', { number, seconds: formats.whole.format(set.seconds) });
    if (set.weightKg)
      return t('fit6.set.weighted', { number, kg: formats.kg.format(set.weightKg), reps: count });
    return t('fit6.set.reps', { number, reps: count });
  };

  const target = exercise.target;
  // Was heute gilt: das Ziel des Dienstes, sonst das Gewicht des ersten Satzes von heute.
  const todayKg = weighted ? (target?.weightKg ?? work[0]?.weightKg ?? null) : null;
  const todayText = exercise.timed
    ? target?.seconds
      ? t('fit6.v.target.seconds', { seconds: formats.whole.format(target.seconds) })
      : null
    : todayKg
      ? t('fit6.v.target.kg', { kg: formats.kg.format(todayKg) })
      : target?.reps
        ? t('fit6.v.target.reps', { reps: formats.whole.format(target.reps) })
        : null;
  const lastText = exercise.last ? describeSets(exercise.last.sets, formats, units) : null;
  const lastLine = lastText
    ? todayText
      ? t('fit6.v.lastToday', { sets: lastText, target: todayText })
      : t('fit6.v.lastOnly', { sets: lastText })
    : todayText
      ? t('fit6.v.todayOnly', { target: todayText })
      : null;
  // Der Grund fuer das heutige Ziel, solange noch kein Satz steht.
  const whyLine =
    target && work.length === 0 ? t(WHY_KEYS[target.reason]) : null;
  const plateKg = exercise.barbell ? (parseDecimal(weight) ?? todayKg) : null;
  const scheme = exercise.timed
    ? t('fit6.v.schemeTimed', { sets: exercise.sets, seconds: secondsOf(exercise.reps) })
    : t('fit6.v.scheme', { sets: exercise.sets, reps: dashRange(exercise.reps) });
  const warmupMark = t('fit6.v.warmupMark');
  const kgOf = (kg: number | null) => (weighted && kg ? formats.kg.format(kg) : '—');
  const repsOf = (set: SetLike) =>
    exercise.timed ? formats.whole.format(set.seconds ?? 0) : formats.whole.format(set.reps ?? 0);
  const lastTop = weighted ? lastSets.reduce((top, set) => Math.max(top, set.weightKg ?? 0), 0) : 0;

  if (collapsed) {
    return (
      <ExerciseRow
        name={exercise.name}
        finished={work.length >= exercise.sets}
        meta={
          work.length > 0
            ? t('fit6.v.exerciseDone', { done: work.length, total: exercise.sets })
            : lastTop > 0
              ? t('fit6.v.otherLast', { scheme, kg: formats.kg.format(lastTop) })
              : scheme
        }
        onPress={onExpand}
      />
    );
  }

  return (
    <TrainingBlock label={exercise.name} more={scheme}>
      {lastLine ? (
        <Text
          variant="label"
          tone="muted"
          style={[
            numeric,
            {
              marginTop: TRAINING.lastLineGap,
              lineHeight: TRAINING.line13,
              fontWeight: theme.fontWeight.regular,
            },
          ]}
        >
          {lastLine}
        </Text>
      ) : null}

      {/* Warum heute diese Zahl steht. Der Dienst rechnet es (`nextTarget`),
          gesagt wird es hier — eine Zahl ohne Grund ist eine Blackbox, und
          genau das werfen Nutzer den anderen Apps vor. Nur vor dem ersten
          Satz: wer schon trainiert, braucht die Begruendung nicht mehr. */}
      {whyLine ? (
        <Text
          variant="caption"
          tone="faint"
          style={{ marginTop: TRAINING.lastLineGap, lineHeight: TRAINING.line13 }}
        >
          {whyLine}
        </Text>
      ) : null}

      {!readOnly && sets.length === 0 && exercise.swaps.length > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.sm,
            marginTop: theme.spacing.md,
          }}
        >
          {swapping ? (
            exercise.swaps
              .slice(0, 6)
              .map((option) => (
                <Chip
                  key={option.exerciseId}
                  label={option.name}
                  onPress={() => void swap(option.exerciseId)}
                />
              ))
          ) : (
            <Chip label={t('fit.training.swap')} onPress={() => setSwapping(true)} />
          )}
        </View>
      ) : null}

      <TableHead columns={columns} />
      <View style={{ gap: theme.spacing.xs }}>
        {warmups.map((set) => (
          <SetRow
            key={set.id}
            kind="done"
            warmup
            columns={columns}
            number={warmupMark}
            last="—"
            kg={kgOf(set.weightKg)}
            reps={repsOf(set)}
            label={setText(set, 0)}
            checkLabel={t('fit6.set.remove', { number: t('fit6.warmup.title') })}
            onCheck={readOnly ? undefined : () => void remove(set)}
          />
        ))}
        {work.map((set, index) => {
          const number = index + 1;
          return (
            <SetRow
              key={set.id}
              kind="done"
              columns={columns}
              number={String(number)}
              last={short(lastSets[index])}
              kg={kgOf(set.weightKg)}
              reps={repsOf(set)}
              note={set.rir !== null ? t('fit6.set.rir', { rir: set.rir }) : null}
              label={[
                setText(set, number),
                set.rir !== null ? rirLabel(t, set.rir) : null,
                set.isRecord ? t('fit6.newRecord') : null,
              ]
                .filter(Boolean)
                .join(', ')}
              checkLabel={t('fit6.set.remove', { number })}
              onCheck={readOnly ? undefined : () => void remove(set)}
            />
          );
        })}
        {readOnly ? null : (
          <SetRow
            kind="now"
            columns={columns}
            number={String(work.length + 1)}
            last={short(nextLast)}
            kg={
              weighted ? (
                <CellInput
                  value={weight}
                  onChangeText={setWeight}
                  label={t('fit6.input.kg')}
                  decimal
                />
              ) : (
                '—'
              )
            }
            reps={
              <CellInput
                value={exercise.timed ? seconds : reps}
                onChangeText={exercise.timed ? setSeconds : setReps}
                label={exercise.timed ? t('fit6.input.seconds') : t('fit6.input.reps')}
                onSubmit={() => void log()}
              />
            }
            label={t('fit6.v.nowRow', { number: work.length + 1 })}
            checkLabel={t('fit6.v.logSet', { number: work.length + 1 })}
            disabled={busy}
            onCheck={() => void log()}
          />
        )}
      </View>

      {!readOnly && plateKg !== null && plateKg > 0 ? (
        <View style={{ marginTop: theme.spacing.md }}>
          <PlateRow kg={plateKg} formats={formats} />
        </View>
      ) : null}

      {error ? (
        <View accessibilityLiveRegion="polite" style={{ marginTop: theme.spacing.sm }}>
          <Text variant="label" tone="danger">
            {error}
          </Text>
        </View>
      ) : null}
    </TrainingBlock>
  );
}
