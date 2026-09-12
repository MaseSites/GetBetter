import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { useLiveQuery, type EventRow } from '@/db';
import { BirthdayForm } from '@/features/birthdays/BirthdayEditor';
import { hasHouseholds } from '@/app/identity';
import { events as eventRepo, groupOf, targetOf, type EventTarget } from '@/db/repositories';
import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Chip, Icon, Input, Loading, Segmented, Sheet, Text } from '@/ui';

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
import { useCalendarAccess } from './useCalendarAccess';

export type EventDraft = {
  /** Gesetzt beim Bearbeiten, leer beim Anlegen. */
  event?: EventRow;
  day: Date;
  /** Vorgeschlagene Startzeit, wenn man in ein leeres Zeitfeld tippt. */
  hour?: number;
};

/**
 * Wohin der Termin gehoert. Man kann mehrere anhaken — dann liegt derselbe
 * Termin in mehreren Kalendern und wird trotzdem nur einmal angezeigt.
 */
type TargetKey = 'personal' | `house:${string}` | `cal:${string}`;

function keyOf(target: EventTarget): TargetKey {
  if (target.calendar === 'custom' && target.calendarId) return `cal:${target.calendarId}`;
  if (target.calendar === 'family' && target.householdId) return `house:${target.householdId}`;
  return 'personal';
}

function targetFor(key: TargetKey): EventTarget {
  if (key.startsWith('cal:')) {
    return { calendar: 'custom', calendarId: key.slice('cal:'.length), householdId: null };
  }
  if (key.startsWith('house:')) {
    return { calendar: 'family', calendarId: null, householdId: key.slice('house:'.length) };
  }
  return { calendar: 'personal', calendarId: null, householdId: null };
}

export type EventEditorProps = {
  draft: EventDraft | null;
  accountId: string;
  onClose: () => void;
};

const DURATIONS = [30, 60, 90, 120] as const;

export function EventEditor({ draft, accountId, onClose }: EventEditorProps) {
  const t = useTranslate();
  const editing = draft?.event;
  const groupId = editing ? groupOf(editing) : null;

  // Beim Bearbeiten kommen die Geschwister dazu: derselbe Termin kann in
  // mehreren Kalendern liegen, und alle sollen vorgewaehlt sein.
  const siblings = useLiveQuery(
    () => (groupId ? eventRepo.group(groupId) : Promise.resolve([])),
    [groupId],
  );
  // `useLiveQuery` haelt beim Wechsel kurz die alten Daten — deshalb pruefen wir
  // nicht auf "geladen", sondern darauf, dass die Zeilen zu diesem Termin gehoeren.
  const rows = siblings.data ?? [];
  const ready = groupId === null || rows.some((row) => groupOf(row) === groupId);

  // Ein neuer Entwurf baut das Formular neu auf — kein Abgleich per Effekt.
  const draftKey = groupId ?? (draft ? `${draft.day.toISOString()}:${draft.hour ?? ''}` : 'none');

  return (
    <Sheet
      visible={draft !== null}
      onClose={onClose}
      title={
        editing ? t('calendar.edit') : hasHouseholds() ? t('calendar.add') : t('calendar.newEntry')
      }
      fullScreen
    >
      {draft && ready ? (
        <DraftBody
          key={draftKey}
          draft={draft}
          accountId={accountId}
          rows={rows}
          onClose={onClose}
        />
      ) : null}
      {draft && !ready ? <Loading /> : null}
    </Sheet>
  );
}

type EntryKind = 'event' | 'birthday';

/**
 * Beim Anlegen im privaten Kalender waehlt man oben, was es wird: ein Termin
 * oder ein Geburtstag. Der Geburtstag landet beim Kontakt und steht damit auch
 * in der Funktion „Geburtstage“ — und jedes Jahr wieder im Kalender.
 */
function DraftBody(props: EventFormProps) {
  const t = useTranslate();
  const theme = useTheme();
  const [kind, setKind] = useState<EntryKind>('event');
  const canChoose = !props.draft.event && !hasHouseholds();

  if (!canChoose) return <EventForm {...props} />;

  return (
    <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.sm }}>
      <Segmented
        options={[
          { value: 'event', label: t('calendar.kind.event') },
          { value: 'birthday', label: t('calendar.kind.birthday') },
        ]}
        value={kind}
        onChange={setKind}
        accessibilityLabel={t('calendar.kind.label')}
      />
      {kind === 'birthday' ? (
        <BirthdayForm
          draft={{ day: props.draft.day }}
          accountId={props.accountId}
          onDone={props.onClose}
        />
      ) : (
        <EventForm {...props} />
      )}
    </View>
  );
}

type EventFormProps = {
  draft: EventDraft;
  accountId: string;
  /** Alle Kopien des bearbeiteten Termins; beim Anlegen leer. */
  rows: readonly EventRow[];
  onClose: () => void;
};

function EventForm({ draft, accountId, rows, onClose }: EventFormProps) {
  const t = useTranslate();
  const theme = useTheme();

  const { calendars, households } = useCalendarAccess();
  const family = hasHouseholds();
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
  // `null` heisst: noch nichts angehakt. Die Vorauswahl richtet sich dann nach
  // dem, was die App gerade weiss — die Haushalte kommen erst mit der Abfrage.
  const [chosen, setChosen] = useState<readonly TargetKey[] | null>(
    rows.length > 0 ? rows.map((row) => keyOf(targetOf(row))) : null,
  );
  const [isPrivate, setIsPrivate] = useState(editing?.isPrivate ?? false);
  const [error, setError] = useState<{
    field: 'title' | 'date' | 'time' | 'calendar';
    message: string;
  } | null>(null);

  const firstHousehold = households[0];
  const targets: readonly TargetKey[] =
    chosen ??
    (family ? (firstHousehold ? [`house:${firstHousehold.household.id}`] : []) : ['personal']);

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
    if (targets.length === 0) {
      setError({ field: 'calendar', message: t('calendar.error.calendar') });
      return;
    }
    // Ohne Haushalt gibt es hier keinen Kalender, in den der Termin passt.
    if (family && !targets.some((key) => key.startsWith('house:'))) {
      setError({ field: 'calendar', message: t('calendar.error.household') });
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

    const fields = {
      isPrivate,
      title,
      startsAt,
      endsAt,
      location,
      notes,
      allDay,
      color,
    };
    const chosen = targets.map(targetFor);

    if (editing) {
      await eventRepo.save(groupOf(editing), accountId, fields, chosen);
    } else {
      await eventRepo.create({ accountId, ...fields }, chosen);
    }
    onClose();
  }

  async function remove() {
    if (!editing) return;
    // Loescht den Termin in allen Kalendern, in denen er liegt.
    await eventRepo.remove(groupOf(editing));
    onClose();
  }

  // Dieselbe Trennung wie im Kalender: hier die Haushalte, dort das Private.
  const choices: { value: TargetKey; label: string }[] = family
    ? households.map((entry) => ({
        value: `house:${entry.household.id}` as const,
        label: entry.household.name,
      }))
    : [
        { value: 'personal', label: t('calendar.scope.personal') },
        ...calendars.map((entry) => ({
          value: `cal:${entry.calendar.id}` as const,
          label: entry.calendar.name,
        })),
      ];

  function toggleTarget(value: TargetKey) {
    setChosen((current) => {
      const list = current ?? targets;
      return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
    });
    setError(null);
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

      {choices.length > 1 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" tone="muted">
            {t('calendar.field.calendar')}
          </Text>
          <View style={[styles.row, { gap: theme.spacing.sm, flexWrap: 'wrap' }]}>
            {choices.map((entry) => (
              <Chip
                key={entry.value}
                label={entry.label}
                selected={targets.includes(entry.value)}
                onPress={() => toggleTarget(entry.value)}
              />
            ))}
          </View>
          <Text variant="caption" tone={error?.field === 'calendar' ? 'danger' : 'faint'}>
            {error?.field === 'calendar' ? error.message : t('calendar.field.calendarHint')}
          </Text>
          {!family && targets.includes('personal') && households.length > 0 ? (
            <View style={[styles.row, { gap: theme.spacing.md }]}>
              <View style={{ flex: 1 }}>
                <Text variant="label" tone="muted">
                  {t('calendar.field.private')}
                </Text>
                <Text variant="caption" tone="faint">
                  {isPrivate ? t('calendar.field.privateOn') : t('calendar.field.privateOff')}
                </Text>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                accessibilityLabel={t('calendar.field.private')}
                trackColor={{ true: theme.colors.accent, false: theme.colors.borderStrong }}
                thumbColor={theme.colors.surface}
              />
            </View>
          ) : null}
        </View>
      ) : null}

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
