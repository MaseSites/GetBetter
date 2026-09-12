import { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import type { AlarmRow } from '@/db';
import { alarms as alarmRepo } from '@/db/repositories';
import { useTranslate, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import { Chip, Icon, Sheet, Text, Wheel, WheelFrame } from '@/ui';

export const WEEKDAYS = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Die Klingeltoene — Namen, kein Klang: der Prototyp weckt nicht wirklich. */
export const ALARM_SOUNDS = ['radial', 'morning', 'soft', 'classic', 'beacon'] as const;
const SNOOZE_MINUTES = [5, 9, 10, 15, 20] as const;
const WORKDAYS: readonly Weekday[] = ['mo', 'di', 'mi', 'do', 'fr'];
const WEEKEND: readonly Weekday[] = ['sa', 'so'];

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);

const pad = (value: number) => String(value).padStart(2, '0');

function sameDays(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && b.every((day) => a.includes(day));
}

/** "Nie", "Täglich", "Werktags", "Jeden Dienstag" oder "Mo, Mi, Fr". */
export function repeatLabel(
  t: (key: TranslationKey, values?: Record<string, string | number>) => string,
  days: readonly string[],
): string {
  if (days.length === 0) return t('alarm.repeat.never');
  if (days.length === WEEKDAYS.length) return t('alarm.repeat.daily');
  if (sameDays(days, WORKDAYS)) return t('alarm.repeat.weekdays');
  if (sameDays(days, WEEKEND)) return t('alarm.repeat.weekend');
  const ordered = WEEKDAYS.filter((day) => days.includes(day));
  if (ordered.length === 1) {
    return t('alarm.repeat.every', { day: t(`alarm.dayLong.${ordered[0]}` as TranslationKey) });
  }
  return ordered.map((day) => t(`alarm.day.${day}` as TranslationKey)).join(', ');
}

export type AlarmEditorProps = {
  visible: boolean;
  accountId: string;
  /** Ein bestehender Wecker zum Bearbeiten — oder null fuer einen neuen. */
  alarm: AlarmRow | null;
  onClose: () => void;
};

/**
 * Der Wecker wie auf dem Telefon: oben Schliessen und Haken, in der Mitte das
 * Rad fuer die Uhrzeit, darunter die Zeilen fuer alles andere. Wer den Editor
 * mit `key` je Wecker einhaengt, bekommt frische Felder.
 */
export function AlarmEditor({ visible, accountId, alarm, onClose }: AlarmEditorProps) {
  const t = useTranslate();
  const theme = useTheme();

  const [initialHour, initialMinute] = (alarm?.time ?? '07:00').split(':').map(Number);
  const [hour, setHour] = useState(initialHour ?? 7);
  const [minute, setMinute] = useState(initialMinute ?? 0);
  const [days, setDays] = useState<readonly Weekday[]>(
    (alarm?.days ?? []).filter((day): day is Weekday =>
      (WEEKDAYS as readonly string[]).includes(day),
    ),
  );
  const [label, setLabel] = useState(alarm?.label ?? '');
  const [sound, setSound] = useState<string>(alarm?.sound ?? ALARM_SOUNDS[0]);
  const [snooze, setSnooze] = useState(alarm?.snooze ?? true);
  const [snoozeMinutes, setSnoozeMinutes] = useState<number>(alarm?.snoozeMinutes ?? 9);
  const [open, setOpen] = useState<'repeat' | 'sound' | null>(null);

  function toggleDay(day: Weekday) {
    setDays((current) =>
      current.includes(day) ? current.filter((entry) => entry !== day) : [...current, day],
    );
  }

  function nextSnooze() {
    const index = SNOOZE_MINUTES.indexOf(snoozeMinutes as (typeof SNOOZE_MINUTES)[number]);
    setSnoozeMinutes(SNOOZE_MINUTES[(index + 1) % SNOOZE_MINUTES.length] ?? SNOOZE_MINUTES[0]);
  }

  async function save() {
    const time = `${pad(hour)}:${pad(minute)}`;
    const fields = { time, label: label.trim(), days, sound, snooze, snoozeMinutes };
    if (alarm) await alarmRepo.update(alarm.id, fields);
    else await alarmRepo.create({ accountId, ...fields });
    onClose();
  }

  async function remove() {
    if (alarm) await alarmRepo.remove(alarm.id);
    onClose();
  }

  const soundLabel = (id: string) => t(`alarm.sound.${id}` as TranslationKey);

  // Schliessen links, Titel in der Mitte, der Haken rechts in Signalfarbe. Die
  // Zeile ist der Griff des Blatts: an ihr wischt man den Editor nach unten weg.
  const bar = (
    <View style={[styles.bar, { gap: theme.spacing.md }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        onPress={onClose}
        style={({ pressed }) => [
          styles.round,
          {
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.surfaceMuted,
            opacity: pressed ? 0.6 : 1,
          },
        ]}
      >
        <Icon name="close" size={20} color={theme.colors.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text variant="title" align="center">
          {alarm ? t('alarm.edit') : t('alarm.new')}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.done')}
        onPress={() => void save()}
        style={({ pressed }) => [
          styles.round,
          {
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.accent,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Icon name="check" size={22} color={theme.colors.textOnAccent} />
      </Pressable>
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose} header={bar} fullScreen>
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
        <TimeWheel hour={hour} minute={minute} onHour={setHour} onMinute={setMinute} />

        <View
          style={[
            styles.card,
            theme.elevation.card,
            { backgroundColor: theme.colors.surface, borderRadius: theme.radii.md },
          ]}
        >
          <Row
            label={t('alarm.repeat')}
            value={repeatLabel(t, days)}
            chevron
            onPress={() => setOpen((current) => (current === 'repeat' ? null : 'repeat'))}
          />
          {open === 'repeat' ? (
            <View
              style={[
                styles.chips,
                { gap: theme.spacing.xs, padding: theme.spacing.md, paddingTop: 0 },
              ]}
            >
              {WEEKDAYS.map((day) => (
                <Chip
                  key={day}
                  label={t(`alarm.day.${day}` as TranslationKey)}
                  selected={days.includes(day)}
                  onPress={() => toggleDay(day)}
                />
              ))}
            </View>
          ) : null}

          <Row label={t('alarm.description')}>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder={t('alarm.descriptionPlaceholder')}
              placeholderTextColor={theme.colors.textFaint}
              accessibilityLabel={t('alarm.description')}
              style={[
                styles.input,
                {
                  fontFamily: theme.fontFamily,
                  fontSize: theme.fontSize.md,
                  color: theme.colors.text,
                },
              ]}
            />
          </Row>

          <Row
            label={t('alarm.sound')}
            value={soundLabel(sound)}
            chevron
            onPress={() => setOpen((current) => (current === 'sound' ? null : 'sound'))}
          />
          {open === 'sound' ? (
            <View
              style={[
                styles.chips,
                { gap: theme.spacing.xs, padding: theme.spacing.md, paddingTop: 0 },
              ]}
            >
              {ALARM_SOUNDS.map((entry) => (
                <Chip
                  key={entry}
                  label={soundLabel(entry)}
                  selected={sound === entry}
                  onPress={() => setSound(entry)}
                />
              ))}
            </View>
          ) : null}

          <Row label={t('alarm.snooze')}>
            <Switch
              value={snooze}
              onValueChange={setSnooze}
              accessibilityLabel={t('alarm.snooze')}
              trackColor={{ true: theme.colors.accent, false: theme.colors.borderStrong }}
              thumbColor={theme.colors.surface}
            />
          </Row>

          {snooze ? (
            <Row
              label={t('alarm.snoozeDuration')}
              value={t('alarm.minutes', { count: snoozeMinutes })}
              accent
              onPress={nextSnooze}
            />
          ) : null}
        </View>

        {alarm ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('alarm.remove')}
            onPress={() => void remove()}
            style={({ pressed }) => [
              styles.card,
              theme.elevation.card,
              {
                alignItems: 'center',
                padding: theme.spacing.md,
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radii.md,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Text variant="label" tone="danger">
              {t('alarm.remove')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Sheet>
  );
}

/** Eine Zeile der Liste: Name links, Wert oder Bedienelement rechts. */
function Row({
  label,
  value,
  chevron = false,
  accent = false,
  onPress,
  children,
}: {
  label: string;
  value?: string;
  chevron?: boolean;
  accent?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  const body = (
    <>
      <Text variant="label" style={styles.rowLabel}>
        {label}
      </Text>
      {/* Schalter und Feld stehen rechts, wie der Wert in den anderen Zeilen. */}
      {children ? <View style={styles.rowControl}>{children}</View> : null}
      {value ? (
        <Text
          variant="label"
          tone={accent ? 'accent' : 'muted'}
          numberOfLines={1}
          style={styles.rowValue}
        >
          {value}
        </Text>
      ) : null}
      {chevron ? <Icon name="forward" size={16} color={theme.colors.textFaint} /> : null}
    </>
  );
  const style = [
    styles.row,
    {
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      minHeight: 52,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={value ? `${label}: ${value}` : label}
        onPress={onPress}
        style={({ pressed }) => [style, { opacity: pressed ? 0.6 : 1 }]}
      >
        {body}
      </Pressable>
    );
  }
  return <View style={style}>{body}</View>;
}

/** Zwei Raeder nebeneinander, dazwischen nichts — die Uhrzeit liest sich so von selbst. */
function TimeWheel({
  hour,
  minute,
  onHour,
  onMinute,
}: {
  hour: number;
  minute: number;
  onHour: (value: number) => void;
  onMinute: (value: number) => void;
}) {
  const t = useTranslate();

  // Ohne Ende: nach 59 kommt wieder 00, nach 23 wieder 00.
  return (
    <WheelFrame>
      <Wheel values={HOURS} value={hour} onChange={onHour} label={t('alarm.hours')} loop />
      <Wheel
        values={MINUTES}
        value={minute}
        onChange={onMinute}
        label={t('alarm.minutesLabel')}
        loop
      />
    </WheelFrame>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center' },
  round: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { flexShrink: 0 },
  rowControl: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  rowValue: { flex: 1, textAlign: 'right' },
  input: { flex: 1, textAlign: 'right', paddingVertical: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
