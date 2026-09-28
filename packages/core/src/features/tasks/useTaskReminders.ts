import { useEffect, useState } from 'react';

import { useLiveQuery } from '@/db';
import { events as eventRepo, tasks as taskRepo } from '@/db/repositories';
import { formatLongDate, formatTime, useI18n } from '@/i18n';
import { eventRemindersOf } from '@/features/calendar/reminders';

import { canPushReminders, syncPushReminders } from './pushReminders';
import { mergeReminders, remindersOf, sameReminders, type Reminder } from './reminders';

/**
 * Merkt sich, was zuletzt gestellt wurde — ausserhalb von React, damit der
 * Effekt nichts setzt und nur bei einer echten Aenderung neu stellt.
 */
class ReminderSync {
  private last: readonly Reminder[] | null = null;

  apply(next: readonly Reminder[], bodyOf: (reminder: Reminder) => string): void {
    if (this.last && sameReminders(this.last, next)) return;
    this.last = next;
    void syncPushReminders(next, bodyOf);
  }
}

/**
 * Haelt die Mitteilungen des Handys mit den Aufgaben **und Terminen** gleich:
 * sobald sich eine Frist, Uhrzeit oder ein Vorlauf aendert, werden die
 * naechsten Erinnerungen neu gestellt (`remindersOf`, `eventRemindersOf`,
 * zusammen hoechstens `MAX_SCHEDULED`). Einmal in der Huelle (`RootShell`),
 * fuer das angemeldete Konto — ohne Konto nichts.
 */
export function useTaskReminders(accountId: string | null): void {
  const { t, language } = useI18n();
  const list = useLiveQuery(
    () =>
      accountId && canPushReminders ? taskRepo.listOpen(accountId, null) : Promise.resolve([]),
    [accountId],
  );
  const eventList = useLiveQuery(
    () =>
      accountId && canPushReminders
        ? eventRepo.listWithReminder(accountId, new Date().toISOString())
        : Promise.resolve([]),
    [accountId],
  );
  const [sync] = useState(() => new ReminderSync());

  useEffect(() => {
    if (!canPushReminders || !accountId || !list.data || !eventList.data) return;
    const now = new Date();
    const next = mergeReminders([remindersOf(list.data, now), eventRemindersOf(eventList.data, now)]);
    sync.apply(next, (reminder) => {
      if (reminder.kind !== 'event' || !reminder.startsAt) return t('tasks.reminder.push');
      return reminder.allDay
        ? t('orgplus.reminder.pushAllDay', { day: formatLongDate(language, reminder.startsAt) })
        : t('orgplus.reminder.pushAt', { time: formatTime(language, reminder.startsAt) });
    });
  }, [accountId, list.data, eventList.data, sync, t, language]);
}
