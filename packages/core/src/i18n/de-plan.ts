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

  // Nur ansehen
  'view.banner': 'Ansicht von @{username} · nur lesen',
  'view.bannerAnon': 'Ansicht · nur lesen',
  'view.readOnly': 'Nur ansehen',
  'view.expired.title': 'Diese Ansicht ist abgelaufen',
  'view.expired.body': 'Der Link gilt nur einmal und eine Minute. Öffne die App im Admin nochmal.',
} as const;
