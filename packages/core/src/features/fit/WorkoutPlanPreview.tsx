import { StyleSheet, View } from 'react-native';

import type { FitAction } from '@/db/fit';
import { formatWeekday, useI18n, type Language } from '@/i18n';
import { numeric, useTheme } from '@/theme';
import { Panel, Text } from '@/ui';

type SessionDetail = { title: string; exercises: { name: string; sets: number; reps: string }[] };

/** Montag zuerst; 0 ist Sonntag. Ein fester Tag im September 2026, der Montag der 21. */
export const weekdayLabel = (language: Language, weekday: number) =>
  formatWeekday(
    language,
    `2026-09-${String(20 + (weekday === 0 ? 7 : weekday)).padStart(2, '0')}T12:00:00`,
  );

/**
 * Was ein vorgeschlagener Trainingsplan bringt: an welchen Tagen, welche
 * Einheiten und in jeder die Uebungen mit Saetzen × Wiederholungen — damit
 * vor dem Bestaetigen klar ist, was kommt.
 */
export function WorkoutPlanPreview({ action }: { action: FitAction }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const summary = action.preview.summary;
  const sessions = (summary.sessionDetails as SessionDetail[] | undefined) ?? [];
  const weekdays = (summary.weekdays as number[] | undefined) ?? [];

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="display" style={{ fontWeight: theme.fontWeight.extrabold }}>
          {String(summary.template ?? '')}
        </Text>
        <Text variant="body" tone="muted">
          {weekdays.map((day) => weekdayLabel(language, day)).join(' · ')}
        </Text>
      </View>
      {sessions.map((session) => (
        <Panel key={session.title} label={session.title}>
          <View style={{ marginTop: theme.spacing.xs }}>
            {session.exercises.map((exercise, index) => (
              <View
                key={`${exercise.name}-${index}`}
                style={{
                  flexDirection: 'row',
                  gap: theme.spacing.sm,
                  paddingVertical: theme.spacing.sm,
                  borderTopWidth: index > 0 ? StyleSheet.hairlineWidth : 0,
                  borderTopColor: theme.colors.border,
                }}
              >
                <Text variant="body" style={{ flex: 1 }}>
                  {exercise.name}
                </Text>
                <Text variant="label" tone="muted" style={numeric}>
                  {t('fit.plan.setsReps', { sets: exercise.sets, reps: exercise.reps })}
                </Text>
              </View>
            ))}
          </View>
        </Panel>
      ))}
    </View>
  );
}
