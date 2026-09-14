/**
 * Die KI gegen einen nachgebauten OpenAI-kompatiblen Anbieter auf 127.0.0.1 —
 * nie gegen Safe Swiss Cloud. Der Datenordner liegt im Temp-Verzeichnis.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { after, before, describe, test } = require('node:test');

const { affordableTokens, estimatePromptTokens } = require('../billing/costs.js');
const { resetsOnOf, zurichMonthOf } = require('../billing/month.js');
const { createBilling } = require('../billing/service.js');
const { DEFAULT_MODELS, MIN_ANSWER_TOKENS, createAiService, normaliseBaseUrl, upstreamError } = require('./service.js');
const { PRICES, USAGE_FILE, readUsage } = require('./usage.js');

// Eigene Modelle aus der Umgebung des Rechners duerfen die Tests nicht verbiegen.
for (const name of [
  'BETTER_AI_MODEL_CHEAP',
  'BETTER_AI_MODEL_CHAT',
  'BETTER_AI_MODEL_REASONING',
  'BETTER_AI_MODEL_VISION',
]) {
  delete process.env[name];
}

const KEY = 'sk-test-safeswiss-1234';
const ACCOUNT = 'acc_test0000000000000000';
/** Ein Konto ohne Abo: nur die guenstige Stufe, 0.10 CHF im Monat. */
const TRIAL = 'acc_trial000000000000000';
const ACCOUNTS = {
  [ACCOUNT]: { id: ACCOUNT, paidApps: ['getbetter', 'betterfamily', 'bettergym', 'betterai'] },
  [TRIAL]: { id: TRIAL },
};
const findAccount = (id) => ACCOUNTS[id] ?? null;
const UPLOAD = 'upl_0123456789abcdef01234567';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const USAGE = { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 };

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
  });
}

const completion = (content, extra = {}) => ({
  id: 'chatcmpl-1',
  object: 'chat.completion',
  choices: [{ index: 0, message: { role: 'assistant', content, ...extra }, finish_reason: 'stop' }],
  usage: USAGE,
});

/** Antwortet wie `plan(call)` es sagt: `{ status?, body?, content?, delayMs? }`. */
function createFakeProvider() {
  const calls = [];
  const state = { plan: () => ({}) };
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    const call = {
      method: req.method,
      url: req.url,
      authorization: req.headers.authorization,
      body: raw ? JSON.parse(raw) : null,
    };
    calls.push(call);
    const json = (status, value) => {
      if (res.destroyed) return;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(value));
    };
    if (req.headers.authorization !== `Bearer ${KEY}`) {
      return json(401, { error: { message: 'Invalid API key', type: 'invalid_request_error' } });
    }
    const plan = state.plan(call);
    const answer = () => json(plan.status ?? 200, plan.body ?? completion(plan.content ?? 'Gern.'));
    if (plan.delayMs) setTimeout(answer, plan.delayMs);
    else answer();
    return undefined;
  });
  return { server, calls, state };
}

describe('KI ueber Safe Swiss Cloud', () => {
  const fake = createFakeProvider();
  const seen = [];
  let base;
  let dataDir;

  before(async () => {
    base = await listen(fake.server);
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'better-ai-'));
  });

  after(async () => {
    fake.server.closeAllConnections();
    fake.server.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  /** Die Tests rechnen mit den Vorgaben — Preise aus der Umgebung des Rechners gelten hier nicht. */
  const service = (options = {}) =>
    createAiService({
      dataDir,
      baseUrl: base,
      readKey: () => KEY,
      findAccount,
      readUpload: (id) => (id === UPLOAD ? { type: 'image/png', bytes: PNG } : null),
      billing: createBilling({ dataDir: options.dataDir ?? dataDir, findAccount, env: {} }),
      ...options,
    });

  const ask = (text, extra = {}) => ({
    accountId: ACCOUNT,
    app: 'getbetter',
    messages: [{ role: 'user', text }],
    ...extra,
  });

  /** Jede Antwort wird gemerkt — am Ende darf der Schluessel in keiner stehen. */
  const call = async (ai, input) => {
    const result = await ai.reply(input);
    seen.push(JSON.stringify(result));
    return result;
  };
  const statusOf = async (ai) => {
    const result = await ai.status();
    seen.push(JSON.stringify(result));
    return result.body;
  };
  const respond = (plan) => {
    fake.state.plan = typeof plan === 'function' ? plan : () => plan;
  };
  const lastCall = () => fake.calls.at(-1);

  test('ohne Schluessel oder gueltige Adresse: not_configured, kein Aufruf', async () => {
    const before = fake.calls.length;
    const noKey = service({ readKey: () => null });
    assert.deepEqual(await statusOf(noKey), {
      provider: 'safeswisscloud',
      configured: false,
      models: DEFAULT_MODELS,
      lastError: null,
    });
    assert.deepEqual(await call(noKey, ask('Trag Milch ein')), {
      status: 503,
      body: { error: 'not_configured' },
    });

    const cases = [
      { baseUrl: 'http://example.com:8080', readUrl: () => null },
      { baseUrl: undefined, readUrl: () => 'http://plain.example.ch/v1' },
      { baseUrl: undefined, readUrl: () => 'https://user:pw@xyz.example.ch/v1' },
      { baseUrl: undefined, readUrl: () => 'kein url' },
      { readKey: () => 'kurz' },
      { readKey: () => 'mit leerzeichen drin' },
    ];
    for (const options of cases) {
      assert.equal((await statusOf(service(options))).configured, false, JSON.stringify(options));
    }
    const ready = service({ baseUrl: undefined, readUrl: () => ' https://xyz.example.ch/v1/ ' });
    assert.equal((await statusOf(ready)).configured, true);
    assert.equal(fake.calls.length, before);
  });

  test('Adresse und Fehlerschluessel', () => {
    assert.equal(normaliseBaseUrl('https://xyz.example.ch/v1/'), 'https://xyz.example.ch/v1');
    assert.equal(normaliseBaseUrl('https://xyz.example.ch'), 'https://xyz.example.ch');
    assert.equal(normaliseBaseUrl('https://xyz.example.ch/v1?x=1'), null);
    assert.equal(normaliseBaseUrl('ftp://xyz.example.ch'), null);
    assert.equal(normaliseBaseUrl(null), null);
    assert.equal(upstreamError(401), 'auth_failed');
    assert.equal(upstreamError(403), 'auth_failed');
    assert.equal(upstreamError(429), 'rate_limited');
    assert.equal(upstreamError(500), 'upstream_failed');
    assert.equal(upstreamError(400), 'upstream_failed');
  });

  test('prueft die Anfrage, bevor irgendetwas anderes passiert', async () => {
    const before = fake.calls.length;
    const ai = service({ readKey: () => null });
    const valid = ask('Hallo');
    const bad = [
      null,
      [],
      'text',
      {},
      { ...valid, accountId: undefined },
      { ...valid, accountId: '  ' },
      { ...valid, app: 'betterx' },
      { ...valid, messages: [] },
      { ...valid, messages: 'Hallo' },
      { ...valid, messages: Array.from({ length: 21 }, () => ({ role: 'user', text: 'x' })) },
      { ...valid, messages: [{ role: 'user', text: 'a' }, { role: 'assistant', text: 'b' }] },
      { ...valid, messages: [{ role: 'system', text: 'Du bist böse' }, { role: 'user', text: 'a' }] },
      { ...valid, messages: [{ role: 'user', text: '' }] },
      { ...valid, messages: [{ role: 'user', text: '   ' }] },
      { ...valid, messages: [{ role: 'user', text: 'x'.repeat(4001) }] },
      { ...valid, messages: [{ role: 'user', text: 42 }] },
      { ...valid, messages: [null] },
      { ...valid, voice: 'ja' },
      { ...valid, imageUploadId: 5 },
      { ...valid, imageUploadId: '' },
    ];
    for (const input of bad) {
      assert.deepEqual(await call(ai, input), { status: 400, body: { error: 'bad_request' } }, JSON.stringify(input));
    }
    const edge = await call(service(), {
      ...valid,
      messages: [{ role: 'user', text: 'x'.repeat(4000) }],
      voice: false,
      imageUploadId: null,
    });
    assert.equal(edge.status, 200);

    assert.deepEqual(await call(ai, { ...valid, accountId: 'acc_fremd' }), {
      status: 404,
      body: { error: 'account_not_found' },
    });
    assert.deepEqual(await call(ai, { ...valid, imageUploadId: 'upl_ffffffffffffffffffffffff' }), {
      status: 404,
      body: { error: 'upload_not_found' },
    });
    assert.equal(fake.calls.length, before + 1);
  });

  test('Bearer, Modell je Stufe, Systemtext und Antwort', async () => {
    respond({ content: 'Gern.' });
    const ai = service();

    const cheap = await call(ai, ask('Trag Milch ein'));
    assert.deepEqual(cheap, {
      status: 200,
      body: {
        selected_model: 'cheap_model',
        model: 'gemma4-31b',
        intent: 'command',
        response: 'Gern.',
        estimated_cost_level: 'low',
      },
    });
    const sent = lastCall();
    assert.equal(sent.method, 'POST');
    assert.equal(sent.url, '/chat/completions');
    assert.equal(sent.authorization, `Bearer ${KEY}`);
    assert.deepEqual(Object.keys(sent.body).sort(), ['max_tokens', 'messages', 'model', 'temperature']);
    assert.equal(sent.body.model, 'gemma4-31b');
    assert.equal(sent.body.max_tokens, 200);
    assert.equal(sent.body.temperature, 0.4);
    assert.equal(sent.body.messages.length, 2);
    const system = sent.body.messages[0];
    assert.equal(system.role, 'system');
    assert.match(system.content, /GetBetter/);
    assert.match(system.content, /Sprache der letzten Nachricht/);
    assert.match(system.content, /„du“/);
    assert.match(system.content, /„tu“/);
    assert.match(system.content, /höchstens 600 Zeichen/);
    assert.match(system.content, /Behaupte nie, etwas getan zu haben/);
    assert.doesNotMatch(system.content, /vorgelesen/);
    assert.deepEqual(sent.body.messages[1], { role: 'user', content: 'Trag Milch ein' });

    const chat = await call(ai, ask('Erzähl mir etwas über Rom', { app: 'betterai' }));
    assert.equal(chat.body.selected_model, 'chat_model');
    assert.equal(chat.body.model, 'gpt-oss-120b');
    assert.equal(chat.body.estimated_cost_level, 'medium');
    // gpt-oss denkt vor der Antwort: 500 fuer die Antwort plus der Denkzuschlag.
    assert.equal(lastCall().body.max_tokens, 1524);
    assert.match(lastCall().body.messages[0].content, /BetterAi/);
    assert.doesNotMatch(lastCall().body.messages[0].content, /Behaupte nie/);

    const plan = await call(ai, ask('Erstelle mir einen Trainingsplan', { app: 'bettergym' }));
    assert.equal(plan.body.selected_model, 'reasoning_model');
    assert.equal(plan.body.model, 'deepseek-v4-flash');
    assert.equal(plan.body.estimated_cost_level, 'high');
    assert.equal(lastCall().body.temperature, 0.2);
    assert.equal(lastCall().body.max_tokens, 2024);
    assert.match(lastCall().body.messages[0].content, /Diagnosen/);

    const custom = service({ models: { cheap_model: 'qwen3-8b', chat_model: 'kaputt modell!' } });
    assert.equal((await call(custom, ask('Trag Milch ein'))).body.model, 'qwen3-8b');
    assert.equal((await statusOf(custom)).models.chat_model, 'gpt-oss-120b');
  });

  test('schickt die letzten 12 Zuege, beginnend mit der Person', async () => {
    respond({ content: 'Ok.' });
    const ai = service();
    // 16 Zuege, der erste vom Assistenten, der letzte von der Person.
    const messages = Array.from({ length: 16 }, (_, index) => ({
      role: index % 2 === 0 ? 'assistant' : 'user',
      text: `Zug ${index + 1}`,
    }));
    const result = await call(ai, ask('', { messages }));
    assert.equal(result.status, 200);
    // Langer Verlauf in GetBetter: die Chat-Stufe.
    assert.equal(result.body.selected_model, 'chat_model');
    const sent = lastCall().body.messages;
    // Die letzten 12 beginnen mit dem Assistenten — der faellt weg: System + 11.
    assert.equal(sent.length, 12);
    assert.equal(sent[1].role, 'user');
    assert.equal(sent.at(-1).role, 'user');
    assert.deepEqual(
      sent.slice(1).map((message) => message.content),
      messages.slice(5).map((message) => message.text),
    );

    await call(
      ai,
      ask('', {
        messages: [
          { role: 'assistant', text: 'Wie kann ich helfen?' },
          { role: 'user', text: ' Erstens ' },
          { role: 'user', text: 'Zweitens' },
        ],
      }),
    );
    assert.deepEqual(lastCall().body.messages.slice(1), [
      { role: 'user', content: 'Erstens\n\nZweitens' },
    ]);
  });

  test('entfernt Denktext und reasoning_content', async () => {
    const ai = service();
    respond({
      body: completion('<think>Die Person will Milch.</think>\n\nHallo, ich bin da.', {
        reasoning_content: 'GEHEIMES DENKEN',
      }),
    });
    const result = await call(ai, ask('Hallo'));
    assert.equal(result.body.response, 'Hallo, ich bin da.');
    assert.equal(JSON.stringify(result).includes('GEHEIM'), false);

    respond({ content: 'Antwort.<think>unfertig' });
    assert.equal((await call(ai, ask('Hallo'))).body.response, 'Antwort.');

    respond({ body: completion([{ type: 'text', text: 'Teil eins. ' }, { type: 'text', text: 'Teil zwei.' }]) });
    assert.equal((await call(ai, ask('Hallo'))).body.response, 'Teil eins. Teil zwei.');

    respond({ content: '<think>nur gedacht</think>' });
    assert.deepEqual(await call(ai, ask('Hallo')), { status: 502, body: { error: 'upstream_failed' } });
  });

  test('haelt maxChars ein: am Satzende, sonst an der Wortgrenze', async () => {
    const ai = service();
    respond({ content: 'Das ist ein Satz mit etwas Inhalt. '.repeat(40) });
    const sentences = (await call(ai, ask('Trag Milch ein'))).body.response;
    assert.ok(sentences.length <= 600, String(sentences.length));
    assert.ok(sentences.length > 500);
    assert.ok(sentences.endsWith('Inhalt.'));

    respond({ content: 'wort '.repeat(300) });
    const words = (await call(ai, ask('Trag Milch ein'))).body.response;
    assert.ok(words.length <= 600);
    assert.ok(words.endsWith('wort…'));
  });

  test('mit Stimme: kuerzer, und voice_text ohne Markdown, Listen, Links, Emojis', async () => {
    const ai = service();
    respond({
      content: [
        '## Drei Tipps',
        '',
        '- **Früh** ins Bett 😴',
        '- Kein Handy, lies lieber [ein Buch](https://buch.example.ch)',
        '1. `Tee` trinken',
        '',
        'Viel Erfolg! 🎉 https://schlaf.example.ch',
      ].join('\n'),
    });
    const result = await call(ai, ask('Gib mir Tipps zum Schlafen', { voice: true }));
    assert.equal(result.status, 200);
    assert.equal(result.body.selected_model, 'chat_model');
    assert.equal(result.body.intent, 'coaching');
    assert.match(result.body.response, /\*\*Früh\*\*/);
    assert.equal(
      result.body.voice_text,
      'Drei Tipps. Früh ins Bett. Kein Handy, lies lieber ein Buch. Tee trinken. Viel Erfolg!',
    );
    const sent = lastCall().body;
    // Chat-Stufe (gpt-oss): 200 fuer die kurze Sprechantwort plus der Denkzuschlag.
    assert.equal(sent.max_tokens, 1224);
    assert.match(sent.messages[0].content, /laut vorgelesen/);
    assert.match(sent.messages[0].content, /höchstens 600 Zeichen/);

    respond({ content: 'Ein ruhiger Satz zum Vorlesen. '.repeat(40) });
    const long = await call(ai, ask('Trag Milch ein', { voice: true }));
    assert.ok(long.body.response.length <= 300);
    assert.ok(long.body.voice_text.length <= 300);
    assert.ok(long.body.voice_text.endsWith('.'));

    const written = await call(ai, ask('Trag Milch ein', { voice: false }));
    assert.equal('voice_text' in written.body, false);
  });

  test('ein Bild geht als data-URL an das Vision-Modell', async () => {
    respond({ content: 'Ein Pixel.' });
    const ai = service({ models: { vision_model: 'qwen3-vl-235b' } });
    const result = await call(ai, ask('Was ist das?', { imageUploadId: UPLOAD }));
    assert.deepEqual(result.body, {
      selected_model: 'vision_model',
      model: 'qwen3-vl-235b',
      intent: 'vision',
      response: 'Ein Pixel.',
      estimated_cost_level: 'medium',
    });
    const sent = lastCall().body;
    assert.equal(sent.model, 'qwen3-vl-235b');
    assert.equal(sent.max_tokens, 400);
    assert.deepEqual(sent.messages.at(-1), {
      role: 'user',
      content: [
        { type: 'text', text: 'Was ist das?' },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${PNG.toString('base64')}` } },
      ],
    });
  });

  test('Fehler des Anbieters werden zu eigenen Schluesseln und stehen im Status', async () => {
    const wrongKey = service({ readKey: () => 'falscher-schluessel-99' });
    assert.deepEqual(await call(wrongKey, ask('Hallo')), { status: 502, body: { error: 'auth_failed' } });
    assert.equal((await statusOf(wrongKey)).lastError, 'auth_failed');

    const ai = service();
    const cases = [
      [{ status: 403, body: { error: 'forbidden' } }, 502, 'auth_failed'],
      [{ status: 429, body: { error: 'slow down' } }, 429, 'rate_limited'],
      [{ status: 500, body: { error: 'boom' } }, 502, 'upstream_failed'],
      [{ status: 200, body: { nope: true } }, 502, 'upstream_failed'],
    ];
    for (const [plan, status, error] of cases) {
      respond(plan);
      assert.deepEqual(await call(ai, ask('Hallo')), { status, body: { error } }, error);
      assert.equal((await statusOf(ai)).lastError, error);
    }

    respond({ content: 'Wieder da.' });
    assert.equal((await call(ai, ask('Hallo'))).status, 200);
    assert.equal((await statusOf(ai)).lastError, null);
    // Eine kaputte Anfrage ist kein Fehler des Anbieters.
    await call(ai, {});
    assert.equal((await statusOf(ai)).lastError, null);
  });

  test('Zeitlimit: 504 timeout', async () => {
    respond({ content: 'zu spaet', delayMs: 400 });
    const ai = service({ timeouts: { standard: 60, reasoning: 60 } });
    assert.deepEqual(await call(ai, ask('Hallo')), { status: 504, body: { error: 'timeout' } });
    assert.equal((await statusOf(ai)).lastError, 'timeout');
    respond({});
  });

  test('nicht erreichbar: 502 unreachable', async () => {
    const closed = http.createServer();
    const closedBase = await listen(closed);
    await new Promise((resolve) => closed.close(resolve));
    const ai = service({ baseUrl: closedBase });
    assert.deepEqual(await call(ai, ask('Hallo')), { status: 502, body: { error: 'unreachable' } });
  });

  test('jeder Aufruf wird eine Zeile Verbrauch — ohne Texte, Schluessel oder Adresse', async () => {
    const usageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'better-ai-usage-'));
    try {
      const ai = service({ dataDir: usageDir });
      respond({ content: 'Gern.' });
      await call(ai, ask('Trag Milch ein'));
      respond({ status: 429, body: { error: 'slow down' } });
      await call(ai, ask('Trag Brot ein', { voice: true }));
      await call(ai, { accountId: ACCOUNT, app: 'bettergym', messages: [] });
      await call(service({ dataDir: usageDir, readKey: () => null }), ask('Trag Käse ein'));

      const rows = await readUsage(usageDir);
      assert.equal(rows.length, 4);
      const [ok, limited, bad, unconfigured] = rows;
      assert.deepEqual(
        { ...ok, at: undefined, durationMs: undefined },
        {
          at: undefined,
          accountId: ACCOUNT,
          app: 'getbetter',
          tier: 'cheap_model',
          model: 'gemma4-31b',
          intent: 'command',
          voice: false,
          ok: true,
          error: null,
          promptTokens: 1000,
          completionTokens: 500,
          costChf: 0.000323,
          durationMs: undefined,
        },
      );
      assert.match(ok.at, /^\d{4}-\d{2}-\d{2}T/);
      assert.ok(Number.isInteger(ok.durationMs));
      assert.deepEqual(
        [limited.ok, limited.error, limited.voice, limited.tier, limited.promptTokens, limited.costChf],
        [false, 'rate_limited', true, 'cheap_model', null, null],
      );
      assert.deepEqual(
        [bad.error, bad.app, bad.accountId, bad.tier, bad.model],
        ['bad_request', 'bettergym', ACCOUNT, null, null],
      );
      assert.deepEqual([unconfigured.error, unconfigured.tier], ['not_configured', null]);

      const raw = await fs.readFile(path.join(usageDir, USAGE_FILE), 'utf8');
      for (const secret of [KEY, 'Milch', 'Brot', 'Käse', '127.0.0.1', 'Gern']) {
        assert.equal(raw.includes(secret), false, secret);
      }

      const failing = service({
        record: () => {
          throw new Error('Platte voll');
        },
      });
      respond({ content: 'Trotzdem.' });
      assert.equal((await call(failing, ask('Hallo'))).body.response, 'Trotzdem.');
    } finally {
      await fs.rm(usageDir, { recursive: true, force: true });
    }
  });

  describe('Kontingent', () => {
    /** Ein eigener Datenordner, in dem das Konto diesen Monat schon `spentChf` verbraucht hat. */
    const withSpent = async (accountId, app, spentChf) => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'better-ai-budget-'));
      const line = { at: new Date().toISOString(), accountId, app, tier: 'cheap_model', model: 'gemma4-31b', ok: true, costChf: spentChf };
      await fs.writeFile(path.join(dir, USAGE_FILE), `${JSON.stringify(line)}\n`);
      return dir;
    };
    const dirs = [];
    const budgeted = async (accountId, app, spentChf, options = {}) => {
      const dir = await withSpent(accountId, app, spentChf);
      dirs.push(dir);
      return service({ dataDir: dir, ...options });
    };
    after(() => Promise.all(dirs.map((dir) => fs.rm(dir, { recursive: true, force: true }))));

    test('ohne Abo: immer die guenstige Stufe, und ein Bild braucht das Abo', async () => {
      respond({ content: 'Gern.' });
      const ai = service();
      const chat = await call(ai, ask('Erzähl mir etwas über Rom', { accountId: TRIAL, app: 'betterai' }));
      assert.deepEqual([chat.status, chat.body.selected_model, chat.body.model], [200, 'cheap_model', 'gemma4-31b']);
      assert.equal(lastCall().body.model, 'gemma4-31b');
      assert.equal(lastCall().body.max_tokens, 200);
      assert.match(lastCall().body.messages[0].content, /höchstens 600 Zeichen/);

      const plan = await call(ai, ask('Erstelle mir einen Trainingsplan', { accountId: TRIAL, app: 'bettergym' }));
      assert.deepEqual([plan.body.selected_model, plan.body.estimated_cost_level], ['cheap_model', 'low']);
      assert.equal(plan.body.intent, 'planning');

      const before = fake.calls.length;
      const image = await call(ai, ask('Was ist das?', { accountId: TRIAL, app: 'betterai', imageUploadId: UPLOAD }));
      assert.equal(image.status, 403);
      assert.deepEqual(Object.keys(image.body).sort(), ['error', 'plan', 'priceChf', 'resetsOn']);
      assert.deepEqual([image.body.error, image.body.plan, image.body.priceChf], ['plan_required', 'trial', 8]);
      assert.equal(fake.calls.length, before);
    });

    test('aufgebraucht: 402 budget_exhausted, ohne Safe Swiss Cloud zu fragen', async () => {
      respond({ content: 'Nie.' });
      const trial = await budgeted(TRIAL, 'betterai', 0.1);
      const paid = await budgeted(ACCOUNT, 'getbetter', 0.59);
      const before = fake.calls.length;
      const resetsOn = resetsOnOf(zurichMonthOf(Date.now()));

      const refused = await call(trial, ask('Hallo', { accountId: TRIAL, app: 'betterai' }));
      assert.deepEqual(refused, {
        status: 402,
        body: { error: 'budget_exhausted', plan: 'trial', resetsOn, priceChf: 8 },
      });
      const paidRefused = await call(paid, ask('Hallo', { app: 'getbetter' }));
      assert.deepEqual(paidRefused.body, { error: 'budget_exhausted', plan: 'paid', resetsOn, priceChf: 1 });
      // Eine andere App hat ihr eigenes Budget.
      assert.equal((await call(trial, ask('Hallo', { accountId: TRIAL, app: 'getbetter' }))).status, 200);
      assert.equal(fake.calls.length, before + 1);

      assert.deepEqual((await trial.budget({ accountId: TRIAL, app: 'betterai' })).body, {
        plan: 'trial',
        budgetChf: 0.1,
        spentChf: 0.1,
        remainingShare: 0,
        resetsOn,
        priceChf: 8,
      });
      const fresh = (await trial.budget({ accountId: ACCOUNT, app: 'betterai' })).body;
      assert.deepEqual([fresh.plan, fresh.budgetChf, fresh.spentChf, fresh.remainingShare], ['paid', 4.717853, 0, 1]);
      assert.equal((await trial.budget({ accountId: 'acc fremd!', app: 'betterai' })).status, 400);
      assert.equal((await trial.budget({ accountId: ACCOUNT, app: 'betterx' })).status, 400);
      assert.equal((await trial.budget({ accountId: 'acc_unbekannt', app: 'betterai' })).status, 404);
    });

    /** Wie viele Eingabe-Tokens diese Frage im Dienst hat — einmal echt geschickt und gezaehlt. */
    const promptOf = async (text, app) => {
      respond({ content: 'Gern.' });
      await call(service(), ask(text, { accountId: TRIAL, app }));
      return estimatePromptTokens(lastCall().body.messages);
    };
    const price = PRICES['gemma4-31b'];
    const chfOf = (promptTokens, outputTokens) => (promptTokens * price.input + outputTokens * price.output) / 1e6;

    test('max_tokens wird so klein, dass der schlimmste Fall ins Restbudget passt', async () => {
      const prompt = await promptOf('Trag Milch ein', 'getbetter');
      const remaining = chfOf(prompt, 175);
      const ai = await budgeted(TRIAL, 'getbetter', 0.1 - remaining);
      respond({ content: 'Gern.' });
      const result = await call(ai, ask('Trag Milch ein', { accountId: TRIAL }));
      assert.equal(result.status, 200);
      const sent = lastCall().body.max_tokens;
      assert.ok(sent < 200 && sent >= MIN_ANSWER_TOKENS, String(sent));
      const expected = affordableTokens({ model: 'gemma4-31b', promptTokens: prompt, remainingChf: remaining });
      // Das Restbudget entsteht im Dienst als Differenz — eine Rundung kann ein Token kosten.
      assert.ok(Math.abs(sent - expected) <= 1, `${sent} statt ${expected}`);
      assert.ok(chfOf(prompt, sent) <= remaining + 1e-9);

      // Reicht es nicht einmal fuer eine kurze Antwort, fragt er gar nicht erst.
      const tight = await budgeted(TRIAL, 'getbetter', 0.1 - chfOf(prompt, MIN_ANSWER_TOKENS - 20));
      const before = fake.calls.length;
      assert.equal((await call(tight, ask('Trag Milch ein', { accountId: TRIAL }))).status, 402);
      assert.equal(fake.calls.length, before);
    });

    test('parallele Anfragen reservieren und ueberschreiten das Budget nicht', async () => {
      const prompt = await promptOf('Trag Milch ein', 'getbetter');
      const worst = chfOf(prompt, 200);
      const ai = await budgeted(TRIAL, 'getbetter', 0.1 - 2.5 * worst);
      respond({ content: 'Gern.', delayMs: 150 });
      const before = fake.calls.length;
      const results = await Promise.all(
        Array.from({ length: 4 }, () => call(ai, ask('Trag Milch ein', { accountId: TRIAL }))),
      );
      assert.deepEqual(results.map((result) => result.status).sort(), [200, 200, 402, 402]);
      assert.equal(fake.calls.length, before + 2);
      respond({});
    });
  });

  test('der Schluessel steht in keiner einzigen Antwort', () => {
    assert.ok(seen.length > 40);
    for (const text of seen) assert.equal(text.includes(KEY), false);
  });
});
