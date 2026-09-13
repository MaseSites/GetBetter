// Relative Pfade mit Absicht: so laeuft die Datei auch in den Tests unter Node.
import type { MailMessage } from '../../db/mail';
import type { MailFolderRole } from '../../db/types';

import { matchesQuery } from './format';

/** Welcher Ordner gerade offen ist; `mailAccountId: null` heisst alle Postfaecher zusammen. */
export type MailPlace = { mailAccountId: string | null; role: MailFolderRole };

/** Wo die E-Mail beginnt: alle Posteingaenge zusammen. */
export const UNIFIED_INBOX: MailPlace = { mailAccountId: null, role: 'inbox' };

/** Die Filter hinter dem runden Knopf unten links — immer nur einer auf einmal. */
export type MailListFilter = 'unread' | 'flagged' | 'attachments' | 'toMe' | 'today';

export const MAIL_LIST_FILTERS: readonly MailListFilter[] = [
  'unread',
  'flagged',
  'attachments',
  'toMe',
  'today',
];

/** Eine Zeile im Posteingang: eine Unterhaltung, gezeigt mit ihrer neuesten Nachricht. */
export type MailThread = {
  id: string;
  latest: MailMessage;
  /** Die Nachrichten dieser Unterhaltung im offenen Ordner, die neueste zuerst. */
  messages: readonly MailMessage[];
  /** Wie viele Nachrichten die ganze Unterhaltung hat — mit den eigenen Antworten. */
  count: number;
  unread: boolean;
  flagged: boolean;
  hasAttachments: boolean;
};

/** Ordner, deren Mails nur dann in einer Unterhaltung stehen, wenn man gerade dort ist. */
const SET_ASIDE: readonly MailFolderRole[] = ['drafts', 'junk', 'trash'];

function timeOf(iso: string): number {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? 0 : time;
}

function newestFirst(a: MailMessage, b: MailMessage): number {
  return timeOf(b.date) - timeOf(a.date);
}

export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

/** Die eigenen Adressen: jedes verbundene Postfach und das Konto selbst. */
export function ownAddressesOf(
  mailboxes: readonly { email: string }[],
  extra: readonly string[] = [],
): ReadonlySet<string> {
  return new Set(
    [...mailboxes.map((box) => box.email), ...extra]
      .map(normalizeAddress)
      .filter((address) => address.length > 0),
  );
}

export function isInPlace(message: MailMessage, place: MailPlace): boolean {
  return (
    message.folderRole === place.role &&
    (place.mailAccountId === null || message.mailAccountId === place.mailAccountId)
  );
}

export function isFromMe(message: MailMessage, own: ReadonlySet<string>): boolean {
  return own.has(normalizeAddress(message.from.address));
}

export function isToMe(message: MailMessage, own: ReadonlySet<string>): boolean {
  return [...message.to, ...message.cc].some((entry) => own.has(normalizeAddress(entry.address)));
}

export function isSameDay(iso: string, now: Date): boolean {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

/** Gleich ist, was dieselbe Message-ID traegt — etwa eine Mail in „Gesendet“ und im Posteingang. */
function sameMailKey(message: MailMessage): string {
  return message.messageId ?? message.id;
}

/** Aus den Mitgliedern einer Unterhaltung, was man in diesem Ordner sieht: die aelteste zuerst. */
function conversationFrom(members: readonly MailMessage[], role: MailFolderRole): MailMessage[] {
  const visible = members.filter(
    (message) => message.folderRole === role || !SET_ASIDE.includes(message.folderRole),
  );
  // Die Mail im offenen Ordner hat Vorrang vor ihrer Kopie anderswo.
  const preferred = [...visible].sort(
    (a, b) => Number(b.folderRole === role) - Number(a.folderRole === role),
  );
  const unique = preferred.filter(
    (message, index) =>
      preferred.findIndex((other) => sameMailKey(other) === sameMailKey(message)) === index,
  );
  return unique.sort((a, b) => timeOf(a.date) - timeOf(b.date));
}

/**
 * Die ganze Unterhaltung, die aelteste zuerst — ueber Ordner und Postfaecher,
 * die eigene Antwort aus „Gesendet“ eingeschlossen, ohne Doppel. Entwuerfe,
 * Spam und Papierkorb gehoeren nur dazu, wenn man gerade dort ist.
 */
export function conversationOf(
  all: readonly MailMessage[],
  threadId: string,
  role: MailFolderRole,
): MailMessage[] {
  return conversationFrom(
    all.filter((message) => message.threadId === threadId),
    role,
  );
}

function groupByThread(messages: readonly MailMessage[]): Map<string, MailMessage[]> {
  const groups = new Map<string, MailMessage[]>();
  for (const message of messages) {
    const members = groups.get(message.threadId);
    if (members) members.push(message);
    else groups.set(message.threadId, [message]);
  }
  return groups;
}

/** Die Unterhaltungen eines Ordners, die mit der neuesten Nachricht zuerst. */
export function threadsIn(all: readonly MailMessage[], place: MailPlace): MailThread[] {
  const everywhere = groupByThread(all);
  const here = groupByThread(all.filter((message) => isInPlace(message, place)));

  return [...here.entries()]
    .flatMap(([id, members]): MailThread[] => {
      const messages = [...members].sort(newestFirst);
      const [latest] = messages;
      if (!latest) return [];
      const conversation = conversationFrom(everywhere.get(id) ?? [], place.role);
      return [
        {
          id,
          latest,
          messages,
          count: Math.max(messages.length, conversation.length),
          unread: messages.some((message) => !message.seen),
          flagged: messages.some((message) => message.flagged),
          hasAttachments: messages.some((message) => message.attachments.length > 0),
        },
      ];
    })
    .sort((a, b) => newestFirst(a.latest, b.latest));
}

export function passesListFilter(
  thread: MailThread,
  filter: MailListFilter | null,
  own: ReadonlySet<string>,
  now: Date,
): boolean {
  switch (filter) {
    case null:
      return true;
    case 'unread':
      return thread.unread;
    case 'flagged':
      return thread.flagged;
    case 'attachments':
      return thread.hasAttachments;
    case 'toMe':
      return thread.messages.some((message) => isToMe(message, own));
    case 'today':
      return isSameDay(thread.latest.date, now);
  }
}

export type ThreadQuery = {
  place: MailPlace;
  filter: MailListFilter | null;
  search: string;
  own: ReadonlySet<string>;
  now?: Date;
};

/** Die Liste, die man sieht: ein Ordner, gefiltert und durchsucht, chronologisch. */
export function selectThreads(all: readonly MailMessage[], query: ThreadQuery): MailThread[] {
  const now = query.now ?? new Date();
  const search = query.search.trim();
  return threadsIn(all, query.place).filter(
    (thread) =>
      passesListFilter(thread, query.filter, query.own, now) &&
      (search.length === 0 || thread.messages.some((message) => matchesQuery(message, search))),
  );
}

/** Welche Unterhaltung ueber und unter dieser steht — fuer ˄ und ˅. */
export function neighboursOf(
  threads: readonly MailThread[],
  threadId: string,
): { previous: string | null; next: string | null } {
  const index = threads.findIndex((thread) => thread.id === threadId);
  if (index === -1) return { previous: null, next: null };
  return {
    previous: threads[index - 1]?.id ?? null,
    next: threads[index + 1]?.id ?? null,
  };
}

/** Der Teil nach dem @: „gmx.ch“. */
export function mailboxDomain(email: string): string {
  const at = email.lastIndexOf('@');
  return at === -1
    ? email.trim().toLowerCase()
    : email
        .slice(at + 1)
        .trim()
        .toLowerCase();
}

/** Der Kurzname eines Postfachs in der Liste: „gmx“ fuer privat@gmx.ch. */
export function mailboxShortName(email: string): string {
  const labels = mailboxDomain(email)
    .split('.')
    .filter((label) => label.length > 0);
  if (labels.length >= 2) return labels[labels.length - 2] ?? email;
  return labels[0] ?? email;
}

/** Was der volle Wisch nach links in diesem Ordner tut. */
export type SwipeAway = 'archive' | 'delete' | 'purge';

export function swipeAwayOf(role: MailFolderRole, roles: readonly MailFolderRole[]): SwipeAway {
  if (role === 'trash') return 'purge';
  if (role === 'archive' || role === 'drafts' || !roles.includes('archive')) return 'delete';
  return 'archive';
}

/** Die Ordner, die alle beteiligten Postfaecher fuehren — dorthin laesst sich verschieben. */
export function commonRoles(
  rolesByMailbox: ReadonlyMap<string, readonly MailFolderRole[]>,
  mailAccountIds: readonly string[],
): MailFolderRole[] {
  const fallback: readonly MailFolderRole[] = ['inbox'];
  const lists = [...new Set(mailAccountIds)].map((id) => rolesByMailbox.get(id) ?? fallback);
  const [first, ...rest] = lists;
  if (!first) return [];
  return first.filter((role) => rest.every((list) => list.includes(role)));
}

/** Eine verschobene Mail, wie sie sich wiederfinden laesst: ihre Id wechselt beim Verschieben. */
export type MovedMail = {
  mailAccountId: string;
  messageId: string | null;
  from: MailFolderRole;
  to: MailFolderRole;
};

export function movedOf(messages: readonly MailMessage[], to: MailFolderRole): MovedMail[] {
  return messages.map((message) => ({
    mailAccountId: message.mailAccountId,
    messageId: message.messageId,
    from: message.folderRole,
    to,
  }));
}

/**
 * Nach dem Verschieben hat die Mail im Zielordner eine neue Zeile. Gefunden wird
 * sie ueber Postfach und Message-ID; zurueck kommen die Ids je Ursprungsordner.
 */
export function findMoved(
  rows: readonly MailMessage[],
  moved: readonly MovedMail[],
): { role: MailFolderRole; ids: string[] }[] {
  const byRole = new Map<MailFolderRole, string[]>();
  for (const entry of moved) {
    if (entry.messageId === null) continue;
    const row = rows.find(
      (candidate) =>
        candidate.mailAccountId === entry.mailAccountId &&
        candidate.messageId === entry.messageId &&
        candidate.folderRole === entry.to,
    );
    if (!row) continue;
    const ids = byRole.get(entry.from);
    if (ids) ids.push(row.id);
    else byRole.set(entry.from, [row.id]);
  }
  return [...byRole.entries()].map(([role, ids]) => ({ role, ids }));
}
