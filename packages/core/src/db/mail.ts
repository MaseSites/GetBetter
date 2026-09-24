import { notifyDataChanged } from './live';
import { callService, serviceUrl, withToken } from './service';
import { db, refresh } from './store';
import {
  MAIL_FOLDER_ROLES,
  type MailAccountRow,
  type MailAddress,
  type MailAttachment,
  type MailFolderRole,
  type MailMessageRow,
} from './types';

export { MAIL_FOLDER_ROLES };

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
  'folder_missing',
  /** Die Anfrage war dem Dienst zu gross (413). */
  'too_large',
  /** Eine verzoegerte Mail ist schon unterwegs — Abbrechen hilft nicht mehr. */
  'already_sent',
  'offline',
  'unknown_route',
] as const;

/** Was sich mit einer oder vielen Nachricht(en) machen laesst. */
export type MailAction = 'seen' | 'unseen' | 'flag' | 'unflag' | 'move' | 'delete';

export type MailActionInput = {
  ids: readonly string[];
  action: MailAction;
  /** Nur bei `move`: wohin. */
  role?: MailFolderRole;
};

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

/** Wie lange eine Mail im Dienst wartet, bevor sie hinausgeht — hoechstens 20 Sekunden. */
export const MAX_SEND_DELAY_MS = 20_000;

export type MailSendInput = {
  mailAccountId: string;
  to: readonly string[];
  cc?: readonly string[];
  /** Geht an diese Adressen, steht aber nur in der eigenen Kopie unter „Gesendet“. */
  bcc?: readonly string[];
  /** Leer beim Weiterleiten: dann setzt der Dienst `Fwd: <Betreff>`. */
  subject: string;
  /** Beim Weiterleiten nur der eigene Text — Kopf und Zitat haengt der Dienst an. */
  text: string;
  /** Die Id der `mailMessages`-Zeile, auf die geantwortet wird. */
  inReplyTo?: string;
  /** Die Id der `mailMessages`-Zeile, die weitergeleitet wird (ohne ihre Anhaenge). Nie mit `inReplyTo`. */
  forwardOf?: string;
  /** Dieser Entwurf wird geloescht, sobald die Mail wirklich hinaus ist. */
  draftId?: string;
  /** 0 (Standard) sendet sofort; bis 20 000 wartet die Mail und laesst sich abbrechen. */
  delayMs?: number;
};

/** Eine verzoegerte Mail: bis `sendAt` hilft `cancelSend(sendId)`. Sofort gesendet: `null`. */
export type MailSendReceipt = { sendId: string; sendAt: string } | null;

/** Wie `cancelSend` ausging: aufgehalten, oder schon unterwegs (dann hilft nichts mehr). */
export type MailCancelOutcome = 'cancelled' | 'already_sent';

export type MailSendState = 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled';

export type MailSendStatus = {
  sendId: string;
  state: MailSendState;
  sendAt: string;
  /** Nur bei `failed`. */
  error: MailError | null;
};

export type MailDraftInput = {
  accountId: string;
  mailAccountId: string;
  /** Nur gueltige Adressen — was noch getippt wird, gehoert nicht hinein. */
  to: readonly string[];
  cc?: readonly string[];
  bcc?: readonly string[];
  subject: string;
  text: string;
  inReplyTo?: string;
  /** Der Entwurf, der ersetzt wird: eine `draftId` von `saveDraft` oder die Id seiner Zeile. */
  draftId?: string;
};

export type MailSyncSummary = {
  newMessages: number;
  errors: readonly { mailAccountId: string; error: MailError }[];
};

/** Ein Anhang, wie der Dienst ihn fuehrt. */
export type MailAttachmentPart = MailAttachment & {
  /** IMAP-Nummer des Teils (`2`, `1.2`); `null`, bis der Abgleich eine alte Zeile nachgetragen hat. */
  part: string | null;
  /** Content-ID ohne spitze Klammern — darauf zeigt `cid:` im HTML. */
  contentId: string | null;
};

/**
 * Eine Nachricht mit den Feldern fuer Unterhaltungen. Mails mit derselben
 * `threadId` gehoeren zusammen — ueber Ordner und Postfaecher hinweg, die eigene
 * Antwort unter „Gesendet“ eingeschlossen.
 */
export type MailMessage = Omit<MailMessageRow, 'attachments'> & {
  /** Message-ID der beantworteten Mail. */
  inReplyTo: string | null;
  /** Die Kette aus `References`; der erste Eintrag ist die Wurzel der Unterhaltung. */
  references: readonly string[];
  /** Nur in Entwuerfen und eigenen Kopien unter „Gesendet“ gefuellt. */
  bcc: readonly MailAddress[];
  /** `th_…`; solange der Dienst sie nicht gesetzt hat, `th_<id>` (die Mail allein). */
  threadId: string;
  attachments: readonly MailAttachmentPart[];
};

export type MailBody = {
  /** Gesaeubertes HTML, Bild-Adressen schon absolut; `null`, wenn die Mail nur Text hat. */
  html: string | null;
  /** Der ganze Text (bis 300 KB), aus dem Textteil oder dem HTML gewonnen. */
  text: string;
  /** Entfernte Bilder im HTML. Ohne `images: true` stehen dort Platzhalter mit `data-remote-image="1"`. */
  remoteImages: number;
  /** Anhaenge (Index in `attachments`), die als eingebettete Bilder im HTML stehen. */
  inlineAttachments: readonly number[];
};

const NOTES: readonly string[] = ['app_password', 'enable_imap', 'oauth_only'];
const SEND_STATES: readonly string[] = ['pending', 'sending', 'sent', 'failed', 'cancelled'];
/** So schreibt der Dienst die Adresse eines eingebetteten Bildes ins HTML. */
const ATTACHMENT_SRC = /src="(\/v1\/mail\/messages\/[^"]+\/attachments\/\d+)"/g;

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

function knownRole(value: string): MailFolderRole {
  return (MAIL_FOLDER_ROLES as readonly string[]).includes(value)
    ? (value as MailFolderRole)
    : 'inbox';
}

/** Eine Zeile, wie sie in der Abschrift liegen kann — auch aus einer aelteren Fassung. */
type StoredMessage = MailMessageRow & {
  inReplyTo?: unknown;
  references?: unknown;
  bcc?: unknown;
  threadId?: unknown;
};

type StoredAttachment = MailAttachment & { part?: unknown; contentId?: unknown };

function completeAttachment(entry: StoredAttachment): MailAttachmentPart {
  return {
    ...entry,
    part: typeof entry.part === 'string' ? entry.part : null,
    contentId: typeof entry.contentId === 'string' ? entry.contentId : null,
  };
}

function stringsOf(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function addressesOf(value: unknown): MailAddress[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: unknown) => {
    const candidate = entry as Partial<MailAddress> | null;
    return candidate && typeof candidate.address === 'string'
      ? [
          {
            name: typeof candidate.name === 'string' ? candidate.name : '',
            address: candidate.address,
          },
        ]
      : [];
  });
}

/**
 * Zeilen aus einer aelteren Fassung des Dienstes kennen Ordner, Fahne,
 * Anhaenge oder Unterhaltungen noch nicht. Bis er neu gestartet und einmal
 * abgeglichen hat, wird hier ergaenzt, statt den Bildschirm auf halbe Zeilen
 * laufen zu lassen.
 */
function completeMessage(row: StoredMessage): MailMessage {
  return {
    ...row,
    folderRole: knownRole(row.folderRole),
    flagged: row.flagged === true,
    answered: row.answered === true,
    attachments: Array.isArray(row.attachments) ? row.attachments.map(completeAttachment) : [],
    inReplyTo: typeof row.inReplyTo === 'string' ? row.inReplyTo : null,
    references: stringsOf(row.references),
    bcc: addressesOf(row.bcc),
    threadId:
      typeof row.threadId === 'string' && row.threadId.length > 0 ? row.threadId : `th_${row.id}`,
  };
}

function completeAccount(row: MailAccountRow): MailAccountRow {
  return { ...row, folders: Array.isArray(row.folders) ? row.folders : [] };
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

const messagePath = (id: string) => `/v1/mail/messages/${encodeURIComponent(id)}`;

/**
 * Der zentrale Posteingang. Gelesen wird aus der Abschrift, geschrieben nur
 * ueber die Schnittstellen des Dienstes — `mailAccounts` und `mailMessages`
 * gehoeren ihm, ein `PUT` darauf lehnt er ab.
 */
export const mail = {
  /** Die verbundenen Postfaecher, in der Reihenfolge des Verbindens. */
  async accounts(accountId: string): Promise<MailAccountRow[]> {
    const rows = await db.mailAccounts.list({
      where: (row) => row.accountId === accountId,
      sort: (a, b) => timeOf(a.connectedAt) - timeOf(b.connectedAt),
    });
    return rows.map(completeAccount);
  },

  /**
   * Alle Nachrichten dieses Kontos, die neueste zuerst — ueber alle Postfaecher
   * und Ordner. Der Bildschirm siebt daraus, was er zeigt: das sind hoechstens
   * ein paar hundert Zeilen, und so stimmen Zahlen, Suche und Filter ohne
   * weitere Abfrage zusammen. Zu Unterhaltungen buendelt `threadId`.
   */
  async messages(accountId: string): Promise<MailMessage[]> {
    const rows = await db.mailMessages.list({
      where: (row) => row.accountId === accountId,
      sort: (a, b) => timeOf(b.date) - timeOf(a.date),
    });
    return rows.map(completeMessage);
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
    return change(`${messagePath(id)}/seen`, { method: 'POST', body: { seen } });
  },

  /** Verschiebt die Nachricht in den Papierkorb des Postfachs. */
  remove(id: string): Promise<MailResult<unknown>> {
    return change(`${messagePath(id)}/delete`, { method: 'POST' });
  },

  /**
   * Ein Handgriff auf einer oder vielen Nachrichten: gelesen, Fahne,
   * verschieben, loeschen. Der Dienst macht es je Postfach in einem Zug — auch
   * auf dem Mailserver.
   */
  async act(input: MailActionInput): Promise<MailResult<number>> {
    if (input.ids.length === 0) return { ok: true, data: 0 };
    const result = await change<{ changed?: number }>('/v1/mail/messages/actions', {
      method: 'POST',
      body: {
        ids: [...input.ids],
        action: input.action,
        ...(input.role ? { role: input.role } : {}),
      },
    });
    return result.ok ? { ok: true, data: result.data.changed ?? 0 } : result;
  },

  /**
   * Der ganze Inhalt einer Nachricht, frisch vom Mailserver oder aus dem
   * Zwischenspeicher des Dienstes. Die Mail bleibt dabei ungelesen.
   * `images: true` laesst entfernte Bilder stehen (Tracking-Pixel inklusive).
   */
  async fetchBody(id: string, options: { images?: boolean } = {}): Promise<MailResult<MailBody>> {
    const result = await ask<Partial<MailBody>>(
      `${messagePath(id)}/body?images=${options.images ? 1 : 0}`,
    );
    if (!result.ok) return result;
    const base = serviceUrl();
    const { html, text, remoteImages, inlineAttachments } = result.data;
    return {
      ok: true,
      data: {
        html:
          typeof html === 'string'
            ? html.replace(
                ATTACHMENT_SRC,
                (_match, route: string) => `src="${withToken(`${base}${route}`)}"`,
              )
            : null,
        text: typeof text === 'string' ? text : '',
        remoteImages: typeof remoteImages === 'number' ? remoteImages : 0,
        inlineAttachments: Array.isArray(inlineAttachments) ? inlineAttachments : [],
      },
    };
  },

  /**
   * Die Adresse eines Anhangs zum Anzeigen oder Herunterladen: Bilder und PDF
   * kommen inline, alles andere als Download, hoechstens 25 MB.
   */
  attachmentUrl(messageId: string, index: number): string {
    return withToken(
      `${serviceUrl()}${messagePath(messageId)}/attachments/${Math.max(0, Math.trunc(index))}`,
    );
  },

  /**
   * Sichert einen Entwurf im Entwurfsordner und ersetzt den vorigen (`draftId`).
   * Immer die zurueckgegebene `draftId` fuers naechste Sichern nehmen. Laedt den
   * Stand nicht neu — es darf alle paar Sekunden laufen.
   */
  async saveDraft(input: MailDraftInput): Promise<MailResult<{ draftId: string }>> {
    const result = await ask<{ draftId?: string }>('/v1/mail/drafts', {
      method: 'POST',
      body: input,
    });
    if (!result.ok) return result;
    const { draftId } = result.data;
    return typeof draftId === 'string'
      ? { ok: true, data: { draftId } }
      : { ok: false, error: 'unknown' };
  },

  /** Loescht einen Entwurf endgueltig — `draftId` von `saveDraft` oder die Id seiner Zeile. */
  deleteDraft(draftId: string): Promise<MailResult<unknown>> {
    return change(`/v1/mail/drafts/${encodeURIComponent(draftId)}`, { method: 'DELETE' });
  },

  /**
   * Sendet — sofort (`data: null`) oder nach `delayMs` (`data: { sendId, sendAt }`).
   * Die Wartezeit laeuft im Dienst weiter, auch wenn die App geschlossen wird.
   */
  async send(input: MailSendInput): Promise<MailResult<MailSendReceipt>> {
    const result = await change<{ sendId?: string; sendAt?: string }>('/v1/mail/send', {
      method: 'POST',
      body: input,
    });
    if (!result.ok) return result;
    const { sendId, sendAt } = result.data;
    return {
      ok: true,
      data: typeof sendId === 'string' && typeof sendAt === 'string' ? { sendId, sendAt } : null,
    };
  },

  /**
   * Haelt eine verzoegerte Mail auf. Zu spaet ist kein Fehler, sondern ein
   * Ausgang: `data: 'already_sent'`. `not_found` fuer eine unbekannte `sendId`.
   */
  async cancelSend(sendId: string): Promise<MailResult<MailCancelOutcome>> {
    try {
      const result = await callService<{ cancelled?: boolean }>(
        `/v1/mail/send/${encodeURIComponent(sendId)}/cancel`,
        { method: 'POST' },
      );
      if (result.ok) {
        return result.data.cancelled === true
          ? { ok: true, data: 'cancelled' }
          : { ok: false, error: 'unknown' };
      }
      if (result.error === 'already_sent') return { ok: true, data: 'already_sent' };
      return { ok: false, error: mailErrorOf(result.error) };
    } catch {
      return { ok: false, error: 'unknown' };
    }
  },

  /** Wie es einer verzoegerten Mail ergangen ist — der Dienst weiss es zehn Minuten lang. */
  async sendStatus(sendId: string): Promise<MailResult<MailSendStatus>> {
    const result = await ask<{ state?: string; sendAt?: string; error?: string | null }>(
      `/v1/mail/send/${encodeURIComponent(sendId)}`,
    );
    if (!result.ok) return result;
    const { state, sendAt } = result.data;
    if (typeof state !== 'string' || !SEND_STATES.includes(state)) {
      return { ok: false, error: 'unknown' };
    }
    return {
      ok: true,
      data: {
        sendId,
        state: state as MailSendState,
        sendAt: typeof sendAt === 'string' ? sendAt : '',
        error: state === 'failed' ? mailErrorOf(result.data.error ?? null) : null,
      },
    };
  },
};
