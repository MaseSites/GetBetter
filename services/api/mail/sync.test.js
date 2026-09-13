const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, describe, test } = require('node:test');

// Der Speicher darf nie auf services/api/data zeigen: jeder Lauf bekommt einen eigenen Ordner.
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'better-sync-test-'));
process.env.BETTER_DATA_DIR = DATA_DIR;
process.env.BETTER_MAIL_ALLOW_PLAIN = '1';

const { load } = require('../store.js');
const { createFakeImap } = require('../test/fakes.js');
const { createMailSync, keepFor, needsBackfill, plan } = require('./sync.js');
const { createVault } = require('./vault.js');

const CONNECTED = '2026-09-01T10:00:00.000Z';
const account = { id: 'mac_1', accountId: 'acc_1', connectedAt: CONNECTED };

const row = (uid, overrides = {}) => ({
  id: `mm_${uid}`,
  accountId: 'acc_1',
  mailAccountId: 'mac_1',
  folder: 'INBOX',
  folderRole: 'inbox',
  uid,
  seen: false,
  flagged: false,
  answered: false,
  attachments: [],
  ...overrides,
});

const message = (uid, overrides = {}) => ({
  uid,
  seen: false,
  flagged: false,
  answered: false,
  attachments: [],
  internalDate: '10-Sep-2026 09:00:00 +0000',
  messageId: `<${uid}@x>`,
  from: { name: 'A', address: 'a@x.ch' },
  to: [],
  cc: [],
  subject: `Mail ${uid}`,
  date: '2026-09-10T09:00:00.000Z',
  snippet: '',
  text: '',
  ...overrides,
});

/** Ein Abruf: je Ordner ein Kasten, dazu die Ordner des Postfachs. */
function remoteOf(boxes, { skipped = [] } = {}) {
  const entries = Object.entries(boxes).map(([name, box]) => [
    name,
    {
      role: box.role ?? 'inbox',
      rebuild: box.rebuild ?? false,
      flags: new Map(box.flags ?? []),
      checked: new Set(box.checked ?? []),
      messages: box.messages ?? [],
    },
  ]);
  return {
    folders: entries.map(([name, box]) => ({ role: box.role, name })),
    boxes: new Map(entries),
    skipped: new Set(skipped),
  };
}

describe('plan', () => {
  test('rebuild replaces all rows and marks nothing as new', () => {
    const remote = remoteOf({ INBOX: { rebuild: true, messages: [message(5), message(6)] } });
    const result = plan(account, [row(1), row(2)], remote);
    assert.deepEqual([...result.removed].sort(), ['mm_1', 'mm_2']);
    assert.deepEqual(
      result.rows.map((r) => [r.uid, r.arrivedAfterConnect]),
      [
        [6, false],
        [5, false],
      ],
    );
    assert.equal(result.changed, true);
  });

  test('refreshes flags, drops mail gone from the server and adds recent arrivals', () => {
    const remote = remoteOf({
      INBOX: {
        flags: [
          [1, ['\\Seen']],
          [3, []],
        ],
        checked: [1, 2, 3],
        messages: [
          message(10),
          message(11, { internalDate: '01-Jan-2020 09:00:00 +0000' }),
          message(12, { seen: true }),
        ],
      },
    });
    const result = plan(account, [row(1), row(2), row(3, { seen: true })], remote, {
      isTouched: (id) => id === 'mm_3',
    });
    const byUid = new Map(result.rows.map((r) => [r.uid, r]));
    assert.equal(byUid.get(1).seen, true);
    assert.ok(result.seenNow.has('mm_1'));
    assert.ok(!byUid.has(2));
    assert.ok(result.removed.has('mm_2'));
    // Lokal eben geaendert: der Abgleich laesst die Zeile, wie sie ist.
    assert.equal(byUid.get(3).seen, true);
    assert.equal(byUid.get(10).arrivedAfterConnect, true);
    // Alte Mail, in den Posteingang zurueckgeschoben: keine Neuigkeit.
    assert.equal(byUid.get(11).arrivedAfterConnect, false);
    assert.equal(byUid.get(12).seen, true);
    assert.equal(result.added.length, 3);
  });

  test('picks up the flag and the answered mark', () => {
    const remote = remoteOf({
      INBOX: {
        flags: [
          [1, ['\\Seen', '\\Flagged']],
          [2, ['\\Answered']],
        ],
        checked: [1, 2],
        messages: [message(9, { flagged: true, attachments: [{ filename: 'a.pdf' }] })],
      },
    });
    const result = plan(account, [row(1), row(2)], remote);
    const byUid = new Map(result.rows.map((r) => [r.uid, r]));
    assert.equal(byUid.get(1).flagged, true);
    assert.equal(byUid.get(2).answered, true);
    assert.equal(byUid.get(9).flagged, true);
    assert.deepEqual(byUid.get(9).attachments, [{ filename: 'a.pdf' }]);
    assert.equal(result.changed, true);
  });

  test('does not resurrect mail deleted while the sync ran', () => {
    const remote = remoteOf({
      INBOX: { rebuild: true, messages: [message(4), message(5)] },
    });
    const result = plan(account, [row(4)], remote, {
      isDeleted: (folder, uid) => folder === 'INBOX' && uid === 4,
    });
    assert.deepEqual(
      result.rows.map((r) => r.uid),
      [5],
    );
  });

  test('keeps at most the newest messages of each folder', () => {
    const keep = keepFor('inbox');
    const mine = Array.from({ length: keep }, (_, index) => row(index + 1));
    const remote = remoteOf({
      INBOX: {
        flags: mine.map((r) => [r.uid, []]),
        checked: mine.map((r) => r.uid),
        messages: [message(keep + 1), message(keep + 2)],
      },
    });
    const result = plan(account, mine, remote);
    assert.equal(result.rows.length, keep);
    assert.equal(result.rows[0].uid, keep + 2);
    assert.ok(result.removed.has('mm_1'));
    assert.ok(result.removed.has('mm_2'));
    assert.equal(result.added.length, 2);
  });

  test('holds every folder apart and keeps fewer outside the inbox', () => {
    const junk = Array.from({ length: keepFor('junk') + 2 }, (_, index) =>
      row(index + 1, { id: `js_${index + 1}`, folder: 'Junk', folderRole: 'junk' }),
    );
    const remote = remoteOf({
      INBOX: { role: 'inbox', rebuild: true, messages: [message(7)] },
      Junk: {
        role: 'junk',
        flags: junk.map((r) => [r.uid, []]),
        checked: junk.map((r) => r.uid),
        messages: [],
      },
    });
    const result = plan(account, [row(1), ...junk], remote);
    const inbox = result.rows.filter((r) => r.folderRole === 'inbox');
    const kept = result.rows.filter((r) => r.folderRole === 'junk');
    assert.deepEqual(
      inbox.map((r) => [r.uid, r.folder]),
      [[7, 'INBOX']],
    );
    assert.equal(kept.length, keepFor('junk'));
    // Ueber der Grenze fallen die aeltesten des Ordners heraus.
    assert.ok(result.removed.has('js_1'));
    assert.ok(result.removed.has('js_2'));
  });

  test('keeps rows of a folder the server refused and drops rows of one that is gone', () => {
    const drafts = row(4, { id: 'md_4', folder: 'Drafts', folderRole: 'drafts' });
    const archive = row(5, { id: 'ma_5', folder: 'Archive', folderRole: 'archive' });
    const remote = remoteOf(
      { INBOX: { flags: [[1, []]], checked: [1], messages: [] } },
      {
        skipped: ['Drafts'],
      },
    );
    const result = plan(account, [row(1), drafts, archive], remote);
    assert.deepEqual(result.rows.map((r) => r.id).sort(), ['md_4', 'mm_1']);
    assert.deepEqual([...result.removed], ['ma_5']);
  });

  test('reports no change when nothing moved', () => {
    const remote = remoteOf({ INBOX: { flags: [[1, []]], checked: [1], messages: [] } });
    assert.equal(plan(account, [row(1)], remote).changed, false);
  });

  test('merges backfilled headers into a row, even one changed locally', () => {
    const remote = remoteOf({ INBOX: { flags: [[1, []]], checked: [1], messages: [] } });
    const patch = {
      inReplyTo: '<a@x>',
      references: ['<a@x>'],
      bcc: [],
      attachments: [
        { filename: 'a.pdf', mime: 'application/pdf', size: 3, part: '2', contentId: null },
      ],
    };
    remote.boxes.get('INBOX').patches = new Map([[1, patch]]);
    const result = plan(account, [row(1, { seen: true })], remote, { isTouched: () => true });
    assert.deepEqual(result.rows[0], { ...row(1, { seen: true }), ...patch });
    assert.equal(result.changed, true);
    assert.equal(needsBackfill(result.rows[0]), false);
    assert.equal(needsBackfill(row(2)), true);
  });
});

describe('createMailSync against a fake server', () => {
  let fake;
  let port;

  before(async () => {
    fake = createFakeImap();
    port = await fake.listen();
  });

  after(async () => {
    await fake.close();
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const OLD_FIELDS = ['inReplyTo', 'references', 'bcc', 'threadId'];
  /** So stehen Zeilen einer aelteren Fassung des Dienstes in der Datenbank. */
  const asOldRow = (entry) => ({
    ...Object.fromEntries(Object.entries(entry).filter(([key]) => !OLD_FIELDS.includes(key))),
    attachments: entry.attachments.map(({ filename, mime, size }) => ({ filename, mime, size })),
  });

  test('threads mail across folders and fills in what older rows lack', async () => {
    const withPdf =
      '(("TEXT" "PLAIN" ("CHARSET" "utf-8") NIL NIL "7BIT" 20 2)' +
      '("APPLICATION" "PDF" ("NAME" "a.pdf") NIL NIL "BASE64" 100 NIL' +
      ' ("attachment" ("FILENAME" "a.pdf")) NIL NIL) "MIXED")';
    fake.addMessage(
      'INBOX',
      [
        'From: Anna <anna@example.ch>',
        'To: user@example.ch',
        'Subject: AW: Offerte',
        'Message-ID: <r1@example.ch>',
        'In-Reply-To: <o1@example.ch>',
        'References: <o1@example.ch>',
        'Date: Thu, 10 Sep 2026 09:00:00 +0200',
        '',
        'Antwort',
        '',
      ].join('\r\n'),
      { structure: withPdf },
    );
    fake.addMessage(
      'Sent',
      [
        'From: user@example.ch',
        'To: anna@example.ch',
        'Bcc: chef@example.ch',
        'Subject: Offerte',
        'Message-ID: <o1@example.ch>',
        'Date: Wed, 9 Sep 2026 09:00:00 +0200',
        '',
        'Frage',
        '',
      ].join('\r\n'),
      { flags: ['\\Seen'] },
    );

    const vault = createVault(DATA_DIR);
    await vault.put('mac_1', 'secret');
    const db = await load();
    db.tables.mailAccounts = [
      {
        id: 'mac_1',
        accountId: 'acc_1',
        email: 'user@example.ch',
        imapHost: '127.0.0.1',
        imapPort: port,
        imapSecure: false,
        username: 'user@example.ch',
        folders: [],
        connectedAt: CONNECTED,
        lastSyncAt: null,
        lastError: null,
      },
    ];
    const sync = createMailSync({ vault, stateFile: path.join(DATA_DIR, 'mail-state.json') });
    const run = () => sync.syncMailAccount('mac_1', { manual: true, quiet: true });

    assert.equal((await run()).error, null);
    const fresh = (await load()).tables.mailMessages;
    const answer = fresh.find((entry) => entry.messageId === '<r1@example.ch>');
    const question = fresh.find((entry) => entry.messageId === '<o1@example.ch>');
    assert.equal(answer.threadId, question.threadId);
    assert.deepEqual(question.bcc, [{ name: '', address: 'chef@example.ch' }]);
    assert.deepEqual(answer.attachments, [
      { filename: 'a.pdf', mime: 'application/pdf', size: 75, part: '2', contentId: null },
    ]);

    const current = await load();
    current.tables.mailMessages = current.tables.mailMessages.map(asOldRow);
    assert.ok(current.tables.mailMessages.every(needsBackfill));
    const linesBefore = fake.state.lines.length;
    assert.equal((await run()).error, null);

    const filled = (await load()).tables.mailMessages;
    assert.deepEqual(
      filled.map((entry) => entry.id).sort(),
      fresh.map((entry) => entry.id).sort(),
      'the rows keep their ids',
    );
    assert.ok(!filled.some(needsBackfill));
    const backfilled = filled.find((entry) => entry.id === answer.id);
    assert.equal(backfilled.inReplyTo, '<o1@example.ch>');
    assert.deepEqual(backfilled.references, ['<o1@example.ch>']);
    assert.equal(backfilled.attachments[0].part, '2');
    assert.equal(backfilled.threadId, question.threadId);
    const headerFetch = (line) => line.includes('HEADER.FIELDS (BCC IN-REPLY-TO REFERENCES)');
    assert.ok(fake.state.lines.slice(linesBefore).some(headerFetch));

    const linesThen = fake.state.lines.length;
    await run();
    assert.ok(!fake.state.lines.slice(linesThen).some(headerFetch), 'nothing left to fill in');
  });
});
