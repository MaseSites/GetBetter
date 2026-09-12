const assert = require('node:assert/strict');
const { afterEach, beforeEach, describe, test } = require('node:test');

const { createFakeSmtp } = require('../test/fakes.js');
const { parseMessage } = require('./mime.js');
const {
  buildMessage,
  dotStuff,
  encodeQuotedPrintable,
  formatAddress,
  formatDate,
  sendMail,
} = require('./smtp.js');

process.env.BETTER_MAIL_ALLOW_PLAIN = '1';

const headerLines = (raw) => raw.toString('utf8').split('\r\n\r\n')[0].split('\r\n');

describe('building messages', () => {
  test('encodes non-ASCII headers and keeps every line within limits', () => {
    const { raw, messageId } = buildMessage({
      from: { name: 'Anna Müller', address: 'anna@example.ch' },
      to: ['ben@example.ch'],
      cc: ['cara@example.ch'],
      subject: 'Grüsse aus Zürich – ein ziemlich langer Betreff, der gefaltet werden muss',
      text: 'Hoi Ben\nzweite Zeile ',
      inReplyTo: '<parent@example.ch>',
      date: new Date('2026-09-11T08:05:09Z'),
    });
    const lines = headerLines(raw);
    assert.ok(lines.includes('From: =?UTF-8?B?QW5uYSBNw7xsbGVy?= <anna@example.ch>'));
    assert.ok(lines.includes('To: ben@example.ch'));
    assert.ok(lines.includes('Cc: cara@example.ch'));
    assert.ok(lines.includes('Date: Fri, 11 Sep 2026 08:05:09 +0000'));
    assert.ok(lines.includes(`Message-ID: ${messageId}`));
    assert.match(messageId, /^<[0-9a-f-]{36}@example\.ch>$/);
    assert.ok(lines.includes('In-Reply-To: <parent@example.ch>'));
    assert.ok(lines.includes('References: <parent@example.ch>'));
    assert.ok(lines.includes('MIME-Version: 1.0'));
    assert.ok(lines.includes('Content-Type: text/plain; charset=utf-8'));
    assert.ok(
      raw
        .toString('latin1')
        .split('\r\n')
        .every((line) => line.length <= 78),
    );
    assert.ok(/^[\x00-\x7f]*$/.test(raw.toString('latin1')));

    const parsed = parseMessage(raw);
    assert.equal(
      parsed.subject,
      'Grüsse aus Zürich – ein ziemlich langer Betreff, der gefaltet werden muss',
    );
    assert.deepEqual(parsed.from, { name: 'Anna Müller', address: 'anna@example.ch' });
    assert.equal(parsed.text, 'Hoi Ben\nzweite Zeile');
  });

  test('blocks header injection through subject and name', () => {
    const { raw } = buildMessage({
      from: { name: 'Eve\r\nBcc: evil@example.ch', address: 'eve@example.ch' },
      to: ['ben@example.ch'],
      subject: 'Hallo\r\nBcc: evil@example.ch',
      text: 'x',
    });
    const lines = headerLines(raw);
    assert.ok(!lines.some((line) => /^bcc:/i.test(line)));
    assert.ok(lines.includes('Subject: Hallo Bcc: evil@example.ch'));
    assert.throws(
      () =>
        buildMessage({
          from: { name: '', address: 'a@b.ch' },
          to: ['x@y.ch\r\nRCPT TO:<z@z.ch>'],
          subject: '',
          text: '',
        }),
      {
        code: 'bad_request',
      },
    );
  });

  test('ignores a malformed parent id', () => {
    const { raw } = buildMessage({
      from: { name: '', address: 'a@b.ch' },
      to: ['c@d.ch'],
      subject: 'Re',
      text: '',
      inReplyTo: '<bad>\r\nX-Evil: 1',
    });
    assert.ok(!headerLines(raw).some((line) => /^(In-Reply-To|X-Evil)/.test(line)));
  });

  test('formats addresses, dates and quoted-printable', () => {
    assert.equal(formatAddress('Muster, Hans', 'h@x.ch'), '"Muster, Hans" <h@x.ch>');
    assert.equal(formatAddress('', 'h@x.ch'), 'h@x.ch');
    assert.equal(formatDate(new Date('2026-01-02T03:04:05Z')), 'Fri, 2 Jan 2026 03:04:05 +0000');
    assert.equal(encodeQuotedPrintable('Grüezi = gut \t'), 'Gr=C3=BCezi =3D gut =09');
    const long = encodeQuotedPrintable('a'.repeat(200));
    assert.ok(long.split('\r\n').every((line) => line.length <= 76));
  });

  test('dot-stuffs lines that start with a dot', () => {
    const stuffed = dotStuff(Buffer.from('.erste\r\nmitte\r\n..zwei\r\n.\r\nende'));
    assert.equal(stuffed.toString(), '..erste\r\nmitte\r\n...zwei\r\n..\r\nende\r\n.\r\n');
  });
});

describe('sending against a fake SMTP server', () => {
  let fake;
  let port;

  beforeEach(async () => {
    fake = createFakeSmtp();
    port = await fake.listen();
  });

  afterEach(async () => {
    await fake.close();
  });

  const send = (overrides = {}) => {
    const { raw } = buildMessage({
      from: { name: 'Nutzer', address: 'user@example.ch' },
      to: ['ben@example.ch'],
      cc: ['cara@example.ch'],
      subject: 'Punkte',
      text: '.versteckt\nnormal\n..doppelt\n.',
    });
    return sendMail({
      host: '127.0.0.1',
      port,
      secure: false,
      username: 'user@example.ch',
      password: 'secret',
      from: 'user@example.ch',
      recipients: ['ben@example.ch', 'cara@example.ch', 'BEN@example.ch'.toLowerCase()],
      raw,
      timeoutMs: 2000,
      ...overrides,
    }).then(() => raw);
  };

  test('delivers with AUTH PLAIN and dot-stuffing', async () => {
    const raw = await send();
    assert.equal(fake.state.messages.length, 1);
    const [delivered] = fake.state.messages;
    assert.equal(delivered.from, 'user@example.ch');
    assert.deepEqual(delivered.recipients, ['ben@example.ch', 'cara@example.ch']);
    assert.ok(delivered.stuffed.includes('\r\n..versteckt\r\n'));
    assert.ok(delivered.stuffed.includes('\r\n...doppelt\r\n'));
    assert.ok(delivered.stuffed.endsWith('\r\n..'));
    assert.equal(`${delivered.message}\r\n`, raw.toString('latin1'));
    assert.equal(
      parseMessage(Buffer.from(delivered.message)).text,
      '.versteckt\nnormal\n..doppelt\n.',
    );
    assert.ok(fake.state.lines.some((line) => line.startsWith('AUTH PLAIN ')));
    assert.ok(fake.state.lines.some((line) => /^EHLO \[127\.0\.0\.1\]$/.test(line)));
  });

  test('falls back to AUTH LOGIN', async () => {
    await fake.close();
    fake = createFakeSmtp({ auth: ['LOGIN'] });
    port = await fake.listen();
    await send();
    assert.ok(fake.state.lines.includes('AUTH LOGIN'));
    assert.equal(fake.state.messages.length, 1);
  });

  test('maps wrong credentials to auth_failed', async () => {
    await assert.rejects(send({ password: 'falsch' }), { code: 'auth_failed' });
    assert.equal(fake.state.messages.length, 0);
  });

  test('maps a rejected recipient to send_failed', async () => {
    await fake.close();
    fake = createFakeSmtp({ rejectRecipients: ['cara@example.ch'] });
    port = await fake.listen();
    await assert.rejects(send(), { code: 'send_failed' });
    assert.equal(fake.state.messages.length, 0);
  });

  test('requires STARTTLS unless plain is allowed', async () => {
    process.env.BETTER_MAIL_ALLOW_PLAIN = '0';
    try {
      await assert.rejects(send(), { code: 'tls_failed' });
    } finally {
      process.env.BETTER_MAIL_ALLOW_PLAIN = '1';
    }
  });
});
