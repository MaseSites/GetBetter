import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { APPS, hasHouseholds } from '@/app/identity';
import {
  calendars as calendarRepo,
  contacts as contactRepo,
  shares as shareRepo,
  useLiveQuery,
  type EventRow,
} from '@/db';
import { BirthdayEditor, type BirthdayDraft } from '@/features/birthdays/BirthdayEditor';
import {
  birthdayEventId,
  birthdaysBetween,
  personOfBirthdayEvent,
  withBirthday,
} from '@/features/birthdays/birthdays';
import { parseDay } from '@/features/shared/days';
import { events as eventRepo, type CalendarSource } from '@/db/repositories';
import { useI18n, type TranslationKey } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  Button,
  Card,
  FloatingButton,
  Header,
  Icon,
  Screen,
  Text,
  usePressScale,
  useSwipeSteps,
} from '@/ui';

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
import { GUTTER_WIDTH, TimeGrid } from './TimeGrid';

/** Geburtstage stehen immer in derselben Farbe im Kalender. */
const BIRTHDAY_COLOR: EventColorKey = 'rose';

export type CalendarViewProps = {
  module: ModuleDefinition;
  /** Als Tab ohne Zurueck, als geoeffnetes Modul mit. */
  showBack?: boolean;
};

/**
 * Ein Kalender, zwei Ausschnitte. In GetBetter der private samt eigenen
 * Kalendern; in BetterFamily nur der des Haushalts. Welcher es ist, sagt
 * `hasHouseholds()` — die App, in der er laeuft.
 *
 * Gestaltet wie im Entwurf: gross der Zeitraum als Titel, ein Tipp darauf
 * oeffnet Ansicht und Kalenderauswahl; darunter die Woche als Leiste und
 * das Zeitraster mit weissen Terminkarten.
 */
export function CalendarView({ module, showBack = true }: CalendarViewProps) {
  const family = hasHouseholds();
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();

  const { access, calendars: myCalendars, households, sharedBy } = useCalendarAccess();
  // Wie im Entwurf beginnt der Kalender beim heutigen Tag, nicht beim Monat.
  const [mode, setMode] = useState<CalendarMode>('day');
  const [managing, setManaging] = useState(false);
  const [picking, setPicking] = useState(false);
  // Leer heisst: kein eigener Kalender abgewaehlt, also alle zeigen.
  const [hidden, setHidden] = useState<readonly CalendarSource[]>([]);
  // Fremde Kalender — Personen wie andere Apps — kommen nur dazu, wenn man
  // sie ausdruecklich anhakt.
  const [shownPeople, setShownPeople] = useState<readonly CalendarSource[]>([]);
  const [askMessage, setAskMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [birthday, setBirthday] = useState<BirthdayDraft | null>(null);

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
    // BetterFamily zeigt die Haushalte, GetBetter den privaten und die eigenen.
    if (family) {
      return households.map((entry) => ({
        source: `house:${entry.household.id}` as const,
        label: entry.household.name,
      }));
    }
    return [
      { source: 'personal', label: t('calendar.scope.personal') },
      ...myCalendars.map((entry) => ({
        source: `cal:${entry.calendar.id}` as const,
        label: entry.calendar.name,
        color: EVENT_COLORS[entry.calendar.color as EventColorKey] ?? eventColor(null),
      })),
    ];
  }, [t, family, households, myCalendars]);

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

    const withOthers =
      others.length > 0
        ? [...groups, { key: 'shared', title: t('calendar.picker.others'), entries: others }]
        : groups;

    // GetBetter fuehrt keine Haushalte, kann ihre Kalender aber zeigen —
    // so laeuft in der Hauptapp alles zusammen.
    if (family || households.length === 0) return withOthers;
    return [
      ...withOthers,
      {
        key: 'apps',
        title: APPS.betterfamily.name,
        entries: households.map((entry) => ({
          source: `house:${entry.household.id}` as const,
          label: entry.household.name,
        })),
      },
    ];
  }, [households, sharedBy, account.id, t, family]);

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
  const saved = list.data;

  // Geburtstage liegen bei den Kontakten und stehen hier jedes Jahr als
  // ganztaegiger Eintrag — gedacht, nicht gespeichert. Nur im privaten Kalender.
  const contactList = useLiveQuery(
    () => (family ? Promise.resolve([]) : contactRepo.list(account.id)),
    [account.id, family],
  );
  const contactRows = contactList.data;
  const showBirthdays = !family && selected.includes('personal');
  const events = useMemo((): EventRow[] => {
    const stored = saved ?? [];
    if (!showBirthdays) return stored;
    const birthdays = birthdaysBetween(withBirthday(contactRows ?? []), from, to).map(
      (entry): EventRow => {
        const startsAt = parseDay(entry.day).toISOString();
        return {
          id: birthdayEventId(entry.person.id, entry.day),
          accountId: account.id,
          householdId: null,
          calendar: 'personal',
          calendarId: null,
          isPrivate: true,
          title: t('birthdays.event', { name: entry.person.name, age: entry.age }),
          location: null,
          notes: null,
          startsAt,
          endsAt: null,
          allDay: true,
          color: BIRTHDAY_COLOR,
          createdAt: startsAt,
        };
      },
    );
    return [...stored, ...birthdays];
  }, [saved, showBirthdays, contactRows, from, to, account.id, t]);

  /** Ein Tipp auf einen Eintrag: Geburtstage oeffnen ihr eigenes Blatt. */
  function openEvent(event: EventRow) {
    const personId = personOfBirthdayEvent(event.id);
    if (personId) {
      const contact = (contactRows ?? []).find((row) => row.id === personId);
      if (contact) setBirthday({ contact });
      return;
    }
    setDraft({ event, day: new Date(event.startsAt) });
  }

  const inviteList = useLiveQuery(() => calendarRepo.invitesFor(account.id), [account.id]);
  const invites = inviteList.data ?? [];

  function step(direction: number) {
    if (mode === 'month') setAnchor((current) => addMonths(current, direction));
    else if (mode === 'week') setAnchor((current) => addDays(current, direction * 7));
    else setAnchor((current) => addDays(current, direction));
  }

  // Wischen blaettert wie die Pfeile: nach links weiter, nach rechts zurueck.
  const swipe = useSwipeSteps(step);

  const periodLabel = useMemo(() => {
    if (mode === 'month') {
      return new Intl.DateTimeFormat('de-CH', { month: 'long', year: 'numeric' }).format(anchor);
    }
    if (mode === 'day') {
      // Das Datum steht in der Wochenleiste darunter — oben reicht der Wochentag.
      return new Intl.DateTimeFormat('de-CH', { weekday: 'long' }).format(anchor);
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
          showBack={showBack}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          actions={
            family
              ? []
              : [
                  {
                    icon: 'settings',
                    label: t('calendars.manage'),
                    onPress: () => setManaging(true),
                  },
                ]
          }
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${module.name}: ${t('calendar.picker.title')}`}
            accessibilityState={{ expanded: picking }}
            onPress={() => setPicking(true)}
            style={[styles.titleRow, { gap: theme.spacing.sm }]}
          >
            <Text
              variant="display"
              numberOfLines={1}
              style={[
                styles.shrink,
                { fontSize: theme.fontSize.title, lineHeight: theme.lineHeight.title },
              ]}
            >
              {periodLabel}
            </Text>
            <Icon name="down" size={18} color={theme.colors.textFaint} />
            <Text
              variant="label"
              tone="faint"
              numberOfLines={1}
              style={[styles.shrink, { fontWeight: theme.fontWeight.semibold }]}
            >
              {`${t(`calendar.view.${mode}` as TranslationKey)} · ${t('calendar.picker.selected', { count: selected.length })}`}
            </Text>
          </Pressable>

          <View style={[styles.toolbar, { gap: theme.spacing.sm }]}>
            <View style={styles.grow} />
            <StepButton label={t('calendar.previous')} icon="back" onPress={() => step(-1)} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('calendar.today')}
              onPress={() => setAnchor(startOfDay(new Date()))}
              style={[
                styles.todayButton,
                {
                  borderRadius: theme.radii.pill,
                  backgroundColor: theme.colors.surfaceMuted,
                  paddingHorizontal: theme.spacing.md,
                },
              ]}
            >
              <Text variant="label" style={{ fontWeight: theme.fontWeight.semibold }}>
                {t('calendar.today')}
              </Text>
            </Pressable>
            <StepButton label={t('calendar.next')} icon="forward" onPress={() => step(1)} />
          </View>
        </Header>
      }
    >
      {invites.length > 0 ? (
        <View style={{ padding: theme.spacing.edge, gap: theme.spacing.sm }}>
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
        <View style={{ paddingHorizontal: theme.spacing.edge, gap: theme.spacing.sm }}>
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

      {/* Nimmt den Platz ein, den Monat und Zeitraster vorher selbst hatten. */}
      <Animated.View style={[styles.fill, swipe.style]} {...swipe.panHandlers}>
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
            <WeekStrip
              days={mode === 'day' ? weekDays(anchor) : days}
              anchor={anchor}
              onSelect={setAnchor}
              alignToGrid={mode === 'week'}
            />
            <AllDayRow days={days} events={events} onPressEvent={openEvent} />
            <TimeGrid
              days={days}
              events={events}
              compact={mode === 'week'}
              onPressSlot={(day, hour) => setDraft({ day, hour })}
              onPressEvent={openEvent}
            />
          </View>
        )}
      </Animated.View>

      <FloatingButton label={t('calendar.add')} onPress={() => setDraft({ day: anchor })} />

      <EventEditor draft={draft} accountId={account.id} onClose={() => setDraft(null)} />

      <BirthdayEditor draft={birthday} accountId={account.id} onClose={() => setBirthday(null)} />

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
          const inGroups = peopleGroups.some((group) =>
            group.entries.some((entry) => entry.source === source),
          );
          if (inGroups) {
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

/** Runder Knopf zum Blaettern — wie der Zurueck-Knopf, nur kleiner. */
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
  const press = usePressScale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      hitSlop={theme.spacing.xs}
    >
      <Animated.View
        style={[
          styles.stepButton,
          theme.elevation.card,
          {
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.surface,
            transform: [{ scale: press.scale }],
          },
        ]}
      >
        <Icon name={icon} size={16} color={theme.colors.text} />
      </Animated.View>
    </Pressable>
  );
}

/**
 * Die Woche als Leiste: Wochentag klein, Datum gross; der gewaehlte Tag liegt
 * als Tinte-Feld darunter, der Wochentag darin in Signalgruen.
 */
function WeekStrip({
  days,
  anchor,
  onSelect,
  alignToGrid,
}: {
  days: readonly Date[];
  anchor: Date;
  onSelect: (day: Date) => void;
  /** In der Wochenansicht stehen die Tage genau ueber ihren Spalten. */
  alignToGrid: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.strip,
        {
          gap: alignToGrid ? 0 : theme.spacing.xs,
          paddingLeft: alignToGrid ? GUTTER_WIDTH : theme.spacing.edge,
          paddingRight: alignToGrid ? 0 : theme.spacing.edge,
          paddingBottom: theme.spacing.sm,
        },
      ]}
    >
      {days.map((day) => {
        const selected = isSameDay(day, anchor);
        const today = isToday(day);
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
            style={[
              styles.stripCell,
              {
                gap: theme.spacing.xs,
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.radii.sm,
                backgroundColor: selected ? theme.colors.inverse : 'transparent',
              },
            ]}
          >
            <Text
              variant="overline"
              style={{
                fontSize: theme.fontSize.micro,
                lineHeight: theme.lineHeight.micro,
                letterSpacing: theme.tracking.label,
                color: selected ? theme.colors.accent : theme.colors.textFaint,
              }}
            >
              {new Intl.DateTimeFormat('de-CH', { weekday: 'short' }).format(day).slice(0, 2)}
            </Text>
            <Text
              variant="title"
              style={{
                fontSize: theme.fontSize.md,
                lineHeight: theme.lineHeight.md,
                color: selected
                  ? theme.colors.onInverse
                  : today
                    ? theme.colors.accentStrong
                    : theme.colors.text,
              }}
            >
              {day.getDate()}
            </Text>
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
      style={styles.allDay}
      contentContainerStyle={{
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.edge,
        paddingBottom: theme.spacing.sm,
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
            theme.elevation.card,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radii.sm,
              gap: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
            },
          ]}
        >
          <View style={[styles.allDayDot, { backgroundColor: eventColor(event.color) }]} />
          <Text variant="label" numberOfLines={1} style={{ fontWeight: theme.fontWeight.semibold }}>
            {event.title}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1 },
  shrink: { flexShrink: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  toolbar: { flexDirection: 'row', alignItems: 'center' },
  todayButton: { minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  stepButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  strip: { flexDirection: 'row' },
  stripCell: { flex: 1, alignItems: 'center', minHeight: 54 },
  allDay: { flexGrow: 0 },
  allDayChip: { flexDirection: 'row', alignItems: 'center', minHeight: 32, maxWidth: 200 },
  allDayDot: { width: 8, height: 8, borderRadius: 999 },
});
