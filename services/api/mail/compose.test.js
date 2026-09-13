const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { forwardSubject, forwardText, referencesFor } = require('./compose.js');
const { parseMessage } = require('./mime.js');
const { buildMessage } = require('./smtp.js');

const original = {
  messageId: '<orig@example.ch>',
  references: ['<root@example.ch>', '<mid@example.ch>'],
  from: { name: 'Anna Muster', address: 'anna@example.ch' },
  to: [{ name: '', address: 'user@example.ch' }],
  cc: [{ name: 'Ben', address: 'ben@example.ch' }],
  subject: 'Offerte Maler',
  date: '2026-09-10T07:00:00.000Z',
  text: 'Hallo\n\nDie Offerte kommt.',
};

describe('compose helpers', () => {
  test('extends the parent references with its own id', () => {
    assert.deepEqual(referencesFor(original), [
      '<root@example.ch>',
      '<mid@example.ch>',
      '<orig@example.ch>',
    ]);
    assert.deepEqual(referencesFor({ messageId: '<x@y>' }), ['<x@y>']);
    assert.deepEqual(referencesFor({ messageId: null, references: undefined }), []);
  });

  test('builds a reply whose References carry the whole chain', () => {
    const { raw } = buildMessage({
      from: { name: '', address: 'user@example.ch' },
      to: ['anna@example.ch'],
      subject: 'Re: Offerte Maler',
      text: 'Danke',
      inReplyTo: original.messageId,
      references: referencesFor(original),
    });
    const parsed = parseMessage(raw);
    assert.equal(parsed.inReplyTo, '<orig@example.ch>');
    assert.deepEqual(parsed.references, referencesFor(original));
  });

  test('keeps Bcc for drafts and sent copies only', () => {
    const base = {
      from: { name: '', address: 'user@example.ch' },
      to: [],
      bcc: ['geheim@example.ch'],
      subject: 'Entwurf',
      text: 'x',
    };
    const wire = buildMessage(base);
    const copy = buildMessage({ ...base, includeBcc: true, messageId: wire.messageId });
    assert.doesNotMatch(wire.raw.toString(), /^(Bcc|To):/m);
    assert.deepEqual(parseMessage(copy.raw).bcc, [{ name: '', address: 'geheim@example.ch' }]);
    assert.equal(copy.messageId, wire.messageId);
  });

  test('prefixes a forward subject once', () => {
    assert.equal(forwardSubject('Offerte Maler'), 'Fwd: Offerte Maler');
    assert.equal(forwardSubject('WG: Offerte Maler'), 'WG: Offerte Maler');
    assert.equal(forwardSubject(''), 'Fwd:');
  });

  test('quotes the original text below a header', () => {
    assert.equal(
      forwardText('Schau mal  \n', original),
      [
        'Schau mal',
        '',
        '---------- Forwarded message ----------',
        'From: Anna Muster <anna@example.ch>',
        'Date: Thu, 10 Sep 2026 07:00:00 +0000',
        'Subject: Offerte Maler',
        'To: user@example.ch',
        'Cc: Ben <ben@example.ch>',
        '',
        '> Hallo',
        '>',
        '> Die Offerte kommt.',
        '',
      ].join('\n'),
    );
    assert.ok(forwardText('', original).startsWith('---------- Forwarded message'));
  });
});
