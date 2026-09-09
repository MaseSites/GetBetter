import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  dayKey,
  routines as routineRepo,
  useLiveQuery,
  workoutSets as setRepo,
  workouts as workoutRepo,
  type RoutineRow,
  type WorkoutRow,
  type WorkoutSetRow,
} from '@/db';
import { parseAmount } from '@/features/money/amount';
import { relativeDay } from '@/features/shared/days';
import { formatNumber, useI18n, type TranslationKey } from '@/i18n';
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
  Icon,
  IconButton,
  Input,
  Screen,
  Sheet,
  Text,
} from '@/ui';

/** Arten von Training — die Schluessel, die Namen kommen aus der Sprache. */
const KINDS = ['strength', 'run', 'bike', 'swim', 'yoga', 'other'] as const;
const MINUTES = [20, 30, 45, 60, 90] as const;
/** Die Uebungen, die fast jeder macht. Eigene gehen ueber das Feld. */
const EXERCISES = [
  'squat',
  'bench',
  'deadlift',
  'press',
  'row',
  'pullup',
  'latpull',
  'legpress',
  'curl',
  'triceps',
  'lunge',
  'plank',
] as const;
/** Pause nach einem Satz, wie in Hevy voreingestellt. */
const REST_SECONDS = 90;

/** Wie weit die Woche zurueckreicht, fuer die Zusammenfassung oben. */
function weekStart(): string {
  const date = new Date();
  const weekday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - weekday);
  return dayKey(date);
}

/** Die Uebungen eines Trainings in der Reihenfolge ihres ersten Satzes. */
function exercisesOf(sets: readonly WorkoutSetRow[]): string[] {
  const seen: string[] = [];
  for (const set of sets) if (!seen.includes(set.exercise)) seen.push(set.exercise);
  return seen;
}

/**
 * Training wie in Hevy: Vorlagen zum Starten, je Uebung die Saetze mit Gewicht
 * und Wiederholungen, die Bestleistung daneben, nach jedem Satz eine Pause.
 */
export function FitnessView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();

  const [starting, setStarting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingRoutine, setEditingRoutine] = useState(false);

  const list = useLiveQuery(() => workoutRepo.listRecent(account.id), [account.id]);
  const setList = useLiveQuery(() => setRepo.listAll(account.id), [account.id]);
  const routineList = useLiveQuery(() => routineRepo.list(account.id), [account.id]);
  const week = useLiveQuery(() => workoutRepo.minutesSince(account.id, weekStart()), [account.id]);
  const rows = list.data ?? [];
  const sets = setList.data ?? [];
  const routines = routineList.data ?? [];
  const open = rows.find((row) => row.id === openId) ?? null;

  const kindLabel = (id: string) => t(`gym.kind.${id}` as TranslationKey);

  async function start(kind: string, minutes: number) {
    const created = await workoutRepo.add({ accountId: account.id, day: dayKey(), kind, minutes });
    setStarting(false);
    setOpenId(created.id);
  }

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={t('gym.week', { minutes: week.data ?? 0 })}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      }
    >
      {/* Vorlagen: ein Tipp startet ein Training mit diesen Uebungen. */}
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="section" tone="muted">
          {t('gym.routines')}
        </Text>
        <View style={[styles.chips, { gap: theme.spacing.sm }]}>
          {routines.map((routine) => (
            <Chip
              key={routine.id}
              label={routine.name}
              onPress={() => void start(routine.name, MINUTES[2])}
            />
          ))}
          <Chip label={`+ ${t('gym.routine.new')}`} onPress={() => setEditingRoutine(true)} />
        </View>
      </View>

      {rows.length === 0 ? (
        <EmptyState icon="fitness" title={t('gym.empty.title')} body={t('gym.empty.body')} />
      ) : (
        rows.map((row) => {
          const count = sets.filter((set) => set.workoutId === row.id).length;
          return (
            <Card key={row.id} onPress={() => setOpenId(row.id)} accessibilityLabel={row.kind}>
              <View style={[styles.row, { gap: theme.spacing.md }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="title">{row.kind}</Text>
                  <Text variant="caption" tone="muted">
                    {[
                      relativeDay(t, language, row.day),
                      row.minutes > 0 ? t('gym.minutes', { minutes: row.minutes }) : null,
                      count > 0 ? t(count === 1 ? 'gym.sets.one' : 'gym.sets', { count }) : null,
                      row.notes,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <Icon name="forward" size={18} color={theme.colors.textFaint} />
              </View>
            </Card>
          );
        })
      )}

      <FloatingButton label={t('gym.start')} onPress={() => setStarting(true)} />

      <Sheet visible={starting} onClose={() => setStarting(false)} title={t('gym.start')}>
        <StartPicker
          routines={routines}
          kindLabel={kindLabel}
          onStart={(kind, minutes) => void start(kind, minutes)}
        />
      </Sheet>

      <RoutineEditor
        visible={editingRoutine}
        accountId={account.id}
        onClose={() => setEditingRoutine(false)}
      />

      <WorkoutDetail
        key={open?.id ?? 'closed'}
        workout={open}
        sets={sets.filter((set) => set.workoutId === openId)}
        allSets={sets}
        routine={routines.find((routine) => routine.name === open?.kind) ?? null}
        accountId={account.id}
        onClose={() => setOpenId(null)}
      />
    </Screen>
  );
}

function StartPicker({
  routines,
  kindLabel,
  onStart,
}: {
  routines: readonly RoutineRow[];
  kindLabel: (id: string) => string;
  onStart: (kind: string, minutes: number) => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const [kind, setKind] = useState<string>(kindLabel(KINDS[0]));
  const [minutes, setMinutes] = useState<number>(MINUTES[2]);

  return (
    <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="label" tone="muted">
          {t('gym.kind')}
        </Text>
        <View style={[styles.chips, { gap: theme.spacing.sm }]}>
          {routines.map((routine) => (
            <Chip
              key={routine.id}
              label={routine.name}
              selected={kind === routine.name}
              onPress={() => setKind(routine.name)}
            />
          ))}
          {KINDS.map((entry) => (
            <Chip
              key={entry}
              label={kindLabel(entry)}
              selected={kind === kindLabel(entry)}
              onPress={() => setKind(kindLabel(entry))}
            />
          ))}
        </View>
      </View>
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="label" tone="muted">
          {t('gym.duration')}
        </Text>
        <View style={[styles.chips, { gap: theme.spacing.sm }]}>
          {MINUTES.map((entry) => (
            <Chip
              key={entry}
              label={t('gym.minutes', { minutes: entry })}
              selected={minutes === entry}
              onPress={() => setMinutes(entry)}
            />
          ))}
        </View>
      </View>
      <Button label={t('gym.start')} icon="fitness" onPress={() => onStart(kind, minutes)} />
    </View>
  );
}

function RoutineEditor({
  visible,
  accountId,
  onClose,
}: {
  visible: boolean;
  accountId: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const [name, setName] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState(false);

  const label = (id: string) => t(`gym.exercise.${id}` as TranslationKey);

  function toggle(exercise: string) {
    setChosen((current) =>
      current.includes(exercise)
        ? current.filter((entry) => entry !== exercise)
        : [...current, exercise],
    );
  }

  async function save() {
    if (name.trim().length === 0 || chosen.length === 0) {
      setError(true);
      return;
    }
    await routineRepo.add({ accountId, name, exercises: chosen });
    setName('');
    setChosen([]);
    setError(false);
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={t('gym.routine.new')}>
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
        <Input
          label={t('gym.routine.name')}
          placeholder={t('gym.routine.namePlaceholder')}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          {...(error ? { error: t('money.error.name') } : {})}
        />
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" tone="muted">
            {t('gym.routine.exercises')}
          </Text>
          <View style={[styles.chips, { gap: theme.spacing.sm }]}>
            {EXERCISES.map((id) => (
              <Chip
                key={id}
                label={label(id)}
                selected={chosen.includes(label(id))}
                onPress={() => toggle(label(id))}
              />
            ))}
            {chosen
              .filter((entry) => !EXERCISES.some((id) => label(id) === entry))
              .map((entry) => (
                <Chip key={entry} label={entry} selected onPress={() => toggle(entry)} />
              ))}
          </View>
          <Input
            placeholder={t('gym.exercisePlaceholder')}
            value={custom}
            onChangeText={setCustom}
            onSubmitEditing={() => {
              if (custom.trim().length > 0) toggle(custom.trim());
              setCustom('');
            }}
            returnKeyType="done"
            accessibilityLabel={t('gym.exercisePlaceholder')}
          />
        </View>
        <Button label={t('common.done')} icon="check" onPress={save} />
      </View>
    </Sheet>
  );
}

/** Ein Training im Detail: je Uebung die Saetze, ein Feld fuer den naechsten. */
function WorkoutDetail({
  workout,
  sets,
  allSets,
  routine,
  accountId,
  onClose,
}: {
  workout: WorkoutRow | null;
  sets: readonly WorkoutSetRow[];
  allSets: readonly WorkoutSetRow[];
  routine: RoutineRow | null;
  accountId: string;
  onClose: () => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();

  const [active, setActive] = useState<string | null>(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [custom, setCustom] = useState('');
  const [notes, setNotes] = useState(workout?.notes ?? '');
  const [rest, setRest] = useState<number | null>(null);

  // Der Pausentimer zaehlt runter, bis er bei null verschwindet.
  useEffect(() => {
    if (rest === null || rest <= 0) return;
    const timer = setTimeout(() => setRest((current) => (current ?? 1) - 1), 1000);
    return () => clearTimeout(timer);
  }, [rest]);

  const exerciseLabel = (id: string) => t(`gym.exercise.${id}` as TranslationKey);
  const exercises = exercisesOf(sets);
  const planned = (routine?.exercises ?? []).filter((entry) => !exercises.includes(entry));
  const suggestions = EXERCISES.map(exerciseLabel).filter(
    (entry) => !exercises.includes(entry) && !planned.includes(entry),
  );

  /** Das Beste, was je fuer diese Uebung stand — Gewicht vor Wiederholungen. */
  function bestOf(exercise: string): string | null {
    const own = allSets.filter((set) => set.exercise === exercise);
    if (own.length === 0) return null;
    const weighted = own.filter((set) => set.weightKg !== null && set.weightKg > 0);
    if (weighted.length > 0) {
      const top = Math.max(...weighted.map((set) => set.weightKg ?? 0));
      return `${formatNumber(language, top)} ${t('gym.weight')}`;
    }
    return t('gym.setLineBody', { reps: Math.max(...own.map((set) => set.reps)) });
  }

  function focus(exercise: string) {
    const last = [...allSets].reverse().find((set) => set.exercise === exercise);
    setActive(exercise);
    setWeight(last?.weightKg ? String(last.weightKg) : '');
    setReps(last ? String(last.reps) : '');
  }

  async function addSet() {
    if (!workout || !active) return;
    const count = Number(reps.replace(/[^\d]/g, ''));
    if (!Number.isFinite(count) || count <= 0) return;
    await setRepo.add({
      workoutId: workout.id,
      accountId,
      exercise: active,
      weightKg: parseAmount(weight),
      reps: count,
    });
    setRest(REST_SECONDS);
  }

  async function saveNotes() {
    if (workout && notes !== (workout.notes ?? '')) {
      await workoutRepo.update(workout.id, { notes });
    }
    onClose();
  }

  const restText =
    rest === null
      ? null
      : rest > 0
        ? t('gym.rest', {
            time: `${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, '0')}`,
          })
        : t('gym.restDone');

  return (
    <Sheet
      visible={workout !== null}
      onClose={saveNotes}
      title={workout?.kind ?? ''}
      subtitle={workout ? relativeDay(t, language, workout.day) : undefined}
      fullScreen
    >
      <View style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.sm }}>
        {restText ? (
          <View
            style={[
              styles.row,
              {
                gap: theme.spacing.sm,
                padding: theme.spacing.md,
                borderRadius: theme.radii.md,
                backgroundColor:
                  rest && rest > 0 ? theme.colors.accentSoft : theme.colors.surfaceMuted,
              },
            ]}
          >
            <Icon name="clock" size={18} color={theme.colors.accentStrong} />
            <View style={{ flex: 1 }}>
              <Text variant="label" tone="accent">
                {restText}
              </Text>
            </View>
            <Button
              label={t('gym.restStop')}
              variant="ghost"
              size="sm"
              fullWidth={false}
              onPress={() => setRest(null)}
            />
          </View>
        ) : null}

        <View style={[styles.chips, { gap: theme.spacing.sm }]}>
          {MINUTES.map((entry) => (
            <Chip
              key={entry}
              label={t('gym.minutes', { minutes: entry })}
              selected={workout?.minutes === entry}
              onPress={() => workout && void workoutRepo.update(workout.id, { minutes: entry })}
            />
          ))}
        </View>

        {[...exercises, ...planned].map((exercise) => {
          const own = sets.filter((set) => set.exercise === exercise);
          const best = bestOf(exercise);
          const isActive = active === exercise;
          return (
            <Card key={exercise}>
              <View style={{ gap: theme.spacing.sm }}>
                <View style={[styles.row, { gap: theme.spacing.sm }]}>
                  <View style={{ flex: 1 }}>
                    <Text variant="title">{exercise}</Text>
                  </View>
                  {best ? (
                    <Text variant="caption" tone="accent">
                      {t('gym.best', { value: best })}
                    </Text>
                  ) : null}
                </View>

                {own.map((set, index) => (
                  <View key={set.id}>
                    {index > 0 ? <Divider /> : null}
                    <View
                      style={[
                        styles.row,
                        { gap: theme.spacing.sm, paddingVertical: theme.spacing.xs },
                      ]}
                    >
                      <Text variant="label" tone="muted">
                        {t('gym.set', { index: index + 1 })}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text variant="body">
                          {set.weightKg !== null && set.weightKg > 0
                            ? t('gym.setLine', {
                                weight: formatNumber(language, set.weightKg),
                                reps: set.reps,
                              })
                            : t('gym.setLineBody', { reps: set.reps })}
                        </Text>
                      </View>
                      <IconButton
                        icon="trash"
                        label={t('common.remove')}
                        onPress={() => void setRepo.remove(set.id)}
                      />
                    </View>
                  </View>
                ))}

                {isActive ? (
                  <View style={[styles.row, { gap: theme.spacing.sm }]}>
                    <View style={{ flex: 1 }}>
                      <Input
                        placeholder={t('gym.weight')}
                        value={weight}
                        onChangeText={setWeight}
                        keyboardType="decimal-pad"
                        accessibilityLabel={t('gym.weight')}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input
                        placeholder={t('gym.reps')}
                        value={reps}
                        onChangeText={setReps}
                        keyboardType="number-pad"
                        onSubmitEditing={() => void addSet()}
                        returnKeyType="done"
                        accessibilityLabel={t('gym.reps')}
                      />
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('gym.addSet')}
                      onPress={() => void addSet()}
                      style={({ pressed }) => [
                        styles.addButton,
                        {
                          borderRadius: theme.radii.md,
                          backgroundColor: pressed
                            ? theme.colors.accentStrong
                            : theme.colors.accent,
                        },
                      ]}
                    >
                      <Icon name="plus" size={22} color={theme.colors.textOnAccent} />
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.chips}>
                    <Chip label={t('gym.addSet')} onPress={() => focus(exercise)} />
                  </View>
                )}
              </View>
            </Card>
          );
        })}

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="section" tone="muted">
            {t('gym.addExercise')}
          </Text>
          <View style={[styles.chips, { gap: theme.spacing.sm }]}>
            {suggestions.map((entry) => (
              <Chip key={entry} label={entry} onPress={() => focus(entry)} />
            ))}
          </View>
          <Input
            placeholder={t('gym.exercisePlaceholder')}
            value={custom}
            onChangeText={setCustom}
            onSubmitEditing={() => {
              if (custom.trim().length > 0) focus(custom.trim());
              setCustom('');
            }}
            returnKeyType="done"
            accessibilityLabel={t('gym.exercisePlaceholder')}
          />
        </View>

        <Input
          label={t('gym.note')}
          placeholder={t('common.optional')}
          value={notes}
          onChangeText={setNotes}
          autoCapitalize="sentences"
        />

        <View style={{ gap: theme.spacing.sm }}>
          <Button label={t('common.done')} icon="check" onPress={saveNotes} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.remove')}
            onPress={() => {
              if (workout) void workoutRepo.remove(workout.id);
              onClose();
            }}
            style={[styles.removeRow, { gap: theme.spacing.sm, paddingVertical: theme.spacing.md }]}
          >
            <Icon name="trash" size={18} color={theme.colors.danger} />
            <Text variant="label" tone="danger">
              {t('common.remove')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  addButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  removeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
