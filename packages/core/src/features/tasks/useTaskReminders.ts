import { useEffect, useState } from 'react';

import { useLiveQuery } from '@/db';
import { tasks as taskRepo } from '@/db/repositories';
import { useI18n } from '@/i18n';

import { canPushReminders, syncPushReminders } from './pushReminders';
import { remindersOf, sameReminders, type Reminder } from './reminders';

/**
 * Merkt sich, was zuletzt gestellt wurde — ausserhalb von React, damit der
 * Effekt nichts setzt und nur bei einer echten Aenderung neu stellt.
 */
class ReminderSync {
  private last: readonly Reminder[] | null = null;

  apply(next: readonly Reminder[], bodyOf: () => string): void {
    if (this.last && sameReminders(this.last, next)) return;
    this.last = next;
    void syncPushReminders(next, bodyOf);
  }
}

/**
 * Haelt die Mitteilungen des Handys mit den Aufgaben gleich: sobald sich
 * eine Frist, Uhrzeit oder ein Vorlauf aendert, werden die naechsten
 * Erinnerungen neu gestellt (`remindersOf`, getestet). Einmal in der Huelle
 * (`RootShell`), fuer das angemeldete Konto — ohne Konto nichts.
 */
export function useTaskReminders(accountId: string | null): void {
  const { t } = useI18n();
  const list = useLiveQuery(
    () =>
      accountId && canPushReminders ? taskRepo.listOpen(accountId, null) : Promise.resolve([]),
    [accountId],
  );
  const [sync] = useState(() => new ReminderSync());

  useEffect(() => {
    if (!canPushReminders || !accountId || !list.data) return;
    sync.apply(remindersOf(list.data, new Date()), () => t('tasks.reminder.push'));
  }, [accountId, list.data, sync, t]);
}
