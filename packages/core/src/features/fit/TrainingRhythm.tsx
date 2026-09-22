import { StyleSheet, View } from 'react-native';

import { fit } from '@/db/fit';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Text } from '@/ui';

import { TrainingBlock } from './TrainingParts';
import { formatsOf } from './trainingText';
import { TRAINING } from './trainingType';
import { useFit } from './useFit';
import { mondayOf } from './TrainingWeek';
import { shiftDay } from './zurichDay';

const WEEKS = 8;
/** Zwei Wochen je Reihe: 14 Spalten, vier Reihen. */
const COLUMNS = 14;
const CELL_GAP = 4;
const CELL_RADIUS = 4;
/** Unter dem Raster bis zum Satz: 10. */
const BODY_GAP = 10;

/** Wie viele Wochen am Stueck mit Training — die laufende zaehlt erst, wenn sie eins hat. */
export function weekStreak(weeks: readonly number[]): number {
  const list = [...weeks];
  if ((list.at(-1) ?? 0) === 0) list.pop();
  let count = 0;
  for (let index = list.length - 1; index >= 0 && (list[index] ?? 0) > 0; index -= 1) count += 1;
  return count;
}

/**
 * Der Rhythmus der letzten acht Wochen als Punkteraster, jeder Tag ein
 * Feld: Tinte heisst trainiert, Signal heute trainiert, die Senke nichts.
 * Darunter ein Satz, der erklaert: Ruhetage sind ein Zustand, keine Luecke.
 */
export function RhythmPanel({ today }: { today: string }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const formats = formatsOf(language);
  const start = shiftDay(mondayOf(today), -(WEEKS - 1) * 7);
  const data = useFit(() => fit.workouts(start, today), [start, today], ['training']);
  if (!data.data) return null;

  const done = new Set(
    data.data.workouts.filter((row) => row.status === 'done').map((row) => row.day),
  );
  const days = Array.from({ length: WEEKS * 7 }, (_, index) => shiftDay(start, index));
  const total = days.filter((day) => done.has(day)).length;
  const perWeek = Array.from(
    { length: WEEKS },
    (_, week) => days.slice(week * 7, week * 7 + 7).filter((day) => done.has(day)).length,
  );
  const streak = weekStreak(perWeek);
  const workouts =
    total === 1
      ? t('fit.count.workoutOne')
      : t('fit.count.workouts', { count: formats.whole.format(total) });
  const rows = Array.from({ length: days.length / COLUMNS }, (_, row) =>
    days.slice(row * COLUMNS, row * COLUMNS + COLUMNS),
  );

  return (
    <TrainingBlock label={t('fit6.v.rhythm.title')} more={t('fit6.v.rhythm.more', { workouts })}>
      <View
        accessible
        accessibilityLabel={t('fit6.v.rhythm.a11y', { workouts })}
        style={{ gap: CELL_GAP, marginTop: theme.spacing.md }}
      >
        {rows.map((row) => (
          <View key={row[0]} style={[styles.row, { gap: CELL_GAP }]}>
            {row.map((day) => (
              <View
                key={day}
                style={{
                  flex: 1,
                  aspectRatio: 1,
                  borderRadius: CELL_RADIUS,
                  // Tinte heisst trainiert, Signal heute trainiert, sonst die Senke.
                  backgroundColor: done.has(day)
                    ? day === today
                      ? theme.colors.accent
                      : theme.colors.text
                    : theme.colors.surfaceMuted,
                }}
              />
            ))}
          </View>
        ))}
      </View>
      <Text
        variant="label"
        tone="faint"
        style={{
          marginTop: BODY_GAP,
          lineHeight: TRAINING.line13,
          fontWeight: theme.fontWeight.regular,
        }}
      >
        {streak >= 2
          ? t('fit6.v.rhythm.streak', { count: formats.whole.format(streak) })
          : t('fit6.v.rhythm.body')}
      </Text>
    </TrainingBlock>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
