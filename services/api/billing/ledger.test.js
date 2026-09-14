/** Das Kassenbuch: nach einem Neustart aus den Protokollen, danach im Speicher. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, describe, test } = require('node:test');

const { recordUsage } = require('../ai/usage.js');
const { recordSpeechUsage } = require('../speech/usage.js');
const { speechSettings } = require('./costs.js');
const { createLedger } = require('./ledger.js');

const SPEECH = speechSettings({});
const OCT = Date.parse('2026-10-15T10:00:00.000Z');

describe('Kassenbuch', () => {
  let dataDir;

  before(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'better-ledger-'));
    const ai = (at, promptTokens, app = 'betterai') =>
      recordUsage(dataDir, { at, accountId: 'acc_a', app, model: 'gemma4-31b', ok: true, promptTokens, completionTokens: 0 });
    // 1 Mio. Eingabe-Tokens gemma4-31b = CHF 0.136
    await ai('2026-09-30T21:00:00.000Z', 1_000_000);
    await ai('2026-09-30T22:30:00.000Z', 1_000_000);
    await ai('2026-10-10T08:00:00.000Z', 2_000_000);
    await recordSpeechUsage(dataDir, {
      at: '2026-10-11T08:00:00.000Z',
      accountId: 'acc_a',
      app: 'betterai',
      purpose: 'speech',
      model: 'eleven_multilingual_v2',
      characters: 1000,
      cached: false,
      ok: true,
    });
  });

  after(() => fs.rm(dataDir, { recursive: true, force: true }));

  test('liest nach dem Neustart genau den Monat in Zuerich', async () => {
    const ledger = createLedger({ dataDir, now: () => OCT, speech: SPEECH });
    await ledger.ready();
    const usage = ledger.usageOf('acc_a', 'betterai');
    assert.equal(Math.round(usage.aiChf * 1e6), 408_000);
    assert.equal(Math.round(usage.speechChf * 1e6), 92_000);
    assert.equal(usage.heldChf, 0);
    assert.equal(ledger.spentChf('acc_b', 'betterai'), 0);
    assert.equal(ledger.spentChf('acc_a', 'getbetter'), 0);
  });

  test('neue Zeilen kommen dazu, ohne die Dateien neu zu lesen', async () => {
    let reads = 0;
    const counting = (reader) => async (...args) => {
      reads += 1;
      return reader(...args);
    };
    const ledger = createLedger({
      dataDir,
      now: () => OCT,
      speech: SPEECH,
      readAi: counting(require('../ai/usage.js').readUsage),
      readSpeech: counting(require('../speech/usage.js').readSpeechUsage),
    });
    // Vor dem ersten Lesen steht die Zeile ohnehin in der Datei — nicht doppelt.
    ledger.addAi({ at: '2026-10-12T08:00:00.000Z', accountId: 'acc_a', app: 'betterai', costChf: 5 });
    await ledger.ready();
    await ledger.ready();
    assert.equal(reads, 2);
    const before = ledger.spentChf('acc_a', 'betterai');
    ledger.addAi({ at: '2026-10-12T08:00:00.000Z', accountId: 'acc_a', app: 'betterai', costChf: 0.25 });
    ledger.addSpeech({ at: '2026-10-12T08:00:00.000Z', accountId: 'acc_a', app: 'betterai', credits: 500, cached: true });
    ledger.addAi({ at: '2026-10-12T08:00:00.000Z', accountId: null, app: 'betterai', costChf: 9 });
    assert.equal(Math.round((ledger.spentChf('acc_a', 'betterai') - before) * 1e6), 250_000);
    assert.equal(reads, 2);
  });

  test('Reservierungen zaehlen mit, bis sie frei oder abgelaufen sind', async () => {
    let time = OCT;
    const ledger = createLedger({ dataDir: path.join(dataDir, 'leer'), now: () => time, speech: SPEECH });
    await ledger.ready();
    const first = ledger.hold('acc_c', 'getbetter', 0.2, 1000);
    ledger.hold('acc_c', 'getbetter', 0.1, 5000);
    assert.equal(Math.round(ledger.spentChf('acc_c', 'getbetter') * 10), 3);
    assert.equal(ledger.spentChf('acc_c', 'bettergym'), 0);
    ledger.release(first);
    assert.equal(Math.round(ledger.spentChf('acc_c', 'getbetter') * 10), 1);
    time += 6000;
    assert.equal(ledger.spentChf('acc_c', 'getbetter'), 0);
    ledger.charge('acc_c', 'getbetter', 0.05);
    assert.equal(ledger.usageOf('acc_c', 'getbetter').aiChf, 0.05);
  });

  test('ein neuer Monat faengt bei null an', async () => {
    let time = Date.parse('2026-10-31T22:00:00.000Z');
    const ledger = createLedger({ dataDir, now: () => time, speech: SPEECH });
    await ledger.ready();
    assert.ok(ledger.spentChf('acc_a', 'betterai') > 0);
    assert.equal(ledger.currentMonth(), '2026-10');
    time = Date.parse('2026-10-31T23:30:00.000Z');
    assert.equal(ledger.currentMonth(), '2026-11');
    assert.equal(ledger.spentChf('acc_a', 'betterai'), 0);
    ledger.addAi({ at: new Date(time).toISOString(), accountId: 'acc_a', app: 'betterai', costChf: 0.01 });
    assert.equal(ledger.spentChf('acc_a', 'betterai'), 0.01);
  });
});
