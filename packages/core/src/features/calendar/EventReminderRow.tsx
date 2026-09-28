import { StyleSheet, View } from 'react-native';

import { useTranslate, type Translate } from '@/i18n';
import { useTheme } from '@/theme';
import { Chip, Text } from '@/ui';
import { canPushReminders } from '@/features/tasks/pushReminders';

import {
  ALL_DAY_REMINDER_CHOICES,
  EVENT_REMINDER_CHOICES,
  EVENT_REMINDER_DAY_BEFORE,
  type EventReminderChoice,
} from './reminders';

function choiceLabel(t: Translate, choice: EventReminderChoice, allDay: boolean): string {
  if (choice === null) return t('orgplus.reminder.none');
  if (choice === EVENT_REMINDER_DAY_BEFORE) return t('orgplus.reminder.dayBefore');
  if (choice === 0) return allDay ? t('orgplus.reminder.onDay') : t('orgplus.reminder.atStart');
  if (choice === 60) return t('orgplus.reminder.hour');
  return t('orgplus.reminder.minutes', { count: choice });
}

/**
 * „Erinnerung“ im Termin-Editor: Keine · Zur Zeit · 10 Min · 1 Std · Am
 * Vortag; ganztägig nur Keine · Am Tag · Am Vortag. Im Browser sagt eine Zeile
 * ehrlich, dass die Mitteilung in der Handy-App kommt.
 */
export function EventReminderRow({
  value,
  allDay,
  onChange,
}: {
  value: number | null;
  allDay: boolean;
  onChange: (minutes: number | null) => void;
}) {
  const t = useTranslate();
  const theme = useTheme();
  const choices: readonly EventReminderChoice[] = allDay
    ? ALL_DAY_REMINDER_CHOICES
    : EVENT_REMINDER_CHOICES;
  // Ganztaegig zaehlen 10 Min und 1 Std wie der Vortag (`eventReminderInstant`).
  const shown =
    allDay && value !== null && value !== 0 ? EVENT_REMINDER_DAY_BEFORE : value;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="label" tone="muted">
        {t('orgplus.reminder.label')}
      </Text>
      <View style={[styles.row, { gap: theme.spacing.sm }]}>
        {choices.map((choice) => (
          <Chip
            key={String(choice)}
            label={choiceLabel(t, choice, allDay)}
            selected={shown === choice}
            onPress={() => onChange(choice)}
          />
        ))}
      </View>
      {!canPushReminders && value !== null ? (
        <Text variant="caption" tone="faint">
          {t('orgplus.reminder.webOnly')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
});
