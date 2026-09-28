/**
 * Die Liste in BetterAi: angeheftete Gespraeche oben, dann das Neueste, und
 * eine Suche ueber Titel und alle Nachrichten. Rein, ohne Speicher.
 */

type ChatLike = { id: string; title: string; updatedAt: string; pinnedAt?: string | null };

/** Ab so vielen Gespraechen steht das Suchfeld da. */
export const SEARCH_FROM = 6;

/** Klein und ohne Akzente: „Café“ findet „cafe“. */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Angeheftete zuerst (zuletzt angeheftet vorne), dann nach letzter Nachricht. */
export function sortChats<T extends ChatLike>(chats: readonly T[]): T[] {
  return [...chats].sort((a, b) => {
    const pinA = a.pinnedAt ?? '';
    const pinB = b.pinnedAt ?? '';
    if (pinA !== pinB) {
      if (!pinA) return 1;
      if (!pinB) return -1;
      return pinB.localeCompare(pinA);
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

/**
 * Filtert nach allen Woertern der Suche — jedes muss im Titel oder in einer
 * Nachricht des Gespraechs stehen. Leere Suche: alle, sortiert.
 */
export function filterChats<T extends ChatLike>(
  chats: readonly T[],
  messages: readonly { chatId: string; text: string }[],
  query: string,
): T[] {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return sortChats(chats);
  const textOf = new Map<string, string>();
  for (const message of messages) {
    textOf.set(message.chatId, `${textOf.get(message.chatId) ?? ''}\n${foldText(message.text)}`);
  }
  return sortChats(
    chats.filter((chat) => {
      const haystack = `${foldText(chat.title)}\n${textOf.get(chat.id) ?? ''}`;
      return words.every((word) => haystack.includes(word));
    }),
  );
}
