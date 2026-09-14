import type { TranslationKey } from './de';

/** Englisch: die Stimmen von ElevenLabs (de-voice.ts). Teil von `en`. */
export const enVoice = {
  'assistant.gender.female': 'female',
  'assistant.gender.male': 'male',
  'assistant.gender.neutral': 'neutral',
  'assistant.cloud.missing':
    'Real-sounding voices come from ElevenLabs. The service needs a key for that — until then, the browser speaks.',
  'assistant.cloud.empty':
    'Your ElevenLabs account has no voices yet. Add one there under “Voices”.',
  'assistant.cloud.auth_failed':
    'ElevenLabs rejects the key. Check it and its permissions: “Text to Speech” and read access to “Voices”.',
  'assistant.cloud.quota_exceeded':
    'Your ElevenLabs credits are used up. Until there’s enough again, the browser speaks.',
  'assistant.cloud.failed':
    'ElevenLabs isn’t responding right now. Until then, the browser speaks.',
  'assistant.ai.offline': 'I can’t reach the service right now. Try again in a moment.',
  'assistant.ai.busy': 'It’s busy right now. Ask me again in a minute.',
  'assistant.ai.failed': 'That didn’t work just now. Please try again.',
} as const satisfies Partial<Record<TranslationKey, string>>;
