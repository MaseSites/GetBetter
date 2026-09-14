import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAIL_FOLDER_ROLES, type MailMessageRow } from '../../db/types';
import { de } from '../../i18n/de';
import {
  FILTER_LABEL_KEYS,
  FOLDER_LABEL_KEYS,
  MAIL_ERROR_KEYS,
  SORT_LABEL_KEYS,
  ageOf,
  countUnread,
  emptyDraft,
  fileSize,
  formatAddress,
  formatAge,
  isEmailAddress,
  listDateKind,
  mailErrorKey,
  matchesQuery,
  parseAddressList,
  quoteText,
  replyDraft,
  replySubject,
  rolesOf,
  selectMessages,
  senderName,
} from './format';

const now = new Date(2026, 8, 11, 15, 30); // Freitag, 11. September 2026, nachmittags

function message(overrides: Partial<MailMessageRow> = {}): MailMessageRow {
  return {
    id: 'mm_1',
    accountId: 'acc_1',
    mailAccountId: 'ma_1',
    folder: 'INBOX',
    folderRole: 'inbox',
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
    flagged: false,
    answered: false,
    attachments: [],
    arrivedAfterConnect: true,
    ...overrides,
  };
}

/** Ein kleiner Posteingang: drei im Posteingang, einer im Spam. */
function inbox(): MailMessageRow[] {
  const at = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  return [
    message({
      id: 'a',
      subject: 'Anfrage',
      from: { name: 'Zoe', address: 'zoe@x.ch' },
      date: at(0),
    }),
    message({
      id: 'b',
      subject: 'Bericht',
      from: { name: 'Ali', address: 'ali@x.ch' },
      date: at(1),
      seen: true,
      flagged: true,
      attachments: [{ filename: 'x.pdf', mime: 'application/pdf', size: 2048 }],
    }),
    message({
      id: 'c',
      subject: 'Cousine',
      from: { name: 'Mia', address: 'mia@x.ch' },
      date: at(2),
      mailAccountId: 'ma_2',
    }),
    message({ id: 'd', subject: 'Gewinn', folder: 'Junk', folderRole: 'junk', date: at(3) }),
  ];
}

test('jeder Fehlerschluessel hat einen Satz', () => {
  for (const key of Object.values(MAIL_ERROR_KEYS)) {
    assert.equal(typeof de[key], 'string', key);
  }
  assert.equal(mailErrorKey('unknown_route'), 'mail.error.unknownRoute');
});

test('Ordner, Sortierung und Filter haben alle ihren Satz', () => {
  const keys = [
    ...Object.values(FOLDER_LABEL_KEYS),
    ...Object.values(SORT_LABEL_KEYS),
    ...Object.values(FILTER_LABEL_KEYS),
  ];
  for (const key of keys) assert.equal(typeof de[key], 'string', key);
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

test('nennt eine Groesse in der Einheit mit den wenigsten Nullen', () => {
  assert.deepEqual(fileSize(0), { value: 0, unit: 'bytes' });
  assert.deepEqual(fileSize(900), { value: 900, unit: 'bytes' });
  assert.deepEqual(fileSize(2048), { value: 2, unit: 'kb' });
  assert.deepEqual(fileSize(1_500_000), { value: 1.4, unit: 'mb' });
  assert.deepEqual(fileSize(-5), { value: 0, unit: 'bytes' });
});

test('sucht in Betreff, Absender und Text', () => {
  const row = message();
  assert.ok(matchesQuery(row, ''));
  assert.ok(matchesQuery(row, 'znacht'));
  assert.ok(matchesQuery(row, 'LEA'));
  assert.ok(matchesQuery(row, 'lea@beispiel'));
  assert.ok(matchesQuery(row, 'Brot'));
  assert.ok(!matchesQuery(row, 'Velo'));
});

test('siebt nach Postfach und Ordner und sortiert, wie gewuenscht', () => {
  const rows = inbox();
  const base = { mailAccountId: null, search: '', filter: 'all', sort: 'newest' } as const;

  const newest = selectMessages(rows, { ...base, role: 'inbox' });
  assert.deepEqual(
    newest.map((row) => row.id),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(
    selectMessages(rows, { ...base, role: 'inbox', sort: 'oldest' }).map((row) => row.id),
    ['c', 'b', 'a'],
  );
  assert.deepEqual(
    selectMessages(rows, { ...base, role: 'inbox', sort: 'sender' }).map((row) => row.id),
    ['b', 'c', 'a'],
  );
  assert.deepEqual(
    selectMessages(rows, { ...base, role: 'inbox', sort: 'subject' }).map((row) => row.id),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(
    selectMessages(rows, { ...base, role: 'junk' }).map((row) => row.id),
    ['d'],
  );
  assert.deepEqual(
    selectMessages(rows, { ...base, role: 'inbox', mailAccountId: 'ma_2' }).map((row) => row.id),
    ['c'],
  );
});

test('filtert nach ungelesen, Fahne und Anhang und findet mit der Suche', () => {
  const rows = inbox();
  const base = { mailAccountId: null, role: 'inbox', search: '', sort: 'newest' } as const;
  assert.deepEqual(
    selectMessages(rows, { ...base, filter: 'unread' }).map((row) => row.id),
    ['a', 'c'],
  );
  assert.deepEqual(
    selectMessages(rows, { ...base, filter: 'flagged' }).map((row) => row.id),
    ['b'],
  );
  assert.deepEqual(
    selectMessages(rows, { ...base, filter: 'attachments' }).map((row) => row.id),
    ['b'],
  );
  assert.deepEqual(
    selectMessages(rows, { ...base, filter: 'all', search: 'bericht' }).map((row) => row.id),
    ['b'],
  );
});

test('zaehlt die ungelesenen je Ordner und Postfach', () => {
  const rows = inbox();
  assert.equal(countUnread(rows), 2);
  assert.equal(countUnread(rows, { mailAccountId: 'ma_2' }), 1);
  assert.equal(countUnread(rows, { role: 'junk' }), 1);
  assert.equal(countUnread(rows, { role: 'trash' }), 0);
});

test('bietet nur Ordner an, die es gibt — den Posteingang immer', () => {
  assert.deepEqual(rolesOf([{ role: 'junk' }, { role: 'trash' }], MAIL_FOLDER_ROLES), [
    'inbox',
    'junk',
    'trash',
  ]);
  assert.deepEqual(rolesOf([], MAIL_FOLDER_ROLES), ['inbox']);
  assert.deepEqual(rolesOf([{ role: 'inbox' }, { role: 'sent' }], MAIL_FOLDER_ROLES), [
    'inbox',
    'sent',
  ]);
});
