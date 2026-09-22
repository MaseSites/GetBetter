/** Sitzungs-Tokens: Ablauf, Obergrenze je Konto, Widerruf, atomares Schreiben. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, describe, test } = require('node:test');

const { MAX_PER_ACCOUNT, bearerOf, createSessions } = require('./sessions.js');

describe('sessions', () => {
  let dir;
  before(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'better-sessions-'));
  });
  after(() => fs.rm(dir, { recursive: true, force: true }));

  const fresh = async (options = {}) => createSessions({ dataDir: await fs.mkdtemp(path.join(dir, 's-')), ...options });

  test('ein Token gilt bis zum Ablauf, danach nicht mehr', async () => {
    let clock = 1_000_000;
    const sessions = await fresh({ ttlMs: 1000, now: () => clock });
    const token = await sessions.issue('acc_anna');
    assert.deepEqual(await sessions.resolve(token), { accountId: 'acc_anna', readOnly: false });
    clock += 999;
    assert.ok(await sessions.resolve(token));
    clock += 1;
    assert.equal(await sessions.resolve(token), null);
  });

  test('falsche, leere und fremde Formen gelten nie', async () => {
    const sessions = await fresh();
    assert.equal(await sessions.resolve(''), null);
    assert.equal(await sessions.resolve('kurz'), null);
    assert.equal(await sessions.resolve('A'.repeat(43)), null);
    assert.equal(await sessions.resolve(null), null);
  });

  test(`hoechstens ${MAX_PER_ACCOUNT} je Konto: die aelteste faellt weg`, async () => {
    let clock = 5000;
    const sessions = await fresh({ now: () => clock });
    const tokens = [];
    for (let index = 0; index < MAX_PER_ACCOUNT + 1; index += 1) {
      clock += 1;
      tokens.push(await sessions.issue('acc_ben'));
    }
    assert.equal(await sessions.resolve(tokens[0]), null);
    assert.ok(await sessions.resolve(tokens[1]));
    assert.ok(await sessions.resolve(tokens.at(-1)));
    // Ein anderes Konto zaehlt nicht mit.
    const other = await sessions.issue('acc_cleo');
    assert.ok(await sessions.resolve(other));
    assert.ok(await sessions.resolve(tokens[1]));
  });

  test('revoke beendet eine Sitzung, revokeAccount alle eines Kontos', async () => {
    const sessions = await fresh();
    const one = await sessions.issue('acc_dora');
    const two = await sessions.issue('acc_dora');
    const keep = await sessions.issue('acc_emil');
    assert.equal(await sessions.revoke(one), true);
    assert.equal(await sessions.revoke(one), false);
    assert.equal(await sessions.resolve(one), null);
    assert.ok(await sessions.resolve(two));
    await sessions.revokeAccount('acc_dora');
    assert.equal(await sessions.resolve(two), null);
    assert.ok(await sessions.resolve(keep));
  });

  test('readOnly bleibt erhalten und alles uebersteht einen Neustart; keine Temp-Datei bleibt liegen', async () => {
    const dataDir = await fs.mkdtemp(path.join(dir, 'restart-'));
    const first = createSessions({ dataDir });
    const token = await first.issue('acc_fritz', { readOnly: true });
    const second = createSessions({ dataDir });
    assert.deepEqual(await second.resolve(token), { accountId: 'acc_fritz', readOnly: true });
    const names = await fs.readdir(dataDir);
    assert.deepEqual(names, ['sessions.json']);
    // Nur Hashes auf der Platte, nie das Token.
    assert.equal((await fs.readFile(path.join(dataDir, 'sessions.json'), 'utf8')).includes(token), false);
  });

  test('bearerOf liest nur „Bearer <token>“', () => {
    assert.equal(bearerOf({ headers: { authorization: 'Bearer abc' } }), 'abc');
    assert.equal(bearerOf({ headers: { authorization: 'bearer   abc ' } }), 'abc');
    assert.equal(bearerOf({ headers: { authorization: 'Basic abc' } }), null);
    assert.equal(bearerOf({ headers: {} }), null);
  });
});
