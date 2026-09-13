import type { TranslationKey } from './de';

/** Italienisch: die Stimmen von ElevenLabs (de-voice.ts). Teil von `it`. */
export const itVoice = {
  'assistant.gender.female': 'femminile',
  'assistant.gender.male': 'maschile',
  'assistant.gender.neutral': 'neutra',
  'assistant.cloud.missing':
    'Le voci naturali arrivano da ElevenLabs. Per questo il servizio ha bisogno di una chiave — nel frattempo parla il browser.',
  'assistant.cloud.empty':
    'Il tuo account ElevenLabs non ha ancora voci. Aggiungine una alla voce «Voices».',
  'assistant.cloud.auth_failed':
    'ElevenLabs rifiuta la chiave. Controlla la chiave e i suoi permessi: «Text to Speech» e lettura di «Voices».',
  'assistant.cloud.quota_exceeded':
    'Il credito ElevenLabs è esaurito. Finché non basta di nuovo, parla il browser.',
  'assistant.cloud.failed': 'ElevenLabs al momento non risponde. Nel frattempo parla il browser.',
} as const satisfies Partial<Record<TranslationKey, string>>;
