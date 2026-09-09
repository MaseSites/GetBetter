import type { AssistantMessage } from './types';

/**
 * Das Modul "KI-Chat" ist eine ganz normale KI ohne Zugriff auf die Module.
 * Der Prototyp zeigt nur den Ablauf, es steckt keine echte KI dahinter.
 */
export const AI_CHAT_THREAD: readonly AssistantMessage[] = [];

export const AI_CHAT_STARTERS: readonly string[] = [
  'Erklär mir das in einfachen Worten',
  'Schreib mir eine höfliche Absage',
  'Was könnte ich heute kochen?',
  'Fass mir diesen Text zusammen',
  'Gib mir drei Ideen',
];

/** Die eine feste Antwort. Die echte Anbindung kommt in einer spaeteren Phase. */
export const AI_CHAT_CANNED_REPLY =
  'Im Prototyp antworte ich noch nicht wirklich. Hier stünde die Antwort einer ganz normalen KI — ohne Blick auf deine Termine, Aufgaben oder Ausgaben.';

export const AI_CHAT_REPLY_DELAY_MS = 700;
