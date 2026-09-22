import { View } from 'react-native';

import { DayPicker } from '@/features/shared/DayPicker';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Chip, Sheet } from '@/ui';

import { shiftDayKey } from './slots';

/**
 * Den Tag der Ernaehrung wechseln: ein Tipp auf die Zeile unter „Heute“
 * oeffnet dieses Blatt — Tag davor, Tag danach, heute, gestern und dahinter
 * ein Feld fuer jedes andere Datum.
 */
export function DaySheet({
  day,
  today,
  onChange,
  onClose,
}: {
  day: string;
  today: string;
  onChange: (day: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const yesterday = shiftDayKey(today, -1);

  function pick(next: string) {
    onChange(next);
    onClose();
  }

  return (
    <Sheet visible onClose={onClose} title={t('fit4.day.pick')}>
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          <Chip label={t('fit.day.previous')} onPress={() => pick(shiftDayKey(day, -1))} />
          <Chip label={t('fit.day.next')} onPress={() => pick(shiftDayKey(day, 1))} />
          <Chip label={t('fit.day.today')} selected={day === today} onPress={() => pick(today)} />
          <Chip
            label={t('fit4.day.yesterday')}
            selected={day === yesterday}
            onPress={() => pick(yesterday)}
          />
        </View>
        <DayPicker
          value={day}
          allowNone={false}
          label={t('fit4.day.other')}
          onChange={(next) => {
            if (next) onChange(next);
          }}
        />
      </View>
    </Sheet>
  );
}
