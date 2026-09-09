import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { households as householdRepo, useLiveQuery, type EventRow } from '@/db';
import { events as eventRepo, type CalendarFilter } from '@/db/repositories';
import { useFavouriteAction } from '@/features/modules/useFavouriteAction';
import { useI18n } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount, useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Button, Chip, Header, Icon, Screen, Segmented, Text } from '@/ui';

import { eventColor } from './colors';
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
import { EventEditor, type EventDraft } from './EventEditor';
import { MonthView } from './MonthView';
import { TimeGrid } from './TimeGrid';

type CalendarMode = 'day' | 'week' | 'month';

export function CalendarView({ module }: { module: ModuleDefinition }) {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const { household } = useApp();
  const householdId = household?.id ?? null;
  const favouriteAction = useFavouriteAction(module.id);

  const [source, setSource] = useState<CalendarFilter>('all');
  const [mode, setMode] = useState<CalendarMode>('month');
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

  const list = useLiveQuery(
    () => eventRepo.listBetween(account.id, householdId, fromIso, toIso, source),
    [account.id, householdId, fromIso, toIso, source],
  );
  const events = list.data ?? [];

  const memberList = useLiveQuery(
    () => (householdId ? householdRepo.members(householdId) : Promise.resolve([])),
    [householdId],
  );
  const members = memberList.data ?? [];

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
          actions={[favouriteAction]}
        >
          <View style={[styles.toolbar, { gap: theme.spacing.sm, paddingTop: theme.spacing.sm }]}>
            <Segmented
              accessibilityLabel={t('calendar.view')}
              value={mode}
              onChange={setMode}
              options={[
                { value: 'day', label: t('calendar.view.day') },
                { value: 'week', label: t('calendar.view.week') },
                { value: 'month', label: t('calendar.view.month') },
              ]}
            />
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

          {household ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: theme.spacing.sm,
                paddingTop: theme.spacing.sm,
                paddingRight: theme.spacing.lg,
              }}
            >
              <Chip
                label={t('calendar.source.all')}
                selected={source === 'all'}
                onPress={() => setSource('all')}
              />
              <Chip
                label={t('calendar.scope.personal')}
                selected={source === 'personal'}
                onPress={() => setSource('personal')}
              />
              <Chip
                label={t('calendar.scope.family')}
                selected={source === 'family'}
                onPress={() => setSource('family')}
              />
              {members
                .filter((member) => member.membership.accountId !== account.id)
                .map((member) => {
                  const value: CalendarFilter = `member:${member.membership.accountId}`;
                  return (
                    <Chip
                      key={member.membership.id}
                      label={member.displayName}
                      selected={source === value}
                      onPress={() => setSource(value)}
                    />
                  );
                })}
            </ScrollView>
          ) : null}
        </Header>
      }
      footer={
        <Button
          label={t('calendar.add')}
          icon="plus"
          onPress={() =>
            setDraft({ day: anchor, calendar: source === 'family' ? 'family' : 'personal' })
          }
        />
      }
    >
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
            onPressSlot={(day, hour) =>
              setDraft({ day, hour, calendar: source === 'family' ? 'family' : 'personal' })
            }
            onPressEvent={(event) => setDraft({ event, day: new Date(event.startsAt) })}
          />
        </View>
      )}

      <EventEditor draft={draft} accountId={account.id} onClose={() => setDraft(null)} />
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
