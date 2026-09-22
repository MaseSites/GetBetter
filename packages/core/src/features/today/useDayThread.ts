import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';

import { appUrl } from '@/app/bridge';
import { APPS, storeUrl, type AppId } from '@/app/identity';
import {
  bills as billRepo,
  contacts as contactRepo,
  dayKey,
  documents as documentRepo,
  habits as habitRepo,
  trips as tripRepo,
  useLiveQuery,
} from '@/db';
import {
  alarms as alarmRepo,
  events as eventRepo,
  shopping as shoppingRepo,
} from '@/db/repositories';
import { WEEKDAYS } from '@/features/alarm/AlarmView';
import { calendarLinkOf } from '@/features/calendar/links';
import { useCalendarAccess } from '@/features/calendar/useCalendarAccess';
import { daysUntil, nextBirthday, parseDay, relativeDay, shiftDay } from '@/features/shared/days';
import { formatMoney, useI18n } from '@/i18n';
import { MODULES, modulesOfApp } from '@/mocks/modules';
import { moduleName } from '@/mocks/moduleText';
import { useAccount, useApp } from '@/state/AppContext';
import { moduleBase, useTheme } from '@/theme';
import type { IconName } from '@/ui';

import type { AllDayEntry, DayEntry } from './DayThread';

/** Was an einem Tag im Band steht. */
export type DayThreadData = {
  isToday: boolean;
  /** Die Abfragen des Tages sind da — vorher waere jede Rechnung mit leeren Listen. */
  ready: boolean;
  entries: DayEntry[];
  allDay: AllDayEntry[];
  /** Der Tag danach, fuer die Vorschau ganz unten im Band. */
  nextDay: string;
  nextEntries: DayEntry[];
};

const HOUR_MS = 60 * 60 * 1000;

/** Wie viel die Startseite zeigt — der grosse Zeitstrahl zeigt alles. */
const SHORT = { events: 3, habits: 3, bills: 2, documents: 2 } as const;

/**
 * Was an einem Tag im Band steht — fuer die Startseite und den grossen
 * Zeitstrahl, damit beide dasselbe zeigen. Es ordnet, was die Funktionen
 * wissen, nach der Zeit statt nach Funktion; was man direkt tun kann
 * (abhaken, bezahlen, Gewohnheit setzen), geht ueber den Kreis links.
 *
 * `full`: der ganze Tag — auch was heute schon vorbei ist, ohne Obergrenzen.
 * Sonst die kurze Fassung der Startseite: heute die naechsten drei Termine.
 * Aufgaben stehen nie im Band, sondern in `DayTasks` darunter.
 */
export function useDayThread(
  day: string,
  { full = false }: { full?: boolean } = {},
): DayThreadData {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const { household } = useApp();
  const { access } = useCalendarAccess();
  const householdId = household?.id ?? null;

  const today = dayKey();
  const isToday = day === today;
  const short = !full;
  const dayFrom = parseDay(day).toISOString();
  const dayTo = parseDay(shiftDay(1, parseDay(day))).toISOString();
  const nextDay = shiftDay(1, parseDay(day));
  const nextTo = parseDay(shiftDay(1, parseDay(nextDay))).toISOString();
  const calendarKeys = [access.accountId, access.householdIds, access.calendarIds];

  // Heute zeigt die Startseite die naechsten drei; sonst gilt der ganze Tag.
  const upcoming = useLiveQuery(
    () =>
      eventRepo.listUpcoming(access, new Date().toISOString(), SHORT.events, { timedOnly: true }),
    calendarKeys,
  );
  const dayEvents = useLiveQuery(
    () => eventRepo.listDay(access, dayFrom, dayTo, { timedOnly: true }),
    [...calendarKeys, dayFrom, dayTo],
  );
  const allDayEvents = useLiveQuery(
    () => eventRepo.listAllDay(access, dayFrom, dayTo),
    [...calendarKeys, dayFrom, dayTo],
  );
  const nextAllDayEvents = useLiveQuery(
    () => eventRepo.listAllDay(access, dayTo, nextTo),
    [...calendarKeys, dayTo, nextTo],
  );
  const nextEvents = useLiveQuery(
    () => eventRepo.listDay(access, dayTo, nextTo, { timedOnly: true }),
    [...calendarKeys, dayTo, nextTo],
  );
  const nextAlarm = useLiveQuery(() => alarmRepo.nextEnabled(account.id), [account.id]);
  const alarmList = useLiveQuery(() => alarmRepo.list(account.id), [account.id]);
  const habitList = useLiveQuery(() => habitRepo.list(account.id), [account.id]);
  const habitTicks = useLiveQuery(() => habitRepo.ticks(account.id), [account.id]);
  const openBills = useLiveQuery(() => billRepo.listOpen(account.id), [account.id]);
  const documentList = useLiveQuery(() => documentRepo.list(account.id), [account.id]);
  const tripList = useLiveQuery(() => tripRepo.list(account.id), [account.id]);
  const contactList = useLiveQuery(() => contactRepo.list(account.id), [account.id]);
  const shoppingList = useLiveQuery(
    () => shoppingRepo.list(account.id, householdId),
    [account.id, householdId],
  );

  const mine = modulesOfApp();
  const owns = (id: string) => mine.some((module) => module.id === id);
  const nameOf = (id: string) => moduleName(t, id);
  const iconOf = (id: string): IconName =>
    MODULES.find((module) => module.id === id)?.icon ?? 'circle';
  const cap = <T>(rows: readonly T[], limit: number) => (short ? rows.slice(0, limit) : rows);

  /** "06:40" auf den gezeigten Tag bezogen, damit es an seiner Zeit steht. */
  function dayAt(time: string): string {
    const [hours, minutes] = time.split(':');
    const when = parseDay(day);
    when.setHours(Number(hours), Number(minutes), 0, 0);
    return when.toISOString();
  }

  /** Der Wecker, der an diesem Tag klingelt: ohne Wochentage jeden Tag, sonst nur an den angehakten. */
  function alarmOfDay() {
    if (isToday) return nextAlarm.data;
    const weekday = WEEKDAYS[(parseDay(day).getDay() + 6) % 7];
    return (alarmList.data ?? []).find(
      (row) => row.enabled && (row.days.length === 0 || row.days.includes(weekday ?? '')),
    );
  }

  /** Oeffnet eine andere Better-App — im Store, sobald es sie dort gibt. */
  function openApp(id: AppId) {
    void Linking.openURL(storeUrl(APPS[id], Platform.OS) ?? appUrl(id));
  }

  const entries: DayEntry[] = [];

  const dayAlarm = alarmOfDay();
  if (dayAlarm && owns('alarm')) {
    entries.push({
      key: 'alarm',
      moduleId: 'alarm',
      icon: iconOf('alarm'),
      at: dayAt(dayAlarm.time),
      title: dayAlarm.label || nameOf('alarm'),
      tag: nameOf('alarm'),
      onPress: () => router.push('/run/alarm'),
    });
  }

  // Ganztaegiges steht in der eigenen Zeile ueber dem Band, nicht dazwischen.
  const timedEvents =
    isToday && short
      ? (upcoming.data ?? []).filter((row) => row.startsAt.slice(0, 10) === today && !row.allDay)
      : (dayEvents.data ?? []);
  for (const event of timedEvents) {
    entries.push({
      key: `event-${event.id}`,
      moduleId: 'calendar',
      icon: iconOf('calendar'),
      at: event.startsAt,
      // Ohne Ende dauert ein Termin eine Stunde — wie im Kalender.
      until: event.endsAt ?? new Date(Date.parse(event.startsAt) + HOUR_MS).toISOString(),
      // Ohne „Kalender“ rechts: Uhrzeit und Symbol sagen schon, was es ist.
      title: event.title,
      onPress: () => router.push(calendarLinkOf(event)),
    });
  }

  // Aufgaben stehen nicht im Band, sondern darunter in ihrem eigenen Bereich
  // (`DayTasks`) — mit Verschieben, Abhaken und Neu fuer diesen Tag.

  // Gewohnheiten hakt man heute ab, nicht im Voraus.
  if (isToday && owns('habits')) {
    const ticked = new Set(
      (habitTicks.data ?? []).filter((tick) => tick.day === today).map((tick) => tick.habitId),
    );
    for (const habit of cap(
      (habitList.data ?? []).filter((row) => !ticked.has(row.id)),
      SHORT.habits,
    )) {
      entries.push({
        key: `habit-${habit.id}`,
        moduleId: 'habits',
        icon: iconOf('habits'),
        title: habit.name,
        tag: nameOf('habits'),
        onPress: () => router.push('/run/habits'),
        onToggle: () => void habitRepo.toggle(habit.id, account.id, today),
      });
    }
  }

  const dayBills = (openBills.data ?? []).filter((row) =>
    isToday ? row.dueDay <= today : row.dueDay === day,
  );
  for (const bill of cap(dayBills, SHORT.bills)) {
    entries.push({
      key: `bill-${bill.id}`,
      moduleId: 'bills',
      icon: iconOf('bills'),
      title: bill.title,
      meta: formatMoney(language, bill.amountChf),
      tag: nameOf('bills'),
      onPress: owns('bills') ? () => router.push('/run/bills') : () => openApp('bettermoney'),
      // Antippen heisst bezahlt — wie beim Abhaken einer Aufgabe.
      onToggle: () => void billRepo.setPaid(bill.id, true),
    });
  }

  if (isToday && owns('documents')) {
    const expiring = (documentList.data ?? []).filter(
      (row) => row.expiresOn !== null && daysUntil(row.expiresOn) <= 60,
    );
    for (const row of cap(expiring, SHORT.documents)) {
      entries.push({
        key: `doc-${row.id}`,
        moduleId: 'documents',
        icon: iconOf('documents'),
        title: row.title,
        meta: row.expiresOn ? relativeDay(t, language, row.expiresOn) : undefined,
        tag: nameOf('documents'),
        onPress: () => router.push('/run/documents'),
      });
    }
  }

  const nextTrip = (tripList.data ?? []).find((trip) => trip.endDay >= today);
  if (isToday && owns('travel') && nextTrip) {
    entries.push({
      key: `trip-${nextTrip.id}`,
      moduleId: 'travel',
      icon: iconOf('travel'),
      title: nextTrip.name,
      meta:
        nextTrip.startDay <= today
          ? t('trips.ongoing')
          : relativeDay(t, language, nextTrip.startDay),
      tag: nameOf('travel'),
      onPress: () => router.push('/run/travel'),
    });
  }

  const shopping = (shoppingList.data ?? []).filter((row) => !row.done);
  if (isToday && shopping.length > 0) {
    entries.push({
      key: 'shopping',
      moduleId: 'shopping',
      icon: iconOf('shopping'),
      title: nameOf('shopping'),
      meta: t('today.openCount', { count: String(shopping.length) }),
      tag: nameOf('shopping'),
      onPress: owns('shopping')
        ? () => router.push('/run/shopping')
        : () => openApp('betterfamily'),
    });
  }

  // Geburtstage gehoeren der Funktion Geburtstage, wo es sie gibt, sonst den Kontakten.
  const birthdayModule = owns('birthdays') ? 'birthdays' : owns('contacts') ? 'contacts' : null;
  const birthdays = (contactList.data ?? []).flatMap((row) =>
    row.birthday ? [{ row, next: nextBirthday(row.birthday) }] : [],
  );

  /** Ein Tipp auf einen Geburtstag oeffnet die Person selbst, wo es die Funktion gibt. */
  const openPerson = (contactId: string) =>
    router.push(
      birthdayModule === 'birthdays'
        ? `/run/birthdays?person=${encodeURIComponent(contactId)}`
        : `/run/${birthdayModule ?? 'contacts'}`,
    );

  /** „Max wird 45“, ohne Jahr „Max hat Geburtstag“ — der Tag steht schon darueber. */
  const birthdayTitle = ({ row, next }: (typeof birthdays)[number]) =>
    row.birthYearKnown === false
      ? t('birthdays.eventNoAge', { name: row.name })
      : t('birthdays.event', { name: row.name, age: next.age });

  /** Die Karte ueber dem Band: wer an diesem Tag feiert, dann ganztaegige Termine. */
  const allDay: AllDayEntry[] = [
    ...(birthdayModule
      ? birthdays
          .filter((entry) => entry.next.day === day)
          .map((entry): AllDayEntry => ({
            key: `birthday-today-${entry.row.id}`,
            title: birthdayTitle(entry),
            icon: 'gift',
            color: moduleBase(theme, birthdayModule),
            onPress: () => openPerson(entry.row.id),
          }))
      : []),
    ...(allDayEvents.data ?? []).map((event): AllDayEntry => ({
      key: `allday-${event.id}`,
      title: event.title,
      // Wie jeder andere Termin: das Kalender-Symbol in der Farbe des Kalenders.
      icon: iconOf('calendar'),
      color: moduleBase(theme, 'calendar'),
      onPress: owns('calendar') ? () => router.push(calendarLinkOf(event)) : undefined,
    })),
  ];

  /** Der naechste Tag ganz unten, verblassend: wer feiert, Ganztaegiges, dann nach Uhrzeit. */
  const nextEntries: DayEntry[] = [
    ...(birthdayModule
      ? birthdays
          .filter((entry) => entry.next.day === nextDay)
          .map((entry): DayEntry => ({
            key: `next-birthday-${entry.row.id}`,
            moduleId: birthdayModule,
            icon: 'gift',
            title: birthdayTitle(entry),
          }))
      : []),
    ...(nextAllDayEvents.data ?? []).map((event): DayEntry => ({
      key: `next-allday-${event.id}`,
      moduleId: 'calendar',
      icon: iconOf('calendar'),
      title: event.title,
    })),
    ...(nextEvents.data ?? []).map((event): DayEntry => ({
      key: `next-event-${event.id}`,
      moduleId: 'calendar',
      icon: iconOf('calendar'),
      at: event.startsAt,
      title: event.title,
    })),
  ];

  return {
    isToday,
    // Erst wenn alles da ist — sonst rollte der Zeitstrahl an einem Eintrag
    // vorbei, der einen Augenblick spaeter kommt.
    ready: [
      upcoming,
      dayEvents,
      allDayEvents,
      nextAlarm,
      alarmList,
      habitList,
      habitTicks,
      openBills,
      documentList,
      tripList,
      contactList,
      shoppingList,
    ].every((query) => !query.loading),
    entries,
    allDay,
    nextDay,
    nextEntries,
  };
}
