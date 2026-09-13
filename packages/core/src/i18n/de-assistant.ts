/** Der Assistent: Sprechen, Gespräch, seine Stimme und was er dabei sagt. Teil von `de` — die Schluessel landen dort per Spread. */
export const deAssistant = {
  // Die zwei Knoepfe unter dem Feld
  'assistant.voice.speak': 'Sprechen',
  'assistant.voice.speak.done': 'Fertig',
  'assistant.voice.speak.a11y': 'Sprechen — antippen und lossprechen',
  'assistant.voice.speak.a11y.busy': 'Hört zu — antippen, wenn du fertig bist',
  'assistant.voice.talk': 'Gespräch',
  'assistant.voice.talk.end': 'Beenden',
  'assistant.voice.talk.a11y': 'Gespräch beginnen — reden, ohne zu tippen',
  'assistant.voice.talk.a11y.busy': 'Gespräch läuft — antippen zum Beenden',

  // Was gerade passiert
  'assistant.voice.listening': 'Ich höre zu …',
  'assistant.voice.listeningNamed': '{name} hört zu …',
  'assistant.voice.speaking': 'Ich antworte …',
  'assistant.voice.speakingNamed': '{name} antwortet …',

  // Wenn es nicht geht — lieber ein ehrlicher Satz als ein toter Knopf
  'assistant.voice.soon':
    'Mit mir reden kannst du, sobald die Apps im Store sind. Im Browser geht es jetzt schon.',
  'assistant.voice.noBrowser': 'Dieser Browser kann nicht zuhören — in Chrome und Safari geht es.',
  'assistant.voice.problem.denied':
    'Ohne Erlaubnis fürs Mikrofon kann ich nicht zuhören. Du kannst sie in den Einstellungen des Browsers wieder geben.',
  'assistant.voice.problem.noDevice': 'Ich finde kein Mikrofon.',
  'assistant.voice.problem.unheard': 'Ich habe nichts gehört.',
  'assistant.voice.problem.failed': 'Das hat nicht geklappt. Versuch es nochmal.',

  // Seine Stimme aussuchen
  'assistant.voice.pick.title': 'Wie soll ich klingen?',
  'assistant.voice.pick.hint': 'Ein Tipp wählt die Stimme und liest gleich einen Satz vor.',
  'assistant.voice.pick.none': 'Dieser Browser hat keine Stimme für deine Sprache.',
  'assistant.voice.pick.onlyOne':
    'Hier gibt es nur eine Stimme — {voice}. Zu wählen gibt es also nichts.',
  'assistant.voice.pick.better':
    'Natürlicher klingende Stimmen gibt es in Microsoft Edge und in Safari.',
  'assistant.voice.tier.natural': 'natürlich',
  'assistant.voice.tier.clear': 'klar',
  'assistant.voice.tier.basic': 'einfach',
  'assistant.voice.pick.a11y': 'Stimme {voice} wählen und anhören',
  'assistant.voice.pick.a11y.speaking': 'Stimme {voice}, spricht gerade',
  'assistant.voice.sample': 'Hi, ich bin {name}. So klinge ich.',
  'assistant.voice.sampleAnon': 'Hallo, so klinge ich.',
} as const;
