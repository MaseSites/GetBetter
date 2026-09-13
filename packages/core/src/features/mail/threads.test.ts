import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { MailMessage } from '../../db/mail';
import {
  UNIFIED_INBOX,
  commonRoles,
  conversationOf,
  findMoved,
  isToMe,
  mailboxDomain,
  mailboxShortName,
  movedOf,
  neighboursOf,
  ownAddressesOf,
  selectThreads,
  swipeAwayOf,
  threadsIn,
} from './threads';

const now = new Date(2026, 8, 13, 15, 0);
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();

function mail(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    id: 'm1',
    accountId: 'acc',
    mailAccountId: 'ma_1',
    folder: 'INBOX',
    folderRole: 'inbox',
    uid: 1,
    messageId: '<m1@x>',
    from: { name: 'Luca Brunner', address: 'luca@x.ch' },
    to: [{ name: '', address: 'jonas@gmx.ch' }],
    cc: [],
    bcc: [],
    subject: 'Offerte Maler',
    date: hoursAgo(1),
    snippet: 'Hab dir die neue Version angehängt',
    text: 'Hab dir die neue Version angehängt',
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

const own = ownAddressesOf([{ email: 'Jonas@gmx.ch' }, { email: 'jonas@gmail.com' }]);

function sample(): MailMessage[] {
  return [
    mail({ id: 'a1', messageId: '<a1>', date: hoursAgo(5) }),
    mail({
      id: 'a2',
      messageId: '<a2>',
      date: hoursAgo(2),
      seen: false,
      attachments: [
        { filename: 'v2.pdf', mime: 'application/pdf', size: 1, part: '2', contentId: null },
      ],
    }),
    // Die eigene Antwort liegt in „Gesendet“.
    mail({
      id: 'a3',
      messageId: '<a3>',
      folder: 'Sent',
      folderRole: 'sent',
      from: { name: 'Jonas', address: 'jonas@gmx.ch' },
      to: [{ name: 'Luca', address: 'luca@x.ch' }],
      date: hoursAgo(3),
    }),
    mail({
      id: 'b1',
      threadId: 'th_b',
      messageId: '<b1>',
      subject: 'Samstag?',
      from: { name: 'Anna', address: 'anna@x.ch' },
      to: [{ name: '', address: 'someone@x.ch' }],
      mailAccountId: 'ma_2',
      date: hoursAgo(30),
      flagged: true,
    }),
    mail({ id: 'c1', threadId: 'th_c', messageId: '<c1>', folderRole: 'trash', date: hoursAgo(1) }),
  ];
}

test('buendelt nach Unterhaltung, die neueste zuerst, mit Zahl samt eigener Antwort', () => {
  const threads = threadsIn(sample(), UNIFIED_INBOX);
  assert.deepEqual(
    threads.map((thread) => thread.id),
    ['th_a', 'th_b'],
  );
  const [first] = threads;
  assert.equal(first?.latest.id, 'a2');
  assert.equal(first?.count, 3);
  assert.equal(first?.unread, true);
  assert.equal(first?.hasAttachments, true);
  assert.equal(threads[1]?.flagged, true);
});

test('ein Postfach allein und ein Ordner allein', () => {
  assert.deepEqual(
    threadsIn(sample(), { mailAccountId: 'ma_2', role: 'inbox' }).map((thread) => thread.id),
    ['th_b'],
  );
  assert.deepEqual(
    threadsIn(sample(), { mailAccountId: null, role: 'trash' }).map((thread) => thread.id),
    ['th_c'],
  );
});

test('filtert nach ungelesen, markiert, Anhang, an mich und heute', () => {
  const pick = (filter: Parameters<typeof selectThreads>[1]['filter']) =>
    selectThreads(sample(), { place: UNIFIED_INBOX, filter, search: '', own, now }).map(
      (thread) => thread.id,
    );
  assert.deepEqual(pick(null), ['th_a', 'th_b']);
  assert.deepEqual(pick('unread'), ['th_a']);
  assert.deepEqual(pick('flagged'), ['th_b']);
  assert.deepEqual(pick('attachments'), ['th_a']);
  assert.deepEqual(pick('toMe'), ['th_a']);
  assert.deepEqual(pick('today'), ['th_a']);
});

test('sucht ueber alle Nachrichten einer Unterhaltung', () => {
  const found = selectThreads(sample(), {
    place: UNIFIED_INBOX,
    filter: null,
    search: 'samstag',
    own,
    now,
  });
  assert.deepEqual(
    found.map((thread) => thread.id),
    ['th_b'],
  );
});

test('die Unterhaltung: aelteste zuerst, ohne Papierkorb, ohne Doppel', () => {
  const rows = [
    ...sample(),
    mail({ id: 'a1copy', messageId: '<a1>', folderRole: 'archive', date: hoursAgo(5) }),
    mail({ id: 'a0', messageId: '<a0>', folderRole: 'trash', date: hoursAgo(9) }),
  ];
  assert.deepEqual(
    conversationOf(rows, 'th_a', 'inbox').map((message) => message.id),
    ['a1', 'a3', 'a2'],
  );
  assert.deepEqual(
    conversationOf(rows, 'th_a', 'trash').map((message) => message.id),
    ['a0', 'a1', 'a3', 'a2'],
  );
});

test('erkennt eigene Adressen ohne Gross und Klein', () => {
  assert.equal(isToMe(mail({ to: [{ name: '', address: ' JONAS@GMAIL.COM ' }] }), own), true);
  assert.equal(isToMe(mail({ to: [], cc: [] }), own), false);
});

test('Nachbarn fuer ˄ und ˅', () => {
  const threads = threadsIn(sample(), UNIFIED_INBOX);
  assert.deepEqual(neighboursOf(threads, 'th_a'), { previous: null, next: 'th_b' });
  assert.deepEqual(neighboursOf(threads, 'th_b'), { previous: 'th_a', next: null });
  assert.deepEqual(neighboursOf(threads, 'nix'), { previous: null, next: null });
});

test('Kurzname und Domain eines Postfachs', () => {
  assert.equal(mailboxShortName('privat@gmx.ch'), 'gmx');
  assert.equal(mailboxShortName('jonas@mail.bluewin.ch'), 'bluewin');
  assert.equal(mailboxShortName('kaputt'), 'kaputt');
  assert.equal(mailboxDomain('privat@GMX.ch'), 'gmx.ch');
});

test('voller Wisch: Archiv, sonst Loeschen, im Papierkorb endgueltig', () => {
  assert.equal(swipeAwayOf('inbox', ['inbox', 'archive']), 'archive');
  assert.equal(swipeAwayOf('inbox', ['inbox', 'trash']), 'delete');
  assert.equal(swipeAwayOf('archive', ['inbox', 'archive']), 'delete');
  assert.equal(swipeAwayOf('drafts', ['inbox', 'archive']), 'delete');
  assert.equal(swipeAwayOf('trash', ['inbox', 'archive', 'trash']), 'purge');
});

test('verschieben geht nur in Ordner, die alle beteiligten Postfaecher haben', () => {
  const roles = new Map([
    ['ma_1', ['inbox', 'archive', 'junk'] as const],
    ['ma_2', ['inbox', 'junk'] as const],
  ]);
  assert.deepEqual(commonRoles(roles, ['ma_1', 'ma_2', 'ma_1']), ['inbox', 'junk']);
  assert.deepEqual(commonRoles(roles, []), []);
});

test('findet verschobene Mails ueber die Message-ID wieder', () => {
  const moved = movedOf(
    [mail({ id: 'x', messageId: '<x>' }), mail({ messageId: null })],
    'archive',
  );
  const rows = [
    mail({ id: 'new', messageId: '<x>', folderRole: 'archive' }),
    mail({ id: 'other', messageId: '<x>', folderRole: 'archive', mailAccountId: 'ma_9' }),
  ];
  assert.deepEqual(findMoved(rows, moved), [{ role: 'inbox', ids: ['new'] }]);
  assert.deepEqual(findMoved([], moved), []);
});
