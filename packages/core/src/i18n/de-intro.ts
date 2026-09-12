/** Intro, Anmelden, Einrichten mit dem Assistenten, Hintergründe, Tutorial. Teil von `de` — die Schluessel landen dort per Spread. */
export const deIntro = {
  // Der erste Bildschirm ohne Konto
  'intro.start.question': 'Willkommen. Hast du schon ein Better-Konto?',
  'intro.start.signIn': 'Anmelden',
  'intro.start.signUp': 'Konto erstellen',
  'intro.start.apple': 'Mit Apple anmelden',
  'intro.start.google': 'Mit Google anmelden',
  'intro.start.soon.apple':
    'Die Anmeldung mit Apple kommt, sobald die Apps im Store sind. Bis dahin genügt deine E-Mail-Adresse.',
  'intro.start.soon.google':
    'Die Anmeldung mit Google kommt, sobald die Apps im Store sind. Bis dahin genügt deine E-Mail-Adresse.',

  // Anmelden und Registrieren
  'intro.signIn.bubble': 'Willkommen zurück. Melde dich mit deiner E-Mail-Adresse an.',
  'intro.signUp.bubble': 'Wir legen dein Konto an. Das dauert einen Moment.',

  // Nach dem Einloggen
  'intro.arrive.question': 'Kennst du dich mit {app} schon aus?',
  'intro.arrive.questionNamed': '{name}, kennst du dich mit {app} schon aus?',
  'intro.arrive.yes': 'Ja, direkt starten',
  'intro.arrive.no': 'Nein, kurze Einführung',

  // Einrichten nach dem Registrieren
  'intro.setup.name.bubble': 'Dein Konto steht. Wie darf ich dich ansprechen?',
  'intro.setup.name.label': 'Spitzname',
  'intro.setup.name.hint':
    'So spricht dich die App an — unabhängig von deinem Benutzernamen. Du änderst ihn jederzeit in den Einstellungen.',
  'intro.setup.assistant.bubble': 'Ich begleite dich durch die App, {name}. Mein Name ist …',
  'intro.setup.assistant.bubbleNamed':
    'Ich begleite dich durch die App, {name}. Mein Name ist {assistant}.',
  'intro.setup.assistant.label': 'Name des Assistenten',
  'intro.setup.assistant.hint': 'Unter diesem Namen findest du mich in allen Better-Apps.',
  'intro.setup.style.bubble':
    'Gut, ich heisse {assistant}. Nun zum Aussehen — jede Änderung wirkt sofort.',
  'intro.setup.style.mode': 'Hell oder dunkel',
  'intro.setup.style.mode.light': 'Hell',
  'intro.setup.style.mode.dark': 'Dunkel',
  'intro.setup.style.mode.system': 'Automatisch',
  'intro.setup.style.accent': 'Akzentfarbe',
  'intro.setup.style.accentMono': 'In Schwarzweiss bleibt alles ohne Farbe.',
  'intro.setup.style.preset': 'Wie viel Farbe',
  'intro.setup.style.backdrop': 'Hintergrund',
  'intro.setup.ready.bubble':
    'Alles eingerichtet, {name}. Soll ich dir die App kurz zeigen, oder findest du dich selbst zurecht?',
  'intro.setup.ready.tour': 'Kurze Einführung',
  'intro.setup.ready.explore': 'Ich finde mich zurecht',

  // Die Akzentfarben beim Namen
  'intro.accent.signal': 'Signalgrün',
  'intro.accent.sage': 'Salbei',
  'intro.accent.blue': 'Blau',
  'intro.accent.violet': 'Violett',
  'intro.accent.rose': 'Rosé',
  'intro.accent.amber': 'Bernstein',
  'intro.accent.teal': 'Petrol',
  'intro.accent.slate': 'Schiefer',

  // Das Tutorial
  'intro.tutorial.done': 'Jetzt starten',
  'intro.tutorial.count': '{current} von {total}',
  'intro.tutorial.today.title': 'Heute',
  'intro.tutorial.today.body':
    'Dein Tag der Reihe nach: Termine und Aufgaben, eines nach dem anderen. Ganz oben steht, was den ganzen Tag gilt — Ganztägiges und Geburtstage.',
  'intro.tutorial.quick.title': 'Schnellzugriff',
  'intro.tutorial.quick.body':
    'Das Karussell oben führt dich mit einem Tipp in deine Bereiche. Über „+“ nimmst du weitere dazu, auch aus den anderen Better-Apps.',
  'intro.tutorial.areas.title': 'Bereiche & Favoriten',
  'intro.tutorial.areas.body':
    'Unter Bereiche liegt alles, was die App kann. Ein Tipp auf den Stern macht einen Bereich zum Favoriten.',
  'intro.tutorial.news.title': 'Mitteilungen',
  'intro.tutorial.news.body':
    'Die Glocke sammelt, was neu ist: Einladungen, Anfragen und was sich in deinen Apps getan hat.',
  'intro.tutorial.mail.title': 'E-Mail',
  'intro.tutorial.mail.body':
    'Alle deine Postfächer in einem Posteingang. Die Farbe zeigt, aus welchem eine Nachricht kommt.',
  'intro.tutorial.swipe.title': 'Wischen',
  'intro.tutorial.swipe.body':
    'Eine Zeile nach links wischen löscht sie. Ein Blatt nach unten wischen schliesst es. Vom linken Rand nach rechts geht es zurück.',
  'intro.tutorial.assistant.title': 'Dein Assistent',
  'intro.tutorial.assistant.body':
    'Er arbeitet quer über alle Better-Apps. Schreib ihm, was du brauchst — etwa „Milch auf die Einkaufsliste“.',
  'intro.tutorial.assistant.bodyNamed':
    '{assistant} arbeitet quer über alle Better-Apps. Schreib ihm, was du brauchst — etwa „Milch auf die Einkaufsliste“.',
  'intro.tutorial.assistant.hello': 'Wie kann ich dich unterstützen?',
  'intro.tutorial.assistant.helloNamed': 'Ich bin {assistant}. Wie kann ich dich unterstützen?',
  'intro.tutorial.start.title': 'Start',
  'intro.tutorial.start.body':
    'Auf der Startseite steht je Funktion das Nächste — und was du gleich erledigen kannst.',
  'intro.tutorial.functions.title': 'Funktionen',
  'intro.tutorial.functions.body':
    'Alles, was diese App kann, liegt unter Funktionen. Ein Tipp öffnet die volle Ansicht.',
  'intro.tutorial.chats.title': 'Deine Gespräche',
  'intro.tutorial.chats.body':
    'Jedes Gespräch bleibt gespeichert, das Neueste steht oben. Ein Anfang-Chip startet ein neues.',
  'intro.tutorial.art.news': 'Was gibt’s Neues',
  'intro.tutorial.art.inbox': 'Posteingang',
} as const;
