const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const net = require('node:net');
const { afterEach, beforeEach, describe, test } = require('node:test');

const { createFakeImap } = require('../test/fakes.js');
const {
  ImapConnection,
  astring,
  connectImap,
  decodeMailboxName,
  findSent,
  findTrash,
  parseValues,
  sequenceSet,
  withImap,
} = require('./imap.js');

process.env.BETTER_MAIL_ALLOW_PLAIN = '1';

const MESSAGE_ONE = 'Subject: Eins\r\n\r\nHallo (mit Klammer)\r\n* 99 FETCH (FLAGS ())\r\n';
const MESSAGE_TWO = 'Subject: Zwei\r\n\r\n{12}\r\nkein Literal\r\n';

describe('protocol helpers', () => {
  test('quotes strings and falls back to literals for non-ASCII', () => {
    assert.equal(astring('pa"ss\\w'), '"pa\\"ss\\\\w"');
    assert.ok(Buffer.isBuffer(astring('Passwört')));
    assert.ok(Buffer.isBuffer(astring('zeile\r\numbruch')));
  });

  test('builds compact sequence sets', () => {
    assert.equal(sequenceSet([7, 1, 2, 3, 3, 9, 10]), '1:3,7,9:10');
    assert.equal(sequenceSet([]), '');
  });

  test('parses lists, strings, NIL, literals and bracketed atoms', () => {
    const values = parseValues([
      '12 FETCH (UID 5 FLAGS (\\Seen) INTERNALDATE "01-Jan-2026 10:00:00 +0000" X NIL BODY[]<0> ',
      Buffer.from('roh'),
      ')',
    ]);
    assert.deepEqual(values, [
      '12',
      'FETCH',
      [
        'UID',
        '5',
        'FLAGS',
        ['\\Seen'],
        'INTERNALDATE',
        '01-Jan-2026 10:00:00 +0000',
        'X',
        null,
        'BODY[]<0>',
        Buffer.from('roh'),
      ],
    ]);
  });

  test('decodes modified UTF-7 and finds special folders', () => {
    assert.equal(decodeMailboxName('Gel&APY-scht'), 'Gelöscht');
    assert.equal(decodeMailboxName('A&-B'), 'A&B');
    const folders = [
      { name: 'INBOX', delimiter: '.', flags: [] },
      { name: 'INBOX.Gel&APY-scht', delimiter: '.', flags: [] },
      { name: 'INBOX.Gesendet', delimiter: '.', flags: [] },
    ];
    assert.equal(findTrash(folders), 'INBOX.Gel&APY-scht');
    assert.equal(findSent(folders), 'INBOX.Gesendet');
    const special = [
      { name: 'Trash', delimiter: '/', flags: ['\\Noselect'] },
      { name: '[Gmail]/Papierkorb', delimiter: '/', flags: ['\\HasNoChildren', '\\Trash'] },
    ];
    assert.equal(findTrash(special), '[Gmail]/Papierkorb');
    assert.equal(findSent(special), null);
  });
});

describe('against a fake IMAP server', () => {
  let fake;
  let port;

  beforeEach(async () => {
    fake = createFakeImap({ password: 'pa"ss\\wört' });
    port = await fake.listen();
  });

  afterEach(async () => {
    await fake.close();
  });

  const options = (overrides = {}) => ({
    host: '127.0.0.1',
    port,
    secure: false,
    username: 'user@example.ch',
    password: 'pa"ss\\wört',
    timeoutMs: 2000,
    ...overrides,
  });

  test('logs in with a literal password, selects, searches and fetches bodies', async () => {
    fake.addMessage('INBOX', MESSAGE_ONE, { flags: ['\\Seen'] });
    fake.addMessage('INBOX', MESSAGE_TWO);

    const result = await withImap(options(), async (client) => {
      assert.ok(client.capabilities.has('UIDPLUS'));
      const box = await client.select('INBOX');
      assert.deepEqual(box, { exists: 2, uidValidity: 42, uidNext: 3 });
      const uids = await client.uidSearch('UID 2:*');
      const fetched = await client.fetch('1:2', '(UID FLAGS INTERNALDATE BODY.PEEK[]<0.200000>)');
      const flags = await client.fetch('1:2', '(UID FLAGS)', { uid: true });
      return { uids, fetched, flags };
    });

    // Das Passwort enthaelt ein ö und geht deshalb als Literal hinaus.
    assert.ok(fake.state.lines.some((line) => /^B\d+ LOGIN "user@example.ch" \{\d+\}$/.test(line)));
    assert.equal(fake.state.logins, 1);
    assert.deepEqual(result.uids, [2]);
    assert.equal(result.fetched.length, 2);
    assert.equal(result.fetched[0].uid, 1);
    assert.deepEqual(result.fetched[0].flags, ['\\Seen']);
    assert.equal(result.fetched[0].body.toString(), MESSAGE_ONE);
    assert.equal(result.fetched[1].body.toString(), MESSAGE_TWO);
    assert.match(result.fetched[1].internalDate, /^\d{2}-[A-Z][a-z]{2}-\d{4} /);
    assert.deepEqual(
      result.flags.map((entry) => [entry.uid, entry.flags]),
      [
        [1, ['\\Seen']],
        [2, []],
      ],
    );
    assert.ok(fake.state.lines.some((line) => /^B\d+ LOGOUT$/.test(line)));
  });

  test('quotes an ASCII password with escapes', async () => {
    await fake.close();
    fake = createFakeImap({ password: 'pa"ss\\w' });
    port = await fake.listen();
    const client = await connectImap(options({ password: 'pa"ss\\w' }));
    await client.logout();
    assert.ok(
      fake.state.lines.some((line) => line.endsWith('LOGIN "user@example.ch" "pa\\"ss\\\\w"')),
    );
  });

  test('stores flags, moves to trash via COPY and UID EXPUNGE, appends to sent', async () => {
    fake.addMessage('INBOX', MESSAGE_ONE);
    fake.addMessage('INBOX', MESSAGE_TWO);

    await withImap(options(), async (client) => {
      await client.select('INBOX');
      await client.uidStore('2', '+FLAGS.SILENT', ['\\Seen']);
      const folders = await client.list();
      assert.equal(findTrash(folders), 'Trash');
      assert.equal(findSent(folders), 'Sent');
      await client.uidMove('1', 'Trash');
      await client.append('Sent', ['\\Seen'], Buffer.from('Subject: Gesendet\r\n\r\nText\r\n'));
    });

    assert.deepEqual(
      fake.state.boxes.INBOX.map((m) => [m.uid, m.flags]),
      [[2, ['\\Seen']]],
    );
    assert.equal(fake.state.boxes.Trash.length, 1);
    assert.equal(fake.state.boxes.Trash[0].body.toString(), MESSAGE_ONE);
    assert.equal(fake.state.boxes.Sent[0].body.toString(), 'Subject: Gesendet\r\n\r\nText\r\n');
    assert.ok(fake.state.lines.some((line) => /UID COPY 1 "Trash"$/.test(line)));
    assert.ok(fake.state.lines.some((line) => /UID EXPUNGE 1$/.test(line)));
  });

  test('uses UID MOVE when the server can', async () => {
    await fake.close();
    fake = createFakeImap({ password: 'x', capabilities: ['IMAP4rev1', 'MOVE'] });
    port = await fake.listen();
    fake.addMessage('INBOX', MESSAGE_ONE);
    await withImap(options({ password: 'x' }), async (client) => {
      await client.select('INBOX');
      await client.uidMove('1', 'Trash');
    });
    assert.ok(fake.state.lines.some((line) => /UID MOVE 1 "Trash"$/.test(line)));
    assert.equal(fake.state.boxes.INBOX.length, 0);
  });

  test('maps a rejected login to auth_failed', async () => {
    await assert.rejects(connectImap(options({ password: 'falsch' })), { code: 'auth_failed' });
  });

  test('requires STARTTLS when plain connections are not allowed', async () => {
    process.env.BETTER_MAIL_ALLOW_PLAIN = '0';
    try {
      await assert.rejects(connectImap(options()), { code: 'tls_failed' });
    } finally {
      process.env.BETTER_MAIL_ALLOW_PLAIN = '1';
    }
  });
});

describe('reading hostile responses', () => {
  const fakeSocket = () => {
    const socket = new EventEmitter();
    socket.written = [];
    socket.write = (data) => socket.written.push(String(data));
    socket.destroy = () => socket.emit('close');
    return socket;
  };
  const tick = () => new Promise((resolve) => setImmediate(resolve));

  test('stays linear when a large literal arrives byte by byte', async () => {
    const socket = fakeSocket();
    const client = new ImapConnection(socket, { timeoutMs: 5000 });
    const greeting = client.greeting();
    client.receive(Buffer.from('* OK ready\r\n'));
    await greeting;

    const body = Buffer.alloc(300_000, 'a');
    const fetching = client.fetch('1', '(UID BODY.PEEK[]<0.200000>)');
    await tick();
    const response = Buffer.concat([
      Buffer.from(`* 1 FETCH (UID 7 BODY[]<0> {${body.length}}\r\n`),
      body,
      Buffer.from(')\r\nB1 OK done\r\n'),
    ]);
    const started = Date.now();
    for (let i = 0; i < response.length; i += 1) client.receive(response.subarray(i, i + 1));
    const [entry] = await fetching;
    assert.ok(Date.now() - started < 3000, `took ${Date.now() - started} ms`);
    assert.equal(entry.uid, 7);
    assert.equal(entry.body.length, body.length);
  });

  test('drops the connection on an oversized literal', async () => {
    const socket = fakeSocket();
    const client = new ImapConnection(socket, { timeoutMs: 5000 });
    const greeting = client.greeting();
    client.receive(Buffer.from('* OK ready\r\n'));
    await greeting;
    const fetching = client.fetch('1', '(BODY.PEEK[]<0.200000>)');
    await tick();
    client.receive(Buffer.from('* 1 FETCH (BODY[]<0> {999999999}\r\n'));
    await assert.rejects(fetching, { code: 'protocol' });
  });
});

describe('connection failures', () => {
  test('times out when the server never greets', async () => {
    const silent = createFakeImap({ greet: false });
    const port = await silent.listen();
    try {
      await assert.rejects(
        connectImap({
          host: '127.0.0.1',
          port,
          secure: false,
          username: 'u',
          password: 'p',
          timeoutMs: 200,
        }),
        { code: 'timeout' },
      );
    } finally {
      await silent.close();
    }
  });

  test('reports a closed port as unreachable', async () => {
    const blocker = net.createServer();
    const port = await new Promise((resolve) =>
      blocker.listen(0, '127.0.0.1', () => resolve(blocker.address().port)),
    );
    await new Promise((resolve) => blocker.close(resolve));
    await assert.rejects(
      connectImap({
        host: '127.0.0.1',
        port,
        secure: false,
        username: 'u',
        password: 'p',
        timeoutMs: 2000,
      }),
      { code: 'unreachable' },
    );
  });

  test('reports a TLS handshake against a plain server as tls_failed', async () => {
    const plain = createFakeImap();
    const port = await plain.listen();
    try {
      await assert.rejects(
        connectImap({
          host: '127.0.0.1',
          port,
          secure: true,
          username: 'u',
          password: 'p',
          timeoutMs: 2000,
        }),
        { code: 'tls_failed' },
      );
    } finally {
      await plain.close();
    }
  });
});
