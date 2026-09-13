// Relative Pfade mit Absicht: so laeuft die Datei auch in den Tests unter Node.
import type { MailMessage } from '../../db/mail';
import type { MailAddress } from '../../db/types';

import { normalizeAddress } from './threads';

/** Ab so vielen Nachrichten werden die mittleren zu „N weitere“ gebuendelt. */
export const BUNDLE_FROM = 4;

export type ConversationItem =
  | { kind: 'message'; id: string; expanded: boolean }
  | { kind: 'bundle'; key: string; ids: readonly string[] };

/** Wohin der Bildschirm rollt: die neueste ungelesene, sonst die neueste. */
export function focusOf(messages: readonly MailMessage[]): string | null {
  const unread = [...messages].reverse().find((message) => !message.seen);
  return (unread ?? messages[messages.length - 1])?.id ?? null;
}

/** Aufgeklappt beim Oeffnen: die neueste ungelesene und die neueste. */
export function initiallyExpanded(messages: readonly MailMessage[]): string[] {
  const ids = [focusOf(messages), messages[messages.length - 1]?.id ?? null];
  return [...new Set(ids.filter((id): id is string => id !== null))];
}

/**
 * Wie die Unterhaltung dasteht (die aelteste zuerst): die erste und die letzte
 * Nachricht immer, dazu jede aufgeklappte und jede, die man sich hat zeigen
 * lassen. Ab vier Nachrichten werden die anderen dazwischen gebuendelt — eine
 * einzelne bleibt als Zeile stehen, ein Buendel von einer waere Unsinn.
 */
export function planConversation(
  messages: readonly MailMessage[],
  state: { expanded: ReadonlySet<string>; revealed: ReadonlySet<string> },
): ConversationItem[] {
  const last = messages.length - 1;
  const bundling = messages.length >= BUNDLE_FROM;
  const items: ConversationItem[] = [];
  let run: string[] = [];

  const flush = () => {
    const [only] = run;
    if (run.length === 1 && only !== undefined) {
      items.push({ kind: 'message', id: only, expanded: false });
    } else if (run.length > 1) {
      items.push({ kind: 'bundle', key: run.join('|'), ids: run });
    }
    run = [];
  };

  messages.forEach((message, index) => {
    const expanded = state.expanded.has(message.id);
    const visible =
      !bundling || index === 0 || index === last || expanded || state.revealed.has(message.id);
    if (!visible) {
      run.push(message.id);
      return;
    }
    flush();
    items.push({ kind: 'message', id: message.id, expanded });
  });
  flush();
  return items;
}

/**
 * Trennt ein Zitat am Ende ab: die Zeilen mit „>“ und die Zeile darueber, die
 * mit einem Doppelpunkt endet („Am … schrieb Lea:“). Ist alles Zitat, bleibt
 * alles stehen.
 */
export function splitQuote(text: string): { body: string; quote: string } {
  const lines = text.replace(/\s+$/, '').split(/\r?\n/);
  let start = lines.length;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = (lines[index] ?? '').trim();
    if (line.startsWith('>')) {
      start = index;
      continue;
    }
    if (line.length > 0) break;
  }
  if (start >= lines.length) return { body: text, quote: '' };

  let head = start - 1;
  while (head >= 0 && (lines[head] ?? '').trim().length === 0) head -= 1;
  if (head >= 0 && (lines[head] ?? '').trim().endsWith(':')) start = head;

  const body = lines.slice(0, start).join('\n').replace(/\s+$/, '');
  if (body.length === 0) return { body: text, quote: '' };
  return { body, quote: lines.slice(start).join('\n') };
}

/** Der Vorname, sonst der Teil vor dem @. */
export function firstNameOf(address: MailAddress): string {
  const name = address.name.trim();
  if (name.length > 0) return name.split(/\s+/)[0] ?? name;
  const mail = address.address.trim();
  return mail.split('@')[0] || mail;
}

export type RecipientLabel = { me: true } | { me: false; name: string };

/** „an mich, Luca“: wer die Nachricht bekam — ich zuerst, jede Adresse einmal. */
export function recipientLabels(message: MailMessage, own: ReadonlySet<string>): RecipientLabel[] {
  const everyone = [...message.to, ...message.cc];
  const mine = everyone.some((entry) => own.has(normalizeAddress(entry.address)));
  const others = everyone.filter(
    (entry, index) =>
      !own.has(normalizeAddress(entry.address)) &&
      everyone.findIndex(
        (other) => normalizeAddress(other.address) === normalizeAddress(entry.address),
      ) === index,
  );
  return [
    ...(mine ? [{ me: true } as const] : []),
    ...others.map((entry) => ({ me: false as const, name: firstNameOf(entry) })),
  ];
}
