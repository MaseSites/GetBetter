// Relative Pfade mit Absicht: so laeuft die Datei auch in den Tests unter Node.
import { dueAtOfDay } from '../../db/taskFields';
import type { MailAddress } from '../../db/types';

import { formatAddress } from './format';

/**
 * Aus einer E-Mail eine Aufgabe: „Antworten: Offerte Maler“, fällig heute,
 * in der Notiz der Absender und der Weg zurück zur Mail. Rein, getestet.
 */
export type MailTaskDraft = {
  title: string;
  /** Absender und Link, je eine Zeile. */
  notes: string;
  /** Heute als `YYYY-MM-DD`. */
  dueDay: string;
  /** Die Frist, wie Aufgaben sie speichern (12:00 Ortszeit). */
  dueAt: string;
  /** `/run/mail?message=<id>` — öffnet die Mail. */
  link: string;
};

/** Die Sätze kommen aus `t()`; ohne Angabe Deutsch, wie in den Tests. */
export type MailTaskText = {
  /** Mit `{subject}`: „Antworten: {subject}“. */
  title: string;
  /** Wenn der Betreff leer ist. */
  noSubject: string;
  /** Mit `{sender}`: „Von {sender}“. */
  from: string;
};

const GERMAN: MailTaskText = {
  title: 'Antworten: {subject}',
  noSubject: 'Ohne Betreff',
  from: 'Von {sender}',
};

/** Länger steht es in keiner Zeile — der Rest ist mit „…“ abgeschnitten. */
export const MAX_SUBJECT = 80;

/** Re:, AW:, Fwd:, WG:, TR:, SV:, auch mehrfach, mit [2] und ohne Leerzeichen. */
const PREFIX = /^\s*(?:(?:re|aw|antw|fw|fwd|wg|tr|sv|vs)(?:\s*\[\d+\])?\s*:\s*)+/iu;

export function cleanSubject(subject: string): string {
  const rest = subject.replace(PREFIX, '').replace(/\s+/gu, ' ').trim();
  if (rest.length <= MAX_SUBJECT) return rest;
  return `${rest.slice(0, MAX_SUBJECT - 1).trimEnd()}…`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function mailLink(messageId: string): string {
  return `/run/mail?message=${encodeURIComponent(messageId)}`;
}

function fill(template: string, name: string, value: string): string {
  return template.replace(`{${name}}`, value);
}

export function taskFromMail(
  message: { id: string; subject: string; from: MailAddress },
  now: Date,
  text: MailTaskText = GERMAN,
): MailTaskDraft {
  const subject = cleanSubject(message.subject) || text.noSubject;
  const dueDay = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const sender = formatAddress(message.from);
  const link = mailLink(message.id);
  return {
    title: fill(text.title, 'subject', subject),
    notes: [sender ? fill(text.from, 'sender', sender) : null, link].filter(Boolean).join('\n'),
    dueDay,
    dueAt: dueAtOfDay(dueDay),
    link,
  };
}
