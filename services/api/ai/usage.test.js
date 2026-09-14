/**
 * Verbrauch und Kosten der KI: Rechnung, Datei, Drehen, Summen.
 * Der Datenordner liegt im Temp-Verzeichnis.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, describe, test } = require('node:test');

const {
  PRICES,
  ROTATED_FILE,
  USAGE_FILE,
  costOf,
  readUsage,
  recordUsage,
  summarizeUsage,
  tokensOf,
} = require('./usage.js');

const entry = (overrides = {}) => ({
  at: '2026-09-14T08:00:00.000Z',
  accountId: 'acc_1',
  app: 'getbetter',
  tier: 'cheap_model',
  model: 'gemma4-31b',
  intent: 'command',
  voice: false,
  ok: true,
  error: null,
  promptTokens: 1000,
  completionTokens: 500,
  durationMs: 120,
  ...overrides,
});

describe('KI-Verbrauch', () => {
  let root;
  let counter = 0;
  const freshDir = async () => {
    counter += 1;
    const dir = path.join(root, `run-${counter}`);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  };

  before(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'better-ai-usage-'));
  });

  after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  test('Preistabelle in CHF je Million Tokens', () => {
    assert.deepEqual(PRICES['gemma4-31b'], { input: 0.136, output: 0.374 });
    assert.deepEqual(PRICES['gpt-oss-120b'], { input: 0.133, output: 0.531 });
    assert.deepEqual(PRICES['deepseek-v4-flash'], { input: 0.168, output: 0.451 });
    for (const model of [
      'qwen3-8b',
      'llama4-maverick',
      'apertus-v1.5-70b',
      'qwen3-vl-235b',
      'deepseek-ocr',
      'mistral-7B-Instruct-v03',
    ]) {
      assert.ok(PRICES[model], model);
    }
  });

  test('costOf rechnet Eingabe und Ausgabe, auf sechs Stellen', () => {
    assert.equal(costOf('gemma4-31b', 1000, 500), 0.000323);
    assert.equal(costOf('gpt-oss-120b', 1_000_000, 1_000_000), 0.664);
    // 0.000699738 -> 0.0007
    assert.equal(costOf('deepseek-v4-flash', 2345, 678), 0.0007);
    assert.equal(costOf('mistral-7B-Instruct-v03', 0, 0), 0);
    assert.equal(costOf('unbekannt', 1000, 500), null);
    assert.equal(costOf('toString', 1000, 500), null);
    assert.equal(costOf('gemma4-31b', null, 500), null);
    assert.equal(costOf('gemma4-31b', 1000, -1), null);
    assert.equal(costOf('gemma4-31b', 1.5, 2), null);
  });

  test('tokensOf liest nur ganze Zahlen aus usage', () => {
    assert.deepEqual(tokensOf({ prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 }), {
      promptTokens: 10,
      completionTokens: 2,
    });
    assert.deepEqual(tokensOf({ prompt_tokens: '10' }), { promptTokens: null, completionTokens: null });
    assert.deepEqual(tokensOf(null), { promptTokens: null, completionTokens: null });
  });

  test('recordUsage schreibt nur die bekannten Felder und rechnet die Kosten', async () => {
    const dir = await freshDir();
    const line = await recordUsage(dir, {
      ...entry(),
      costChf: 99,
      text: 'geheime Nachricht',
      apiKey: 'sk-geheim',
    });
    assert.equal(line.costChf, 0.000323);
    const raw = await fs.readFile(path.join(dir, USAGE_FILE), 'utf8');
    assert.equal(raw.endsWith('\n'), true);
    assert.equal(raw.includes('geheim'), false);
    assert.deepEqual(Object.keys(JSON.parse(raw)), [
      'at',
      'accountId',
      'app',
      'tier',
      'model',
      'intent',
      'voice',
      'ok',
      'error',
      'promptTokens',
      'completionTokens',
      'costChf',
      'durationMs',
    ]);
    assert.deepEqual(await readUsage(dir), [{ ...entry(), costChf: 0.000323 }]);

    const failed = await recordUsage(dir, entry({ ok: false, error: 'timeout', promptTokens: null }));
    assert.deepEqual([failed.error, failed.promptTokens, failed.costChf], ['timeout', null, null]);
    const noAt = await recordUsage(dir, { ok: true, error: 'wird ignoriert' });
    assert.match(noAt.at, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(noAt.error, null);
    assert.equal(noAt.durationMs, null);
  });

  test('ueber der Grenze wird die Datei gedreht, die aelteste faellt weg', async () => {
    const dir = await freshDir();
    const one = Buffer.byteLength(`${JSON.stringify(await recordUsage(dir, entry()))}\n`);
    await fs.rm(path.join(dir, USAGE_FILE));
    const maxBytes = one * 2;

    for (let index = 1; index <= 5; index += 1) {
      await recordUsage(dir, entry({ accountId: `acc_${index}` }), { maxBytes });
    }
    const lines = async (name) =>
      (await fs.readFile(path.join(dir, name), 'utf8')).trim().split('\n').length;
    // 1+2 passen genau hinein; 3 dreht; 4 passt; 5 dreht und wirft 1+2 weg.
    assert.equal(await lines(ROTATED_FILE), 2);
    assert.equal(await lines(USAGE_FILE), 1);
    assert.deepEqual(
      (await readUsage(dir)).map((row) => row.accountId),
      ['acc_3', 'acc_4', 'acc_5'],
    );
  });

  test('gleichzeitige Zeilen verschraenken sich nicht', async () => {
    const dir = await freshDir();
    await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        recordUsage(dir, entry({ accountId: `acc_${index}` }), { maxBytes: 2000 }),
      ),
    );
    const rows = await readUsage(dir);
    assert.ok(rows.length > 0 && rows.length <= 25);
    const raw = [
      await fs.readFile(path.join(dir, ROTATED_FILE), 'utf8'),
      await fs.readFile(path.join(dir, USAGE_FILE), 'utf8'),
    ].join('');
    for (const text of raw.trim().split('\n')) assert.doesNotThrow(() => JSON.parse(text));
  });

  test('readUsage ueberspringt kaputte Zeilen und filtert', async () => {
    const dir = await freshDir();
    assert.deepEqual(await readUsage(path.join(dir, 'fehlt')), []);
    await recordUsage(dir, entry({ at: '2026-09-13T23:59:59.000Z', accountId: 'acc_a' }));
    await fs.appendFile(path.join(dir, USAGE_FILE), 'kaputt\n{"ohne":"zeit"}\n\n');
    await recordUsage(dir, entry({ at: '2026-09-14T00:00:00.000Z', accountId: 'acc_b', app: 'bettergym' }));
    await recordUsage(dir, entry({ at: '2026-09-15T00:00:00.000Z', accountId: 'acc_a' }));

    assert.equal((await readUsage(dir)).length, 3);
    const day = await readUsage(dir, { from: '2026-09-14', to: '2026-09-15T00:00:00.000Z' });
    assert.deepEqual(day.map((row) => row.accountId), ['acc_b']);
    assert.equal((await readUsage(dir, { accountId: 'acc_a' })).length, 2);
    assert.equal((await readUsage(dir, { app: 'bettergym' })).length, 1);
    assert.equal((await readUsage(dir, { from: 'kein Datum' })).length, 3);
  });

  test('summarizeUsage summiert je App, Konto, Stufe und Tag', () => {
    const rows = [
      { ...entry(), costChf: 0.1 },
      { ...entry({ accountId: 'acc_2', tier: 'chat_model' }), costChf: 0.2 },
      {
        ...entry({ app: 'bettergym', ok: false, error: 'timeout', promptTokens: null, completionTokens: null }),
        at: '2026-09-15T10:00:00.000Z',
        costChf: null,
      },
      { ...entry({ app: null, accountId: null, tier: null }), costChf: null },
    ];
    const summary = summarizeUsage(rows);
    assert.deepEqual(summary.total, {
      requests: 4,
      errors: 1,
      promptTokens: 3000,
      completionTokens: 1500,
      tokens: 4500,
      costChf: 0.3,
    });
    assert.deepEqual(Object.keys(summary.byApp).sort(), ['bettergym', 'getbetter', 'unknown']);
    assert.equal(summary.byApp.getbetter.requests, 2);
    assert.equal(summary.byApp.getbetter.costChf, 0.3);
    assert.equal(summary.byApp.bettergym.errors, 1);
    assert.equal(summary.byAccount.acc_1.requests, 2);
    assert.equal(summary.byAccount.unknown.requests, 1);
    assert.equal(summary.byTier.chat_model.tokens, 1500);
    assert.deepEqual(Object.keys(summary.byDay).sort(), ['2026-09-14', '2026-09-15']);
    assert.equal(summary.byDay['2026-09-14'].requests, 3);
    assert.deepEqual(summarizeUsage(undefined).total.requests, 0);
  });
});
