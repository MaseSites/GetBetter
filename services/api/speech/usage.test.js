/**
 * Verbrauch der Stimmen: Zeile, Credits je Modell, Zwischenspeicher, Summen.
 * Der Datenordner liegt im Temp-Verzeichnis.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, describe, test } = require('node:test');

const {
  SPEECH_USAGE_FILE,
  creditsPerCharacter,
  readSpeechUsage,
  recordSpeechUsage,
  summarizeSpeech,
} = require('./usage.js');

const line = (overrides = {}) => ({
  at: '2026-09-14T08:00:00.000Z',
  accountId: 'acc_1',
  app: 'getbetter',
  purpose: 'speech',
  model: 'eleven_multilingual_v2',
  voiceId: 'VoiceGerman001',
  characters: 20,
  cached: false,
  ok: true,
  ...overrides,
});

describe('Verbrauch der Stimmen', () => {
  let root;
  let counter = 0;
  const freshDir = async () => {
    counter += 1;
    const dir = path.join(root, `run-${counter}`);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  };

  before(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'better-speech-usage-'));
  });

  after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  test('Credits je Zeichen: Flash und Turbo halb, alles andere ganz', () => {
    assert.equal(creditsPerCharacter('eleven_multilingual_v2'), 1);
    assert.equal(creditsPerCharacter('eleven_v3'), 1);
    assert.equal(creditsPerCharacter('eleven_flash_v2_5'), 0.5);
    assert.equal(creditsPerCharacter('eleven_turbo_v2_5'), 0.5);
    assert.equal(creditsPerCharacter('unbekannt'), 1);
    assert.equal(creditsPerCharacter(null), 1);
  });

  test('schreibt nur die bekannten Felder, rechnet die Credits selbst und nie einen Text', async () => {
    const dir = await freshDir();
    const written = await recordSpeechUsage(dir, {
      ...line(),
      credits: 999,
      text: 'Geheimer Satz',
      apiKey: 'xi-geheim',
    });
    assert.equal(written.credits, 20);
    const raw = await fs.readFile(path.join(dir, SPEECH_USAGE_FILE), 'utf8');
    assert.equal(raw.includes('Geheim'), false);
    assert.equal(raw.includes('xi-geheim'), false);
    assert.deepEqual(Object.keys(JSON.parse(raw)), [
      'at',
      'accountId',
      'app',
      'purpose',
      'model',
      'voiceId',
      'characters',
      'credits',
      'cached',
      'ok',
      'error',
    ]);

    const flash = await recordSpeechUsage(dir, line({ model: 'eleven_flash_v2_5', characters: 21 }));
    assert.equal(flash.credits, 10.5);
    const cached = await recordSpeechUsage(dir, line({ cached: true }));
    assert.deepEqual([cached.credits, cached.cached, cached.ok], [0, true, true]);
    const failed = await recordSpeechUsage(dir, line({ ok: false, error: 'quota_exceeded' }));
    assert.deepEqual([failed.credits, failed.error], [0, 'quota_exceeded']);
    const interrupted = await recordSpeechUsage(dir, line({ ok: false, billed: true, error: 'interrupted' }));
    assert.equal(interrupted.credits, 20);
    const odd = await recordSpeechUsage(dir, {
      at: '2026-09-15T08:00:00.000Z',
      purpose: 'geheim',
      voiceId: '../etc',
      accountId: 'x'.repeat(101),
      characters: -3,
      ok: true,
    });
    assert.deepEqual(
      [odd.purpose, odd.voiceId, odd.accountId, odd.characters, odd.credits],
      ['speech', null, null, 0, 0],
    );
    assert.equal((await readSpeechUsage(dir)).length, 6);
    assert.equal((await readSpeechUsage(dir, { accountId: 'acc_1' })).length, 5);
    assert.equal((await readSpeechUsage(dir, { from: '2026-09-15' })).length, 1);
  });

  test('summarizeSpeech: Credits, erzeugte Zeichen, Zwischenspeicher, Proben und Gespartes', () => {
    const rows = [
      { ...line(), credits: 20 },
      { ...line({ cached: true }), credits: 0 },
      { ...line({ purpose: 'sample', characters: 21, accountId: 'acc_2' }), credits: 21 },
      {
        ...line({ purpose: 'sample', characters: 21, accountId: 'acc_3', cached: true, model: 'eleven_flash_v2_5' }),
        credits: 0,
      },
      {
        ...line({ ok: false, error: 'quota_exceeded', app: 'bettergym', accountId: null }),
        credits: 0,
        at: '2026-09-15T08:00:00.000Z',
      },
    ];
    const summary = summarizeSpeech(rows);
    assert.deepEqual(summary.total, {
      requests: 5,
      errors: 1,
      cached: 2,
      characters: 41,
      credits: 41,
      savedCredits: 30.5,
      samples: 2,
      sampleCredits: 21,
    });
    assert.equal(summary.byAccount.acc_1.requests, 2);
    assert.equal(summary.byAccount.unknown.errors, 1);
    assert.equal(summary.byApp.bettergym.requests, 1);
    assert.deepEqual(Object.keys(summary.byDay).sort(), ['2026-09-14', '2026-09-15']);
    assert.equal(summarizeSpeech(undefined).total.requests, 0);
  });
});
