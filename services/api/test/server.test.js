/**
 * Startet server.js als eigenen Prozess — mit Datenordner im Temp-Verzeichnis,
 * ohne Abgleich-Takt und mit nachgebauten Mail-Servern — und prueft die
 * Schnittstellen von aussen. services/api/data bleibt unberuehrt.
 */
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { after, before, describe, test } = require('node:test');

const { createFakeImap, createFakeSmtp } = require('./fakes.js');

const SERVER = path.join(__dirname, '..', 'server.js');
const MAIL_PASSWORD = 'Mail-Passwort-ÄÖÜ';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const MAIL_ACCOUNT_KEYS = [
  'accountId',
  'connectedAt',
  'displayName',
  'email',
  'id',
  'imapHost',
  'imapPort',
  'imapSecure',
  'lastError',
  'lastSyncAt',
  'provider',
  'smtpHost',
  'smtpPort',
  'smtpSecure',
  'username',
];
const MAIL_MESSAGE_KEYS = [
  'accountId',
  'arrivedAfterConnect',
  'cc',
  'date',
  'folder',
  'from',
  'id',
  'mailAccountId',
  'messageId',
  'seen',
  'snippet',
  'subject',
  'text',
  'to',
  'uid',
];
const NOTIFICATION_KEYS = [
  'accountId',
  'app',
  'body',
  'createdAt',
  'id',
  'kind',
  'readAt',
  'ref',
  'title',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
  });
}

async function freePort() {
  for (let port = 18090 + (process.pid % 700); port < 19900; port += 1) {
    if (await isFree(port)) return port;
  }
  throw new Error('kein freier Port');
}

async function waitFor(check, timeoutMs = 5000) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > until) throw new Error('Zeitlimit beim Warten');
    await sleep(50);
  }
}

const mailRaw = ({ from, subject, text, id }) =>
  [
    `From: ${from}`,
    'To: user@example.ch',
    `Subject: ${subject}`,
    `Message-ID: <${id}@example.ch>`,
    'Date: Thu, 10 Sep 2026 09:00:00 +0200',
    '',
    text,
    '',
  ].join('\r\n');

describe('service endpoints', () => {
  let child;
  let base;
  let dataDir;
  let imap;
  let smtp;
  let imapPort;
  let smtpPort;
  let accountA;
  let accountB;

  const call = async (method, route, body) => {
    const response = await fetch(`${base}${route}`, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
    const type = response.headers.get('content-type') ?? '';
    const data = type.includes('json')
      ? await response.json()
      : Buffer.from(await response.arrayBuffer());
    return { status: response.status, data, headers: response.headers };
  };
  const tables = async () => (await call('GET', '/v1/db')).data.tables;

  before(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'better-api-'));
    imap = createFakeImap({ username: 'user@example.ch', password: MAIL_PASSWORD });
    smtp = createFakeSmtp({ username: 'user@example.ch', password: MAIL_PASSWORD });
    imapPort = await imap.listen();
    smtpPort = await smtp.listen();

    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, [SERVER], {
      env: {
        ...process.env,
        PORT: String(port),
        BETTER_DATA_DIR: dataDir,
        BETTER_MAIL_SYNC_MS: '0',
        BETTER_MAIL_ALLOW_PLAIN: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.resume();
    child.stderr.resume();
    await waitFor(async () => {
      try {
        return (await fetch(`${base}/v1/health`)).ok;
      } catch {
        return false;
      }
    });

    accountA = (
      await call('POST', '/v1/accounts', { email: 'anna@test.ch', password: 'passwort123' })
    ).data.account;
    accountB = (
      await call('POST', '/v1/accounts', { email: 'ben@test.ch', password: 'passwort123' })
    ).data.account;
  });

  after(async () => {
    child?.kill();
    await imap?.close();
    await smtp?.close();
    await sleep(200);
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  test('allows DELETE in CORS and refuses PUT on server-owned collections', async () => {
    const options = await fetch(`${base}/v1/db`, { method: 'OPTIONS' });
    assert.match(options.headers.get('access-control-allow-methods') ?? '', /DELETE/);

    for (const name of ['notifications', 'mailAccounts', 'mailMessages']) {
      const result = await call('PUT', `/v1/db/${name}`, { rows: [] });
      assert.equal(result.status, 403, name);
      assert.deepEqual(result.data, { error: 'server_owned' });
    }
    const tasks = await call('PUT', '/v1/db/tasks', { rows: [{ id: 't1', title: 'x' }] });
    assert.equal(tasks.status, 200);
    assert.deepEqual((await tables()).tasks, [{ id: 't1', title: 'x' }]);
  });

  test('stores assistantName and backdrop on the profile', async () => {
    const patched = await call('PATCH', `/v1/accounts/${accountA.id}`, {
      assistantName: 'Luma',
      backdrop: 'upload:upl_0123',
      firstName: 'Anna',
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.data.account.assistantName, 'Luma');
    assert.equal(patched.data.account.backdrop, 'upload:upl_0123');
    assert.equal(patched.data.account.passwordHash, undefined);

    const read = await call('GET', `/v1/accounts/${accountA.id}`);
    assert.equal(read.data.account.firstName, 'Anna');
    assert.equal(read.data.account.assistantName, 'Luma');

    assert.equal(
      (await call('PATCH', `/v1/accounts/${accountA.id}`, { assistantName: 5 })).status,
      400,
    );
    assert.equal((await call('PATCH', '/v1/accounts/acc_fehlt', { firstName: 'x' })).status, 404);
  });

  test('creates, reads, removes notifications', async () => {
    const before = (await call('GET', '/v1/revision')).data.revision;
    const created = await call('POST', '/v1/notifications', {
      accountId: accountA.id,
      kind: 'calendarShare',
      title: 'Ben',
      body: 'Familie',
      ref: { shareId: 's1' },
      app: 'getbetter',
    });
    assert.equal(created.status, 201);
    const { notification } = created.data;
    assert.deepEqual(Object.keys(notification).sort(), NOTIFICATION_KEYS);
    assert.equal(notification.readAt, null);
    assert.ok((await call('GET', '/v1/revision')).data.revision > before);

    const invalid = [
      { accountId: accountA.id, kind: 'spam', title: 'x', body: '', ref: {}, app: 'getbetter' },
      {
        accountId: accountA.id,
        kind: 'system',
        title: 'x',
        body: '',
        ref: { n: 1 },
        app: 'getbetter',
      },
      { accountId: accountA.id, kind: 'system', title: 'x', body: '', ref: {}, app: '' },
    ];
    for (const body of invalid)
      assert.equal((await call('POST', '/v1/notifications', body)).status, 400);
    const unknown = await call('POST', '/v1/notifications', {
      ...invalid[0],
      kind: 'system',
      accountId: 'acc_x',
    });
    assert.equal(unknown.status, 404);

    const read = await call('POST', `/v1/notifications/${notification.id}/read`);
    assert.equal(read.status, 200);
    assert.ok(read.data.notification.readAt);

    const make = (accountId, value) =>
      call('POST', '/v1/notifications', {
        accountId,
        kind: 'householdInvite',
        title: 'Haus',
        body: '',
        ref: { membershipId: value },
        app: 'betterfamily',
      });
    await make(accountA.id, 'm1');
    await make(accountB.id, 'm1');
    await make(accountB.id, 'm2');
    const onlyB = await call('POST', '/v1/notifications/remove-by-ref', {
      accountId: accountB.id,
      kind: 'householdInvite',
      key: 'membershipId',
      value: 'm1',
    });
    assert.deepEqual(onlyB.data, { removed: 1 });
    const everyone = await call('POST', '/v1/notifications/remove-by-ref', {
      kind: 'householdInvite',
      key: 'membershipId',
      value: 'm1',
    });
    assert.deepEqual(everyone.data, { removed: 1 });
    assert.equal(
      (await call('POST', '/v1/notifications/remove-by-ref', { kind: 'x', key: 'a', value: 'b' }))
        .status,
      400,
    );

    assert.deepEqual((await call('DELETE', `/v1/notifications/${notification.id}`)).data, {
      ok: true,
    });
    assert.equal((await call('DELETE', `/v1/notifications/${notification.id}`)).status, 404);
    const left = (await tables()).notifications;
    assert.deepEqual(
      left.map((row) => [row.accountId, row.ref.membershipId]),
      [[accountB.id, 'm2']],
    );
  });

  test('uploads, serves and deletes images', async () => {
    const dataUrl = `data:image/png;base64,${PNG.toString('base64')}`;
    const created = await call('POST', '/v1/uploads', { accountId: accountA.id, dataUrl });
    assert.equal(created.status, 201);
    assert.match(created.data.id, /^upl_[a-f0-9]{24}$/);
    assert.equal(created.data.url, `/v1/uploads/${created.data.id}`);
    await fs.access(path.join(dataDir, 'uploads', `${created.data.id}.png`));

    const served = await call('GET', created.data.url);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get('content-type'), 'image/png');
    assert.equal(served.headers.get('access-control-allow-origin'), '*');
    assert.match(served.headers.get('cache-control') ?? '', /max-age/);
    assert.deepEqual(served.data, PNG);

    const gif = await call('POST', '/v1/uploads', {
      accountId: accountA.id,
      dataUrl: 'data:image/gif;base64,R0lGODlh',
    });
    assert.deepEqual([gif.status, gif.data.error], [400, 'unsupported_type']);
    const disguised = await call('POST', '/v1/uploads', {
      accountId: accountA.id,
      dataUrl: `data:image/jpeg;base64,${PNG.toString('base64')}`,
    });
    assert.equal(disguised.data.error, 'unsupported_type');
    const huge = Buffer.concat([PNG.subarray(0, 8), Buffer.alloc(5 * 1024 * 1024)]);
    const tooLarge = await call('POST', '/v1/uploads', {
      accountId: accountA.id,
      dataUrl: `data:image/png;base64,${huge.toString('base64')}`,
    });
    assert.deepEqual([tooLarge.status, tooLarge.data.error], [413, 'too_large']);
    assert.equal((await call('POST', '/v1/uploads', { dataUrl })).status, 400);
    assert.equal((await call('GET', '/v1/uploads/..%2F..%2Fdb.json')).status, 404);

    assert.deepEqual((await call('DELETE', created.data.url)).data, { ok: true });
    assert.equal((await call('GET', created.data.url)).status, 404);
  });

  describe('mail', () => {
    let mailAccount;
    const imapSettings = () => ({
      imapHost: '127.0.0.1',
      imapPort,
      imapSecure: false,
      smtpHost: '127.0.0.1',
      smtpPort,
      smtpSecure: false,
    });

    test('suggests provider settings', async () => {
      const gmx = await call('GET', '/v1/mail/providers?email=hans%40gmx.ch');
      assert.equal(gmx.status, 200);
      assert.equal(gmx.data.provider, 'gmx');
      assert.equal(gmx.data.note, 'enable_imap');
      assert.equal((await call('GET', '/v1/mail/providers?email=kaputt')).status, 400);
    });

    test('rejects Outlook, wrong passwords and bad input', async () => {
      const outlook = await call('POST', '/v1/mail/accounts', {
        accountId: accountA.id,
        email: 'a@hotmail.com',
        password: 'x',
      });
      assert.deepEqual(outlook.data, { error: 'oauth_required' });

      const wrong = await call('POST', '/v1/mail/accounts', {
        accountId: accountA.id,
        email: 'user@gmail.com',
        username: 'user@example.ch',
        password: 'falsch',
        ...imapSettings(),
      });
      assert.deepEqual(
        [wrong.status, wrong.data],
        [400, { error: 'auth_failed', note: 'app_password' }],
      );

      const badPort = await call('POST', '/v1/mail/accounts', {
        accountId: accountA.id,
        email: 'user@example.ch',
        password: MAIL_PASSWORD,
        ...imapSettings(),
        imapPort: 70000,
      });
      assert.deepEqual(badPort.data, { error: 'bad_request' });
      const badHost = await call('POST', '/v1/mail/accounts', {
        accountId: accountA.id,
        email: 'user@example.ch',
        password: MAIL_PASSWORD,
        ...imapSettings(),
        imapHost: 'mail server.ch',
      });
      assert.deepEqual(badHost.data, { error: 'bad_request' });
    });

    test('connects, runs the first sync without notifications and keeps the password secret', async () => {
      imap.addMessage(
        'INBOX',
        mailRaw({ from: 'Alt <alt@example.ch>', subject: 'Alt eins', text: 'eins', id: 'a1' }),
        {
          flags: ['\\Seen'],
        },
      );
      imap.addMessage(
        'INBOX',
        mailRaw({ from: 'Alt <alt@example.ch>', subject: 'Alt zwei', text: 'zwei', id: 'a2' }),
      );

      const created = await call('POST', '/v1/mail/accounts', {
        accountId: accountA.id,
        email: 'User@Example.ch',
        displayName: 'Anna',
        password: MAIL_PASSWORD,
        ...imapSettings(),
      });
      assert.equal(created.status, 201);
      mailAccount = created.data.mailAccount;
      assert.deepEqual(Object.keys(mailAccount).sort(), MAIL_ACCOUNT_KEYS);
      assert.equal(mailAccount.email, 'user@example.ch');
      assert.equal(mailAccount.provider, 'custom');
      assert.equal(mailAccount.username, 'user@example.ch');

      const duplicate = await call('POST', '/v1/mail/accounts', {
        accountId: accountA.id,
        email: 'user@example.ch',
        password: MAIL_PASSWORD,
        ...imapSettings(),
      });
      assert.deepEqual(duplicate.data, { error: 'already_connected' });

      const synced = await waitFor(async () => {
        const current = await tables();
        return current.mailMessages.length === 2 && current.mailAccounts[0].lastSyncAt
          ? current
          : null;
      });
      for (const row of synced.mailMessages) {
        assert.deepEqual(Object.keys(row).sort(), MAIL_MESSAGE_KEYS);
        assert.equal(row.arrivedAfterConnect, false);
        assert.equal(row.accountId, accountA.id);
      }
      const first = synced.mailMessages.find((row) => row.uid === 1);
      assert.equal(first.subject, 'Alt eins');
      assert.equal(first.seen, true);
      assert.deepEqual(first.from, { name: 'Alt', address: 'alt@example.ch' });
      assert.equal(synced.notifications.filter((row) => row.kind === 'mail').length, 0);

      const files = await Promise.all(
        ['db.json', 'mail-vault.json', 'mail-state.json'].map((name) =>
          fs.readFile(path.join(dataDir, name), 'utf8'),
        ),
      );
      for (const content of files) assert.ok(!content.includes(MAIL_PASSWORD));
      assert.ok(!JSON.stringify(synced).includes(MAIL_PASSWORD));
      assert.equal((await fs.readFile(path.join(dataDir, 'mail.key'))).length, 32);
    });

    test('announces new mail, refreshes flags and drops deleted mail', async () => {
      imap.addMessage(
        'INBOX',
        mailRaw({
          from: '"Cara Neu" <cara@example.ch>',
          subject: 'Neu da',
          text: 'Hallo',
          id: 'n1',
        }),
      );
      imap.state.boxes.INBOX = imap.state.boxes.INBOX.filter((m) => m.uid !== 1).map((m) =>
        m.uid === 2 ? { ...m, flags: ['\\Seen'] } : m,
      );

      const result = await call('POST', '/v1/mail/sync', { accountId: accountA.id });
      assert.deepEqual(result.data, { newMessages: 1, errors: [] });

      const current = await tables();
      assert.deepEqual(current.mailMessages.map((row) => row.uid).sort(), [2, 3]);
      assert.equal(current.mailMessages.find((row) => row.uid === 2).seen, true);
      const fresh = current.mailMessages.find((row) => row.uid === 3);
      assert.equal(fresh.arrivedAfterConnect, true);
      assert.equal(fresh.messageId, '<n1@example.ch>');
      const [notification] = current.notifications.filter((row) => row.kind === 'mail');
      assert.deepEqual(
        {
          title: notification.title,
          body: notification.body,
          ref: notification.ref,
          app: notification.app,
        },
        {
          title: 'Cara Neu',
          body: 'Neu da',
          ref: { mailMessageId: fresh.id, mailAccountId: mailAccount.id },
          app: 'getbetter',
        },
      );
      assert.equal(notification.accountId, accountA.id);
      assert.equal(notification.readAt, null);
    });

    test('marks mail as seen on the server and reads its notification', async () => {
      const fresh = (await tables()).mailMessages.find((row) => row.uid === 3);
      assert.deepEqual(
        (await call('POST', `/v1/mail/messages/${fresh.id}/seen`, { seen: true })).data,
        { ok: true },
      );
      assert.ok(imap.state.boxes.INBOX.find((m) => m.uid === 3).flags.includes('\\Seen'));
      const current = await tables();
      assert.equal(current.mailMessages.find((row) => row.id === fresh.id).seen, true);
      assert.ok(current.notifications.find((row) => row.ref.mailMessageId === fresh.id).readAt);
      assert.equal((await call('POST', `/v1/mail/messages/${fresh.id}/seen`, {})).status, 400);
      assert.equal(
        (await call('POST', '/v1/mail/messages/mm_fehlt/seen', { seen: true })).status,
        404,
      );
    });

    test('sends replies and files a copy in Sent', async () => {
      const parent = (await tables()).mailMessages.find((row) => row.uid === 3);
      const sent = await call('POST', '/v1/mail/send', {
        mailAccountId: mailAccount.id,
        to: ['Cara <cara@example.ch>'],
        cc: [],
        subject: 'Re: Neu da',
        text: 'Danke!\n.punkt',
        inReplyTo: parent.id,
      });
      assert.deepEqual(sent.data, { ok: true });
      const [delivered] = smtp.state.messages;
      assert.deepEqual(delivered.recipients, ['cara@example.ch']);
      assert.match(delivered.message, /\r\nIn-Reply-To: <n1@example\.ch>\r\n/);
      assert.match(delivered.message, /^From: Anna <user@example\.ch>\r\n/);
      assert.ok(delivered.stuffed.includes('\r\n..punkt'));
      await waitFor(() => imap.state.boxes.Sent.length === 1);

      const unknown = await call('POST', '/v1/mail/send', {
        mailAccountId: 'mac_x',
        to: ['a@b.ch'],
        subject: '',
        text: '',
      });
      assert.deepEqual(unknown.data, { error: 'not_found' });
      const badTo = await call('POST', '/v1/mail/send', {
        mailAccountId: mailAccount.id,
        to: ['kein-mail'],
        subject: '',
        text: '',
      });
      assert.deepEqual(badTo.data, { error: 'bad_request' });
      const missingParent = await call('POST', '/v1/mail/send', {
        mailAccountId: mailAccount.id,
        to: ['a@b.ch'],
        subject: '',
        text: '',
        inReplyTo: 'mm_fehlt',
      });
      assert.deepEqual(missingParent.data, { error: 'not_found' });
    });

    test('moves deleted mail to the trash', async () => {
      const target = (await tables()).mailMessages.find((row) => row.uid === 3);
      assert.deepEqual((await call('POST', `/v1/mail/messages/${target.id}/delete`)).data, {
        ok: true,
      });
      assert.ok(!imap.state.boxes.INBOX.some((m) => m.uid === 3));
      assert.equal(imap.state.boxes.Trash.length, 1);
      const current = await tables();
      assert.ok(!current.mailMessages.some((row) => row.id === target.id));
      assert.ok(!current.notifications.some((row) => row.ref.mailMessageId === target.id));
    });

    test('records sync errors and removes everything on disconnect', async () => {
      await imap.close();
      const result = await call('POST', '/v1/mail/sync', { accountId: accountA.id });
      assert.deepEqual(result.data, {
        newMessages: 0,
        errors: [{ mailAccountId: mailAccount.id, error: 'unreachable' }],
      });
      assert.equal((await tables()).mailAccounts[0].lastError, 'unreachable');

      assert.deepEqual((await call('DELETE', `/v1/mail/accounts/${mailAccount.id}`)).data, {
        ok: true,
      });
      const current = await tables();
      assert.equal(current.mailAccounts.length, 0);
      assert.equal(current.mailMessages.length, 0);
      assert.equal(current.notifications.filter((row) => row.kind === 'mail').length, 0);
      const vault = JSON.parse(await fs.readFile(path.join(dataDir, 'mail-vault.json'), 'utf8'));
      assert.deepEqual(vault.entries, {});
      assert.equal((await call('DELETE', `/v1/mail/accounts/${mailAccount.id}`)).status, 404);
    });
  });
});
