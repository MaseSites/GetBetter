import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Reminder } from './reminders';

/**
 * Erinnerungen als Mitteilung aufs Handy (`expo-notifications`): lokal
 * geplant, kein Server dazwischen. Im Browser gibt es das nicht — dort steht
 * die Erinnerung nur an der Aufgabe.
 */
export const canPushReminders = Platform.OS !== 'web';

let prepared = false;

/** Auch wenn die App gerade offen ist, soll die Mitteilung erscheinen. */
function prepare(): void {
  if (prepared || !canPushReminders) return;
  prepared = true;
  Notifications.setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
  });
}

async function allowed(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * Stellt die Erinnerungen neu: alles Geplante weg, dann je Erinnerung eine
 * Mitteilung zu ihrer Zeit. `false`, wenn das Handy keine Mitteilungen erlaubt.
 */
export async function syncPushReminders(
  reminders: readonly Reminder[],
  bodyOf: (reminder: Reminder) => string,
): Promise<boolean> {
  if (!canPushReminders) return false;
  prepare();
  if (reminders.length === 0) {
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
    return true;
  }
  if (!(await allowed())) return false;
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Promise.all(
    reminders.map((reminder) =>
      Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.title,
          body: bodyOf(reminder),
          data: { taskId: reminder.taskId },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(reminder.at),
        },
      }),
    ),
  );
  return true;
}
