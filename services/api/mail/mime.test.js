const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const {
  MAX_SNIPPET,
  MAX_TEXT,
  decodeWords,
  htmlToText,
  parseAddressList,
  parseMessage,
} = require('./mime.js');

const crlf = (lines) => lines.join('\r\n');

describe('RFC 2047', () => {
  test('decodes B and Q words and glues neighbours', () => {
    assert.equal(decodeWords('=?UTF-8?B?R3LDvGV6aQ==?= mitenand'), 'Grüezi mitenand');
    assert.equal(decodeWords('=?iso-8859-1?Q?M=FCller_AG?='), 'Müller AG');
    assert.equal(decodeWords('=?utf-8?Q?Sch=C3=B6?= =?utf-8?Q?ne_Gr=C3=BCsse?='), 'Schöne Grüsse');
    assert.equal(decodeWords('Hallo =?utf-8?q?W=C3=B6rld?= !'), 'Hallo Wörld !');
  });

  test('joins a multibyte character split across two words', () => {
    // "ü" = C3 BC, auf zwei Woerter verteilt
    assert.equal(decodeWords('=?utf-8?Q?Gr=C3?= =?utf-8?Q?=BCezi?='), 'Grüezi');
  });

  test('leaves unknown charsets readable', () => {
    assert.equal(decodeWords('=?x-unknown?Q?abc?='), 'abc');
  });
});

describe('addresses', () => {
  test('parses names, quotes, encoded words and groups', () => {
    const list = parseAddressList(
      '"Müller, Hans" <hans@x.ch>, =?utf-8?Q?J=C3=B6rg?= <joerg@y.ch>, plain@z.ch, ' +
        'Team: a@b.ch, c@d.ch;, old@style.ch (Old Style)',
    );
    assert.deepEqual(list, [
      { name: 'Müller, Hans', address: 'hans@x.ch' },
      { name: 'Jörg', address: 'joerg@y.ch' },
      { name: '', address: 'plain@z.ch' },
      { name: '', address: 'a@b.ch' },
      { name: '', address: 'c@d.ch' },
      { name: 'Old Style', address: 'old@style.ch' },
    ]);
  });

  test('returns an empty list for empty input', () => {
    assert.deepEqual(parseAddressList(''), []);
    assert.deepEqual(parseAddressList('undisclosed-recipients:;'), []);
  });
});

describe('parseMessage', () => {
  test('prefers text/plain in multipart/alternative with quoted-printable', () => {
    const raw = crlf([
      'From: =?utf-8?B?QW5uYSBNw7xsbGVy?= <anna@example.ch>',
      'To: Ben <ben@example.ch>, cara@example.ch',
      'Cc: "Dora D." <dora@example.ch>',
      'Subject: =?utf-8?Q?Einladung_zum_Z=C3=BCgle?=',
      'Date: Tue, 1 Jul 2026 10:52:37 +0200 (CEST)',
      'Message-ID: <abc.123@example.ch>',
      'MIME-Version: 1.0',
      'Content-Type: multipart/alternative; boundary="b1"',
      '',
      'preamble',
      '--b1',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      'Hoi Ben, wir gehen z=C3=BCgle. Das ist eine sehr lange Zeile, die weich umbro=',
      'chen wurde.',
      '--b1',
      'Content-Type: text/html; charset=utf-8',
      '',
      '<p>HTML-Fassung</p>',
      '--b1--',
      '',
    ]);
    const message = parseMessage(Buffer.from(raw));
    assert.deepEqual(message.from, { name: 'Anna Müller', address: 'anna@example.ch' });
    assert.deepEqual(message.to, [
      { name: 'Ben', address: 'ben@example.ch' },
      { name: '', address: 'cara@example.ch' },
    ]);
    assert.deepEqual(message.cc, [{ name: 'Dora D.', address: 'dora@example.ch' }]);
    assert.equal(message.subject, 'Einladung zum Zügle');
    assert.equal(message.date, '2026-07-01T08:52:37.000Z');
    assert.equal(message.messageId, '<abc.123@example.ch>');
    assert.equal(
      message.text,
      'Hoi Ben, wir gehen zügle. Das ist eine sehr lange Zeile, die weich umbrochen wurde.',
    );
    assert.equal(message.snippet, message.text);
  });

  test('turns base64 HTML into text when no plain part exists', () => {
    const html =
      '<html><head><title>x</title><style>p{color:red}</style></head><body>' +
      '<p>Gr&uuml;ezi&nbsp;Welt &amp; Co</p><ul><li>eins</li><li>zwei</li></ul>' +
      '<script>alert(1)</script>Preis: 5 &lt; 6 &#8364;&#x21;<br>Ende</body></html>';
    const raw = crlf([
      'From: shop@example.ch',
      'Subject: HTML',
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(html)
        .toString('base64')
        .replace(/(.{76})/g, '$1\r\n'),
    ]);
    const message = parseMessage(Buffer.from(raw));
    assert.equal(message.text, 'Grüezi Welt & Co\n\n- eins\n- zwei\nPreis: 5 < 6 €!\nEnde');
    assert.ok(!message.text.includes('color'));
    assert.ok(!message.text.includes('alert'));
  });

  test('decodes latin1 bodies and raw 8-bit latin1 headers', () => {
    const head = Buffer.from('Subject: Gr\xfcsse aus Z\xfcrich\r\nFrom: a@b.ch\r\n', 'latin1');
    const body = Buffer.from(
      crlf([
        'Content-Type: text/plain; charset=iso-8859-1',
        'Content-Transfer-Encoding: quoted-printable',
        '',
        'Sch=F6ne Gr=FCsse',
      ]),
    );
    const message = parseMessage(Buffer.concat([head, body]));
    assert.equal(message.subject, 'Grüsse aus Zürich');
    assert.equal(message.text, 'Schöne Grüsse');
  });

  test('handles nested multipart, attachments and a missing closing boundary', () => {
    const raw = crlf([
      'From: a@b.ch',
      'Content-Type: multipart/mixed; boundary=outer',
      '',
      '--outer',
      'Content-Type: multipart/alternative; boundary="inner"',
      '',
      '--inner',
      'Content-Type: text/html',
      '',
      '<b>fett</b>',
      '--inner',
      'Content-Type: text/plain; charset="utf-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      'Der eigentliche Text ✓',
      '--inner--',
      '--outer',
      'Content-Type: text/plain; name="notiz.txt"',
      'Content-Disposition: attachment; filename="notiz.txt"',
      '',
      'Anhang',
      '--outer',
      'Content-Type: application/pdf',
      '',
      'abgeschnitten …',
    ]);
    const message = parseMessage(Buffer.from(raw));
    assert.equal(message.text, 'Der eigentliche Text ✓');
  });

  test('falls back to INTERNALDATE and wraps bare message ids', () => {
    const raw = crlf(['From: a@b.ch', 'Message-ID: bare-id@host', '', 'Text']);
    const message = parseMessage(Buffer.from(raw), { internalDate: '17-Jul-2026 02:44:25 -0700' });
    assert.equal(message.date, '2026-07-17T09:44:25.000Z');
    assert.equal(message.messageId, '<bare-id@host>');
    assert.deepEqual(message.to, []);
  });

  test('cuts long text and snippet', () => {
    const long = 'Wort '.repeat(10_000);
    const message = parseMessage(Buffer.from(`From: a@b.ch\r\n\r\n${long}`));
    assert.equal(message.text.length, MAX_TEXT);
    assert.ok(message.snippet.length <= MAX_SNIPPET);
    assert.ok(message.snippet.length > MAX_SNIPPET - 40);
    assert.ok(message.snippet.startsWith('Wort Wort'));
  });

  test('stays fast on hostile HTML', () => {
    const started = Date.now();
    htmlToText('<a'.repeat(50_000) + '<style'.repeat(20_000) + '&#x'.repeat(20_000));
    parseAddressList('('.repeat(10_000));
    assert.ok(Date.now() - started < 2000);
  });
});
