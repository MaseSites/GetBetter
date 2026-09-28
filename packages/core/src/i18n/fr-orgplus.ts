import type { TranslationKey } from './de';

/** Français : e-mail en tâche, rendez-vous en une phrase, rappels (de-orgplus.ts). Partie de `fr`. */
export const frOrgPlus = {
  'orgplus.mail.toTask': 'En tâche',
  'orgplus.mail.taskTitle': 'Répondre : {subject}',
  'orgplus.mail.taskFrom': 'De {sender}',
  'orgplus.mail.taskCreated': 'Tâche créée',

  'orgplus.quick.label': 'Saisie rapide',
  'orgplus.quick.placeholder': 'Dentiste demain 9 @Rue de la Gare',
  'orgplus.quick.found': 'Reconnu',
  'orgplus.quick.span': '{from}–{to}',

  'orgplus.reminder.label': 'Rappel',
  'orgplus.reminder.none': 'Aucun',
  'orgplus.reminder.atStart': 'À l’heure',
  'orgplus.reminder.minutes': '{count} min',
  'orgplus.reminder.hour': '1 h',
  'orgplus.reminder.dayBefore': 'La veille 18:00',
  'orgplus.reminder.onDay': 'Le jour même 9:00',
  'orgplus.reminder.webOnly': 'Le rappel arrive comme notification dans l’app mobile.',
  'orgplus.reminder.pushAt': 'Commence à {time}.',
  'orgplus.reminder.pushAllDay': 'Toute la journée · {day}',
} as const satisfies Partial<Record<TranslationKey, string>>;
