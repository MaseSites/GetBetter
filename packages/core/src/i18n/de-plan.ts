/** Abo und Kontingent, dazu „App ansehen“ aus dem Admin. Teil von `de` — die Schluessel landen dort per Spread. */
export const dePlan = {
  // Wenn das Kontingent der KI aufgebraucht ist
  'assistant.ai.budgetExhausted':
    'Dein KI-Kontingent für diesen Monat ist aufgebraucht. Am {date} geht es weiter.',
  'assistant.ai.trialExhausted':
    'Dein Gratis-Kontingent ist aufgebraucht. Mit dem Abo ({price} im Monat) geht es weiter.',
  'assistant.ai.trialExhaustedSoon':
    'Dein Gratis-Kontingent ist aufgebraucht. Ein Abo für diese App kommt bald.',
  'assistant.ai.planRequired': 'Bilder schaue ich mir erst mit dem Abo an.',

  // Stimmen von ElevenLabs
  'assistant.cloud.planRequired': 'Echte Stimmen gibt es mit dem Abo.',
  'assistant.cloud.budgetExhausted':
    'Die echten Stimmen sind für diesen Monat aufgebraucht — bis dahin spricht der Browser.',

  // Einstellungen
  'settings.ai.month': 'KI diesen Monat',
  'settings.ai.plan.trial': 'Gratis',
  'settings.ai.plan.paid': 'Abo',
  'settings.ai.value': '{plan} · {share} genutzt',
  'settings.ai.hint': 'Das KI-Kontingent gilt für diese App und ist am {date} wieder voll.',

  // Das Abo-Fenster
  'plan.title': '{app} Abo',
  'plan.price': '{price} im Monat',
  'plan.priceSoon': 'Abo kommt bald',
  'plan.benefit.ai': 'KI-Assistent im vollen Umfang',
  'plan.benefit.aiChat': 'KI-Chats im vollen Umfang',
  'plan.benefit.ai.hint': 'Mit grosszügigem Monatskontingent',
  'plan.benefit.voices': 'Echte Stimmen',
  'plan.benefit.voices.hint': 'Natürlich klingend, von ElevenLabs',
  'plan.benefit.personalize': 'Alles personalisieren',
  'plan.benefit.personalize.hint': 'Farben, Hintergrund, Avatar, Stimme',
  'plan.benefit.everywhere': 'Gilt fürs Aussehen in allen Better-Apps',
  'plan.benefit.everywhere.hint': 'Ein Abo genügt dafür',
  'plan.perMonth': '/Monat',
  'plan.term.month': 'Monatlich',
  'plan.term.year': 'Jährlich',
  'plan.perYear': '/Jahr',
  'plan.save': '{count} Monate gratis',
  'plan.yearMonthly': 'Das sind {price} im Monat.',
  'plan.benefit.voicePick': 'Stimme des Assistenten wählen',
  'plan.benefit.assistantName': 'Eigener Name für den Assistenten',
  'plan.benefit.avatar': 'Avatar frei gestalten',
  'plan.benefit.accent': 'Eigene Akzentfarbe',
  'plan.benefit.preset': 'Farbig oder schwarzweiss',
  'plan.benefit.backdrop': 'Eigene Hintergründe, auch eigene Bilder',
  'plan.benefit.cancelAnytime': 'Jederzeit kündbar',
  'plan.cancel': 'Abo kündigen',
  'plan.cancel.title': 'Abo kündigen?',
  'plan.cancel.body': 'Du behältst alles bis zum {date}. Danach gilt wieder die Gratis-Version.',
  'plan.cancel.confirm': 'Kündigen',
  'plan.cancel.keep': 'Abo behalten',
  'plan.cancel.error': 'Das hat nicht geklappt. Versuch es gleich nochmal.',
  'plan.cancelled': 'Gekündigt · aktiv bis {date}',
  'plan.resume': 'Kündigung zurücknehmen',
  'plan.row.cancelled': 'Gekündigt',
  'plan.request': 'Abo anfragen',
  'plan.requested': 'Angefragt – wir schalten dich bald frei',
  'plan.active': 'Dein Abo ist aktiv',
  'plan.soon': 'Das Abo für {app} kommt bald.',
  'plan.later': 'Später',
  'plan.free': 'Ohne Abo bleibt die App kostenlos – im Standard-Aussehen und mit kleinem KI-Kontingent.',
  'plan.error': 'Die Anfrage ging nicht durch. Versuch es gleich nochmal.',
  'plan.row': 'Abo',
  'plan.row.free': 'Gratis',
  'plan.row.active': 'Aktiv',
  'plan.row.pending': 'Angefragt',
  'plan.row.soon': 'Bald',
  'plan.locked': 'Abo',
  'plan.hint': 'Mit Abo personalisierbar',
  'plan.see': 'Abo ansehen',
  'plan.setup.bubble':
    'Hell oder dunkel? Das wählst du hier. Farben, Hintergrund, Avatar und Stimme passt du mit dem Abo an.',

  // Mitteilungen aus dem Admin
  'news.planApproved': 'Dein {app}-Abo ist aktiv',
  'news.planApproved.body': 'Jetzt kannst du alles personalisieren.',
  'news.planDeclined': 'Deine Abo-Anfrage für {app} wurde abgelehnt',

  // Nur ansehen
  'view.banner': 'Ansicht von @{username} · nur lesen',
  'view.bannerAnon': 'Ansicht · nur lesen',
  'view.readOnly': 'Nur ansehen',
  'view.expired.title': 'Diese Ansicht ist abgelaufen',
  'view.expired.body': 'Der Link gilt nur einmal und eine Minute. Öffne die App im Admin nochmal.',
} as const;
