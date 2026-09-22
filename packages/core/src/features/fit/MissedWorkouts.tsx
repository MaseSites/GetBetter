import { StyleSheet, View } from 'react-native';

import type { TrainingSummary } from '@/db/fitTraining';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Panel, Text } from '@/ui';

import { InkPill } from './TrainingParts';

const MARK = 3;

/**
 * Verpasste Trainings der letzten zwei Wochen: geplant, aber vorbei. Je Zeile
 * zwei Wege — heute nachholen oder auslassen (mit Rückgängig). Die Zeile selbst
 * ist nicht drückbar, sie trägt die Knöpfe. Ein roter Strich markiert, was fällig war.
 */
export function MissedWorkouts({
  missed,
  busy,
  dayText,
  onCatchUp,
  onSkip,
}: {
  missed: readonly TrainingSummary[];
  busy: boolean;
  dayText: (day: string) => string;
  onCatchUp: (row: TrainingSummary) => void;
  onSkip: (row: TrainingSummary) => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  if (missed.length === 0) return null;

  return (
    <Panel label={t('fit6.missed.title')} more={String(missed.length)}>
      {missed.slice(0, 3).map((row, index) => (
        <View
          key={row.id}
          style={{
            gap: theme.spacing.md,
            paddingVertical: theme.spacing.md,
            borderTopWidth: index > 0 ? StyleSheet.hairlineWidth : 0,
            borderTopColor: theme.colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <View
              style={{
                width: MARK,
                borderRadius: theme.radii.pill,
                backgroundColor: theme.colors.danger,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text variant="body" style={{ fontWeight: theme.fontWeight.semibold }}>
                {row.title}
              </Text>
              <Text variant="label" tone="muted">
                {dayText(row.day)}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <InkPill
              label={t('fit6.missed.catchUp')}
              icon="play"
              disabled={busy}
              onPress={() => onCatchUp(row)}
            />
            <InkPill
              label={t('fit6.missed.skip')}
              soft
              disabled={busy}
              onPress={() => onSkip(row)}
            />
          </View>
        </View>
      ))}
    </Panel>
  );
}
