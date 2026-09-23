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
  /**
   * Wohin die Vorschlaege zeigen.
   *
   * `future` (Vorgabe) ist eine **Frist**: Aufgabe, Ablaufdatum, Reise, Service
   * — heute, morgen, in einer Woche, in einem Monat.
   *
   * `past` ist ein **Messwert**: Gewicht, Blutdruck, Puls, eine Nacht Schlaf.
   * Den von morgen kann niemand kennen, also gibt es ihn auch nicht zur Wahl —
   * heute, gestern, vorgestern, und ein Datum in der Zukunft wird abgelehnt.
   */
  direction?: 'future' | 'past';
};

/** Eine Frist: heute, morgen, in einer Woche, in einem Monat. */
const FUTURE = [
  { id: 'today', days: 0 },
  { id: 'tomorrow', days: 1 },
  { id: 'week', days: 7 },
  { id: 'month', days: 30 },
] as const;

/** Ein Messwert: heute, gestern, vorgestern. Weiter zurueck ueber das Feld. */
const PAST = [
  { id: 'today', days: 0 },
  { id: 'yesterday', days: -1 },
  { id: 'before', days: -2 },
] as const;

/**
 * Ein Tag in einem Tipp: ein paar Vorschlaege als Chips, dahinter ein Feld
 * fuer jedes andere Datum. Kein Kalenderrad — das braucht auf dem Handy mehr
 * Tipps als eine kurze Zahl.
 */
export function DayPicker({
  value,
  onChange,
  allowNone = true,
  label,
  direction = 'future',
}: DayPickerProps) {
  const { t, language } = useI18n();
  const theme = useTheme();

  const [custom, setCustom] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<'format' | 'future' | null>(null);

  const presets = (direction === 'past' ? PAST : FUTURE).map((preset) => ({
    ...preset,
    key: shiftDay(preset.days),
  }));
  const isPreset = presets.some((preset) => preset.key === value);
  const customActive = custom || (value !== null && !isPreset);

  function pickText(input: string) {
    setText(input);
    const parsed = parseDateValue(input);
    if (!parsed) {
      setError(input.trim().length > 0 ? 'format' : null);
      return;
    }
    // Ein Messwert von morgen gibt es nicht — das Feld sagt es, statt still
    // einen Tag zu speichern, an dem noch nichts passiert ist.
    if (direction === 'past' && dayKey(parsed) > shiftDay(0)) {
      setError('future');
      return;
    }
    setError(null);
    onChange(dayKey(parsed));
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
          {...(error ? { error: t(error === 'future' ? 'day.errorFuture' : 'day.error') } : {})}
        />
      ) : null}
    </View>
  );
}
