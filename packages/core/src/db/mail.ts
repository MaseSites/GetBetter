import { notifyDataChanged } from './live';
import { callService } from './service';
import { db, refresh } from './store';
import type { MailAccountRow, MailMessageRow } from './types';

/**
 * Die Fehler, die der Dienst bei E-Mail meldet — dazu `offline`, wenn er nicht
 * antwortet, und `unknown_route`, solange er E-Mail noch gar nicht kennt.
 */
export const MAIL_ERRORS = [
  'bad_request',
  'already_connected',
  'auth_failed',
  'unreachable',
  'tls_failed',
  'timeout',
  'oauth_required',
  'send_failed',
  'not_found',
  'offline',
  'unknown_route',
] as const;

/** Alles, was der Dienst sonst noch schickt (`http_500` …), heisst hier `unknown`. */
export type MailError = (typeof MAIL_ERRORS)[number] | 'unknown';

export type MailResult<T> = { ok: true; data: T } | { ok: false; error: MailError };

/** Was eine Adresse verraet: Gmail braucht ein App-Passwort, GMX erst IMAP, Outlook geht nicht. */
export type MailProviderNote = 'app_password' | 'enable_imap' | 'oauth_only';

export type MailProviderInfo = {
  provider: string;
  label: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  note: MailProviderNote | null;
};

/** Leere Felder weglassen — dann nimmt der Dienst, was er zum Anbieter weiss. */
export type MailConnectInput = {
  accountId: string;
  email: string;
  password: string;
  displayName?: string;
  username?: string;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
};

export type MailSendInput = {
  mailAccountId: string;
  to: readonly string[];
  cc?: readonly string[];
  subject: string;
  text: string;
  /** Die Id der `mailMessages`-Zeile, auf die geantwortet wird. */
  inReplyTo?: string;
};

export type MailSyncSummary = {
  newMessages: number;
  errors: readonly { mailAccountId: string; error: MailError }[];
};

const NOTES: readonly string[] = ['app_password', 'enable_imap', 'oauth_only'];

function isKnownError(value: string): value is (typeof MAIL_ERRORS)[number] {
  return (MAIL_ERRORS as readonly string[]).includes(value);
}

/** Ein Fehlerschluessel des Dienstes — auch `lastError` eines Postfachs — als bekannter Fall. */
export function mailErrorOf(raw: string | null | undefined): MailError {
  return raw && isKnownError(raw) ? raw : 'unknown';
}

function timeOf(iso: string): number {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? 0 : time;
}

type Init = { method: 'GET' | 'POST' | 'DELETE'; body?: unknown };

/** Fragt den Dienst und wirft nie: jeder Fehler kommt als Schluessel zurueck. */
async function ask<T>(path: string, init?: Init): Promise<MailResult<T>> {
  try {
    const result = await callService<T>(path, init);
    return result.ok ? result : { ok: false, error: mailErrorOf(result.error) };
  } catch {
    return { ok: false, error: 'unknown' };
  }
}

/** Wie `ask`, laedt danach aber den Stand neu — die Sammlungen gehoeren dem Dienst. */
async function change<T>(path: string, init: Init): Promise<MailResult<T>> {
  const result = await ask<T>(path, init);
  if (!result.ok) return result;
  try {
    await refresh();
  } catch {
    // Der naechste Abgleich holt es nach; geklappt hat es trotzdem.
  }
  notifyDataChanged();
  return result;
}

/**
 * Der zentrale Posteingang. Gelesen wird aus der Abschrift, geschrieben nur
 * ueber die Schnittstellen des Dienstes — `mailAccounts` und `mailMessages`
 * gehoeren ihm, ein `PUT` darauf lehnt er ab.
 */
export const mail = {
  /** Die verbundenen Postfaecher, in der Reihenfolge des Verbindens. */
  accounts(accountId: string): Promise<MailAccountRow[]> {
    return db.mailAccounts.list({
      where: (row) => row.accountId === accountId,
      sort: (a, b) => timeOf(a.connectedAt) - timeOf(b.connectedAt),
    });
  },

  /** Die Nachrichten eines Postfachs oder aller (`null`), die neueste zuerst. */
  messages(accountId: string, mailAccountId: string | null): Promise<MailMessageRow[]> {
    return db.mailMessages.list({
      where: (row) =>
        row.accountId === accountId &&
        (mailAccountId === null || row.mailAccountId === mailAccountId),
      sort: (a, b) => timeOf(b.date) - timeOf(a.date),
    });
  },

  /** Welcher Anbieter hinter einer Adresse steckt und was er braucht. */
  async provider(email: string): Promise<MailResult<MailProviderInfo>> {
    const result = await ask<MailProviderInfo>(
      `/v1/mail/providers?email=${encodeURIComponent(email.trim())}`,
    );
    if (!result.ok) return result;
    const note = result.data.note;
    return {
      ok: true,
      data: { ...result.data, note: note && NOTES.includes(note) ? note : null },
    };
  },

  /** Prueft die Anmeldung live beim Mailserver. Das Passwort bleibt beim Dienst. */
  async connect(input: MailConnectInput): Promise<MailResult<MailAccountRow>> {
    const result = await change<{ mailAccount: MailAccountRow }>('/v1/mail/accounts', {
      method: 'POST',
      body: input,
    });
    return result.ok ? { ok: true, data: result.data.mailAccount } : result;
  },

  /** Trennt ein Postfach samt seinen Nachrichten und Mitteilungen. */
  disconnect(id: string): Promise<MailResult<unknown>> {
    return change(`/v1/mail/accounts/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  /** Gleicht alle Postfaecher dieses Kontos ab. */
  async sync(accountId: string): Promise<MailResult<MailSyncSummary>> {
    const result = await change<{
      newMessages?: number;
      errors?: readonly { mailAccountId: string; error: string }[];
    }>('/v1/mail/sync', { method: 'POST', body: { accountId } });
    if (!result.ok) return result;
    return {
      ok: true,
      data: {
        newMessages: result.data.newMessages ?? 0,
        errors: (result.data.errors ?? []).map((entry) => ({
          mailAccountId: entry.mailAccountId,
          error: mailErrorOf(entry.error),
        })),
      },
    };
  },

  /** Gelesen oder ungelesen — auch auf dem Mailserver. */
  setSeen(id: string, seen: boolean): Promise<MailResult<unknown>> {
    return change(`/v1/mail/messages/${encodeURIComponent(id)}/seen`, {
      method: 'POST',
      body: { seen },
    });
  },

  /** Verschiebt die Nachricht in den Papierkorb des Postfachs. */
  remove(id: string): Promise<MailResult<unknown>> {
    return change(`/v1/mail/messages/${encodeURIComponent(id)}/delete`, { method: 'POST' });
  },

  send(input: MailSendInput): Promise<MailResult<unknown>> {
    return change('/v1/mail/send', { method: 'POST', body: input });
  },
};
