const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { describe, test } = require('node:test');

// Der Speicher darf nie auf services/api/data zeigen — auch wenn plan() ihn nicht anfasst.
process.env.BETTER_DATA_DIR = path.join(os.tmpdir(), 'better-sync-test-unused');

const { MAX_KEEP, plan } = require('./sync.js');

const CONNECTED = '2026-09-01T10:00:00.000Z';
const account = { id: 'mac_1', accountId: 'acc_1', connectedAt: CONNECTED };

const row = (uid, overrides = {}) => ({
  id: `mm_${uid}`,
  accountId: 'acc_1',
  mailAccountId: 'mac_1',
  folder: 'INBOX',
  uid,
  seen: false,
  ...overrides,
});

const message = (uid, overrides = {}) => ({
  uid,
  seen: false,
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

describe('plan', () => {
  test('rebuild replaces all rows and marks nothing as new', () => {
    const remote = {
      rebuild: true,
      flags: new Map(),
      checked: new Set(),
      messages: [message(5), message(6)],
    };
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
    const remote = {
      rebuild: false,
      flags: new Map([
        [1, ['\\Seen']],
        [3, []],
      ]),
      checked: new Set([1, 2, 3]),
      messages: [
        message(10),
        message(11, { internalDate: '01-Jan-2020 09:00:00 +0000' }),
        message(12, { seen: true }),
      ],
    };
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

  test('does not resurrect mail deleted while the sync ran', () => {
    const remote = {
      rebuild: true,
      flags: new Map(),
      checked: new Set(),
      messages: [message(4), message(5)],
    };
    const result = plan(account, [row(4)], remote, { isDeleted: (uid) => uid === 4 });
    assert.deepEqual(
      result.rows.map((r) => r.uid),
      [5],
    );
  });

  test('keeps at most the newest messages', () => {
    const mine = Array.from({ length: MAX_KEEP }, (_, index) => row(index + 1));
    const remote = {
      rebuild: false,
      flags: new Map(mine.map((r) => [r.uid, []])),
      checked: new Set(mine.map((r) => r.uid)),
      messages: [message(MAX_KEEP + 1), message(MAX_KEEP + 2)],
    };
    const result = plan(account, mine, remote);
    assert.equal(result.rows.length, MAX_KEEP);
    assert.equal(result.rows[0].uid, MAX_KEEP + 2);
    assert.ok(result.removed.has('mm_1'));
    assert.ok(result.removed.has('mm_2'));
    assert.equal(result.added.length, 2);
  });

  test('reports no change when nothing moved', () => {
    const remote = {
      rebuild: false,
      flags: new Map([[1, []]]),
      checked: new Set([1]),
      messages: [],
    };
    assert.equal(plan(account, [row(1)], remote).changed, false);
  });
});
