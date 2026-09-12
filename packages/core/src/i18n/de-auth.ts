/** Begruessung, Anmelden und Registrieren. Teil von `de` — die Schluessel landen dort per Spread. */
export const deAuth = {
  // Die Begruessung: unter den Knoepfen die Anbieter, ganz unten eine stille Zeile.
  'auth.start.note': 'Ein Konto gilt in allen Better-Apps.',
  'auth.provider.apple': 'Apple',
  'auth.provider.google': 'Google',

  // Registrieren — hier steht schon alles, was ein Konto ausmacht.
  'auth.signUp.subtitleFull': 'E-Mail, Benutzername und ein Passwort mit mindestens acht Zeichen.',
  'auth.username': 'Benutzername',
  'auth.usernameHint':
    'Drei bis 24 Zeichen: Kleinbuchstaben, Zahlen, Punkt, Strich oder Unterstrich.',
  'auth.usernameChecking': 'Ich schaue nach, ob der Name noch frei ist …',
  'auth.usernameFree': 'Dieser Benutzername ist frei.',
  'auth.passwordRepeat': 'Passwort wiederholen',
  'auth.passwordRepeatPlaceholder': 'Nochmal dasselbe Passwort',

  'auth.error.usernameInvalid':
    'Der Benutzername braucht drei bis 24 Zeichen — Kleinbuchstaben, Zahlen, Punkt, Strich oder Unterstrich.',
  'auth.error.usernameTaken': 'Diesen Benutzernamen hat schon jemand. Nimm bitte einen anderen.',
  'auth.error.passwordMismatch': 'Die beiden Passwörter sind nicht gleich.',
} as const;
