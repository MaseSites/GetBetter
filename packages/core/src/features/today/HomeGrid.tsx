import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { contacts as contactRepo, dayKey, useLiveQuery } from '@/db';
import { events as eventRepo, tasks as taskRepo } from '@/db/repositories';
import { dueDayOf } from '@/db/taskFields';
import { birthdaysBetween } from '@/features/birthdays/birthdays';
import { eventColor } from '@/features/calendar/colors';
import { calendarLinkOf } from '@/features/calendar/links';
import { useCalendarAccess } from '@/features/calendar/useCalendarAccess';
import { parseDay, relativeDay, shiftDay } from '@/features/shared/days';
import { formatDayMonth, formatTime, formatWeekday, useI18n } from '@/i18n';
import { useAccount, useApp } from '@/state/AppContext';
import { moduleBase, useTheme } from '@/theme';
import { Icon, Text } from '@/ui';

import { dayDots, weekAgenda, weekDays, WEEK_DAYS, type AgendaItem } from './weekAgenda';

/** Die Punkte unter einem Tag im Streifen. */
const DOT = 6;
const DOTS_SHOWN = 3;
/** Der Kreis um den heutigen Tag. */
const TODAY_RING = 36;
/** Die Zeitspalte links in der Liste. */
const TIME_COLUMN = 48;
/** Der Farbbalken eines Eintrags. */
const BAR = 3;
const BAR_HEIGHT = 20;

/**
 * Die Startseite als **Übersicht**: die naechsten sieben Tage auf einen Blick.
 * Oben der **Wochenstreifen** — je Tag der Wochentag und die Zahl, heute im
 * Kreis, darunter Farbpunkte fuer das, was ansteht —, darunter die **Liste**
 * dieser Tage: Termine mit ihrer Farbe, Geburtstage, Aufgaben mit Frist, nach
 * Tag und Uhrzeit. Tage ohne etwas fehlen. Ein Tipp auf einen Tag im Streifen
 * oeffnet ihn im grossen Zeitstrahl, ein Tipp auf eine Zeile den Eintrag.
 */
export function HomeGrid() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const { household } = useApp();
  const { access } = useCalendarAccess();
  const householdId = household?.id ?? null;
  const today = dayKey();
  const days = weekDays(today);
  const fromIso = parseDay(today).toISOString();
  const toIso = parseDay(shiftDay(WEEK_DAYS, parseDay(today))).toISOString();

  const events = useLiveQuery(
    () => eventRepo.listDay(access, fromIso, toIso),
    [access.accountId, access.householdIds, access.calendarIds, fromIso, toIso],
  );
  const openTasks = useLiveQuery(
    () => taskRepo.listOpen(account.id, householdId),
    [account.id, householdId],
  );
  const contactList = useLiveQuery(() => contactRepo.list(account.id), [account.id]);

  const people = (contactList.data ?? []).flatMap((row) =>
    row.birthday
      ? [{ id: row.id, name: row.name, birthday: row.birthday, yearKnown: row.birthYearKnown !== false }]
      : [],
  );
  const birthdays = birthdaysBetween(people, parseDay(today), parseDay(shiftDay(WEEK_DAYS - 1, parseDay(today))));

  const items: (AgendaItem & { day: string })[] = [
    ...(events.data ?? []).map((event) => ({
      key: `event-${event.id}`,
      kind: 'event' as const,
      day: dayKey(new Date(event.startsAt)),
      title: event.title,
      color: eventColor(event.color),
      at: event.allDay ? null : event.startsAt,
      time: null,
      onPress: () => router.push(calendarLinkOf(event)),
    })),
    ...birthdays.map((entry) => ({
      key: `birthday-${entry.person.id}-${entry.day}`,
      kind: 'birthday' as const,
      day: entry.day,
      title: entry.person.yearKnown
        ? t('birthdays.event', { name: entry.person.name, age: entry.age })
        : t('birthdays.eventNoAge', { name: entry.person.name }),
      color: moduleBase(theme, 'birthdays'),
      at: null,
      time: null,
      onPress: () => router.push(`/run/birthdays?person=${encodeURIComponent(entry.person.id)}`),
    })),
    ...(openTasks.data ?? []).flatMap((task) => {
      const day = dueDayOf(task);
      if (!day) return [];
      return [
        {
          key: `task-${task.id}`,
          kind: 'task' as const,
          day,
          title: task.title,
          color: moduleBase(theme, 'tasks'),
          at: null,
          time: task.dueTime ?? null,
          onPress: () => router.push(`/run/tasks?task=${task.id}`),
        },
      ];
    }),
  ];
  const agenda = weekAgenda(today, items);
  const openDay = (day: string) => router.push(`/timeline?day=${day}`);

  return (
    <View style={{ gap: theme.spacing.lg }}>
      {/* Der Wochenstreifen: sieben Tage, heute im Kreis, darunter die Farbpunkte. */}
      <View
        style={[
          styles.strip,
          theme.elevation.card,
          {
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.xs,
            borderRadius: theme.radii.lg,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        {days.map((day) => {
          const isToday = day === today;
          const date = parseDay(day);
          const dots = dayDots(agenda, day, DOTS_SHOWN);
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={relativeDay(t, language, day)}
              onPress={() => openDay(day)}
              style={({ pressed }) => [styles.day, { gap: theme.spacing.xs, opacity: pressed ? 0.6 : 1 }]}
            >
              <Text variant="caption" tone={isToday ? 'default' : 'faint'}>
                {formatWeekday(language, date.toISOString()).replace('.', '')}
              </Text>
              <View
                style={[
                  styles.ring,
                  {
                    borderRadius: theme.radii.pill,
                    backgroundColor: isToday ? theme.colors.inverse : 'transparent',
                  },
                ]}
              >
                <Text
                  variant="title"
                  style={{
                    fontSize: theme.fontSize.lg,
                    lineHeight: theme.lineHeight.lg,
                    color: isToday ? theme.colors.onInverse : theme.colors.text,
                  }}
                >
                  {date.getDate()}
                </Text>
              </View>
              <View style={[styles.dots, { gap: 3, height: DOT }]}>
                {dots.map((color, index) => (
                  <View key={index} style={[styles.dot, { backgroundColor: color }]} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Die Liste: je Tag eine Ueberschrift, darunter die Eintraege nach Uhrzeit. */}
      {agenda.length === 0 ? (
        <Text variant="body" tone="muted" align="center" style={{ paddingVertical: theme.spacing.xl }}>
          {t('today.week.empty')}
        </Text>
      ) : (
        agenda.map((entry) => (
          <View key={entry.day} style={{ gap: theme.spacing.xs }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={relativeDay(t, language, entry.day)}
              onPress={() => openDay(entry.day)}
              style={({ pressed }) => [
                styles.row,
                {
                  gap: theme.spacing.sm,
                  paddingBottom: theme.spacing.xs,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.colors.borderStrong,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <Text
                variant="label"
                tone={entry.day === today ? 'accent' : 'default'}
                style={{ fontWeight: theme.fontWeight.semibold }}
              >
                {relativeDay(t, language, entry.day)}
              </Text>
              <Text variant="label" tone="faint">
                {formatDayMonth(language, parseDay(entry.day))}
              </Text>
              <View style={styles.grow} />
              <Icon name="forward" size={14} color={theme.colors.textFaint} />
            </Pressable>
            {entry.items.map((item) => (
              <AgendaRow key={item.key} item={item} />
            ))}
          </View>
        ))
      )}
    </View>
  );
}

/** Eine Zeile: links die Uhrzeit (oder nichts), ein Farbbalken, der Titel. */
function AgendaRow({ item }: { item: AgendaItem }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const time = item.at ? formatTime(language, item.at) : item.time;
  const spoken = [time ?? t('today.week.allDay'), item.title].join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      onPress={item.onPress}
      style={({ pressed }) => [
        styles.row,
        { gap: theme.spacing.md, paddingVertical: theme.spacing.sm, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Text variant="label" tone={time ? 'muted' : 'faint'} style={{ width: TIME_COLUMN }}>
        {time ?? (item.kind === 'task' ? '' : t('today.week.allDay'))}
      </Text>
      <View style={[styles.bar, { borderRadius: theme.radii.pill, backgroundColor: item.color }]} />
      {item.kind === 'task' ? (
        <Icon name="circle" size={16} color={theme.colors.textFaint} />
      ) : item.kind === 'birthday' ? (
        <Icon name="gift" size={16} color={item.color} />
      ) : null}
      <Text variant="body" numberOfLines={1} style={styles.grow}>
        {item.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'flex-start' },
  day: { flex: 1, alignItems: 'center' },
  ring: { width: TODAY_RING, height: TODAY_RING, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  bar: { width: BAR, height: BAR_HEIGHT },
});
