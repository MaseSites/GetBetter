// Relative Pfade mit Absicht: so laeuft die Datei auch in den Tests unter Node.
import type { MailError } from '../../db/mail';
import type { MailAddress, MailFolderRole, MailMessageRow } from '../../db/types';
import type { Language, TranslationKey } from '../../i18n';
import { localeFor } from '../../i18n/format';

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
/** Bis eine Woche zurueck steht der Wochentag, danach das Datum. */
const WEEK_DAYS = 7;
const MAX_PORT = 65_535;
const KILOBYTE = 1024;
/** Eine Stelle nach dem Komma reicht bei Megabyte. */
const ONE_DECIMAL = 10;

/** Welcher Satz zu welchem Fehlerschluessel gehoert. */
export const MAIL_ERROR_KEYS: Readonly<Record<MailError, TranslationKey>> = {
  bad_request: 'mail.error.badRequest',
  already_connected: 'mail.error.alreadyConnected',
  auth_failed: 'mail.error.authFailed',
  unreachable: 'mail.error.unreachable',
  tls_failed: 'mail.error.tlsFailed',
  timeout: 'mail.error.timeout',
  oauth_required: 'mail.error.oauthRequired',
  send_failed: 'mail.error.sendFailed',
  not_found: 'mail.error.notFound',
  folder_missing: 'mail.error.folderMissing',
  too_large: 'mailui.error.tooLarge',
  already_sent: 'mailui.error.alreadySent',
  offline: 'mail.error.offline',
  unknown_route: 'mail.error.unknownRoute',
  unknown: 'mail.error.unknown',
};

export function mailErrorKey(error: MailError): TranslationKey {
  return MAIL_ERROR_KEYS[error];
}

/** Wie ein Ordner heisst, wenn ein Mensch ihn liest. */
export const FOLDER_LABEL_KEYS: Readonly<Record<MailFolderRole, TranslationKey>> = {
  inbox: 'mail.folder.inbox',
  sent: 'mail.folder.sent',
  drafts: 'mail.folder.drafts',
  junk: 'mail.folder.junk',
  trash: 'mail.folder.trash',
  archive: 'mail.folder.archive',
};

/** Wonach sortiert wird. */
export type MailSort = 'newest' | 'oldest' | 'sender' | 'subject';

export const MAIL_SORTS: readonly MailSort[] = ['newest', 'oldest', 'sender', 'subject'];

export const SORT_LABEL_KEYS: Readonly<Record<MailSort, TranslationKey>> = {
  newest: 'mail.sort.newest',
  oldest: 'mail.sort.oldest',
  sender: 'mail.sort.sender',
  subject: 'mail.sort.subject',
};

/** Was ueberhaupt in der Liste steht. */
export type MailFilter = 'all' | 'unread' | 'flagged' | 'attachments';

export const MAIL_FILTERS: readonly MailFilter[] = ['all', 'unread', 'flagged', 'attachments'];

export const FILTER_LABEL_KEYS: Readonly<Record<MailFilter, TranslationKey>> = {
  all: 'mail.filter.all',
  unread: 'mail.filter.unread',
  flagged: 'mail.filter.flagged',
  attachments: 'mail.filter.attachments',
};

/** Der Name, sonst die Adresse — leer nur, wenn beides fehlt. */
export function senderName(address: MailAddress): string {
  return address.name.trim() || address.address.trim();
}

/** "Jonas Muster <jonas@beispiel.ch>" oder nur die Adresse. */
export function formatAddress(address: MailAddress): string {
  const name = address.name.trim();
  const mail = address.address.trim();
  if (name.length === 0 || name === mail) return mail;
  return mail.length > 0 ? `${name} <${mail}>` : name;
}

/** Ein „Re: “ davor — ohne es bei jeder Antwort zu verdoppeln (Re:, RE:, AW:, Antw:). */
export function replySubject(subject: string): string {
  const rest = subject.trim().replace(/^((re|aw|antw)\s*:\s*)+/i, '');
  return `Re: ${rest}`;
}

/** Jede Zeile mit „> “ davor; leere Zeilen am Ende fallen weg. */
export function quoteText(text: string): string {
  const lines = text.replace(/\s+$/, '').split(/\r?\n/);
  return lines.map((line) => (line.length > 0 ? `> ${line}` : '>')).join('\n');
}

/** Adressen aus einem Feld: getrennt durch Komma, Strichpunkt oder Leerraum. */
export function parseAddressList(input: string): string[] {
  return input
    .split(/[,;\s]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/**
 * Ein Port aus einem Feld: leer heisst „nicht gesetzt“ (`undefined`), eine
 * gueltige Zahl kommt als Zahl, alles andere als `null`.
 */
export function parsePort(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (!/^\d+$/.test(trimmed)) return null;
  const port = Number(trimmed);
  return port >= 1 && port <= MAX_PORT ? port : null;
}

export type ListDateKind = 'time' | 'yesterday' | 'weekday' | 'date' | 'none';

/** Wie der Zeitpunkt in der Liste steht: heute die Uhrzeit, gestern, Wochentag, sonst Datum. */
export function listDateKind(iso: string, now: Date = new Date()): ListDateKind {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'none';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((today.getTime() - day.getTime()) / DAY_MS);
  if (days === 0) return 'time';
  if (days === 1) return 'yesterday';
  if (days > 1 && days < WEEK_DAYS) return 'weekday';
  return 'date';
}

export type Age = { value: number; unit: 'minute' | 'hour' | 'day' };

/** Wie lange etwas her ist — `now` unter einer Minute, `null` bei kaputtem Datum. */
export function ageOf(iso: string, now: Date = new Date()): Age | 'now' | null {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;
  const minutes = Math.floor((now.getTime() - time) / MINUTE_MS);
  if (minutes < 1) return 'now';
  if (minutes < MINUTES_PER_HOUR) return { value: minutes, unit: 'minute' };
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) return { value: hours, unit: 'hour' };
  return { value: Math.floor(hours / HOURS_PER_DAY), unit: 'day' };
}

/** "vor 5 Minuten", "gestern" — ueber Intl, in der Sprache des Kontos. */
export function formatAge(language: Language, age: Age): string {
  return new Intl.RelativeTimeFormat(localeFor(language), { numeric: 'auto' }).format(
    -age.value,
    age.unit,
  );
}

/** Ein Zeitpunkt als Zahl; ein kaputtes Datum zaehlt als Urzeit. */
function timeOf(iso: string): number {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? 0 : time;
}

export type FileSize = { value: number; unit: 'bytes' | 'kb' | 'mb' };

/** Eine Groesse in der Einheit, die am wenigsten Nullen braucht. */
export function fileSize(bytes: number): FileSize {
  const size = Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes) : 0;
  if (size < KILOBYTE) return { value: size, unit: 'bytes' };
  if (size < KILOBYTE * KILOBYTE) return { value: Math.round(size / KILOBYTE), unit: 'kb' };
  const megabytes = size / (KILOBYTE * KILOBYTE);
  return { value: Math.round(megabytes * ONE_DECIMAL) / ONE_DECIMAL, unit: 'mb' };
}

/** Die Suche greift ueber Betreff, Absender und Text — was geladen ist, wird durchsucht. */
export function matchesQuery(message: MailMessageRow, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (needle.length === 0) return true;
  return [
    message.subject,
    message.from.name,
    message.from.address,
    message.snippet,
    message.text,
  ].some((part) => part.toLowerCase().includes(needle));
}

function passesFilter(message: MailMessageRow, filter: MailFilter): boolean {
  switch (filter) {
    case 'unread':
      return !message.seen;
    case 'flagged':
      return message.flagged;
    case 'attachments':
      return message.attachments.length > 0;
    case 'all':
      return true;
  }
}

function compare(a: MailMessageRow, b: MailMessageRow, sort: MailSort): number {
  const newest = timeOf(b.date) - timeOf(a.date);
  switch (sort) {
    case 'oldest':
      return -newest;
    case 'sender': {
      const order = senderName(a.from).localeCompare(senderName(b.from), undefined, {
        sensitivity: 'base',
      });
      return order === 0 ? newest : order;
    }
    case 'subject': {
      const order = a.subject
        .trim()
        .localeCompare(b.subject.trim(), undefined, { sensitivity: 'base' });
      return order === 0 ? newest : order;
    }
    case 'newest':
      return newest;
  }
}

/** Wonach die Liste gerade zusammengestellt wird. */
export type MailQuery = {
  /** `null` heisst: alle Postfaecher. */
  mailAccountId: string | null;
  role: MailFolderRole;
  search: string;
  filter: MailFilter;
  sort: MailSort;
};

/** Ein Postfach und ein Ordner, gesiebt und sortiert — die Liste, die man sieht. */
export function selectMessages(
  rows: readonly MailMessageRow[],
  query: MailQuery,
): MailMessageRow[] {
  return rows
    .filter(
      (row) =>
        (query.mailAccountId === null || row.mailAccountId === query.mailAccountId) &&
        row.folderRole === query.role &&
        passesFilter(row, query.filter) &&
        matchesQuery(row, query.search),
    )
    .sort((a, b) => compare(a, b, query.sort));
}

/** Wie viele ungelesene ein Ordner hat — ohne Suche und Filter, das ist eine Zahl am Ordner. */
export function countUnread(
  rows: readonly MailMessageRow[],
  where: { mailAccountId?: string | null; role?: MailFolderRole } = {},
): number {
  const role = where.role ?? 'inbox';
  const mailbox = where.mailAccountId ?? null;
  return rows.filter(
    (row) =>
      !row.seen && row.folderRole === role && (mailbox === null || row.mailAccountId === mailbox),
  ).length;
}

/** Welche Ordner ueberhaupt angeboten werden: die des Postfachs, sonst alle bekannten. */
export function rolesOf(
  folders: readonly { role: MailFolderRole }[],
  all: readonly MailFolderRole[],
): MailFolderRole[] {
  const known = new Set(folders.map((folder) => folder.role));
  const found = all.filter((role) => known.has(role));
  return found.includes('inbox') ? found : ['inbox', ...found];
}

/** Was im Schreiben-Blatt vorausgefuellt steht. */
export type ComposeDraft = {
  mailAccountId: string | null;
  to: string;
  cc: string;
  subject: string;
  text: string;
  /** Gesetzt beim Antworten: die Id der Nachricht. */
  inReplyTo?: string;
};

export function emptyDraft(mailAccountId: string | null): ComposeDraft {
  return { mailAccountId, to: '', cc: '', subject: '', text: '' };
}

/**
 * Die Antwort auf eine Nachricht: an den Absender, aus demselben Postfach, mit
 * „Re: “ und dem zitierten Text. Die Zeile ueber dem Zitat kommt aus `t()`.
 */
export function replyDraft(message: MailMessageRow, quoteHeader: string): ComposeDraft {
  const quoted = message.text.trim().length > 0 ? `\n${quoteText(message.text)}` : '';
  return {
    mailAccountId: message.mailAccountId,
    to: message.from.address,
    cc: '',
    subject: replySubject(message.subject),
    text: `\n\n${quoteHeader}${quoted}`,
    inReplyTo: message.id,
  };
}
