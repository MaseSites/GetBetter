import { notifyDataChanged } from './events';
import { db, newId } from './store';
import type { ChatMessageRow, ChatRow } from './types';

function now(): string {
  return new Date().toISOString();
}

function changed<T>(value: T): T {
  notifyDataChanged();
  return value;
}

/** So lang darf ein Titel aus der ersten Nachricht werden. */
const TITLE_LENGTH = 48;

/** Der Titel eines Gespraechs: die erste Frage, gekuerzt. */
export function chatTitleOf(text: string): string {
  const line = text.trim().split('\n')[0] ?? '';
  return line.length > TITLE_LENGTH ? `${line.slice(0, TITLE_LENGTH - 1)}…` : line;
}

/** Die Gespraeche in BetterAi — je Konto, das Neueste zuerst. */
export const chats = {
  list(accountId: string) {
    return db.chats.list({
      where: (row) => row.accountId === accountId,
      sort: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    });
  },

  find(id: string) {
    return db.chats.find(id);
  },

  async create(accountId: string, title = ''): Promise<ChatRow> {
    const timestamp = now();
    const row: ChatRow = {
      id: newId('ch'),
      accountId,
      title: title.trim(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    return changed(await db.chats.insert(row));
  },

  async remove(id: string) {
    const messages = await db.chatMessages.list({ where: (row) => row.chatId === id });
    for (const message of messages) await db.chatMessages.remove(message.id);
    await db.chats.remove(id);
    changed(null);
  },
};

export const chatMessages = {
  list(chatId: string) {
    return db.chatMessages.list({
      where: (row) => row.chatId === chatId,
      sort: (a, b) => a.createdAt.localeCompare(b.createdAt),
    });
  },

  /** Die letzte Nachricht je Gespraech — fuer die Vorschau in der Liste. */
  async latest(accountId: string): Promise<Map<string, ChatMessageRow>> {
    const rows = await db.chatMessages.list({
      where: (row) => row.accountId === accountId,
      sort: (a, b) => a.createdAt.localeCompare(b.createdAt),
    });
    const map = new Map<string, ChatMessageRow>();
    for (const row of rows) map.set(row.chatId, row);
    return map;
  },

  /**
   * Eine Nachricht anhaengen. Die erste Frage wird zum Titel, und das
   * Gespraech rutscht in der Liste nach oben.
   */
  async add(input: {
    chatId: string;
    accountId: string;
    role: 'user' | 'assistant';
    text: string;
  }): Promise<ChatMessageRow> {
    const row: ChatMessageRow = {
      id: newId('cm'),
      chatId: input.chatId,
      accountId: input.accountId,
      role: input.role,
      text: input.text.trim(),
      createdAt: now(),
    };
    await db.chatMessages.insert(row);
    const chat = await db.chats.find(input.chatId);
    if (chat) {
      await db.chats.update(chat.id, {
        updatedAt: row.createdAt,
        ...(chat.title.length === 0 && input.role === 'user'
          ? { title: chatTitleOf(input.text) }
          : {}),
      });
    }
    return changed(row);
  },
};
