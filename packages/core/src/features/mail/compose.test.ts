import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { MailMessage } from '../../db/mail';
import {
  addRecipients,
  canSend,
  composeText,
  draftCompose,
  draftInputOf,
  emptyCompose,
  forwardCompose,
  forwardSubject,
  isDirty,
  recipientsOf,
  removeRecipient,
  replyCompose,
  sendInputOf,
  splitTyped,
  suggestAddresses,
  uniqueAddresses,
} from './compose';

function mail(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    id: 'mm_1',
    accountId: 'acc',
    mailAccountId: 'ma_1',
    folder: 'INBOX',
    folderRole: 'inbox',
    uid: 1,
    messageId: '<m1@x>',
    from: { name: 'Luca Brunner', address: 'luca@x.ch' },
    to: [
      { name: 'Jonas', address: 'jonas@gmx.ch' },
      { name: 'Anna', address: 'anna@x.ch' },
    ],
    cc: [{ name: 'Mia', address: 'mia@x.ch' }],
    bcc: [],
    subject: 'Offerte Maler',
    date: '2026-09-13T08:00:00.000Z',
    snippet: '',
    text: 'Hier die Offerte.\nGruss',
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

const own = new Set(['jonas@gmx.ch']);

test('aus Getipptem werden Adressen, sobald ein Trenner kommt', () => {
  assert.deepEqual(splitTyped('luca@x.ch, an'), { complete: ['luca@x.ch'], rest: 'an' });
  assert.deepEqual(splitTyped('luca@x.ch;'), { complete: ['luca@x.ch'], rest: '' });
  assert.deepEqual(splitTyped('luca'), { complete: [], rest: 'luca' });
  assert.deepEqual(splitTyped(' '), { complete: [], rest: '' });
});

test('jede Adresse einmal, entfernen ohne Gross und Klein', () => {
  assert.deepEqual(uniqueAddresses([' A@x.ch', 'a@X.ch', '', 'b@x.ch']), ['A@x.ch', 'b@x.ch']);
  assert.deepEqual(addRecipients(['a@x.ch'], ['A@x.ch', 'c@x.ch']), ['a@x.ch', 'c@x.ch']);
  assert.deepEqual(removeRecipient(['a@x.ch', 'b@x.ch'], 'A@X.CH'), ['b@x.ch']);
});

test('senden geht mit Postfach und gueltigen Adressen, auch noch getippt', () => {
  const base = emptyCompose('ma_1');
  assert.equal(canSend(base), false);
  assert.equal(canSend({ ...base, toInput: 'luca@x.ch' }), true);
  assert.equal(canSend({ ...base, to: ['luca@x'] }), false);
  assert.equal(canSend({ ...base, to: ['luca@x.ch'], cc: ['kaputt'] }), false);
  assert.equal(canSend({ ...emptyCompose(null), to: ['luca@x.ch'] }), false);
  assert.deepEqual(recipientsOf({ ...base, to: ['a@x.ch'], toInput: 'b@x.ch' }, 'to'), [
    'a@x.ch',
    'b@x.ch',
  ]);
});

test('antworten: an den Absender, Re:, Zitat eingeklappt', () => {
  const state = replyCompose(mail(), { all: false, own, quoteHeader: 'Luca schrieb:' });
  assert.deepEqual(state.to, ['luca@x.ch']);
  assert.deepEqual(state.cc, []);
  assert.equal(state.subject, 'Re: Offerte Maler');
  assert.equal(state.quote, 'Luca schrieb:\n> Hier die Offerte.\n> Gruss');
  assert.equal(state.inReplyTo, 'mm_1');
  assert.equal(
    composeText({ ...state, body: 'Passt.\n' }),
    'Passt.\n\nLuca schrieb:\n> Hier die Offerte.\n> Gruss',
  );
});

test('allen antworten: die anderen in Cc, ohne mich', () => {
  const state = replyCompose(mail(), { all: true, own, quoteHeader: 'Kopf' });
  assert.deepEqual(state.to, ['luca@x.ch']);
  assert.deepEqual(state.cc, ['anna@x.ch', 'mia@x.ch']);
  assert.equal(state.showCcBcc, true);
});

test('auf die eigene Mail antworten geht an die Empfaenger von damals', () => {
  const sent = mail({
    from: { name: 'Jonas', address: 'JONAS@gmx.ch' },
    to: [{ name: '', address: 'luca@x.ch' }],
    cc: [],
  });
  assert.deepEqual(replyCompose(sent, { all: true, own, quoteHeader: 'K' }).to, ['luca@x.ch']);
});

test('weiterleiten und Fwd: genau einmal', () => {
  assert.equal(forwardSubject('Fwd: WG: Offerte'), 'Fwd: Offerte');
  const state = forwardCompose(mail());
  assert.equal(state.forwardOf, 'mm_1');
  assert.equal(state.subject, 'Fwd: Offerte Maler');
  assert.deepEqual(state.to, []);
});

test('ein Entwurf kommt mit Adressen, Text und seiner Id zurueck', () => {
  const state = draftCompose(
    mail({ folderRole: 'drafts', bcc: [{ name: '', address: 'b@x.ch' }] }),
  );
  assert.equal(state.draftId, 'mm_1');
  assert.deepEqual(state.bcc, ['b@x.ch']);
  assert.equal(state.body, 'Hier die Offerte.\nGruss');
});

test('Senden und Entwurf: die Eingaben fuer den Dienst', () => {
  const state = {
    ...replyCompose(mail(), { all: false, own, quoteHeader: 'K' }),
    body: 'Ok',
    ccInput: 'kaputt',
  };
  assert.equal(sendInputOf(state, 5000, 'dft_1'), null);
  const valid = { ...state, ccInput: 'mia@x.ch' };
  assert.deepEqual(sendInputOf(valid, 5000, 'dft_1'), {
    mailAccountId: 'ma_1',
    to: ['luca@x.ch'],
    cc: ['mia@x.ch'],
    subject: 'Re: Offerte Maler',
    text: 'Ok\n\nK\n> Hier die Offerte.\n> Gruss',
    inReplyTo: 'mm_1',
    draftId: 'dft_1',
    delayMs: 5000,
  });
  assert.deepEqual(draftInputOf(state, 'acc', null), {
    accountId: 'acc',
    mailAccountId: 'ma_1',
    to: ['luca@x.ch'],
    subject: 'Re: Offerte Maler',
    text: 'Ok\n\nK\n> Hier die Offerte.\n> Gruss',
    inReplyTo: 'mm_1',
  });
  assert.equal(draftInputOf(emptyCompose(null), 'acc', null), null);
});

test('veraendert ist nur, was sich am Inhalt geaendert hat', () => {
  const initial = emptyCompose('ma_1');
  assert.equal(isDirty({ ...initial, showCcBcc: true }, initial), false);
  assert.equal(isDirty({ ...initial, toInput: 'a@x.ch' }, initial), true);
  assert.equal(isDirty({ ...initial, body: 'Hallo' }, initial), true);
});

test('Vorschlaege: Treffer in Name oder Adresse, Kontakte zuerst, ohne Doppel und ohne mich', () => {
  const messages = [
    mail({ from: { name: 'Luca Brunner', address: 'luca@x.ch' } }),
    mail({ from: { name: '', address: 'LUCA@x.ch' } }),
    mail({ from: { name: 'Lucia Meier', address: 'lucia@y.ch' }, to: [], cc: [] }),
  ];
  const options = { exclude: [], own, contactNames: [] };
  assert.deepEqual(
    suggestAddresses(messages, 'luc', options).map((entry) => entry.address),
    ['luca@x.ch', 'lucia@y.ch'],
  );
  assert.deepEqual(
    suggestAddresses(messages, 'luc', { ...options, contactNames: ['lucia meier'] }).map(
      (entry) => entry.address,
    ),
    ['lucia@y.ch', 'luca@x.ch'],
  );
  assert.deepEqual(
    suggestAddresses(messages, 'meier', { ...options, exclude: ['lucia@y.ch'] }),
    [],
  );
  assert.deepEqual(suggestAddresses(messages, 'jonas', options), []);
  assert.deepEqual(suggestAddresses(messages, ' ', options), []);
});
