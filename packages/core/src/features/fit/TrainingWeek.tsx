import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { fit } from '@/db/fit';
import type { TrainingSummary } from '@/db/fitTraining';
import { formatShortDate, formatWeekday, useI18n, type TranslationKey } from '@/i18n';
import { numeric, useTheme } from '@/theme';
import { Icon, Text } from '@/ui';

import { InkPill, StartPill, TrainingBlock } from './TrainingParts';
import { plannedMinutes, shortName } from './trainingText';
import { TRAINING } from './trainingType';
import { useFit } from './useFit';
import { shiftDay } from './zurichDay';

const DAY_MARK = 22;
const REST_DOT = 6;
const RING = 1.5;
const TODAY_RING = 2;
/** Unter „Als Nächstes“ nur die naechsten zwei. */
const UPCOMING_ROWS = 2;

/** Der Montag der Woche, in der `day` liegt. */
export const mondayOf = (day: string) =>
  shiftDay(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));

type DayState = 'done' | 'today' | 'planned' | 'rest';

/**
 * Die Woche von Montag bis Sonntag als sieben Zeichen: erledigt ein Kreis in
 * Signal, heute ein Ring in Tinte, geplant ein zarter Ring, Ruhetag ein
 * kleiner Punkt. Ein Tag mit Training oeffnet es.
 */
export function WeekStrip({
  workouts,
  today,
  onOpen,
}: {
  workouts: readonly TrainingSummary[];
  today: string;
  onOpen: (id: string) => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const monday = mondayOf(today);
  const days = Array.from({ length: 7 }, (_, index) => shiftDay(monday, index));

  return (
    <View accessibilityLabel={t('fit6.v.week.a11y')}>
      <TrainingBlock style={styles.week}>
        {days.map((day) => {
          const row =
            workouts.find((entry) => entry.day === day && entry.status === 'done') ??
            workouts.find((entry) => entry.day === day && entry.status === 'planned') ??
            null;
          const state: DayState =
            row?.status === 'done' ? 'done' : day === today ? 'today' : row ? 'planned' : 'rest';
          const name = formatWeekday(language, `${day}T12:00:00`).slice(0, 2);
          const label = [
            `${formatWeekday(language, `${day}T12:00:00`)} ${formatShortDate(language, `${day}T12:00:00`)}`,
            row?.title,
            t(`fit6.v.state.${state === 'today' && !row ? 'today' : state}` as TranslationKey),
          ]
            .filter(Boolean)
            .join(', ');
          const content = (
            <View style={[styles.day, { gap: TRAINING.lastLineGap }]}>
              <Text
                variant="caption"
                tone={day === today ? 'default' : 'faint'}
                style={{
                  fontSize: theme.fontSize.caption,
                  lineHeight: TRAINING.line12,
                  fontWeight: day === today ? theme.fontWeight.bold : theme.fontWeight.medium,
                }}
              >
                {name}
              </Text>
              <View style={[styles.mark, { width: DAY_MARK, height: DAY_MARK }]}>
                {state === 'rest' ? (
                  <View
                    style={{
                      width: REST_DOT,
                      height: REST_DOT,
                      borderRadius: theme.radii.pill,
                      backgroundColor: theme.colors.borderStrong,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: DAY_MARK,
                      height: DAY_MARK,
                      borderRadius: theme.radii.pill,
                      backgroundColor: state === 'done' ? theme.colors.accent : 'transparent',
                      borderWidth: state === 'today' ? TODAY_RING : RING,
                      borderColor:
                        state === 'done'
                          ? theme.colors.accentMark
                          : state === 'today'
                            ? theme.colors.text
                            : theme.colors.borderStrong,
                    }}
                  />
                )}
              </View>
            </View>
          );
          return row ? (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => onOpen(row.id)}
              style={({ pressed }) => [styles.cell, { opacity: pressed ? 0.6 : 1 }]}
            >
              {content}
            </Pressable>
          ) : (
            <View key={day} accessible accessibilityLabel={label} style={styles.cell}>
              {content}
            </View>
          );
        })}
      </TrainingBlock>
    </View>
  );
}

/** Heute im Block: Dauer rechts oben, gross der Titel, darunter die Uebungen kurz. */
function TodayBody({
  shown,
  isToday,
  statusText,
  children,
}: {
  shown: TrainingSummary;
  isToday: boolean;
  statusText: string | undefined;
  children: ReactNode;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const detail = useFit(() => fit.workout(shown.id), [shown.id], ['training']);
  const exercises = detail.data?.workout.exercises ?? [];
  const separator = t('fit6.v.shortSep');
  const names = exercises.map((exercise) => shortName(exercise.name, separator));
  const whole = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });
  const more =
    statusText ??
    (exercises.length > 0
      ? t('fit6.v.today.minutes', { minutes: whole.format(plannedMinutes(exercises)) })
      : undefined);

  return (
    <TrainingBlock label={isToday ? t('fit.day.today') : t('fit.training.next')} more={more}>
      <Text
        variant="display"
        style={{
          marginTop: theme.spacing.sm,
          fontWeight: theme.fontWeight.extrabold,
          letterSpacing: TRAINING.displayTracking,
        }}
      >
        {shown.title}
      </Text>
      {names.length > 0 ? (
        <Text
          variant="body"
          tone="faint"
          numberOfLines={2}
          style={{
            marginTop: theme.spacing.xs,
            fontSize: theme.fontSize.lede,
            lineHeight: TRAINING.line14,
            letterSpacing: theme.tracking.none,
          }}
        >
          {names.join(' · ')}
        </Text>
      ) : null}
      {children}
    </TrainingBlock>
  );
}

/**
 * Heute: das Training in grosser Schrift, darunter die Uebungen, eine
 * schwarze Pille zum Starten — und abgesetzt, was es fuers Essen heisst.
 * Gibt es heute keins, steht das naechste da, mit „Heute machen“.
 */
export function TodayPanel({
  todays,
  nextOne,
  busy,
  foodText,
  onStart,
  onDoToday,
  onFood,
}: {
  todays: TrainingSummary | null;
  nextOne: TrainingSummary | null;
  busy: boolean;
  foodText: string | null;
  onStart: (id: string) => void;
  onDoToday: (row: TrainingSummary) => void;
  onFood: () => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const shown = todays ?? nextOne;

  const food = foodText ? (
    <Pressable
      accessibilityRole="button"
      onPress={onFood}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        marginTop: theme.spacing.md,
        paddingTop: theme.spacing.md,
        borderTopWidth: TRAINING.hairline,
        borderTopColor: theme.colors.border,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text
        variant="label"
        tone="muted"
        style={[
          numeric,
          { flex: 1, lineHeight: TRAINING.line13, fontWeight: theme.fontWeight.regular },
        ]}
      >
        {foodText}
      </Text>
      <Icon name="forward" size={TRAINING.rowSize} color={theme.colors.textMuted} />
    </Pressable>
  ) : null;

  if (!shown) {
    return (
      <TrainingBlock label={t('fit.training.next')}>
        <Text variant="body" tone="muted" style={{ marginTop: theme.spacing.sm }}>
          {t('fit.training.emptyBody')}
        </Text>
        {food}
      </TrainingBlock>
    );
  }

  const statusText =
    todays && todays.status !== 'planned'
      ? t(`fit.training.status.${todays.status}` as TranslationKey)
      : !todays
        ? `${formatWeekday(language, `${shown.day}T12:00:00`)} ${formatShortDate(language, `${shown.day}T12:00:00`)}`
        : undefined;

  return (
    <TodayBody key={shown.id} shown={shown} isToday={Boolean(todays)} statusText={statusText}>
      <View style={{ marginTop: TODAY_PILL_GAP }}>
        <StartPill
          label={todays?.status === 'done' ? t('fit.training.show') : t('fit.training.start')}
          onPress={() => onStart(shown.id)}
        />
      </View>
      {!todays && nextOne ? (
        <View style={{ flexDirection: 'row', marginTop: theme.spacing.sm }}>
          <InkPill
            label={t('fit6.today.do')}
            soft
            disabled={busy}
            onPress={() => onDoToday(nextOne)}
          />
        </View>
      ) : null}
      {food}
    </TodayBody>
  );
}

/** Abstand vom Namen der Uebungen zur Pille: 14 wie im Entwurf. */
const TODAY_PILL_GAP = 14;

/** Die Hauptuebung eines Trainings, kurz: „Kreuzheben“. */
function MainExercise({ id }: { id: string }) {
  const { t } = useI18n();
  const theme = useTheme();
  const detail = useFit(() => fit.workout(id), [id], ['training']);
  const first = detail.data?.workout.exercises[0];
  if (!first) return null;
  return (
    <Text
      variant="label"
      tone="faint"
      numberOfLines={1}
      style={{ lineHeight: TRAINING.line13, fontWeight: theme.fontWeight.regular }}
    >
      {shortName(first.name, t('fit6.v.shortSep'))}
    </Text>
  );
}

/** „Fr 25.“: Wochentag ohne Punkt, dann der Tag. */
function compactDay(
  language: string,
  day: string,
  pattern: (weekday: string, day: string) => string,
) {
  const date = new Date(`${day}T12:00:00`);
  const weekday = new Intl.DateTimeFormat(`${language}-CH`, { weekday: 'short' })
    .format(date)
    .replace(/[.,]$/, '');
  const number = new Intl.DateTimeFormat(`${language}-CH`, { day: 'numeric' })
    .format(date)
    .replace(/\.$/, '');
  return pattern(weekday, number);
}

/**
 * „Als Nächstes“: eine Marke ueber dem Block, darin die naechsten zwei
 * Trainings — Datum, Name, rechts die Hauptuebung. Ein Tipp oeffnet es.
 */
export function UpcomingPanel({
  rows,
  today,
  onOpen,
}: {
  rows: readonly TrainingSummary[];
  today: string;
  onOpen: (id: string) => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  if (rows.length === 0) return null;
  const shown = rows.slice(0, UPCOMING_ROWS);

  return (
    <View style={{ gap: theme.spacing.sm, marginTop: SECTION_GAP }}>
      <Text
        variant="overline"
        tone="faint"
        numberOfLines={1}
        style={{ lineHeight: TRAINING.line11, letterSpacing: TRAINING.capsTracking }}
      >
        {t('fit6.v.upcoming')}
      </Text>
      <TrainingBlock style={{ paddingTop: theme.spacing.xs, paddingBottom: theme.spacing.xs }}>
        {shown.map((workout, index) => {
          const date = `${formatWeekday(language, `${workout.day}T12:00:00`)} ${formatShortDate(language, `${workout.day}T12:00:00`)}`;
          return (
            <Pressable
              key={workout.id}
              accessibilityRole="button"
              accessibilityLabel={t('fit6.row.a11y', {
                title: workout.title,
                day: `${date}${workout.day === today ? `, ${t('fit.day.today')}` : ''}`,
                status: t(`fit.training.status.${workout.status}` as TranslationKey),
              })}
              onPress={() => onOpen(workout.id)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
                paddingVertical: theme.spacing.md,
                borderBottomWidth: index < shown.length - 1 ? TRAINING.hairline : 0,
                borderBottomColor: theme.colors.border,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text
                variant="label"
                tone="faint"
                numberOfLines={1}
                style={{
                  width: TRAINING.dateColumn,
                  lineHeight: TRAINING.line13,
                  fontWeight: theme.fontWeight.regular,
                }}
              >
                {compactDay(language, workout.day, (weekday, day) =>
                  t('fit6.v.dateShort', { weekday, day }),
                )}
              </Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  variant="body"
                  numberOfLines={1}
                  style={{
                    fontSize: TRAINING.rowSize,
                    lineHeight: TRAINING.rowLine,
                    fontWeight: theme.fontWeight.semibold,
                    letterSpacing: theme.tracking.none,
                  }}
                >
                  {workout.title}
                </Text>
              </View>
              {workout.status === 'done' ? (
                <Icon name="checkCircle" size={theme.fontSize.lg} color={theme.colors.accentMark} />
              ) : (
                <MainExercise id={workout.id} />
              )}
            </Pressable>
          );
        })}
      </TrainingBlock>
    </View>
  );
}

/** Ueber „Als Nächstes“ 22 Luft: 8 aus dem Abstand der Liste, dazu 14. */
const SECTION_GAP = 14;

const styles = StyleSheet.create({
  week: { flexDirection: 'row' },
  cell: { flex: 1 },
  day: { alignItems: 'center' },
  mark: { alignItems: 'center', justifyContent: 'center' },
});
