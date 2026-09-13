import { useState } from 'react';
import { View } from 'react-native';

import { DayPicker } from '@/features/shared/DayPicker';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Sheet, Text } from '@/ui';

import { TimeField } from './fields';
import type { Schedule } from './schedule';

export type DateRequest = {
  /** Neu je Anfrage — das Blatt beginnt dann mit frischen Werten. */
  id: number;
  day: string | null;
  time: string | null;
  onApply: (schedule: Schedule) => void;
};

/**
 * „Datum wählen …“: Tag und Uhrzeit. Kein „Fertig“ — Schliessen uebernimmt,
 * was gewaehlt ist.
 */
export function DateSheet({ request, onClose }: { request: DateRequest; onClose: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const [day, setDay] = useState(request.day);
  const [time, setTime] = useState(request.time);

  function close() {
    const nextTime = day === null ? null : time;
    if (day !== request.day || nextTime !== request.time) request.onApply({ day, time: nextTime });
    onClose();
  }

  return (
    <Sheet visible onClose={close} title={t('tasks.plan.sheetTitle')}>
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
        <DayPicker value={day} onChange={setDay} />
        {day !== null ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="label" tone="muted">
              {t('tasks.field.time')}
            </Text>
            <TimeField value={time} onChange={setTime} />
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}
