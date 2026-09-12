// Relative Pfade mit Absicht: so laeuft die Datei auch in den Tests unter Node.
import type { MailError } from '../../db/mail';
import type { MailAddress, MailMessageRow } from '../../db/types';
import type { Language, TranslationKey } from '../../i18n';
import { localeFor } from '../../i18n/format';

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
/** Bis eine Woche zurueck steht der Wochentag, danach das Datum. */
const WEEK_DAYS = 7;
const MAX_PORT = 65_535;

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
  offline: 'mail.error.offline',
  unknown_route: 'mail.error.unknownRoute',
  unknown: 'mail.error.unknown',
};

export function mailErrorKey(error: MailError): TranslationKey {
  return MAIL_ERROR_KEYS[error];
}

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
