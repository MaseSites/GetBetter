import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import type { EventRow } from '@/db';
import { events as eventRepo } from '@/db/repositories';
import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Icon, Input, Sheet, Text } from '@/ui';

import {
  EVENT_COLORS,
  EVENT_COLOR_KEYS,
  colorLabelKey,
  eventColorKey,
  type EventColorKey,
} from './colors';
import {
  addDays,
  endOfDay,
  formatDateValue,
  formatTimeValue,
  parseDateValue,
  parseTime,
  startOfDay,
  withTime,
} from './dates';

export type EventDraft = {
  /** Gesetzt beim Bearbeiten, leer beim Anlegen. */
  event?: EventRow;
  day: Date;
  /** Vorgeschlagene Startzeit, wenn man in ein leeres Zeitfeld tippt. */
  hour?: number;
};

export type EventEditorProps = {
  draft: EventDraft | null;
  accountId: string;
  onClose: () => void;
};

const DURATIONS = [30, 60, 90, 120] as const;

export function EventEditor({ draft, accountId, onClose }: EventEditorProps) {
  const t = useTranslate();
  const editing = draft?.event;
  // Ein neuer Entwurf baut das Formular neu auf — kein Abgleich per Effekt.
  const draftKey =
    editing?.id ?? (draft ? `${draft.day.toISOString()}:${draft.hour ?? ''}` : 'none');

  return (
    <Sheet
      visible={draft !== null}
      onClose={onClose}
      title={editing ? t('calendar.edit') : t('calendar.add')}
      fullScreen
    >
      {draft ? (
        <EventForm key={draftKey} draft={draft} accountId={accountId} onClose={onClose} />
      ) : null}
    </Sheet>
  );
}

type EventFormProps = { draft: EventDraft; accountId: string; onClose: () => void };

function EventForm({ draft, accountId, onClose }: EventFormProps) {
  const t = useTranslate();
  const theme = useTheme();

  const editing = draft.event;
  const initialStart = editing ? new Date(editing.startsAt) : null;
  const initialHour = draft.hour ?? 9;

  const [title, setTitle] = useState(editing?.title ?? '');
  const [allDay, setAllDay] = useState(editing?.allDay ?? false);
  const [dateText, setDateText] = useState(formatDateValue(initialStart ?? draft.day));
  const [startText, setStartText] = useState(
    initialStart ? formatTimeValue(initialStart) : `${String(initialHour).padStart(2, '0')}:00`,
  );
  const [endText, setEndText] = useState(() => {
    if (editing?.endsAt) return formatTimeValue(new Date(editing.endsAt));
    if (initialStart) return formatTimeValue(new Date(initialStart.getTime() + 3600_000));
    return `${String(Math.min(initialHour + 1, 23)).padStart(2, '0')}:00`;
  });
  const [location, setLocation] = useState(editing?.location ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [color, setColor] = useState<EventColorKey>(eventColorKey(editing?.color));
  const [error, setError] = useState<{ field: 'title' | 'date' | 'time'; message: string } | null>(
    null,
  );

  function applyDuration(minutes: number) {
    const start = parseTime(startText);
    if (!start) return;
    const end = new Date(0);
    end.setHours(start.hour, start.minute + minutes, 0, 0);
    setEndText(formatTimeValue(end));
    setError(null);
  }

  async function save() {
    if (title.trim().length === 0) {
      setError({ field: 'title', message: t('calendar.error.title') });
      return;
    }
    const day = parseDateValue(dateText);
    if (!day) {
      setError({ field: 'date', message: t('calendar.error.date') });
      return;
    }

    let startsAt: string;
    let endsAt: string | null;

    if (allDay) {
      startsAt = startOfDay(day).toISOString();
      endsAt = endOfDay(day).toISOString();
    } else {
      const start = parseTime(startText);
      const end = parseTime(endText);
      if (!start || !end) {
        setError({ field: 'time', message: t('calendar.error.time') });
        return;
      }
      const startDate = withTime(day, start.hour, start.minute);
      let endDate = withTime(day, end.hour, end.minute);
      // Bis Mitternacht oder darueber hinaus: auf das Tagesende begrenzen.
      if (endDate <= startDate) endDate = endOfDay(day);
      startsAt = startDate.toISOString();
      endsAt = endDate.toISOString();
    }

    const payload = {
      title,
      startsAt,
      endsAt,
      location,
      notes,
      allDay,
      color,
    };

    if (editing) {
      await eventRepo.update(editing.id, {
        title: title.trim(),
        startsAt,
        endsAt,
        location: location.trim() || null,
        notes: notes.trim() || null,
        allDay,
        color,
      });
    } else {
      await eventRepo.create({ accountId, ...payload });
    }
    onClose();
  }

  async function remove() {
    if (!editing) return;
    await eventRepo.remove(editing.id);
    onClose();
  }

  function shiftDay(delta: number) {
    const day = parseDateValue(dateText);
    if (!day) return;
    setDateText(formatDateValue(addDays(day, delta)));
    setError(null);
  }

  return (
    <View style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.sm }}>
      <Input
        label={t('calendar.field.title')}
        placeholder={t('calendar.field.titlePlaceholder')}
        value={title}
        onChangeText={(value) => {
          setTitle(value);
          setError(null);
        }}
        autoCapitalize="sentences"
        {...(error?.field === 'title' ? { error: error.message } : {})}
      />

      <View style={[styles.row, { gap: theme.spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Text variant="label" tone="muted">
            {t('calendar.field.allDay')}
          </Text>
        </View>
        <Switch
          value={allDay}
          onValueChange={setAllDay}
          accessibilityLabel={t('calendar.field.allDay')}
          trackColor={{ true: theme.colors.accent, false: theme.colors.borderStrong }}
          thumbColor={theme.colors.surface}
        />
      </View>

      <View style={{ gap: theme.spacing.xs }}>
        <Input
          label={t('calendar.field.date')}
          placeholder="08.09.2026"
          value={dateText}
          onChangeText={(value) => {
            setDateText(value);
            setError(null);
          }}
          {...(error?.field === 'date' ? { error: error.message } : {})}
        />
        <View style={[styles.row, { gap: theme.spacing.sm }]}>
          <Button
            label={t('calendar.dayBack')}
            icon="back"
            size="sm"
            variant="secondary"
            fullWidth={false}
            onPress={() => shiftDay(-1)}
          />
          <Button
            label={t('calendar.dayForward')}
            icon="forward"
            size="sm"
            variant="secondary"
            fullWidth={false}
            onPress={() => shiftDay(1)}
          />
        </View>
      </View>

      {allDay ? null : (
        <View style={{ gap: theme.spacing.sm }}>
          <View style={[styles.row, { gap: theme.spacing.md }]}>
            <View style={{ flex: 1 }}>
              <Input
                label={t('calendar.field.from')}
                placeholder="09:00"
                value={startText}
                onChangeText={(value) => {
                  setStartText(value);
                  setError(null);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label={t('calendar.field.to')}
                placeholder="10:00"
                value={endText}
                onChangeText={(value) => {
                  setEndText(value);
                  setError(null);
                }}
              />
            </View>
          </View>
          {error?.field === 'time' ? (
            <Text variant="caption" tone="danger">
              {error.message}
            </Text>
          ) : null}
          <View style={[styles.row, { gap: theme.spacing.sm, flexWrap: 'wrap' }]}>
            {DURATIONS.map((minutes) => (
              <Button
                key={minutes}
                label={t('calendar.duration', { minutes })}
                size="sm"
                variant="secondary"
                fullWidth={false}
                onPress={() => applyDuration(minutes)}
              />
            ))}
          </View>
        </View>
      )}

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="label" tone="muted">
          {t('calendar.field.color')}
        </Text>
        <View style={[styles.row, { gap: theme.spacing.md, flexWrap: 'wrap' }]}>
          {EVENT_COLOR_KEYS.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="radio"
              accessibilityState={{ selected: color === key }}
              accessibilityLabel={t(colorLabelKey(key))}
              onPress={() => setColor(key)}
              style={[
                styles.swatch,
                {
                  backgroundColor: EVENT_COLORS[key],
                  borderColor: color === key ? theme.colors.text : 'transparent',
                },
              ]}
            >
              {color === key ? <Icon name="check" size={16} color="#FFFFFF" /> : null}
            </Pressable>
          ))}
        </View>
      </View>

      <Input
        label={t('calendar.field.location')}
        placeholder={t('calendar.field.locationPlaceholder')}
        value={location}
        onChangeText={setLocation}
      />

      <Input
        label={t('calendar.field.notes')}
        placeholder={t('calendar.field.notesPlaceholder')}
        value={notes}
        onChangeText={setNotes}
        multiline
        autoCapitalize="sentences"
      />

      <View style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.lg }}>
        <Button label={t('common.done')} icon="check" onPress={save} />
        {editing ? (
          <Button label={t('calendar.remove')} variant="danger" icon="trash" onPress={remove} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
