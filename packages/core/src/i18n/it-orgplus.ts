import type { TranslationKey } from './de';

/** Italiano: e-mail in attività, appuntamento in una frase, promemoria (de-orgplus.ts). Parte di `it`. */
export const itOrgPlus = {
  'orgplus.mail.toTask': 'Come attività',
  'orgplus.mail.taskTitle': 'Rispondere: {subject}',
  'orgplus.mail.taskFrom': 'Da {sender}',
  'orgplus.mail.taskCreated': 'Attività creata',

  'orgplus.quick.label': 'Inserimento rapido',
  'orgplus.quick.placeholder': 'Dentista domani 9 @Via Stazione',
  'orgplus.quick.found': 'Riconosciuto',
  'orgplus.quick.span': '{from}–{to}',

  'orgplus.reminder.label': 'Promemoria',
  'orgplus.reminder.none': 'Nessuno',
  'orgplus.reminder.atStart': 'All’inizio',
  'orgplus.reminder.minutes': '{count} min',
  'orgplus.reminder.hour': '1 ora',
  'orgplus.reminder.dayBefore': 'Il giorno prima 18:00',
  'orgplus.reminder.onDay': 'Il giorno stesso 9:00',
  'orgplus.reminder.webOnly': 'Il promemoria arriva come notifica nell’app per telefono.',
  'orgplus.reminder.pushAt': 'Inizia alle {time}.',
  'orgplus.reminder.pushAllDay': 'Tutto il giorno · {day}',
} as const satisfies Partial<Record<TranslationKey, string>>;
