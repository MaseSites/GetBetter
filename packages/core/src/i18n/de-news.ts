/** Mitteilungen, die Glocke und „Was gibt's Neues“. Teil von `de` — die Schluessel landen dort per Spread. */
export const deNews = {
  'news.title': 'Was gibt’s Neues',
  'news.empty': 'Keine Neuigkeiten',
  'news.more': '+{count} weitere',
  'news.bell.label': 'Mitteilungen, {count} neu',
  'news.bell.many': '{count}+',

  'news.inbox.title': 'Mitteilungen',
  'news.inbox.new': 'Neu',
  'news.inbox.earlier': 'Früher',
  'news.inbox.clear': 'Alle entfernen',
  'news.inbox.empty.title': 'Keine Mitteilungen',
  'news.inbox.empty.body': 'Einladungen, Anfragen und neue E-Mails landen hier.',

  // Die Sätze je Art. {name} ist die Person, {calendar} und {household} der Name.
  'news.calendarShare': '{name} möchte deinen Kalender sehen.',
  'news.calendarInvite': '{name} lädt dich in den Kalender «{calendar}» ein.',
  'news.householdInvite': '{name} lädt dich in den Haushalt «{household}» ein.',
  'news.mail': 'Neue E-Mail von {name}',
  'news.mail.noSubject': 'Ohne Betreff',
  'news.system': 'Mitteilung',
  'news.someone': 'Jemand',
  'news.calendarFallback': 'Kalender',
  'news.householdFallback': 'Haushalt',

  'news.action.read': 'Gelesen',
  'news.action.dismiss': 'Weg damit',
  'news.action.accept': 'Annehmen',
  'news.action.decline': 'Ablehnen',
  'news.action.seen': 'Gesehen',
  'news.action.delete': 'Löschen',
  'news.action.openMail': 'E-Mail öffnen: {subject}',

  'news.time.now': 'Gerade eben',
  'news.time.minutes': 'Vor {count} Min.',
  'news.time.hours': 'Vor {count} Std.',

  'news.error.failed': 'Das hat nicht geklappt. Versuch es nochmal.',
  'news.error.calendarLimit': 'Du bist schon in {max} Kalendern.',
  'news.error.householdLimit': 'Du bist schon in {max} Haushalten.',
} as const;
