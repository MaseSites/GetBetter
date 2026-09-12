import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { MailMessageRow } from '../../db/types';
import { de } from '../../i18n/de';
import {
  MAIL_ERROR_KEYS,
  ageOf,
  emptyDraft,
  formatAddress,
  formatAge,
  isEmailAddress,
  listDateKind,
  mailErrorKey,
  parseAddressList,
  parsePort,
  quoteText,
  replyDraft,
  replySubject,
  senderName,
} from './format';

const now = new Date(2026, 8, 11, 15, 30); // Freitag, 11. September 2026, nachmittags

function message(overrides: Partial<MailMessageRow> = {}): MailMessageRow {
  return {
    id: 'mm_1',
    accountId: 'acc_1',
    mailAccountId: 'ma_1',
    folder: 'INBOX',
    uid: 7,
    messageId: '<abc@beispiel.ch>',
    from: { name: 'Lea Meier', address: 'lea@beispiel.ch' },
    to: [{ name: '', address: 'jonas@beispiel.ch' }],
    cc: [],
    subject: 'Znacht am Samstag',
    date: now.toISOString(),
    snippet: 'Kommst du auch?',
    text: 'Kommst du auch?\nBring Brot mit.',
    seen: false,
    arrivedAfterConnect: true,
    ...overrides,
  };
}

test('jeder Fehlerschluessel hat einen Satz', () => {
  for (const key of Object.values(MAIL_ERROR_KEYS)) {
    assert.equal(typeof de[key], 'string', key);
  }
  assert.equal(mailErrorKey('unknown_route'), 'mail.error.unknownRoute');
});

test('nimmt den Namen, sonst die Adresse', () => {
  assert.equal(senderName({ name: 'Lea Meier', address: 'lea@beispiel.ch' }), 'Lea Meier');
  assert.equal(senderName({ name: '  ', address: 'lea@beispiel.ch' }), 'lea@beispiel.ch');
  assert.equal(senderName({ name: '', address: '' }), '');
});

test('schreibt Name und Adresse zusammen, ohne Doppeltes', () => {
  assert.equal(
    formatAddress({ name: 'Lea Meier', address: 'lea@beispiel.ch' }),
    'Lea Meier <lea@beispiel.ch>',
  );
  assert.equal(formatAddress({ name: '', address: 'lea@beispiel.ch' }), 'lea@beispiel.ch');
  assert.equal(
    formatAddress({ name: 'lea@beispiel.ch', address: 'lea@beispiel.ch' }),
    'lea@beispiel.ch',
  );
});

test('setzt Re: genau einmal davor', () => {
  assert.equal(replySubject('Znacht'), 'Re: Znacht');
  assert.equal(replySubject('Re: Znacht'), 'Re: Znacht');
  assert.equal(replySubject('RE:Znacht'), 'Re: Znacht');
  assert.equal(replySubject('AW: Re: Znacht'), 'Re: Znacht');
  assert.equal(replySubject(''), 'Re: ');
});

test('zitiert jede Zeile und laesst leere Zeilen am Ende weg', () => {
  assert.equal(quoteText('Hallo\r\n\r\nBis bald\n\n'), '> Hallo\n>\n> Bis bald');
});

test('liest mehrere Adressen aus einem Feld', () => {
  assert.deepEqual(parseAddressList('a@b.ch, c@d.ch;e@f.ch  g@h.ch'), [
    'a@b.ch',
    'c@d.ch',
    'e@f.ch',
    'g@h.ch',
  ]);
  assert.deepEqual(parseAddressList(' , ; '), []);
});

test('erkennt eine E-Mail-Adresse', () => {
  assert.ok(isEmailAddress('jonas@beispiel.ch'));
  assert.ok(isEmailAddress(' jonas.muster@mail.beispiel.ch '));
  assert.ok(!isEmailAddress('jonas@beispiel'));
  assert.ok(!isEmailAddress('jonas beispiel.ch'));
  assert.ok(!isEmailAddress(''));
});

test('liest einen Port: leer, gueltig oder falsch', () => {
  assert.equal(parsePort(''), undefined);
  assert.equal(parsePort(' 993 '), 993);
  assert.equal(parsePort('0'), null);
  assert.equal(parsePort('70000'), null);
  assert.equal(parsePort('99a'), null);
});

test('zeigt heute die Uhrzeit, danach gestern, Wochentag, Datum', () => {
  assert.equal(listDateKind(new Date(2026, 8, 11, 8, 0).toISOString(), now), 'time');
  assert.equal(listDateKind(new Date(2026, 8, 10, 23, 59).toISOString(), now), 'yesterday');
  assert.equal(listDateKind(new Date(2026, 8, 7, 12, 0).toISOString(), now), 'weekday');
  assert.equal(listDateKind(new Date(2026, 8, 4, 12, 0).toISOString(), now), 'date');
  assert.equal(listDateKind(new Date(2026, 8, 14, 12, 0).toISOString(), now), 'date');
  assert.equal(listDateKind('kein Datum', now), 'none');
});

test('sagt, wie lange ein Abgleich her ist', () => {
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  assert.equal(ageOf(ago(30_000), now), 'now');
  assert.deepEqual(ageOf(ago(5 * 60_000), now), { value: 5, unit: 'minute' });
  assert.deepEqual(ageOf(ago(3 * 3_600_000), now), { value: 3, unit: 'hour' });
  assert.deepEqual(ageOf(ago(2 * 86_400_000), now), { value: 2, unit: 'day' });
  assert.equal(ageOf('kaputt', now), null);
});

test('schreibt das Alter ueber Intl', () => {
  assert.equal(formatAge('de', { value: 5, unit: 'minute' }), 'vor 5 Minuten');
  assert.equal(formatAge('de', { value: 1, unit: 'day' }), 'gestern');
});

test('baut die Antwort an den Absender aus demselben Postfach', () => {
  const draft = replyDraft(message(), 'Am Freitag schrieb Lea Meier:');
  assert.equal(draft.mailAccountId, 'ma_1');
  assert.equal(draft.to, 'lea@beispiel.ch');
  assert.equal(draft.subject, 'Re: Znacht am Samstag');
  assert.equal(draft.inReplyTo, 'mm_1');
  assert.equal(
    draft.text,
    '\n\nAm Freitag schrieb Lea Meier:\n> Kommst du auch?\n> Bring Brot mit.',
  );
});

test('ohne Text nur die Zeile ueber dem Zitat, neu leer', () => {
  assert.equal(replyDraft(message({ text: '  ' }), 'Kopf').text, '\n\nKopf');
  assert.deepEqual(emptyDraft(null), {
    mailAccountId: null,
    to: '',
    cc: '',
    subject: '',
    text: '',
  });
});
