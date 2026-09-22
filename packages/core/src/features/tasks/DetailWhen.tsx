import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { tasks as taskRepo, type TaskRepeat, type TaskRepeatUnit, type TaskRow } from '@/db';
import { dueDayOf } from '@/db/taskFields';
import type { TaskPatch } from '@/db/tasks';
import { DayPicker } from '@/features/shared/DayPicker';
import { useI18n, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import { Chip, HIT_TARGET, Text, Toggle } from '@/ui';

import { weekdayOf } from './days';
import { ChipRow, FieldRow, TimeField } from './fields';
import { dayLabel, reminderLabel, repeatLabel, weekdayName } from './labels';
import { weekdaysOf } from './recurrence';
import { dayBeforeOffset, REMINDER_OFFSETS, schedulePatch } from './schedule';

type Open = 'date' | 'time' | 'reminder' | 'repeat' | null;

const UNITS: readonly (TaskRepeatUnit | null)[] = [null, 'day', 'week', 'month', 'year'];

const UNIT_LABELS: Record<TaskRepeatUnit | 'never', TranslationKey> = {
  never: 'tasks.repeat.never',
  day: 'tasks.repeat.daily',
  week: 'tasks.repeat.weekly',
  month: 'tasks.repeat.monthly',
  year: 'tasks.repeat.yearly',
};

const WEEK = [1, 2, 3, 4, 5, 6, 7] as const;

function RepeatEditor({
  repeat,
  day,
  onChange,
}: {
  repeat: TaskRepeat | null;
  day: string;
  onChange: (repeat: TaskRepeat | null) => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const weekdays = repeat ? weekdaysOf(repeat) : [];

  function chooseUnit(unit: TaskRepeatUnit | null) {
    if (unit === null) {
      onChange(null);
      return;
    }
    const base = {
      every: repeat?.unit === unit ? repeat.every : 1,
      unit,
      fromCompletion: repeat?.fromCompletion ?? false,
    };
    onChange(unit === 'week' ? { ...base, weekdays: [weekdayOf(day)] } : base);
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      <ChipRow>
        {UNITS.map((unit) => (
          <Chip
            key={unit ?? 'never'}
            label={t(UNIT_LABELS[unit ?? 'never'])}
            selected={(repeat?.unit ?? null) === unit}
            onPress={() => chooseUnit(unit)}
          />
        ))}
      </ChipRow>
      {repeat ? (
        <>
          <ChipRow>
            <Chip
              label={t('tasks.repeat.more')}
              disabled={repeat.every <= 1}
              onPress={() => onChange({ ...repeat, every: Math.max(1, repeat.every - 1) })}
            />
            <Chip
              label={t('tasks.repeat.fewer')}
              onPress={() => onChange({ ...repeat, every: repeat.every + 1 })}
            />
          </ChipRow>
          {repeat.unit === 'week' ? (
            <ChipRow>
              {WEEK.map((weekday) => {
                const selected = weekdays.includes(weekday);
                return (
                  <Chip
                    key={weekday}
                    label={weekdayName(language, weekday, false)}
                    selected={selected}
                    onPress={() => {
                      const next = selected
                        ? weekdays.filter((entry) => entry !== weekday)
                        : [...weekdays, weekday].sort((a, b) => a - b);
                      if (next.length > 0) onChange({ ...repeat, weekdays: next });
                    }}
                  />
                );
              })}
            </ChipRow>
          ) : null}
          <View style={[styles.switchRow, { gap: theme.spacing.md }]}>
            <Text variant="body" style={styles.grow}>
              {t('tasks.repeat.fromCompletion')}
            </Text>
            <Toggle
              accessibilityLabel={t('tasks.repeat.fromCompletion')}
              value={repeat.fromCompletion}
              onValueChange={(fromCompletion) => onChange({ ...repeat, fromCompletion })}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}

/**
 * „Wann“ im Blatt: Datum. Uhrzeit, Erinnerung und Wiederholen erscheinen erst,
 * wenn ein Datum gesetzt ist. Jede Wahl gilt sofort.
 */
export function DetailWhen({ task, today }: { task: TaskRow; today: string }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const [open, setOpen] = useState<Open>(null);

  const day = dueDayOf(task);
  const time = day !== null ? (task.dueTime ?? null) : null;
  const toggle = (key: Exclude<Open, null>) => setOpen((current) => (current === key ? null : key));
  const update = (patch: TaskPatch) => void taskRepo.update(task.id, patch);
  const reminders: (number | null)[] =
    time === null ? [] : [null, ...REMINDER_OFFSETS, dayBeforeOffset(time)];

  return (
    <View>
      <FieldRow
        separator={false}
        icon="calendar"
        label={t('tasks.field.date')}
        value={day ? dayLabel(t, language, day, today) : t('tasks.plan.none')}
        valueTone={day !== null && day < today && !task.done ? 'danger' : 'muted'}
        expanded={open === 'date'}
        onPress={() => toggle('date')}
      >
        <DayPicker
          value={day}
          onChange={(next) => update(schedulePatch(task, { day: next, time }))}
        />
      </FieldRow>

      {day !== null ? (
        <>
          <FieldRow
            icon="clock"
            label={t('tasks.field.time')}
            value={time ?? t('tasks.time.none')}
            expanded={open === 'time'}
            onPress={() => toggle('time')}
          >
            <TimeField
              value={time}
              onChange={(next) => update(schedulePatch(task, { day, time: next }))}
            />
          </FieldRow>

          <FieldRow
            icon="bell"
            label={t('tasks.field.reminder')}
            value={reminderLabel(t, task.reminderOffsetMinutes, time)}
            expanded={open === 'reminder' && time !== null}
            onPress={() => toggle('reminder')}
          >
            <ChipRow>
              {reminders.map((minutes) => (
                <Chip
                  key={String(minutes)}
                  label={reminderLabel(t, minutes, time)}
                  selected={(task.reminderOffsetMinutes ?? null) === minutes}
                  onPress={() => update({ reminderOffsetMinutes: minutes })}
                />
              ))}
            </ChipRow>
          </FieldRow>
          <Text
            variant="caption"
            tone="faint"
            style={{ paddingLeft: HIT_TARGET, paddingBottom: theme.spacing.sm }}
          >
            {t('tasks.reminder.pending')}
          </Text>

          <FieldRow
            icon="repeat"
            label={t('tasks.field.repeat')}
            value={task.repeat ? repeatLabel(t, language, task.repeat) : t('tasks.repeat.never')}
            expanded={open === 'repeat'}
            onPress={() => toggle('repeat')}
          >
            <RepeatEditor
              repeat={task.repeat ?? null}
              day={day}
              onChange={(repeat) => update({ repeat })}
            />
          </FieldRow>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
});
