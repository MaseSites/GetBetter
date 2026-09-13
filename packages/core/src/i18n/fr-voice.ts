import type { TranslationKey } from './de';

/** Französisch: die Stimmen von ElevenLabs (de-voice.ts). Teil von `fr`. */
export const frVoice = {
  'assistant.gender.female': 'féminine',
  'assistant.gender.male': 'masculine',
  'assistant.gender.neutral': 'neutre',
  'assistant.cloud.missing':
    'Les voix naturelles viennent d’ElevenLabs. Le service a besoin d’une clé pour cela — en attendant, c’est le navigateur qui parle.',
  'assistant.cloud.empty':
    'Ton compte ElevenLabs n’a encore aucune voix. Ajoutes-en une sous « Voices ».',
  'assistant.cloud.auth_failed':
    'ElevenLabs refuse la clé. Vérifie-la ainsi que ses droits : « Text to Speech » et lecture de « Voices ».',
  'assistant.cloud.quota_exceeded':
    'Ton crédit ElevenLabs est épuisé. En attendant, c’est le navigateur qui parle.',
  'assistant.cloud.failed':
    'ElevenLabs ne répond pas pour le moment. En attendant, c’est le navigateur qui parle.',
} as const satisfies Partial<Record<TranslationKey, string>>;
