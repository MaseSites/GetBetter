import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Icon, Input, Text, type IconName } from '@/ui';
import { dayLabel } from '@/features/tasks/labels';

import { parseEventInput, quickPatch, type ParsedEvent, type QuickPatch } from './parseEvent';

function todayKey(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * „Schnell eintragen“ oben im Termin-Editor: ein Satz, und Titel, Datum,
 * Von/Bis und Ort füllen sich darunter (`parseEventInput`, getestet). Was
 * erkannt ist, steht als Chip darunter; die Felder bleiben änderbar.
 */
export function QuickEventField({ onPatch }: { onPatch: (patch: QuickPatch) => void }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const [now] = useState(() => new Date());
  const [text, setText] = useState('');
  const parsed = parseEventInput(text, now);

  function change(value: string) {
    onPatch(quickPatch(parsed, parseEventInput(value, now)));
    setText(value);
  }

  const chips = chipsOf(parsed, (day) => dayLabel(t, language, day, todayKey(now)), {
    allDay: t('calendar.field.allDay'),
    span: (from, to) => t('orgplus.quick.span', { from, to }),
  });

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Input
        label={t('orgplus.quick.label')}
        placeholder={t('orgplus.quick.placeholder')}
        icon="sparkles"
        value={text}
        onChangeText={change}
        autoCapitalize="sentences"
        returnKeyType="done"
      />
      {chips.length > 0 ? (
        <View
          accessible
          accessibilityLabel={`${t('orgplus.quick.found')}: ${chips.map((chip) => chip.label).join(', ')}`}
          style={[styles.row, { gap: theme.spacing.sm }]}
        >
          {chips.map((chip) => (
            <View
              key={chip.key}
              style={[
                styles.chip,
                {
                  gap: theme.spacing.xs,
                  borderRadius: theme.radii.pill,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.xs,
                  backgroundColor: theme.colors.accentSoft,
                },
              ]}
            >
              <Icon name={chip.icon} size={14} color={theme.colors.accentStrong} />
              <Text variant="label" numberOfLines={1} style={{ color: theme.colors.accentStrong }}>
                {chip.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

type QuickChip = { key: string; icon: IconName; label: string };

function chipsOf(
  parsed: ParsedEvent,
  day: (key: string) => string,
  words: { allDay: string; span: (from: string, to: string) => string },
): QuickChip[] {
  const list: QuickChip[] = [];
  if (parsed.day) list.push({ key: 'day', icon: 'calendar', label: day(parsed.day) });
  if (parsed.allDay) list.push({ key: 'allDay', icon: 'sun', label: words.allDay });
  if (parsed.start) {
    list.push({
      key: 'time',
      icon: 'clock',
      label: parsed.end ? words.span(parsed.start, parsed.end) : parsed.start,
    });
  }
  if (parsed.location) list.push({ key: 'place', icon: 'location', label: parsed.location });
  return list;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', maxWidth: '100%' },
});
