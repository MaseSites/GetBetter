import { StyleSheet, View } from 'react-native';

import type { TrainingProgress } from '@/db/fitTraining';
import { useI18n, type Translate, type TranslationKey } from '@/i18n';
import { hueTint, numeric, useTheme } from '@/theme';
import { Text } from '@/ui';

import { AreaPanel } from './AreaBlocks';
import { LINE } from './KitchenKit';
import { shortExerciseNames } from './progressText';
import { GrowBar } from './TrainingParts';
import { formatsOf, weekBars } from './trainingText';
import { shiftDay, zurichDayOf } from './zurichDay';

/** Masse aus der Vision (Fortschritt.dc.html). */
const BAR_HEIGHT = 8;
const LAST_HEIGHT = 4;
const LABEL_WIDTH = 92;
const COUNT_WIDTH = 28;
const VALUE_WIDTH = 70;
const ROWS_TOP = 12;
const RECORDS_TOP = 6;
const ROW_GAP = 10;
const BAR_GAP = 3;
/** Der Name einer Uebung in der Liste: 16 px wie der Fliesstext der Vision. */
const NAME_SIZE = 16;
const NAME_LINE = 20;
const VALUE_LINE = 26;
/** So lange heisst ein Maximum „Rekord“: in der letzten Woche erreicht. */
const FRESH_DAYS = 7;
/** Auch ein einzelner Satz bleibt als Balken sichtbar. */
const MIN_SHARE = 0.04;

const GROUPS = ['legs', 'chest', 'back', 'shoulders', 'arms', 'core'];

const groupName = (t: Translate, group: string) =>
  t(`fit6.group.${GROUPS.includes(group) ? group : 'other'}` as TranslationKey);

/**
 * Die Trainingswoche (Montag bis Sonntag, nur abgeschlossene Trainings): je
 * Muskelgruppe die Arbeitssaetze als Balken in Tinte, darunter duenn und grau
 * die letzte Woche — auf derselben Skala, die Zahl rechts. Die Balken wachsen
 * beim Laden einmal, je Reihe etwas spaeter.
 */
export function WeekVolume({ week }: { week: TrainingProgress['week'] }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const formats = formatsOf(language);
  const bars = weekBars(week.groups, week.lastGroups);

  return (
    <AreaPanel
      label={t('fit6.v.sets.title')}
      more={bars.length > 0 ? t('fit6.v.sets.more') : undefined}
    >
      {bars.length > 0 ? (
        <View style={{ gap: ROW_GAP, marginTop: ROWS_TOP }}>
          {bars.map((bar, index) => (
            <View
              key={bar.group}
              accessible
              accessibilityLabel={t('fit6.week.bar', {
                group: groupName(t, bar.group),
                sets: formats.whole.format(bar.sets),
                last: formats.whole.format(bar.last),
              })}
              style={[styles.row, { gap: ROW_GAP }]}
            >
              <Text
                variant="label"
                tone="muted"
                numberOfLines={1}
                style={[small(theme), { width: LABEL_WIDTH }]}
              >
                {groupName(t, bar.group)}
              </Text>
              <View style={{ flex: 1, gap: BAR_GAP }}>
                <GrowBar
                  share={Math.max(bar.share, bar.sets > 0 ? MIN_SHARE : 0)}
                  height={BAR_HEIGHT}
                  color={theme.colors.text}
                  index={index}
                />
                <GrowBar
                  share={Math.max(bar.lastShare, bar.last > 0 ? MIN_SHARE : 0)}
                  height={LAST_HEIGHT}
                  color={theme.colors.borderStrong}
                  index={index}
                />
              </View>
              <Text
                variant="label"
                align="right"
                style={[
                  numeric,
                  small(theme),
                  { width: COUNT_WIDTH, fontWeight: theme.fontWeight.semibold },
                ]}
              >
                {formats.whole.format(bar.sets)}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text variant="label" tone="muted" style={[small(theme), { marginTop: ROWS_TOP }]}>
          {t('fit6.week.empty')}
        </Text>
      )}
    </AreaPanel>
  );
}

/** „Diese Woche 2 Trainings, 14 Sätze · letzte Woche …“ — leise unter den Blöcken. */
export function weekSummaryOf(
  t: Translate,
  language: Parameters<typeof formatsOf>[0],
  week: TrainingProgress['week'],
) {
  const formats = formatsOf(language);
  const total = (groups: TrainingProgress['week']['groups']) =>
    Object.values(groups).reduce((sum, entry) => sum + entry.sets, 0);
  // Einzahl und Mehrzahl: „1 Training, 1 Satz“, nicht „1 Trainings, 1 Sätze“.
  const workoutsText = (count: number) =>
    count === 1
      ? t('fit.count.workoutOne')
      : t('fit.count.workouts', { count: formats.whole.format(count) });
  const setsText = (count: number) =>
    count === 1
      ? t('fit6.history.setsOne')
      : t('fit6.history.sets', { count: formats.whole.format(count) });
  if (week.workouts === 0 && week.lastWorkouts === 0) return null;
  return t('fit6.week.summary', {
    workouts: workoutsText(week.workouts),
    sets: setsText(total(week.groups)),
    lastWorkouts: workoutsText(week.lastWorkouts),
    lastSets: setsText(total(week.lastGroups)),
  });
}

function small(theme: ReturnType<typeof useTheme>) {
  return {
    fontSize: theme.fontSize.sm,
    lineHeight: LINE.sm,
    fontWeight: theme.fontWeight.regular,
  } as const;
}

/** Eine Zeile: Name, Veraenderung (oder „Rekord“ in Rot), rechts die Zahl gross. */
function RecordRow({
  last,
  name,
  note,
  fresh,
  value,
  label,
}: {
  last: boolean;
  name: string;
  note: string | null;
  fresh: boolean;
  value: string;
  label: string;
}) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[
        styles.row,
        {
          gap: theme.spacing.md,
          paddingVertical: ROW_GAP,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.border,
        },
      ]}
    >
      <Text
        variant="body"
        numberOfLines={1}
        style={{
          flex: 1,
          fontSize: NAME_SIZE,
          lineHeight: NAME_LINE,
          letterSpacing: 0,
          fontWeight: theme.fontWeight.semibold,
        }}
      >
        {name}
      </Text>
      {note ? (
        <Text
          variant="label"
          tone="faint"
          numberOfLines={1}
          style={[
            numeric,
            small(theme),
            fresh
              ? { color: hueTint(theme, 'health').base, fontWeight: theme.fontWeight.semibold }
              : null,
          ]}
        >
          {note}
        </Text>
      ) : null}
      <Text
        variant="title"
        align="right"
        numberOfLines={1}
        style={[
          numeric,
          {
            width: VALUE_WIDTH,
            fontSize: theme.fontSize.stat,
            lineHeight: VALUE_LINE,
            letterSpacing: 0,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * Geschaetztes Maximum je Uebung mit Gewicht: kurzer Name, Veraenderung in
 * acht Wochen — oder „Rekord“, wenn es diese Woche erreicht wurde — und die Zahl.
 */
export function Records({ records }: { records: TrainingProgress['records'] }) {
  const { t, language } = useI18n();
  const formats = formatsOf(language);
  const weighted = records
    .filter((entry) => entry.kind === 'weight' && entry.e1rm !== null)
    .slice(0, 6);
  const names = shortExerciseNames(weighted.map((entry) => entry.name));
  const since = shiftDay(zurichDayOf(), -FRESH_DAYS);
  if (weighted.length === 0) return null;

  return (
    <AreaPanel label={t('fit6.e1rm.title')} more={t('fit6.v.e1rm.more')}>
      <View style={{ marginTop: RECORDS_TOP }}>
        {weighted.map((entry, index) => {
          const kg = formats.oneDecimal.format(entry.e1rm ?? 0);
          const change =
            entry.change !== null
              ? t('fit6.e1rm.change', { delta: formats.signed.format(entry.change) })
              : null;
          const fresh = entry.day >= since;
          return (
            <RecordRow
              key={entry.exerciseId}
              last={index === weighted.length - 1}
              name={names[index] ?? entry.name}
              fresh={fresh}
              note={
                fresh
                  ? t('fit6.set.record')
                  : entry.change !== null
                    ? `${formats.signed.format(entry.change)} ${t('fit6.unit.kg')}`
                    : null
              }
              value={formats.whole.format(entry.e1rm ?? 0)}
              label={[
                t('fit6.e1rm.a11y', { name: entry.name, kg, change: change ?? '' }),
                t('fit6.record.weight', {
                  kg: formats.kg.format(entry.weightKg ?? 0),
                  reps: formats.whole.format(entry.reps ?? 0),
                }),
                fresh ? t('fit6.set.record') : null,
              ]
                .filter(Boolean)
                .join(', ')}
            />
          );
        })}
      </View>
    </AreaPanel>
  );
}

/** Rekorde ohne Gewicht — nach Wiederholungen oder Sekunden. Steht unter den Bloecken der Vision. */
export function OtherRecords({ records }: { records: TrainingProgress['records'] }) {
  const { t, language } = useI18n();
  const formats = formatsOf(language);
  const others = records.filter((entry) => entry.kind !== 'weight').slice(0, 6);
  const names = shortExerciseNames(others.map((entry) => entry.name));
  const since = shiftDay(zurichDayOf(), -FRESH_DAYS);
  if (others.length === 0) return null;

  return (
    <AreaPanel label={t('fit6.records.title')}>
      <View style={{ marginTop: RECORDS_TOP }}>
        {others.map((entry, index) => {
          const value =
            entry.kind === 'seconds'
              ? `${formats.whole.format(entry.seconds ?? 0)} ${t('fit6.unit.seconds')}`
              : formats.whole.format(entry.reps ?? 0);
          const fresh = entry.day >= since;
          return (
            <RecordRow
              key={entry.exerciseId}
              last={index === others.length - 1}
              name={names[index] ?? entry.name}
              fresh={fresh}
              note={fresh ? t('fit6.set.record') : null}
              value={value}
              label={
                entry.kind === 'seconds'
                  ? `${entry.name}: ${t('fit6.record.seconds', { seconds: formats.whole.format(entry.seconds ?? 0) })}`
                  : `${entry.name}: ${t('fit6.record.reps', { reps: formats.whole.format(entry.reps ?? 0) })}`
              }
            />
          );
        })}
      </View>
    </AreaPanel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
