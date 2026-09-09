import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { calendars as calendarRepo, shares as shareRepo, useLiveQuery, type EventRow } from '@/db';
import { events as eventRepo, type CalendarSource } from '@/db/repositories';
import { useFavouriteAction } from '@/features/modules/useFavouriteAction';
import { useI18n, type TranslationKey } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Button, Card, Header, Icon, Screen, Text } from '@/ui';

import { eventColor, EVENT_COLORS, type EventColorKey } from './colors';
import {
  addDays,
  addMonths,
  isSameDay,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  weekDays,
} from './dates';
import { CalendarManager } from './CalendarManager';
import {
  CalendarPicker,
  type CalendarMode,
  type PickerEntry,
  type PickerGroup,
} from './CalendarPicker';
import { EventEditor, type EventDraft } from './EventEditor';
import { useCalendarAccess } from './useCalendarAccess';
import { MonthView } from './MonthView';
import { TimeGrid } from './TimeGrid';

export function CalendarView({ module }: { module: ModuleDefinition }) {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const favouriteAction = useFavouriteAction(module.id);

  const { access, calendars: myCalendars, households, sharedBy } = useCalendarAccess();
  const [mode, setMode] = useState<CalendarMode>('month');
  const [managing, setManaging] = useState(false);
  const [picking, setPicking] = useState(false);
  // Leer heisst: kein eigener Kalender abgewaehlt, also alle zeigen.
  const [hidden, setHidden] = useState<readonly CalendarSource[]>([]);
  // Fremde Kalender kommen nur dazu, wenn man sie ausdruecklich anhakt.
  const [shownPeople, setShownPeople] = useState<readonly CalendarSource[]>([]);
  const [askMessage, setAskMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [draft, setDraft] = useState<EventDraft | null>(null);

  // Sichtbarer Zeitraum je Ansicht — grosszuegig, damit Raender mitkommen.
  const { from, to, days } = useMemo(() => {
    if (mode === 'day') {
      return { from: anchor, to: addDays(anchor, 1), days: [anchor] };
    }
    if (mode === 'week') {
      const week = weekDays(anchor);
      const first = week[0] ?? anchor;
      return { from: first, to: addDays(first, 7), days: week };
    }
    const first = startOfWeek(startOfMonth(anchor));
    return { from: first, to: addDays(first, 42), days: [] as Date[] };
  }, [mode, anchor]);

  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const calendarEntries = useMemo((): PickerEntry[] => {
    // Der eigene, dann je Haushalt einer unter seinem Namen, dann die eigenen.
    return [
      { source: 'personal', label: t('calendar.scope.personal') },
      ...households.map((entry) => ({
        source: `house:${entry.household.id}` as const,
        label: entry.household.name,
      })),
      ...myCalendars.map((entry) => ({
        source: `cal:${entry.calendar.id}` as const,
        label: entry.calendar.name,
        color: EVENT_COLORS[entry.calendar.color as EventColorKey] ?? eventColor(null),
      })),
    ];
  }, [t, households, myCalendars]);

  // Personen: je Haushalt eine Gruppe, darunter, wer freigegeben hat.
  // Wer in zwei Haushalten steht, erscheint nur einmal.
  const peopleGroups = useMemo((): PickerGroup[] => {
    // Jede Person nur einmal, auch wenn sie in zwei Haushalten steht.
    const seen = new Set<string>([account.id]);
    const take = (id: string, label: string): PickerEntry | null => {
      if (seen.has(id)) return null;
      seen.add(id);
      return { source: `member:${id}`, label };
    };

    const byHousehold = households
      .map((entry) => ({
        key: entry.household.id,
        title: entry.household.name,
        entries: entry.members
          .map((member) => take(member.membership.accountId, member.displayName))
          .filter((entry): entry is PickerEntry => entry !== null),
      }))
      .filter((group) => group.entries.length > 0);

    // Die Ueberschrift hilft erst, wenn mehrere Haushalte Leute beisteuern.
    const groups: PickerGroup[] =
      byHousehold.length > 1
        ? byHousehold
        : byHousehold.map(({ key, entries }) => ({ key, entries }));

    const others = sharedBy
      .map((person) => take(person.share.ownerId, person.displayName))
      .filter((entry): entry is PickerEntry => entry !== null);

    return others.length > 0
      ? [...groups, { key: 'shared', title: t('calendar.picker.others'), entries: others }]
      : groups;
  }, [households, sharedBy, account.id, t]);

  const selected = useMemo(() => {
    const known = new Set(
      peopleGroups.flatMap((group) => group.entries.map((entry) => entry.source)),
    );
    return [
      ...calendarEntries.map((entry) => entry.source).filter((source) => !hidden.includes(source)),
      ...shownPeople.filter((source) => known.has(source)),
    ];
  }, [calendarEntries, hidden, shownPeople, peopleGroups]);

  const askedList = useLiveQuery(() => shareRepo.askedBy(account.id), [account.id]);
  const waiting = (askedList.data ?? []).map((person) => person.displayName);

  const requestList = useLiveQuery(() => shareRepo.requestsFor(account.id), [account.id]);
  const requests = requestList.data ?? [];

  async function askPerson(username: string) {
    if (username.trim().length === 0) return;
    const result = await shareRepo.requestByUsername(account.id, username);
    if (result.ok) {
      setAskMessage({ tone: 'ok', text: t('calendar.picker.asked') });
      return;
    }
    setAskMessage({
      tone: 'error',
      text:
        result.error === 'unknown_user'
          ? t('calendars.share.unknown')
          : result.error === 'self'
            ? t('calendars.share.self')
            : t('calendar.picker.alreadyAsked'),
    });
  }

  const list = useLiveQuery(
    () => eventRepo.listBetween(access, fromIso, toIso, selected),
    [access.accountId, access.householdIds, access.calendarIds, fromIso, toIso, selected],
  );
  const events = list.data ?? [];

  const inviteList = useLiveQuery(() => calendarRepo.invitesFor(account.id), [account.id]);
  const invites = inviteList.data ?? [];

  function step(direction: number) {
    if (mode === 'month') setAnchor((current) => addMonths(current, direction));
    else if (mode === 'week') setAnchor((current) => addDays(current, direction * 7));
    else setAnchor((current) => addDays(current, direction));
  }

  const periodLabel = useMemo(() => {
    if (mode === 'month') {
      return new Intl.DateTimeFormat('de-CH', { month: 'long', year: 'numeric' }).format(anchor);
    }
    if (mode === 'day') {
      return new Intl.DateTimeFormat('de-CH', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(anchor);
    }
    const week = weekDays(anchor);
    const first = week[0] ?? anchor;
    const last = week[6] ?? anchor;
    const dayMonth = new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'short' });
    return `${dayMonth.format(first)} – ${dayMonth.format(last)}`;
  }, [mode, anchor]);

  return (
    <Screen
      scroll={false}
      padded={false}
      header={
        <Header
          title={module.name}
          subtitle={periodLabel}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
          actions={[
            {
              icon: 'settings',
              label: t('calendars.manage'),
              onPress: () => setManaging(true),
            },
            favouriteAction,
          ]}
        >
          <View style={[styles.toolbar, { gap: theme.spacing.sm, paddingTop: theme.spacing.sm }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('calendar.picker.title')}
              accessibilityState={{ expanded: picking }}
              onPress={() => setPicking(true)}
              style={({ pressed }) => [
                styles.pickerButton,
                {
                  borderRadius: theme.radii.pill,
                  backgroundColor: pressed ? theme.colors.border : theme.colors.surfaceMuted,
                  gap: theme.spacing.xs,
                  paddingHorizontal: theme.spacing.md,
                },
              ]}
            >
              <Text variant="caption" tone="muted">
                {t(`calendar.view.${mode}` as TranslationKey)} ·{' '}
                {t('calendar.picker.selected', { count: selected.length })}
              </Text>
              <Icon name="down" size={14} color={theme.colors.textMuted} />
            </Pressable>
            <View style={{ flex: 1 }} />
            <StepButton label={t('calendar.previous')} icon="back" onPress={() => step(-1)} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('calendar.today')}
              onPress={() => setAnchor(startOfDay(new Date()))}
              style={({ pressed }) => [
                styles.todayButton,
                {
                  borderRadius: theme.radii.pill,
                  borderColor: theme.colors.border,
                  backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
                },
              ]}
            >
              <Text variant="caption" tone="muted">
                {t('calendar.today')}
              </Text>
            </Pressable>
            <StepButton label={t('calendar.next')} icon="forward" onPress={() => step(1)} />
          </View>
        </Header>
      }
      footer={
        <Button label={t('calendar.add')} icon="plus" onPress={() => setDraft({ day: anchor })} />
      }
    >
      {invites.length > 0 ? (
        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}>
          {invites.map((invite) => (
            <Card
              key={invite.membership.id}
              title={t('calendars.invites.title', {
                name: invite.calendar?.name ?? t('calendars.invites.unknown'),
              })}
              subtitle={t('calendars.invites.body', { name: invite.invitedByName })}
            >
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <Button
                  label={t('calendars.invites.accept')}
                  size="sm"
                  icon="check"
                  fullWidth={false}
                  onPress={() => calendarRepo.respond(invite.membership.id, true)}
                />
                <Button
                  label={t('calendars.invites.decline')}
                  size="sm"
                  variant="ghost"
                  fullWidth={false}
                  onPress={() => calendarRepo.respond(invite.membership.id, false)}
                />
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {requests.length > 0 ? (
        <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm }}>
          {requests.map((person) => (
            <Card
              key={person.share.id}
              title={t('calendars.share.incoming', { name: person.displayName })}
              subtitle={t('calendars.share.incomingBody')}
            >
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <Button
                  label={t('calendars.invites.accept')}
                  size="sm"
                  icon="check"
                  fullWidth={false}
                  onPress={() => shareRepo.respond(person.share.id, true)}
                />
                <Button
                  label={t('calendars.invites.decline')}
                  size="sm"
                  variant="ghost"
                  fullWidth={false}
                  onPress={() => shareRepo.respond(person.share.id, false)}
                />
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {mode === 'month' ? (
        <MonthView
          month={anchor}
          selected={anchor}
          events={events}
          onOpenDay={(day) => {
            // Ein Tag antippen fuehrt in seine Tagesansicht.
            setAnchor(day);
            setMode('day');
          }}
        />
      ) : (
        <View style={styles.fill}>
          <DayHeader days={days} anchor={anchor} onSelect={setAnchor} mode={mode} />
          <AllDayRow
            days={days}
            events={events}
            onPressEvent={(event) => setDraft({ event, day: new Date(event.startsAt) })}
          />
          <TimeGrid
            days={days}
            events={events}
            compact={mode === 'week'}
            onPressSlot={(day, hour) => setDraft({ day, hour })}
            onPressEvent={(event) => setDraft({ event, day: new Date(event.startsAt) })}
          />
        </View>
      )}

      <EventEditor draft={draft} accountId={account.id} onClose={() => setDraft(null)} />

      <CalendarPicker
        visible={picking}
        onClose={() => {
          setPicking(false);
          setAskMessage(null);
        }}
        mode={mode}
        onMode={setMode}
        calendars={calendarEntries}
        people={peopleGroups}
        waiting={waiting}
        selected={selected}
        onToggle={(source) => {
          if (source.startsWith('member:')) {
            setShownPeople((current) =>
              current.includes(source)
                ? current.filter((item) => item !== source)
                : [...current, source],
            );
            return;
          }
          setHidden((current) =>
            current.includes(source)
              ? current.filter((item) => item !== source)
              : [...current, source],
          );
        }}
        onAll={(all) => setHidden(all ? [] : calendarEntries.map((entry) => entry.source))}
        onAsk={(username) => void askPerson(username)}
        askMessage={askMessage}
      />

      <CalendarManager
        visible={managing}
        onClose={() => setManaging(false)}
        calendars={myCalendars}
      />
    </Screen>
  );
}

function StepButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: 'back' | 'forward';
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.stepButton,
        { opacity: pressed ? 0.5 : 1, borderRadius: theme.radii.pill },
      ]}
    >
      <Icon name={icon} size={20} color={theme.colors.textMuted} />
    </Pressable>
  );
}

function DayHeader({
  days,
  anchor,
  onSelect,
  mode,
}: {
  days: readonly Date[];
  anchor: Date;
  onSelect: (day: Date) => void;
  mode: CalendarMode;
}) {
  const theme = useTheme();
  if (mode === 'day') return null;

  return (
    <View style={[styles.dayHeader, { borderBottomColor: theme.colors.border, paddingLeft: 44 }]}>
      {days.map((day) => {
        const selected = isSameDay(day, anchor);
        return (
          <Pressable
            key={day.toISOString()}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={new Intl.DateTimeFormat('de-CH', {
              weekday: 'long',
              day: 'numeric',
            }).format(day)}
            onPress={() => onSelect(day)}
            style={styles.dayHeaderCell}
          >
            <Text variant="caption" tone="faint">
              {new Intl.DateTimeFormat('de-CH', { weekday: 'short' }).format(day).slice(0, 2)}
            </Text>
            <View
              style={[
                styles.dayHeaderCircle,
                selected
                  ? { backgroundColor: theme.colors.accent }
                  : isToday(day)
                    ? { borderWidth: 1, borderColor: theme.colors.accent }
                    : null,
              ]}
            >
              <Text
                variant="label"
                tone={selected ? 'onAccent' : isToday(day) ? 'accent' : 'default'}
              >
                {day.getDate()}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function AllDayRow({
  days,
  events,
  onPressEvent,
}: {
  days: readonly Date[];
  events: readonly EventRow[];
  onPressEvent: (event: EventRow) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  const allDay = events.filter(
    (event) => event.allDay && days.some((day) => isSameDay(new Date(event.startsAt), day)),
  );
  if (allDay.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.allDay, { borderBottomColor: theme.colors.border }]}
      contentContainerStyle={{
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
      }}
    >
      {allDay.map((event) => (
        <Pressable
          key={event.id}
          accessibilityRole="button"
          accessibilityLabel={`${event.title} — ${t('today.allDay')}`}
          onPress={() => onPressEvent(event)}
          style={[
            styles.allDayChip,
            { backgroundColor: eventColor(event.color), borderRadius: theme.radii.sm },
          ]}
        >
          <Text variant="caption" tone="onAccent" numberOfLines={1}>
            {event.title}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center' },
  pickerButton: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
  },
  todayButton: {
    height: 28,
    paddingHorizontal: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  dayHeader: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  dayHeaderCell: { flex: 1, alignItems: 'center', paddingVertical: 6, gap: 2 },
  dayHeaderCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allDay: { flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  allDayChip: { paddingHorizontal: 8, paddingVertical: 4, maxWidth: 160 },
});
