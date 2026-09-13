import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { MailMessage } from '../../db/mail';
import {
  firstNameOf,
  focusOf,
  initiallyExpanded,
  planConversation,
  recipientLabels,
  splitQuote,
} from './conversation';

function mail(id: string, overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    id,
    accountId: 'acc',
    mailAccountId: 'ma_1',
    folder: 'INBOX',
    folderRole: 'inbox',
    uid: 1,
    messageId: `<${id}>`,
    from: { name: 'Luca Brunner', address: 'luca@x.ch' },
    to: [{ name: 'Jonas', address: 'jonas@gmx.ch' }],
    cc: [],
    bcc: [],
    subject: 'Offerte',
    date: '2026-09-13T08:00:00.000Z',
    snippet: '',
    text: '',
    seen: true,
    flagged: false,
    answered: false,
    attachments: [],
    arrivedAfterConnect: true,
    inReplyTo: null,
    references: [],
    threadId: 'th_a',
    ...overrides,
  };
}

const none = new Set<string>();

test('Fokus: die neueste ungelesene, sonst die neueste', () => {
  const read = [mail('a'), mail('b'), mail('c')];
  assert.equal(focusOf(read), 'c');
  const unread = [mail('a'), mail('b', { seen: false }), mail('c')];
  assert.equal(focusOf(unread), 'b');
  assert.deepEqual(initiallyExpanded(unread), ['b', 'c']);
  assert.deepEqual(initiallyExpanded(read), ['c']);
  assert.equal(focusOf([]), null);
});

test('bis drei Nachrichten steht jede da', () => {
  const plan = planConversation([mail('a'), mail('b'), mail('c')], {
    expanded: new Set(['c']),
    revealed: none,
  });
  assert.deepEqual(plan, [
    { kind: 'message', id: 'a', expanded: false },
    { kind: 'message', id: 'b', expanded: false },
    { kind: 'message', id: 'c', expanded: true },
  ]);
});

test('ab vier werden die mittleren gebuendelt', () => {
  const messages = ['a', 'b', 'c', 'd', 'e'].map((id) => mail(id));
  assert.deepEqual(planConversation(messages, { expanded: new Set(['e']), revealed: none }), [
    { kind: 'message', id: 'a', expanded: false },
    { kind: 'bundle', key: 'b|c|d', ids: ['b', 'c', 'd'] },
    { kind: 'message', id: 'e', expanded: true },
  ]);
});

test('aufgeklappte und gezeigte teilen das Buendel, ein einzelnes bleibt eine Zeile', () => {
  const messages = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => mail(id));
  assert.deepEqual(
    planConversation(messages, { expanded: new Set(['c', 'f']), revealed: new Set(['e']) }),
    [
      { kind: 'message', id: 'a', expanded: false },
      { kind: 'message', id: 'b', expanded: false },
      { kind: 'message', id: 'c', expanded: true },
      { kind: 'message', id: 'd', expanded: false },
      { kind: 'message', id: 'e', expanded: false },
      { kind: 'message', id: 'f', expanded: true },
    ],
  );
});

test('trennt das Zitat samt Kopfzeile ab', () => {
  assert.deepEqual(splitQuote('Danke!\n\nAm Freitag schrieb Lea:\n> Kommst du?\n>\n> Gruss\n'), {
    body: 'Danke!',
    quote: 'Am Freitag schrieb Lea:\n> Kommst du?\n>\n> Gruss',
  });
  assert.deepEqual(splitQuote('Nur Text\nohne Zitat'), { body: 'Nur Text\nohne Zitat', quote: '' });
  assert.deepEqual(splitQuote('> alles\n> Zitat'), { body: '> alles\n> Zitat', quote: '' });
  assert.deepEqual(splitQuote('Oben\n> mitten\nunten'), {
    body: 'Oben\n> mitten\nunten',
    quote: '',
  });
});

test('an mich, Luca: ich zuerst, jede Adresse einmal, Vorname', () => {
  const own = new Set(['jonas@gmx.ch']);
  const message = mail('a', {
    to: [
      { name: 'Luca Brunner', address: 'luca@x.ch' },
      { name: '', address: 'JONAS@gmx.ch' },
    ],
    cc: [
      { name: '', address: 'anna.muster@x.ch' },
      { name: 'Luca', address: 'luca@x.ch' },
    ],
  });
  assert.deepEqual(recipientLabels(message, own), [
    { me: true },
    { me: false, name: 'Luca' },
    { me: false, name: 'anna.muster' },
  ]);
  assert.equal(firstNameOf({ name: '', address: '' }), '');
});
