import type { TranslationKey } from './de';

/** English: mail to task, event in one sentence, event reminders (de-orgplus.ts). Part of `en`. */
export const enOrgPlus = {
  'orgplus.mail.toTask': 'As a task',
  'orgplus.mail.taskTitle': 'Reply: {subject}',
  'orgplus.mail.taskFrom': 'From {sender}',
  'orgplus.mail.taskCreated': 'Task created',

  'orgplus.quick.label': 'Quick add',
  'orgplus.quick.placeholder': 'Dentist tomorrow 9 @Main Street',
  'orgplus.quick.found': 'Recognised',
  'orgplus.quick.span': '{from}–{to}',

  'orgplus.reminder.label': 'Reminder',
  'orgplus.reminder.none': 'None',
  'orgplus.reminder.atStart': 'At start',
  'orgplus.reminder.minutes': '{count} min',
  'orgplus.reminder.hour': '1 hr',
  'orgplus.reminder.dayBefore': 'Day before 18:00',
  'orgplus.reminder.onDay': 'On the day 9:00',
  'orgplus.reminder.webOnly': 'The reminder arrives as a notification in the phone app.',
  'orgplus.reminder.pushAt': 'Starts at {time}.',
  'orgplus.reminder.pushAllDay': 'All day · {day}',
} as const satisfies Partial<Record<TranslationKey, string>>;
