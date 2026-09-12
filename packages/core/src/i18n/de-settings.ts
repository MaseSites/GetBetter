/** Die Einstellungen mit ihren Bereichen. Teil von `de` — die Schluessel landen dort per Spread. */
export const deSettings = {
  'settings.title': 'Einstellungen',
  'settings.card.hint': 'Konto, Darstellung, Assistent und App',
  'settings.profile.edit': 'Profil bearbeiten',

  'settings.account': 'Konto',
  'settings.nickname': 'Spitzname',
  'settings.nickname.hint': 'So spricht dich die App an.',
  'settings.nickname.none': 'Noch keiner',
  'settings.username': 'Benutzername',
  'settings.username.hint': 'Klein geschrieben, ohne @ — so finden dich andere.',
  'settings.username.empty': 'Ohne Namen findet dich niemand. Schreib etwas hinein.',
  'settings.username.taken': 'Den hat schon jemand. Nimm einen anderen.',
  'settings.username.invalid':
    'Drei bis 24 Zeichen: Kleinbuchstaben, Zahlen, Punkt, Strich oder Unterstrich.',
  'settings.username.offline': 'Der Dienst antwortet nicht. Versuch es gleich nochmal.',
  'settings.email': 'E-Mail',
  'settings.email.fixed': 'Die E-Mail gehört zum Konto und lässt sich nicht ändern.',
  'settings.language': 'Sprache',
  'settings.since': 'Mitglied seit',

  'settings.appearance': 'Darstellung',
  'settings.appearance.hint': 'Gilt in allen Better-Apps.',
  'settings.style': 'Aussehen',
  'settings.backdrop': 'Hintergrund',
  'settings.assistant.none': 'Noch ohne Namen',

  'settings.household': 'Haushalt',
  'settings.household.none': 'Du bist noch in keinem Haushalt.',
  'settings.household.join': 'Haushalt beitreten',

  'settings.app': 'App',
  'settings.app.version': 'Version',
} as const;
