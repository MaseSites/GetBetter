import type { TranslationKey } from '../i18n';

import type { AssistantMessage } from './types';

/**
 * Das Modul "KI-Chat" ist eine ganz normale KI ohne Zugriff auf die Module.
 * Der Prototyp zeigt nur den Ablauf, es steckt keine echte KI dahinter.
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

/** Die eine feste Antwort. Die echte Anbindung kommt in einer spaeteren Phase. */
export const AI_CHAT_CANNED_REPLY_KEY: TranslationKey = 'aiChat.cannedReply';

export const AI_CHAT_REPLY_DELAY_MS = 700;
