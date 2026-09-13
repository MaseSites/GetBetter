const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, beforeEach, describe, test } = require('node:test');

const { createOutbox } = require('./outbox.js');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check, timeoutMs = 2000) {
  const until = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > until) throw new Error('Zeitlimit beim Warten');
    await sleep(10);
  }
}

describe('createOutbox', () => {
  let dir;
  // Jeder Test eine eigene Datei: ein Postausgang aus einem frueheren Test schreibt sonst hinein.
  let file = '';
  let counter = 0;
  const job = (delayMs, overrides = {}) => {
    counter += 1;
    return {
      sendId: `snd_${counter}`,
      accountId: 'acc_1',
      mailAccountId: 'mac_1',
      recipients: ['a@b.ch'],
      raw: 'Subject: x\r\n\r\ny\r\n',
      sentCopy: 'Subject: x\r\n\r\ny\r\n',
      subject: 'x',
      sendAt: new Date(Date.now() + delayMs).toISOString(),
      ...overrides,
    };
  };

  before(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'better-outbox-'));
  });

  beforeEach(() => {
    counter += 1;
    file = path.join(dir, `mail-outbox-${counter}.json`);
  });

  after(async () => {
    await sleep(50);
    await fs.rm(dir, { recursive: true, force: true });
  });

  test('sends when the delay is over and remembers it', async () => {
    const delivered = [];
    const outbox = createOutbox({ file, deliver: async (entry) => delivered.push(entry.sendId) });
    const receipt = await outbox.schedule(job(40));
    assert.equal((await outbox.status(receipt.sendId)).state, 'pending');
    assert.deepEqual(delivered, []);
    await waitFor(() => delivered.length === 1);
    await waitFor(async () => (await outbox.status(receipt.sendId)).state === 'sent');
    assert.equal(await outbox.cancel(receipt.sendId), 'already_sent');
    assert.equal(await outbox.cancel('snd_unbekannt'), 'not_found');
    await waitFor(async () => (await fs.readFile(file, 'utf8')).trim() === '{}');
  });

  test('cancels while pending, twice, and never sends', async () => {
    const delivered = [];
    const outbox = createOutbox({ file, deliver: async (entry) => delivered.push(entry) });
    const { sendId } = await outbox.schedule(job(60));
    assert.equal(await outbox.cancel(sendId), 'cancelled');
    assert.equal(await outbox.cancel(sendId), 'cancelled');
    await sleep(120);
    assert.deepEqual(delivered, []);
    assert.equal((await outbox.status(sendId)).state, 'cancelled');
  });

  test('refuses to cancel a mail already on its way', async () => {
    let release;
    const outbox = createOutbox({
      file,
      deliver: () => new Promise((resolve) => (release = resolve)),
    });
    const { sendId } = await outbox.schedule(job(0));
    await waitFor(async () => (await outbox.status(sendId)).state === 'sending');
    assert.equal(await outbox.cancel(sendId), 'already_sent');
    release();
    await waitFor(async () => (await outbox.status(sendId)).state === 'sent');
  });

  test('reports a failed delivery with its error key', async () => {
    const failures = [];
    const outbox = createOutbox({
      file,
      deliver: async () => {
        throw Object.assign(new Error('auth_failed'), { code: 'auth_failed' });
      },
      onFailure: async (entry, error) => failures.push([entry.sendId, error]),
    });
    const { sendId, sendAt } = await outbox.schedule(job(0));
    await waitFor(() => failures.length === 1);
    assert.deepEqual(failures, [[sendId, 'auth_failed']]);
    assert.deepEqual(await outbox.status(sendId), {
      sendId,
      state: 'failed',
      sendAt,
      error: 'auth_failed',
    });
  });

  test('survives a restart: pending mail goes out, interrupted mail counts as failed', async () => {
    const first = createOutbox({ file, deliver: async () => {} });
    const waiting = job(80);
    await first.schedule(waiting);
    first.stop();
    // Ein Absturz mitten im Senden hinterlaesst `sending` in der Datei.
    const stored = JSON.parse(await fs.readFile(file, 'utf8'));
    const interrupted = job(0, { state: 'sending' });
    await fs.writeFile(file, JSON.stringify({ ...stored, [interrupted.sendId]: interrupted }));

    const delivered = [];
    const failures = [];
    const second = createOutbox({
      file,
      deliver: async (entry) => delivered.push(entry.sendId),
      onFailure: async (entry, error) => failures.push([entry.sendId, error]),
    });
    await second.resume();
    assert.deepEqual(failures, [[interrupted.sendId, 'send_failed']]);
    await waitFor(() => delivered.length === 1);
    assert.deepEqual(delivered, [waiting.sendId]);
  });

  test('drops pending mail of a disconnected mailbox', async () => {
    const delivered = [];
    const outbox = createOutbox({ file, deliver: async (entry) => delivered.push(entry) });
    const mine = await outbox.schedule(job(50, { mailAccountId: 'mac_weg' }));
    const other = await outbox.schedule(job(50, { mailAccountId: 'mac_bleibt' }));
    await outbox.dropMailbox('mac_weg');
    await waitFor(() => delivered.length === 1);
    assert.equal(delivered[0].sendId, other.sendId);
    assert.equal((await outbox.status(mine.sendId)).state, 'cancelled');
  });
});
