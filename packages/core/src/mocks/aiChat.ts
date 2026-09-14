import type { TranslationKey } from '../i18n';

import type { AssistantMessage } from './types';

/**
 * Das Modul "KI-Chat" ist eine ganz normale KI ohne Zugriff auf die Module.
 * Die Antworten kommen von der KI im Dienst (`db/ai.ts`).
 */
export const AI_CHAT_THREAD: readonly AssistantMessage[] = [];

/** Die Anfaenge als Schluessel — der Text kommt aus der Sprache des Kontos. */
export const AI_CHAT_STARTER_KEYS: readonly TranslationKey[] = [
  'aiChat.starter.explain',
  'aiChat.starter.decline',
  'aiChat.starter.cook',
  'aiChat.starter.summarise',
  'aiChat.starter.ideas',
];
