import { useState } from 'react';
import { View } from 'react-native';

import { dayKey } from '@/db';
import { formatDateValue, parseDateValue } from '@/features/calendar/dates';
import { formatShortDate, useI18n, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import { Chip, Input, Text } from '@/ui';

import { parseDay, shiftDay } from './days';

export type DayPickerProps = {
  /** `YYYY-MM-DD` oder null fuer "kein Datum". */
  value: string | null;
  onChange: (day: string | null) => void;
  /** Ob "Keins" zur Wahl steht. */
  allowNone?: boolean;
  label?: string;
};

/** Die Vorschlaege: heute, morgen, in einer Woche, in einem Monat. */
const PRESETS = [
  { id: 'today', days: 0 },
  { id: 'tomorrow', days: 1 },
  { id: 'week', days: 7 },
  { id: 'month', days: 30 },
] as const;

/**
 * Ein Tag in einem Tipp: ein paar Vorschlaege als Chips, dahinter ein Feld
 * fuer jedes andere Datum. Kein Kalenderrad — das braucht auf dem Handy mehr
 * Tipps als eine kurze Zahl.
 */
export function DayPicker({ value, onChange, allowNone = true, label }: DayPickerProps) {
  const { t, language } = useI18n();
  const theme = useTheme();

  const [custom, setCustom] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState(false);

  const presets = PRESETS.map((preset) => ({ ...preset, key: shiftDay(preset.days) }));
  const isPreset = presets.some((preset) => preset.key === value);
  const customActive = custom || (value !== null && !isPreset);

  function pickText(input: string) {
    setText(input);
    const parsed = parseDateValue(input);
    if (parsed) {
      setError(false);
      onChange(dayKey(parsed));
      return;
    }
    setError(input.trim().length > 0);
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {label ? (
        <Text variant="label" tone="muted">
          {label}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {allowNone ? (
          <Chip
            label={t('day.none')}
            selected={value === null && !custom}
            onPress={() => {
              setCustom(false);
              onChange(null);
            }}
          />
        ) : null}
        {presets.map((preset) => (
          <Chip
            key={preset.id}
            label={t(`day.preset.${preset.id}` as TranslationKey)}
            selected={value === preset.key && !custom}
            onPress={() => {
              setCustom(false);
              onChange(preset.key);
            }}
          />
        ))}
        <Chip
          label={
            customActive && value
              ? formatShortDate(language, parseDay(value).toISOString())
              : t('day.pick')
          }
          selected={customActive}
          onPress={() => {
            setCustom(true);
            setText(value ? formatDateValue(parseDay(value)) : '');
          }}
        />
      </View>
      {custom ? (
        <Input
          placeholder={t('day.placeholder')}
          value={text}
          onChangeText={pickText}
          keyboardType="numbers-and-punctuation"
          accessibilityLabel={t('day.pick')}
          {...(error ? { error: t('day.error') } : {})}
        />
      ) : null}
    </View>
  );
}
