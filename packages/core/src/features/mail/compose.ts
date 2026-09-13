// Relative Pfade mit Absicht: so laeuft die Datei auch in den Tests unter Node.
import type { MailDraftInput, MailMessage, MailSendInput } from '../../db/mail';
import type { MailAddress } from '../../db/types';

import { isEmailAddress, parseAddressList, quoteText, replySubject } from './format';
import { normalizeAddress } from './threads';

export type ComposeMode = 'new' | 'reply' | 'replyAll' | 'forward' | 'draft';

export type RecipientField = 'to' | 'cc' | 'bcc';

/** Was im Schreib-Blatt steht — es lebt ausserhalb des Blatts, damit Minimieren nichts kostet. */
export type ComposeState = {
  mode: ComposeMode;
  mailAccountId: string | null;
  to: readonly string[];
  cc: readonly string[];
  bcc: readonly string[];
  /** Was im Feld noch getippt wird, bevor es zur Adresse wird. */
  toInput: string;
  ccInput: string;
  bccInput: string;
  /** Die eine Zeile „Cc/Bcc, Von“ ist aufgeteilt. */
  showCcBcc: boolean;
  subject: string;
  body: string;
  /** Das Zitat beim Antworten — eingeklappt, beim Senden unter dem eigenen Text. */
  quote: string;
  inReplyTo: string | null;
  forwardOf: string | null;
  /** Der Entwurf, aus dem das Blatt geoeffnet wurde. */
  draftId: string | null;
};

const INPUT_OF: Readonly<Record<RecipientField, 'toInput' | 'ccInput' | 'bccInput'>> = {
  to: 'toInput',
  cc: 'ccInput',
  bcc: 'bccInput',
};

export function inputFieldOf(field: RecipientField): 'toInput' | 'ccInput' | 'bccInput' {
  return INPUT_OF[field];
}

export function emptyCompose(mailAccountId: string | null): ComposeState {
  return {
    mode: 'new',
    mailAccountId,
    to: [],
    cc: [],
    bcc: [],
    toInput: '',
    ccInput: '',
    bccInput: '',
    showCcBcc: false,
    subject: '',
    body: '',
    quote: '',
    inReplyTo: null,
    forwardOf: null,
    draftId: null,
  };
}

/** Jede Adresse einmal, ohne Leerraum; die erste Schreibweise bleibt. */
export function uniqueAddresses(list: readonly string[]): string[] {
  const trimmed = list.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  return trimmed.filter(
    (entry, index) =>
      trimmed.findIndex((other) => normalizeAddress(other) === normalizeAddress(entry)) === index,
  );
}

export function addRecipients(list: readonly string[], additions: readonly string[]): string[] {
  return uniqueAddresses([...list, ...additions]);
}

export function removeRecipient(list: readonly string[], address: string): string[] {
  return list.filter((entry) => normalizeAddress(entry) !== normalizeAddress(address));
}

/**
 * Tippt man ein Komma, einen Strichpunkt oder Leerraum, wird das Getippte zur
 * Adresse. Was danach noch steht, bleibt im Feld.
 */
export function splitTyped(input: string): { complete: string[]; rest: string } {
  const parts = input.split(/[,;\s]+/);
  const separated = /[,;\s]$/.test(input);
  const complete = (separated ? parts : parts.slice(0, -1)).filter((part) => part.length > 0);
  return { complete, rest: separated ? '' : (parts[parts.length - 1] ?? '') };
}

/** Die Adressen eines Felds samt dem, was noch getippt dasteht. */
export function recipientsOf(state: ComposeState, field: RecipientField): string[] {
  return uniqueAddresses([...state[field], ...parseAddressList(state[INPUT_OF[field]])]);
}

/** Senden geht, sobald ein Postfach gewaehlt ist und jede Adresse gueltig ist — und es eine an „An“ gibt. */
export function canSend(state: ComposeState): boolean {
  if (state.mailAccountId === null) return false;
  const to = recipientsOf(state, 'to');
  if (to.length === 0) return false;
  return [to, recipientsOf(state, 'cc'), recipientsOf(state, 'bcc')].every((list) =>
    list.every(isEmailAddress),
  );
}

/** Der Text, der hinausgeht: der eigene, darunter das Zitat. */
export function composeText(state: ComposeState): string {
  const body = state.body.replace(/\s+$/, '');
  return state.quote.length > 0 ? `${body}\n\n${state.quote}` : body;
}

export function sendInputOf(
  state: ComposeState,
  delayMs: number,
  draftId: string | null,
): MailSendInput | null {
  if (!canSend(state) || state.mailAccountId === null) return null;
  const cc = recipientsOf(state, 'cc');
  const bcc = recipientsOf(state, 'bcc');
  return {
    mailAccountId: state.mailAccountId,
    to: recipientsOf(state, 'to'),
    ...(cc.length > 0 ? { cc } : {}),
    ...(bcc.length > 0 ? { bcc } : {}),
    subject: state.subject.trim(),
    text: composeText(state),
    ...(state.inReplyTo ? { inReplyTo: state.inReplyTo } : {}),
    ...(state.forwardOf ? { forwardOf: state.forwardOf } : {}),
    ...(draftId ? { draftId } : {}),
    delayMs,
  };
}

/** Ein Entwurf nimmt nur gueltige Adressen mit — was noch getippt wird, gehoert nicht hinein. */
export function draftInputOf(
  state: ComposeState,
  accountId: string,
  draftId: string | null,
): MailDraftInput | null {
  if (state.mailAccountId === null) return null;
  const valid = (field: RecipientField) => recipientsOf(state, field).filter(isEmailAddress);
  const cc = valid('cc');
  const bcc = valid('bcc');
  return {
    accountId,
    mailAccountId: state.mailAccountId,
    to: valid('to'),
    ...(cc.length > 0 ? { cc } : {}),
    ...(bcc.length > 0 ? { bcc } : {}),
    subject: state.subject,
    text: composeText(state),
    ...(state.inReplyTo ? { inReplyTo: state.inReplyTo } : {}),
    ...(draftId ? { draftId } : {}),
  };
}

/** Der Inhalt als ein Schluessel — aendert er sich, gibt es etwas zu sichern. */
export function composeSignature(state: ComposeState): string {
  return JSON.stringify([
    state.mailAccountId,
    recipientsOf(state, 'to'),
    recipientsOf(state, 'cc'),
    recipientsOf(state, 'bcc'),
    state.subject,
    state.body,
  ]);
}

export function isDirty(state: ComposeState, initial: ComposeState): boolean {
  return composeSignature(state) !== composeSignature(initial);
}

/** Ein „Fwd: “ davor — ohne es zu verdoppeln (Fwd:, Fw:, WG:). */
export function forwardSubject(subject: string): string {
  const rest = subject.trim().replace(/^((fwd?|wg)\s*:\s*)+/i, '');
  return `Fwd: ${rest}`;
}

/**
 * Die Antwort: an den Absender — war ich es selbst, an die Empfaenger von
 * damals. „Allen antworten“ nimmt die uebrigen in Cc, ohne mich.
 */
export function replyCompose(
  message: MailMessage,
  options: { all: boolean; own: ReadonlySet<string>; quoteHeader: string },
): ComposeState {
  const isOwn = (address: string) => options.own.has(normalizeAddress(address));
  const fromMe = isOwn(message.from.address);
  const to = uniqueAddresses(
    fromMe ? message.to.map((entry) => entry.address) : [message.from.address],
  );
  const others = options.all
    ? uniqueAddresses(
        [...(fromMe ? [] : message.to), ...message.cc].map((entry) => entry.address),
      ).filter(
        (address) =>
          !isOwn(address) &&
          !to.some((entry) => normalizeAddress(entry) === normalizeAddress(address)),
      )
    : [];
  const quote =
    message.text.trim().length > 0 ? `${options.quoteHeader}\n${quoteText(message.text)}` : '';

  return {
    ...emptyCompose(message.mailAccountId),
    mode: options.all ? 'replyAll' : 'reply',
    to,
    cc: others,
    showCcBcc: others.length > 0,
    subject: replySubject(message.subject),
    quote,
    inReplyTo: message.id,
  };
}

/** Weiterleiten: nur der eigene Text — Kopf und Zitat haengt der Dienst an, Anhaenge nicht. */
export function forwardCompose(message: MailMessage): ComposeState {
  return {
    ...emptyCompose(message.mailAccountId),
    mode: 'forward',
    subject: forwardSubject(message.subject),
    forwardOf: message.id,
  };
}

/** Ein Entwurf aus dem Entwurfsordner, wieder im Blatt. */
export function draftCompose(message: MailMessage): ComposeState {
  const cc = message.cc.map((entry) => entry.address);
  const bcc = message.bcc.map((entry) => entry.address);
  return {
    ...emptyCompose(message.mailAccountId),
    mode: 'draft',
    to: uniqueAddresses(message.to.map((entry) => entry.address)),
    cc: uniqueAddresses(cc),
    bcc: uniqueAddresses(bcc),
    showCcBcc: cc.length > 0 || bcc.length > 0,
    subject: message.subject,
    body: message.text,
    draftId: message.id,
  };
}

/** So viele Vorschlaege stehen hoechstens unter einem Adressfeld. */
export const SUGGESTION_LIMIT = 5;

/**
 * Vorschlaege fuer ein Adressfeld aus allen Adressen der bisherigen Mails.
 * Wer unter diesem Namen bei den Kontakten steht, kommt zuerst, danach, wem
 * man am oeftesten begegnet.
 */
export function suggestAddresses(
  messages: readonly MailMessage[],
  query: string,
  options: {
    exclude: readonly string[];
    own: ReadonlySet<string>;
    contactNames: readonly string[];
    limit?: number;
  },
): MailAddress[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];
  const excluded = new Set([...options.exclude.map(normalizeAddress), ...options.own]);
  const contacts = new Set(
    options.contactNames.map((name) => name.trim().toLowerCase()).filter((name) => name.length > 0),
  );

  const known = new Map<string, { address: MailAddress; count: number }>();
  for (const message of messages) {
    for (const entry of [message.from, ...message.to, ...message.cc, ...message.bcc]) {
      const key = normalizeAddress(entry.address);
      if (key.length === 0 || excluded.has(key)) continue;
      const previous = known.get(key);
      const name = previous?.address.name || entry.name.trim();
      known.set(key, {
        address: { name, address: previous?.address.address ?? entry.address.trim() },
        count: (previous?.count ?? 0) + 1,
      });
    }
  }

  const matches = (address: MailAddress) => {
    const name = address.name.toLowerCase();
    return (
      address.address.toLowerCase().includes(needle) ||
      name.startsWith(needle) ||
      name.split(/\s+/).some((word) => word.startsWith(needle))
    );
  };
  const inContacts = (address: MailAddress) => contacts.has(address.name.trim().toLowerCase());

  return [...known.values()]
    .filter((entry) => matches(entry.address))
    .sort(
      (a, b) =>
        Number(inContacts(b.address)) - Number(inContacts(a.address)) ||
        b.count - a.count ||
        a.address.address.localeCompare(b.address.address),
    )
    .slice(0, options.limit ?? SUGGESTION_LIMIT)
    .map((entry) => entry.address);
}
