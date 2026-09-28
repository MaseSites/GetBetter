/**
 * Organisation, schnelle Gewinne: Mail → Aufgabe, Termin in einem Satz,
 * Erinnerung vor Terminen. Teil von `de` — die Schluessel landen dort per Spread.
 */
export const deOrgPlus = {
  // Mail → Aufgabe
  'orgplus.mail.toTask': 'Als Aufgabe',
  'orgplus.mail.taskTitle': 'Antworten: {subject}',
  'orgplus.mail.taskFrom': 'Von {sender}',
  'orgplus.mail.taskCreated': 'Aufgabe angelegt',

  // Termin in einem Satz
  'orgplus.quick.label': 'Schnell eintragen',
  'orgplus.quick.placeholder': 'Zahnarzt morgen 9 @Bahnhofstrasse',
  'orgplus.quick.found': 'Erkannt',
  'orgplus.quick.span': '{from}–{to}',

  // Erinnerung vor Terminen
  'orgplus.reminder.label': 'Erinnerung',
  'orgplus.reminder.none': 'Keine',
  'orgplus.reminder.atStart': 'Zur Zeit',
  'orgplus.reminder.minutes': '{count} Min',
  'orgplus.reminder.hour': '1 Std',
  'orgplus.reminder.dayBefore': 'Am Vortag 18:00',
  'orgplus.reminder.onDay': 'Am Tag 9:00',
  'orgplus.reminder.webOnly': 'Die Erinnerung kommt als Mitteilung in der Handy-App.',
  'orgplus.reminder.pushAt': 'Beginnt um {time}.',
  'orgplus.reminder.pushAllDay': 'Ganztägig · {day}',
} as const;
