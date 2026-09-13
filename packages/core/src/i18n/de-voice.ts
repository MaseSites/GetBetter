/** Die Stimmen von ElevenLabs: was bei der Auswahl dazu steht. Teil von `de` — die Schluessel landen dort per Spread. */
export const deVoice = {
  'assistant.gender.female': 'weiblich',
  'assistant.gender.male': 'männlich',
  'assistant.gender.neutral': 'neutral',
  'assistant.cloud.missing':
    'Echt klingende Stimmen kommen von ElevenLabs. Dafür braucht der Dienst einen Schlüssel — bis dahin spricht der Browser.',
  'assistant.cloud.empty':
    'Dein ElevenLabs-Konto hat noch keine Stimmen. Füge dort unter „Voices“ eine hinzu.',
  'assistant.cloud.auth_failed':
    'ElevenLabs lehnt den Schlüssel ab. Prüf ihn und seine Rechte: „Text to Speech“ und „Voices“ lesen.',
  'assistant.cloud.quota_exceeded':
    'Das Guthaben bei ElevenLabs ist aufgebraucht. Bis es wieder reicht, spricht der Browser.',
  'assistant.cloud.failed': 'ElevenLabs antwortet gerade nicht. Bis dahin spricht der Browser.',
} as const;
