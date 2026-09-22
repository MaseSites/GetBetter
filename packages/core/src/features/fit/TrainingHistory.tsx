import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { fit } from '@/db/fit';
import { formatMonth, formatShortDate, formatWeekday, useI18n, type TranslationKey } from '@/i18n';
import { numeric, useTheme } from '@/theme';
import { EmptyState, Icon, IconButton, Panel, Text } from '@/ui';

import { FitState } from './FitGate';
import { formatsOf, monthEnd, shiftMonth } from './trainingText';
import { useFit } from './useFit';

/**
 * Der Verlauf eines Monats: die erledigten Trainings als Liste, das Neueste
 * oben; ein Tipp oeffnet eines zum Ansehen. Wie oft trainiert wurde, zeigt
 * das Raster „Dein Rhythmus“ — hier steht, was es war.
 */
export function TrainingHistory({
  today,
  onOpen,
}: {
  today: string;
  onOpen: (workoutId: string) => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const formats = formatsOf(language);
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const data = useFit(() => fit.workouts(`${month}-01`, monthEnd(month)), [month], ['training']);
  const done = (data.data?.workouts ?? []).filter((row) => row.status === 'done');
  const thisMonth = today.slice(0, 7);

  return (
    <Panel label={t('fit6.history.title')}>
      <View style={[styles.row, { gap: theme.spacing.xs, marginTop: theme.spacing.xs }]}>
        <Text
          variant="body"
          numberOfLines={1}
          style={{ flex: 1, fontWeight: theme.fontWeight.semibold }}
        >
          {formatMonth(language, new Date(`${month}-15T12:00:00`))}
        </Text>
        <IconButton
          icon="back"
          label={t('fit6.history.prev')}
          onPress={() => setMonth(shiftMonth(month, -1))}
        />
        {month < thisMonth ? (
          <IconButton
            icon="forward"
            label={t('fit6.history.next')}
            onPress={() => setMonth(shiftMonth(month, 1))}
          />
        ) : null}
      </View>

      <FitState loading={data.loading} error={data.error} onRetry={data.reload}>
        {done.length === 0 ? (
          <EmptyState compact title={t('fit6.history.empty')} body={t('fit6.history.emptyBody')} />
        ) : (
          <View>
            {[...done].reverse().map((row, index) => {
              const date = `${formatWeekday(language, `${row.day}T12:00:00`)} ${formatShortDate(language, `${row.day}T12:00:00`)}`;
              const sets =
                row.sets === 1
                  ? t('fit6.history.setsOne')
                  : t('fit6.history.sets', { count: formats.whole.format(row.sets) });
              return (
                <Pressable
                  key={row.id}
                  accessibilityRole="button"
                  accessibilityLabel={t('fit6.row.a11y', {
                    title: row.title,
                    day: date,
                    status: t(`fit.training.status.${row.status}` as TranslationKey),
                  })}
                  onPress={() => onOpen(row.id)}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      gap: theme.spacing.md,
                      paddingVertical: theme.spacing.md,
                      borderTopWidth: index > 0 ? StyleSheet.hairlineWidth : 0,
                      borderTopColor: theme.colors.border,
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      variant="body"
                      numberOfLines={1}
                      style={{ fontWeight: theme.fontWeight.semibold }}
                    >
                      {row.title}
                    </Text>
                    <Text variant="label" tone="muted" style={numeric}>
                      {`${date} · ${sets}`}
                    </Text>
                  </View>
                  <Icon
                    name="checkCircle"
                    size={theme.fontSize.lg}
                    color={theme.colors.accentMark}
                  />
                  <Icon name="forward" size={theme.fontSize.md} color={theme.colors.textFaint} />
                </Pressable>
              );
            })}
          </View>
        )}
      </FitState>
    </Panel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
