/** Texte fuer die Geburtstage. Teil von `de` — die Schluessel landen dort per Spread. */
export const deBirthdays = {
  // Demnächst
  'birthdays.section.week': 'Diese Woche',
  'birthdays.section.month': 'Dieser Monat',
  'birthdays.section.later': 'Später',
  'birthdays.turnsToday': 'wird heute {age}',
  'birthdays.hasToday': 'hat heute Geburtstag',
  'birthdays.turnsOnShort': 'wird {age} · {date}',
  'birthdays.dateTurns': '{date} · wird {age}',
  'birthdays.turnsOn': 'wird {age} am {date}',
  'birthdays.birthdayOn': 'hat am {date} Geburtstag',
  'birthdays.daysUnit': 'Tagen',
  'birthdays.inDays': 'in {days} Tagen',
  'birthdays.message': 'Nachricht',
  'birthdays.addPerson': 'Person hinzufügen',
  'birthdays.editAction': 'Bearbeiten',
  'birthdays.removeBirthday': 'Geburtstag entfernen',
  'birthdays.removed': 'Geburtstag von {name} entfernt',
  'birthdays.emptyLine': 'Wer als Nächstes feiert, steht hier zuoberst.',
  'birthdays.noMatch': 'Niemand heisst „{query}“.',
  'birthdays.page': 'Person {index} von {count}',
  'birthdays.eventNoAge': '{name} hat Geburtstag',
  'birthdays.pair': '{first} · {second}',

  // Anlegen und Bearbeiten
  'birthdays.form.titleEdit': 'Geburtstag bearbeiten',
  'birthdays.form.save': 'Sichern',
  'birthdays.form.namePlaceholder': 'Name',
  'birthdays.form.suggestion': '{name} · {date}',
  'birthdays.form.photo': 'Foto wählen',
  'birthdays.form.photoError': 'Das Foto liess sich nicht hochladen.',
  'birthdays.form.firstSaved': 'Erinnerung 1 Woche vorher und am Tag',

  // Person
  'birthdays.person.goneTitle': 'Nicht mehr da',
  'birthdays.person.goneBody': 'Dieser Geburtstag wurde entfernt.',
  'birthdays.reminders.weekBefore': '1 Woche vorher',
  'birthdays.reminders.dayOf': 'Am Tag',
  'birthdays.reminders.off': 'Keine',
} as const;
