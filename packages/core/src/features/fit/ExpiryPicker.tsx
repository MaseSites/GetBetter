import { useState } from 'react';
import { View } from 'react-native';

import { DayPicker } from '@/features/shared/DayPicker';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Text } from '@/ui';

import { addDays } from './kitchenLogic';
import { WhiteChip } from './KitchenMedia';

/**
 * Haltbar bis: ohne Datum, in drei Tagen, in einer Woche oder ein Tag nach
 * Wahl — drei Chips fuer das Uebliche, dahinter der `DayPicker`.
 */
export function ExpiryPicker({
  value,
  onChange,
  today,
}: {
  value: string | null;
  onChange: (day: string | null) => void;
  today: string;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const presets = [
    { key: 'none', day: null, label: t('fit.pantry.expiry.none') },
    { key: 'days3', day: addDays(today, 3), label: t('fit.pantry.expiry.days3') },
    { key: 'week', day: addDays(today, 7), label: t('fit.pantry.expiry.week') },
  ] as const;
  const isPreset = presets.some((preset) => preset.day === value);
  const [picking, setPicking] = useState(!isPreset);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="overline" tone="faint">
        {t('fit.pantry.expiryLabel')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {presets.map((preset) => (
          <WhiteChip
            key={preset.key}
            label={preset.label}
            selected={!picking && preset.day === value}
            onPress={() => {
              setPicking(false);
              onChange(preset.day);
            }}
          >
            {preset.label}
          </WhiteChip>
        ))}
        <WhiteChip
          label={t('fit.pantry.expiry.pick')}
          selected={picking}
          onPress={() => setPicking(true)}
        >
          {t('fit.pantry.expiry.pick')}
        </WhiteChip>
      </View>
      {picking ? <DayPicker value={value} onChange={onChange} allowNone={false} /> : null}
    </View>
  );
}
