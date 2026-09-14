/**
 * Der Admin von aussen: Host- und Origin-Pruefung, statische Dateien und jede
 * Route mit ihren Fehlern. Datenordner und Seite liegen im Temp-Verzeichnis —
 * services/api/data und admin/public bleiben unberuehrt.
 */
const assert = require('node:assert/strict');
const { once } = require('node:events');
const fsSync = require('node:fs');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { after, before, describe, test } = require('node:test');

// Vor dem ersten require des Speichers: er liest den Datenordner beim Laden.
const DATA_DIR = fsSync.mkdtempSync(path.join(os.tmpdir(), 'better-admin-'));
process.env.BETTER_DATA_DIR = DATA_DIR;
process.env.BETTER_AI_MONTHLY_MINIMUM_CHF = '';

const { hashPassword, matches } = require('../auth.js');
const { PRICES } = require('../ai/usage.js');
const { forgetDeleted, load, withoutDeleted } = require('../store.js');
const { viewTickets } = require('../viewTickets.js');
const { CONTENT_SECURITY_POLICY, startAdminServer } = require('./server.js');

// Preise und Anteile aus der Umgebung des Rechners duerfen die Zahlen nicht verbiegen.
for (const name of Object.keys(process.env)) {
  if (/^BETTER_(PRICE_\w+_CHF|VAT|STORE_FEE|USER_SHARE|TRIAL_BUDGET_CHF|SPEECH_USD_PER_1K_CHARS|USD_CHF|SPEECH_MONTHLY_FIXED_USD)$/.test(name)) {
    delete process.env[name];
  }
}

const NOW = Date.now();
const SECOND = 1000;
const HOUR = 60 * 60 * SECOND;
const DAY = 24 * HOUR;
const ago = (ms) => new Date(NOW - ms).toISOString();
const PASSWORD = 'altes-passwort';
const NEW_PASSWORD = 'neues-passwort-123';
const CURRENT_MONTH = new Date(NOW).toISOString().slice(0, 7);

const usageLine = (overrides) => ({
  accountId: 'acc_anna',
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
  durationMs: 800,
  ...overrides,
});

const speechLine = (overrides) => ({
  accountId: 'acc_anna',
  app: 'getbetter',
  purpose: 'speech',
  model: 'eleven_multilingual_v2',
  voiceId: 'VoiceGerman001',
  characters: 40,
  credits: 40,
  cached: false,
  ok: true,
  error: null,
  ...overrides,
});

const CACHE_IDS = {
  often: '1'.repeat(32),
  once: '2'.repeat(32),
  sample: '3'.repeat(32),
};

const ZERO_SPEECH = {
  requests: 0,
  errors: 0,
  cached: 0,
  characters: 0,
  credits: 0,
  savedCredits: 0,
  samples: 0,
  sampleCredits: 0,
};

const USAGE = {
  anna: {
    last30: {
      ai: { requests: 2, promptTokens: 1000, completionTokens: 500, tokens: 1500, costChf: 0.000323 },
      speech: { ...ZERO_SPEECH, requests: 2, cached: 1, characters: 40, credits: 40, savedCredits: 40 },
    },
    total: {
      ai: { requests: 3, promptTokens: 1010, completionTokens: 510, tokens: 1520, costChf: 0.500323 },
      speech: { ...ZERO_SPEECH, requests: 3, cached: 1, characters: 140, credits: 140, savedCredits: 40 },
    },
  },
  ben: {
    last30: {
      ai: { requests: 1, promptTokens: 2000, completionTokens: 1000, tokens: 3000, costChf: 0.001 },
      speech: { ...ZERO_SPEECH, requests: 1, characters: 21, credits: 21, samples: 1, sampleCredits: 21 },
    },
    total: {
      ai: { requests: 1, promptTokens: 2000, completionTokens: 1000, tokens: 3000, costChf: 0.001 },
      speech: { ...ZERO_SPEECH, requests: 1, characters: 21, credits: 21, samples: 1, sampleCredits: 21 },
    },
  },
  cleo: {
    last30: {
      ai: { requests: 0, promptTokens: 0, completionTokens: 0, tokens: 0, costChf: 0 },
      speech: ZERO_SPEECH,
    },
    total: {
      ai: { requests: 0, promptTokens: 0, completionTokens: 0, tokens: 0, costChf: 0 },
      speech: ZERO_SPEECH,
    },
  },
};

async function seed() {
  const account = async (fields) => {
    const salt = `salz-${fields.id}`;
    return {
      firstName: '',
      language: 'de',
      onboarded: false,
      selectedAreas: [],
      householdId: null,
      passwordSalt: salt,
      passwordHash: await hashPassword(PASSWORD, salt),
      ...fields,
    };
  };
  const tables = {
    accounts: [
      await account({
        id: 'acc_anna',
        email: 'anna@test.ch',
        username: 'anna',
        firstName: 'Anna',
        onboarded: true,
        householdId: 'h1',
        themeMode: 'dark',
        accentKey: 'blue',
        themePreset: 'clean',
        assistantName: 'Luma',
        paidApps: ['getbetter'],
        createdAt: ago(2 * DAY),
      }),
      await account({
        id: 'acc_ben',
        email: 'ben@test.ch',
        username: 'ben',
        language: 'fr',
        disabled: true,
        blockedApps: ['bettergym'],
        createdAt: ago(40 * DAY),
      }),
      await account({
        id: 'acc_cleo',
        email: 'cleo@test.ch',
        username: 'cleo',
        language: 'it',
        createdAt: ago(100 * DAY),
      }),
    ],
    appAccess: [
      { id: 'aa1', accountId: 'acc_anna', appId: 'getbetter', firstSeenAt: ago(2 * DAY), lastSeenAt: ago(HOUR) },
      { id: 'aa2', accountId: 'acc_anna', appId: 'bettergym', firstSeenAt: ago(2 * DAY), lastSeenAt: ago(10 * DAY) },
      { id: 'aa3', accountId: 'acc_ben', appId: 'getbetter', firstSeenAt: ago(40 * DAY), lastSeenAt: ago(20 * DAY) },
      // Ein geloeschtes Konto zaehlt nirgends mit.
      { id: 'aa4', accountId: 'acc_weg', appId: 'betterai', firstSeenAt: ago(DAY), lastSeenAt: ago(DAY) },
    ],
    events: [
      { id: 'e1', accountId: 'acc_anna', calendar: 'personal', householdId: null, title: 'Zahnarzt' },
      { id: 'e2', accountId: 'acc_anna', calendar: 'family', householdId: 'h1', title: 'Grillfest' },
      { id: 'e3', accountId: 'acc_ben', calendar: 'personal', householdId: null, title: 'Kino' },
    ],
    tasks: [
      { id: 't1', accountId: 'acc_anna', title: 'Einkaufen' },
      { id: 't2', accountId: 'acc_anna', title: 'Putzen' },
    ],
    contacts: [
      { id: 'c1', accountId: 'acc_anna', name: 'Max', birthday: '1990-05-01' },
      { id: 'c2', accountId: 'acc_anna', name: 'Eva', birthday: null },
    ],
    chores: [{ id: 'ch1', householdId: 'h1', title: 'Abwaschen', assignedTo: 'acc_anna' }],
    notes: [{ id: 'n1', accountId: 'acc_ben', title: 'Geheim', body: 'Geheime Notiz' }],
  };
  await fs.writeFile(path.join(DATA_DIR, 'db.json'), JSON.stringify({ revision: 3, tables }));
  await fs.mkdir(path.join(DATA_DIR, 'uploads'), { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, 'uploads', 'upl_x.png'), Buffer.alloc(10));

  const usage = [
    usageLine({ at: ago(3 * SECOND) }),
    usageLine({
      at: ago(2 * SECOND),
      app: 'betterai',
      tier: 'chat_model',
      model: 'gpt-oss-120b',
      intent: 'conversation',
      voice: true,
      ok: false,
      error: 'timeout',
      promptTokens: null,
      completionTokens: null,
      costChf: null,
      durationMs: 30000,
    }),
    usageLine({
      at: ago(SECOND),
      accountId: 'acc_ben',
      app: 'bettergym',
      tier: 'reasoning_model',
      model: 'deepseek-v4-flash',
      intent: 'planning',
      promptTokens: 2000,
      completionTokens: 1000,
      costChf: 0.001,
    }),
    usageLine({ at: '2025-01-15T10:00:00.000Z', promptTokens: 10, completionTokens: 10, costChf: 0.5 }),
  ];
  await fs.writeFile(
    path.join(DATA_DIR, 'ai-usage.jsonl'),
    `${usage.map((line) => JSON.stringify(line)).join('\n')}\n`,
  );
  const speech = [
    speechLine({ at: ago(3 * SECOND) }),
    speechLine({ at: ago(2 * SECOND), cached: true, credits: 0 }),
    speechLine({
      at: ago(SECOND),
      accountId: 'acc_ben',
      app: 'bettergym',
      purpose: 'sample',
      characters: 21,
      credits: 21,
    }),
    speechLine({ at: ago(40 * DAY), characters: 100, credits: 100 }),
    speechLine({ at: ago(SECOND), accountId: null, app: null, characters: 12, credits: 12 }),
  ];
  await fs.writeFile(
    path.join(DATA_DIR, 'speech-usage.jsonl'),
    `${speech.map((line) => JSON.stringify(line)).join('\n')}\n`,
  );
  const cacheDir = path.join(DATA_DIR, 'speech-cache');
  await fs.mkdir(path.join(cacheDir, 'samples'), { recursive: true });
  await fs.writeFile(path.join(cacheDir, `${CACHE_IDS.often}.mp3`), Buffer.alloc(100));
  await fs.writeFile(path.join(cacheDir, `${CACHE_IDS.once}.mp3`), Buffer.alloc(50));
  await fs.writeFile(path.join(cacheDir, 'samples', `${CACHE_IDS.sample}.mp3`), Buffer.alloc(30));
  await fs.writeFile(
    path.join(cacheDir, 'index.json'),
    JSON.stringify({
      version: 1,
      entries: {
        [CACHE_IDS.often]: { hits: 7, lastPlayedAt: ago(HOUR), characters: 24, bytes: 100, purpose: 'speech' },
        [CACHE_IDS.once]: { hits: 0, lastPlayedAt: ago(DAY), characters: 80, bytes: 50, purpose: 'speech' },
        [CACHE_IDS.sample]: { hits: 4, lastPlayedAt: ago(2 * HOUR), characters: 21, bytes: 30, purpose: 'sample' },
      },
    }),
  );
  const activity = [
    JSON.stringify({ at: ago(5 * SECOND), accountId: 'acc_anna', kind: 'session.created', detail: {} }),
    '{kaputt',
    JSON.stringify({ at: ago(4 * SECOND), accountId: 'acc_ben', kind: 'session.blocked', detail: {} }),
  ];
  await fs.writeFile(path.join(DATA_DIR, 'activity.jsonl'), `${activity.join('\n')}\n`);
}

describe('admin server', () => {
  let server;
  let port;
  let publicDir;
  let configured = false;
  const removedMailboxes = [];

  /** Wie der Mail-Dienst: Postfach und seine Nachrichten weg. Tresor und Cache gibt es hier nicht. */
  const fakeMail = {
    removeAccount: async (id) => {
      removedMailboxes.push(id);
      const db = await load();
      db.tables.mailAccounts = db.tables.mailAccounts.filter((row) => row.id !== id);
      db.tables.mailMessages = db.tables.mailMessages.filter((row) => row.mailAccountId !== id);
      return { status: 200, body: { ok: true } };
    },
  };

  /** Rohes HTTP, damit Host und Origin genau so ankommen, wie der Test sie setzt. */
  const request = (method, route, { body, headers = {}, to = port } = {}) =>
    new Promise((resolve, reject) => {
      const text = body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body);
      const req = http.request(
        {
          host: '127.0.0.1',
          port: to,
          method,
          path: route,
          agent: false,
          headers: {
            Host: `127.0.0.1:${to}`,
            ...(text === undefined ? {} : { 'Content-Length': Buffer.byteLength(text) }),
            ...headers,
          },
        },
        (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            const isJson = String(res.headers['content-type'] ?? '').includes('json');
            resolve({ status: res.statusCode, headers: res.headers, data: isJson ? JSON.parse(raw) : raw });
          });
        },
      );
      req.on('error', reject);
      if (text !== undefined) req.write(text);
      req.end();
    });
  const get = (route, headers) => request('GET', route, { headers });
  const send = (method, route, body, headers = {}) =>
    request(method, route, {
      body,
      headers: { Origin: `http://127.0.0.1:${port}`, 'Content-Type': 'application/json', ...headers },
    });
  const activityLines = async () =>
    (await fs.readFile(path.join(DATA_DIR, 'activity.jsonl'), 'utf8'))
      .trim()
      .split('\n')
      .flatMap((line) => {
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      });

  before(async () => {
    await seed();
    publicDir = await fs.mkdtemp(path.join(os.tmpdir(), 'better-admin-public-'));
    await fs.writeFile(path.join(publicDir, 'index.html'), '<title>Admin</title>');
    await fs.writeFile(path.join(publicDir, 'app.js'), 'void 0;');
    await fs.writeFile(path.join(publicDir, 'app.css'), 'body{}');
    await fs.writeFile(path.join(publicDir, 'chart-view.js'), 'export const x = 1;');
    await fs.writeFile(path.join(publicDir, 'notes.txt'), 'nicht ausliefern');
    await fs.mkdir(path.join(publicDir, 'sub'));
    await fs.writeFile(path.join(publicDir, 'sub', 'app.js'), 'void 1;');
    server = startAdminServer({
      port: 0,
      dataDir: DATA_DIR,
      aiStatus: async () => ({ status: 200, body: { configured } }),
      speechStatus: async () => ({ status: 200, body: { configured: true } }),
      mail: fakeMail,
      publicDir,
      log: () => {},
    });
    await once(server, 'listening');
    port = server.address().port;
  });

  after(async () => {
    server?.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(publicDir, { recursive: true, force: true });
    await fs.rm(DATA_DIR, { recursive: true, force: true });
  });

  describe('security', () => {
    test('listens on 127.0.0.1 only and refuses foreign Host headers', async () => {
      assert.equal(server.address().address, '127.0.0.1');
      for (const host of ['evil.example', `evil.example:${port}`, `127.0.0.1:${port + 1}`, `[::1]:${port}`]) {
        const refused = await get('/api/overview', { Host: host });
        assert.deepEqual([refused.status, refused.data], [403, { error: 'forbidden' }], host);
      }
      const local = await get('/api/overview', { Host: `localhost:${port}` });
      assert.equal(local.status, 200);
      assert.equal(local.headers['access-control-allow-origin'], undefined);
      assert.equal(local.headers['cache-control'], 'no-store');
      assert.equal(local.headers['x-content-type-options'], 'nosniff');
      assert.equal(local.headers['referrer-policy'], 'no-referrer');
      assert.equal(local.headers['x-frame-options'], 'DENY');
    });

    test('refuses writes without our Origin or without a JSON content type', async () => {
      const body = { firstName: 'Mallory' };
      const attempts = [
        { 'Content-Type': 'application/json' },
        { Origin: 'http://evil.example', 'Content-Type': 'application/json' },
        { Origin: `http://127.0.0.1:${port + 1}`, 'Content-Type': 'application/json' },
        { Origin: 'null', 'Content-Type': 'application/json' },
        { Origin: `http://localhost:${port}`, 'Content-Type': 'text/plain' },
        { Origin: `http://127.0.0.1:${port}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        { Origin: `http://127.0.0.1:${port}` },
      ];
      for (const headers of attempts) {
        const result = await request('PATCH', '/api/accounts/acc_cleo', { body, headers });
        assert.deepEqual([result.status, result.data], [403, { error: 'forbidden' }], JSON.stringify(headers));
      }
      const password = await request('POST', '/api/accounts/acc_cleo/password', {
        body: { password: NEW_PASSWORD },
        headers: { 'Content-Type': 'application/json' },
      });
      assert.equal(password.status, 403);
      const cleo = (await load()).tables.accounts.find((row) => row.id === 'acc_cleo');
      assert.equal(cleo.firstName, '');

      const fromLocalhost = await send('PATCH', '/api/accounts/acc_cleo', {}, {
        Origin: `http://localhost:${port}`,
        'Content-Type': 'application/json; charset=utf-8',
      });
      assert.equal(fromLocalhost.status, 200);
    });

    test('serves index and plain .js/.css files of public/, all with CSP and security headers', async () => {
      assert.match(CONTENT_SECURITY_POLICY, /default-src 'self'/);
      assert.match(CONTENT_SECURITY_POLICY, /frame-ancestors 'none'/);
      // „App ansehen“ darf genau die fuenf Apps einbetten, sonst nichts.
      assert.match(
        CONTENT_SECURITY_POLICY,
        /(^|; )frame-src http:\/\/localhost:8081 http:\/\/localhost:8082 http:\/\/localhost:8083 http:\/\/localhost:8084 http:\/\/localhost:8085(;|$)/,
      );
      const served = [
        ['/', 'text/html; charset=utf-8', '<title>Admin</title>'],
        ['/app.js', 'text/javascript; charset=utf-8', 'void 0;'],
        ['/chart-view.js', 'text/javascript; charset=utf-8', 'export const x = 1;'],
        ['/app.css', 'text/css; charset=utf-8', 'body{}'],
      ];
      for (const [route, type, body] of served) {
        const file = await get(route);
        assert.deepEqual([file.status, file.headers['content-type'], file.data], [200, type, body], route);
        assert.equal(file.headers['content-security-policy'], CONTENT_SECURITY_POLICY, route);
        assert.equal(file.headers['x-frame-options'], 'DENY', route);
        assert.equal(file.headers['cache-control'], 'no-store', route);
        assert.equal(file.headers['x-content-type-options'], 'nosniff', route);
        assert.equal(file.headers['referrer-policy'], 'no-referrer', route);
      }

      for (const route of [
        '/../server.js',
        '/%2e%2e/server.js',
        '/%2E%2E%2Fserver.js',
        '/..%5cserver.js',
        '/%2e%2e%2fserver.js',
        '/sub/app.js',
        '/APP.JS',
        '/index.html',
        '/app.js/',
        '/public/app.js',
        '/server.js',
        '/catalog.js',
        '/fehlt.js',
        '/notes.txt',
        '/app.mjs',
        '/app.js.map',
        '/.hidden.js',
        '/-app.js',
        '/app_view.js',
      ]) {
        const refused = await get(route);
        assert.deepEqual([refused.status, refused.data], [404, { error: 'unknown_route' }], route);
      }
      assert.equal((await request('POST', '/', { headers: { Origin: `http://127.0.0.1:${port}`, 'Content-Type': 'application/json' }, body: {} })).status, 404);
    });

    test('answers 503 while the page files are missing', async () => {
      const bare = startAdminServer({
        port: 0,
        dataDir: DATA_DIR,
        aiStatus: async () => ({ body: { configured: false } }),
        publicDir: path.join(publicDir, 'fehlt'),
        log: () => {},
      });
      await once(bare, 'listening');
      try {
        const page = await request('GET', '/', { to: bare.address().port });
        assert.equal(page.status, 503);
        assert.equal(page.headers['content-type'], 'text/plain; charset=utf-8');
        assert.equal(page.headers['content-security-policy'], CONTENT_SECURITY_POLICY);
        const script = await request('GET', '/app.js', { to: bare.address().port });
        assert.deepEqual([script.status, script.data], [404, { error: 'unknown_route' }]);
      } finally {
        bare.closeAllConnections();
        await new Promise((resolve) => bare.close(resolve));
      }
    });
  });

  describe('reading', () => {
    test('GET /api/overview', async () => {
      const { status, data } = await get('/api/overview');
      assert.equal(status, 200);
      assert.ok(Math.abs(new Date(data.generatedAt).getTime() - Date.now()) < 60 * SECOND);
      assert.deepEqual(data.accounts, { total: 3, active7: 1, active30: 2, newThisWeek: 1, disabled: 1 });
      assert.deepEqual(data.apps, [
        { id: 'getbetter', name: 'GetBetter', users: 2, active7: 1, blockedCount: 0 },
        { id: 'betterfamily', name: 'BetterFamily', users: 0, active7: 0, blockedCount: 0 },
        { id: 'bettergym', name: 'BetterGym', users: 1, active7: 0, blockedCount: 1 },
        { id: 'betterai', name: 'BetterAi', users: 0, active7: 0, blockedCount: 0 },
        { id: 'bettermoney', name: 'BetterMoney', users: 0, active7: 0, blockedCount: 0 },
      ]);
      const module = (app, id) => data.modules.find((entry) => entry.app === app && entry.id === id);
      assert.deepEqual(module('getbetter', 'calendar'), {
        app: 'getbetter',
        id: 'calendar',
        name: 'Termine',
        collection: 'events',
        items: 2,
      });
      assert.equal(module('betterfamily', 'calendar').items, 1);
      assert.equal(module('getbetter', 'birthdays').items, 1);
      assert.equal(module('getbetter', 'contacts').items, 2);
      assert.equal(module('betterfamily', 'chores').items, 1);
      assert.deepEqual([module('getbetter', 'weather').collection, module('getbetter', 'weather').items], [null, 0]);
      assert.equal(data.modules.length, 30);

      const { ai } = data;
      assert.equal(ai.configured, false);
      assert.equal(ai.requests30, 3);
      assert.equal(ai.costChf30, 0.001323);
      assert.equal(ai.costChfMonth, 0.001323);
      assert.equal(ai.cheapShare30, 1 / 3);
      assert.equal(ai.monthlyMinimumChf, 95);
      assert.equal(ai.byDay.length, 30);
      assert.equal(ai.byDay.at(-1).day, new Date().toISOString().slice(0, 10));
      assert.equal(ai.byDay.reduce((total, day) => total + day.requests, 0), 3);
      assert.ok(ai.byDay.every((day) => /^\d{4}-\d{2}-\d{2}$/.test(day.day)));

      assert.deepEqual(data.speech, {
        configured: true,
        requests30: 4,
        cached30: 1,
        credits30: 73,
        savedCredits30: 40,
        creditsMonth: 73,
        charactersMonth: 73,
        sampleCreditsMonth: 21,
        monthlyCredits: 10000,
        cache: {
          entries: 3,
          samples: 1,
          bytes: 180,
          replays: 11,
          maxFiles: 2000,
          maxBytes: 200 * 1024 * 1024,
          top: [
            { purpose: 'speech', characters: 24, hits: 7, bytes: 100, lastPlayedAt: ago(HOUR) },
            { purpose: 'sample', characters: 21, hits: 4, bytes: 30, lastPlayedAt: ago(2 * HOUR) },
          ],
        },
      });
      // Nie eine Id eines Satzes — daraus liesse sich ein kurzer Satz erraten.
      assert.equal(JSON.stringify(data).includes(CACHE_IDS.often), false);
      process.env.BETTER_SPEECH_MONTHLY_CREDITS = '500';
      try {
        assert.equal((await get('/api/overview')).data.speech.monthlyCredits, 500);
        process.env.BETTER_SPEECH_MONTHLY_CREDITS = 'viel';
        assert.equal((await get('/api/overview')).data.speech.monthlyCredits, 10000);
      } finally {
        delete process.env.BETTER_SPEECH_MONTHLY_CREDITS;
      }

      // Marge diesen Monat: Anna zahlt fuer GetBetter (1.–), Ben hat kein Abo.
      const margin = (app) => data.margin.byApp.find((entry) => entry.app === app);
      assert.deepEqual(
        [margin('getbetter').paidAccounts, margin('getbetter').netRevenueChf, margin('getbetter').paidCostChf, margin('getbetter').trialCostChf],
        [1, 0.786309, 0.004003, 0],
      );
      assert.equal(margin('getbetter').marginChf, 0.782306);
      assert.deepEqual([margin('bettergym').paidAccounts, margin('bettergym').trialCostChf, margin('bettergym').marginChf], [0, 0.002932, -0.002932]);
      assert.deepEqual([data.margin.totals.unassignedChf, data.margin.totals.aiMinimumChf, data.margin.totals.aiBillableChf], [0.001104, 95, 95]);

      assert.ok(data.storage.dbBytes > 0);
      assert.equal(data.storage.uploadsBytes, 10);
    });

    test('GET /api/accounts without secrets', async () => {
      const { status, data } = await get('/api/accounts');
      assert.equal(status, 200);
      assert.equal(JSON.stringify(data).includes('password'), false);
      assert.deepEqual(data.accounts.map((row) => row.id), ['acc_anna', 'acc_ben', 'acc_cleo']);
      const [anna, ben, cleo] = data.accounts;
      assert.deepEqual(Object.keys(anna).sort(), [
        'apps',
        'blockedApps',
        'costChfMonth',
        'createdAt',
        'disabled',
        'email',
        'firstName',
        'id',
        'items',
        'language',
        'lastSeenAt',
        'paidApps',
        'usage',
        'username',
      ]);
      assert.deepEqual([anna.paidApps, ben.paidApps, cleo.paidApps], [['getbetter'], [], []]);
      assert.deepEqual(anna.usage, USAGE.anna);
      assert.deepEqual(ben.usage, USAGE.ben);
      assert.deepEqual(cleo.usage, USAGE.cleo);
      assert.equal(anna.lastSeenAt, ago(HOUR));
      assert.deepEqual(anna.apps, [
        { id: 'getbetter', firstSeenAt: ago(2 * DAY), lastSeenAt: ago(HOUR) },
        { id: 'bettergym', firstSeenAt: ago(2 * DAY), lastSeenAt: ago(10 * DAY) },
      ]);
      // Termine 2, Aufgaben 2, Kontakte 2, ein zugeteiltes Aemtli.
      assert.equal(anna.items, 7);
      assert.equal(anna.costChfMonth, 0.000323);
      assert.deepEqual([anna.disabled, anna.blockedApps], [false, []]);
      assert.deepEqual([ben.disabled, ben.blockedApps, ben.items, ben.costChfMonth], [true, ['bettergym'], 2, 0.001]);
      assert.deepEqual([cleo.lastSeenAt, cleo.apps, cleo.items, cleo.costChfMonth], [null, [], 0, 0]);
    });

    test('GET /api/accounts/:id with counts, activity and AI', async () => {
      const { status, data } = await get('/api/accounts/acc_anna');
      assert.equal(status, 200);
      assert.equal(JSON.stringify(data).includes('password'), false);
      const { account, counts, activity, ai } = data;
      assert.deepEqual(
        [account.themeMode, account.accentKey, account.themePreset, account.assistantName],
        ['dark', 'blue', 'clean', 'Luma'],
      );
      assert.deepEqual([account.onboarded, account.householdId, account.email], [true, 'h1', 'anna@test.ch']);
      assert.deepEqual(account.usage, USAGE.anna);
      // Kontingent diesen Monat: KI 0.000323 und 40 Credits (40 × 0.10 / 1000 × 0.92 = 0.00368).
      const billing = (app) => account.billing.find((entry) => entry.app === app);
      assert.deepEqual(
        [billing('getbetter').plan, billing('getbetter').budgetChf, billing('getbetter').spentChf, billing('getbetter').priceChf],
        ['paid', 0.589731, 0.004003, 1],
      );
      assert.deepEqual([billing('betterai').plan, billing('betterai').budgetChf, billing('betterai').spentChf], ['trial', 0.1, 0]);
      assert.deepEqual([billing('bettermoney').plan, billing('bettermoney').priceChf], ['trial', null]);
      assert.match(billing('getbetter').resetsOn, /^\d{4}-\d{2}-01$/);

      const count = (app, module) => counts.find((entry) => entry.app === app && entry.module === module);
      assert.deepEqual(count('getbetter', 'calendar'), {
        app: 'getbetter',
        module: 'calendar',
        name: 'Termine',
        collection: 'events',
        items: 1,
      });
      assert.equal(count('betterfamily', 'calendar').items, 1);
      assert.equal(count('getbetter', 'birthdays').items, 1);
      assert.equal(count('betterfamily', 'chores').items, 1);
      assert.equal(count('getbetter', 'notes').items, 0);

      assert.deepEqual(
        activity.map((entry) => entry.kind),
        ['ai.reply', 'ai.reply', 'session.created', 'ai.reply'],
      );
      assert.ok(activity.every((entry) => entry.accountId === 'acc_anna' && entry.email === 'anna@test.ch'));
      assert.deepEqual(activity[0].detail, {
        app: 'betterai',
        tier: 'chat_model',
        model: 'gpt-oss-120b',
        costChf: null,
        ok: false,
        error: 'timeout',
      });

      assert.deepEqual(ai.totals, { requests: 3, costChf: 0.500323, promptTokens: 1010, completionTokens: 510 });
      assert.deepEqual(ai.byApp.find((entry) => entry.app === 'getbetter'), { app: 'getbetter', requests: 2, costChf: 0.500323 });
      assert.deepEqual(ai.byApp.find((entry) => entry.app === 'betterai'), { app: 'betterai', requests: 1, costChf: 0 });
      assert.equal(ai.recent.length, 3);
      assert.deepEqual(ai.recent[0], {
        at: ago(2 * SECOND),
        app: 'betterai',
        tier: 'chat_model',
        model: 'gpt-oss-120b',
        intent: 'conversation',
        voice: true,
        ok: false,
        error: 'timeout',
        promptTokens: null,
        completionTokens: null,
        costChf: null,
        durationMs: 30000,
      });

      const missing = await get('/api/accounts/acc_fehlt');
      assert.deepEqual([missing.status, missing.data], [404, { error: 'not_found' }]);
    });

    test('GET /api/activity merges the log with AI replies', async () => {
      const all = await get('/api/activity');
      assert.equal(all.status, 200);
      assert.deepEqual(
        all.data.entries.map((entry) => [entry.kind, entry.accountId]),
        [
          ['ai.reply', 'acc_ben'],
          ['ai.reply', 'acc_anna'],
          ['ai.reply', 'acc_anna'],
          ['session.blocked', 'acc_ben'],
          ['session.created', 'acc_anna'],
          ['ai.reply', 'acc_anna'],
        ],
      );
      assert.deepEqual(all.data.entries[0], {
        at: ago(SECOND),
        accountId: 'acc_ben',
        email: 'ben@test.ch',
        kind: 'ai.reply',
        detail: {
          app: 'bettergym',
          tier: 'reasoning_model',
          model: 'deepseek-v4-flash',
          costChf: 0.001,
          ok: true,
          error: null,
        },
      });

      const entries = async (query) => (await get(`/api/activity?${query}`)).data.entries;
      assert.equal((await entries('accountId=acc_ben')).length, 2);
      assert.deepEqual((await entries('kind=session')).map((entry) => entry.kind), ['session.blocked', 'session.created']);
      assert.equal((await entries('kind=ai.reply')).length, 4);
      assert.equal((await entries('kind=ai')).length, 4);
      assert.equal((await entries('limit=2')).length, 2);
      assert.equal((await entries('limit=9999')).length, 6);
      const before = await entries(`before=${encodeURIComponent(ago(2.5 * SECOND))}`);
      assert.deepEqual(before.map((entry) => entry.kind), ['ai.reply', 'session.blocked', 'session.created', 'ai.reply']);

      for (const query of ['limit=0', 'limit=abc', 'limit=1.5', 'before=gestern']) {
        const refused = await get(`/api/activity?${query}`);
        assert.deepEqual([refused.status, refused.data], [400, { error: 'bad_request' }], query);
      }
    });

    test('GET /api/costs per month', async () => {
      const current = await get('/api/costs');
      assert.equal(current.status, 200);
      const data = current.data;
      assert.equal(data.month, CURRENT_MONTH);
      assert.equal(data.totalChf, 0.001323);
      assert.equal(data.monthlyMinimumChf, 95);
      assert.equal(data.billableChf, 95);
      assert.deepEqual(data.byApp.map((entry) => entry.app), ['getbetter', 'betterfamily', 'bettergym', 'betterai', 'bettermoney']);
      assert.deepEqual(data.byApp[0], {
        app: 'getbetter',
        requests: 1,
        promptTokens: 1000,
        completionTokens: 500,
        costChf: 0.000323,
      });
      assert.deepEqual(data.byAccount[0], {
        accountId: 'acc_ben',
        email: 'ben@test.ch',
        username: 'ben',
        requests: 1,
        costChf: 0.001,
      });
      assert.equal(data.byAccount.find((entry) => entry.accountId === 'acc_anna').requests, 2);
      assert.ok(data.byTier.some((entry) => entry.tier === 'cheap_model' && entry.requests === 1));
      const [year, month] = CURRENT_MONTH.split('-').map(Number);
      assert.equal(data.byDay.length, new Date(Date.UTC(year, month, 0)).getUTCDate());
      assert.equal(data.byDay.reduce((total, day) => total + day.requests, 0), 3);
      assert.equal(data.prices.length, Object.keys(PRICES).length);
      assert.deepEqual(data.prices.find((price) => price.model === 'gemma4-31b'), {
        model: 'gemma4-31b',
        inputChf: 0.136,
        outputChf: 0.374,
      });

      const { speech } = data;
      assert.deepEqual(
        [speech.requests, speech.cached, speech.credits, speech.characters, speech.savedCredits],
        [4, 1, 73, 73, 40],
      );
      assert.deepEqual([speech.samples, speech.sampleCredits, speech.monthlyCredits], [1, 21, 10000]);
      assert.deepEqual(
        speech.byApp.map((entry) => [entry.app, entry.requests, entry.credits]),
        [
          ['getbetter', 2, 40],
          ['betterfamily', 0, 0],
          ['bettergym', 1, 21],
          ['betterai', 0, 0],
          ['bettermoney', 0, 0],
          [null, 1, 12],
        ],
      );
      assert.deepEqual(
        speech.byAccount.map((entry) => [entry.accountId, entry.credits]),
        [
          ['acc_anna', 40],
          ['acc_ben', 21],
          [null, 12],
        ],
      );
      assert.deepEqual(speech.byAccount[0], {
        accountId: 'acc_anna',
        email: 'anna@test.ch',
        username: 'anna',
        ...ZERO_SPEECH,
        requests: 2,
        cached: 1,
        characters: 40,
        credits: 40,
        savedCredits: 40,
      });
      assert.deepEqual([speech.cache.entries, speech.cache.replays, speech.cache.top.length], [3, 11, 2]);

      assert.deepEqual(data.margin.byApp.map((entry) => entry.app), ['getbetter', 'betterfamily', 'bettergym', 'betterai', 'bettermoney']);

      const old = (await get('/api/costs?month=2025-01')).data;
      assert.deepEqual([old.month, old.totalChf, old.billableChf], ['2025-01', 0.5, 95]);
      // Anna zahlt (heute) fuer GetBetter: ihre 0.50 im Januar 2025 sind Kosten eines Abos.
      const oldGetBetter = old.margin.byApp.find((entry) => entry.app === 'getbetter');
      assert.deepEqual([old.margin.month, oldGetBetter.paidCostChf, oldGetBetter.marginChf], ['2025-01', 0.5, 0.286309]);
      assert.deepEqual([old.speech.requests, old.speech.credits, old.speech.byAccount], [0, 0, []]);

      const empty = (await get('/api/costs?month=2024-02')).data;
      assert.deepEqual([empty.totalChf, empty.billableChf, empty.byDay.length], [0, 0, 29]);
      assert.deepEqual(empty.byAccount, []);

      configured = true;
      process.env.BETTER_AI_MONTHLY_MINIMUM_CHF = '120';
      try {
        const minimum = (await get('/api/costs?month=2024-02')).data;
        assert.deepEqual([minimum.monthlyMinimumChf, minimum.billableChf], [120, 120]);
        process.env.BETTER_AI_MONTHLY_MINIMUM_CHF = 'viel';
        assert.equal((await get('/api/costs?month=2024-02')).data.billableChf, 95);
        assert.equal((await get('/api/overview')).data.ai.configured, true);
      } finally {
        configured = false;
        process.env.BETTER_AI_MONTHLY_MINIMUM_CHF = '';
      }

      for (const month of ['2025-13', '2025-1', 'abc', '2025-00']) {
        const refused = await get(`/api/costs?month=${month}`);
        assert.deepEqual([refused.status, refused.data], [400, { error: 'bad_request' }], month);
      }
    });
  });

  describe('writing', () => {
    test('PATCH /api/accounts/:id changes the admin fields and records it', async () => {
      const revision = (await load()).revision;
      const patched = await send('PATCH', '/api/accounts/acc_cleo', {
        firstName: 'Cleo',
        username: ' @Cleo.Neu ',
        language: 'en',
        disabled: true,
        blockedApps: ['betterai', 'bettermoney'],
        paidApps: ['bettergym'],
      });
      assert.equal(patched.status, 200);
      const { account } = patched.data;
      assert.deepEqual(
        [account.id, account.firstName, account.username, account.language, account.disabled, account.blockedApps],
        ['acc_cleo', 'Cleo', 'cleo.neu', 'en', true, ['betterai', 'bettermoney']],
      );
      assert.deepEqual(account.paidApps, ['bettergym']);
      assert.equal(account.billing.find((entry) => entry.app === 'bettergym').plan, 'paid');
      assert.equal(account.billing.find((entry) => entry.app === 'betterai').plan, 'trial');
      assert.equal(JSON.stringify(patched.data).includes('password'), false);

      const db = await load();
      assert.ok(db.revision > revision);
      const stored = db.tables.accounts.find((row) => row.id === 'acc_cleo');
      assert.deepEqual([stored.disabled, stored.blockedApps, stored.username], [true, ['betterai', 'bettermoney'], 'cleo.neu']);
      assert.ok(stored.passwordHash, 'das Passwort bleibt');

      const recorded = (await activityLines()).at(-1);
      assert.deepEqual(
        [recorded.accountId, recorded.kind, [...recorded.detail.fields].sort()],
        ['acc_cleo', 'admin.updated', ['blockedApps', 'disabled', 'firstName', 'language', 'paidApps', 'username']],
      );

      const unblocked = await send('PATCH', '/api/accounts/acc_cleo', { disabled: false, blockedApps: [], paidApps: [] });
      assert.deepEqual(
        [unblocked.data.account.disabled, unblocked.data.account.blockedApps, unblocked.data.account.paidApps],
        [false, [], []],
      );
    });

    test('PATCH /api/accounts/:id refuses anything else', async () => {
      const refusals = [
        [{ nickname: 'x' }, 400, 'bad_request'],
        [{ passwordHash: 'x' }, 400, 'bad_request'],
        [{ firstName: 5 }, 400, 'bad_request'],
        [{ firstName: 'x'.repeat(101) }, 400, 'bad_request'],
        [{ language: 'es' }, 400, 'bad_request'],
        [{ disabled: 'ja' }, 400, 'bad_request'],
        [{ blockedApps: 'betterai' }, 400, 'bad_request'],
        [{ blockedApps: ['getbetter', 'getbetter'] }, 400, 'bad_request'],
        [{ blockedApps: ['betterwhatever'] }, 400, 'bad_request'],
        [{ paidApps: 'betterai' }, 400, 'bad_request'],
        [{ paidApps: ['betterai', 'betterai'] }, 400, 'bad_request'],
        [{ paidApps: ['betterwhatever'] }, 400, 'bad_request'],
        [{ paidApps: [null] }, 400, 'bad_request'],
        [{ username: 42 }, 400, 'bad_request'],
        [{ username: 'a b' }, 400, 'username_invalid'],
        [{ username: 'ab' }, 400, 'username_invalid'],
        [{ username: 'ANNA' }, 409, 'username_taken'],
      ];
      for (const [body, status, error] of refusals) {
        const result = await send('PATCH', '/api/accounts/acc_cleo', { firstName: 'Nie', ...body });
        assert.deepEqual([result.status, result.data], [status, { error }], JSON.stringify(body));
      }
      const cleo = (await load()).tables.accounts.find((row) => row.id === 'acc_cleo');
      assert.equal(cleo.firstName, 'Cleo');

      const missing = await send('PATCH', '/api/accounts/acc_fehlt', { firstName: 'x' });
      assert.deepEqual([missing.status, missing.data], [404, { error: 'not_found' }]);
      const notObject = await send('PATCH', '/api/accounts/acc_cleo', '[1]');
      assert.deepEqual([notObject.status, notObject.data], [400, { error: 'bad_request' }]);
      const broken = await send('PATCH', '/api/accounts/acc_cleo', '{kaputt');
      assert.equal(broken.status, 400);
    });

    test('POST /api/accounts/:id/password sets a new password that works', async () => {
      const short = await send('POST', '/api/accounts/acc_anna/password', { password: 'kurz' });
      assert.deepEqual([short.status, short.data], [400, { error: 'password_too_short' }]);
      const missing = await send('POST', '/api/accounts/acc_fehlt/password', { password: NEW_PASSWORD });
      assert.deepEqual([missing.status, missing.data], [404, { error: 'not_found' }]);
      const wrongType = await send('POST', '/api/accounts/acc_anna/password', { password: 12345678 });
      assert.equal(wrongType.status, 400);

      const done = await send('POST', '/api/accounts/acc_anna/password', { password: NEW_PASSWORD });
      assert.deepEqual([done.status, done.data], [200, { ok: true }]);

      const anna = (await load()).tables.accounts.find((row) => row.id === 'acc_anna');
      assert.notEqual(anna.passwordSalt, 'salz-acc_anna');
      assert.equal(matches(await hashPassword(NEW_PASSWORD, anna.passwordSalt), anna.passwordHash), true);
      assert.equal(matches(await hashPassword(PASSWORD, anna.passwordSalt), anna.passwordHash), false);

      const recorded = (await activityLines()).at(-1);
      assert.deepEqual([recorded.accountId, recorded.kind, recorded.detail], ['acc_anna', 'admin.password', {}]);
      const raw = await fs.readFile(path.join(DATA_DIR, 'activity.jsonl'), 'utf8');
      assert.equal(raw.includes(NEW_PASSWORD), false);
    });

    test('POST /api/accounts/:id/view issues a single-use ticket for one app', async () => {
      const route = '/api/accounts/acc_anna/view';
      const foreign = await request('POST', route, {
        body: { app: 'getbetter' },
        headers: { Origin: 'http://evil.example', 'Content-Type': 'application/json' },
      });
      assert.deepEqual([foreign.status, foreign.data], [403, { error: 'forbidden' }]);
      const noJson = await request('POST', route, {
        body: { app: 'getbetter' },
        headers: { Origin: `http://127.0.0.1:${port}`, 'Content-Type': 'text/plain' },
      });
      assert.equal(noJson.status, 403);
      for (const body of [{}, { app: 'betterx' }, { app: 'getbetter', accountId: 'acc_ben' }, { app: 5 }]) {
        const refused = await send('POST', route, body);
        assert.deepEqual([refused.status, refused.data], [400, { error: 'bad_request' }], JSON.stringify(body));
      }
      const missing = await send('POST', '/api/accounts/acc_fehlt/view', { app: 'getbetter' });
      assert.deepEqual([missing.status, missing.data], [404, { error: 'not_found' }]);

      const started = Date.now();
      const view = await send('POST', route, { app: 'bettergym' });
      assert.equal(view.status, 200);
      assert.deepEqual(Object.keys(view.data).sort(), ['expiresAt', 'url']);
      const match = /^http:\/\/localhost:8083\/\?view=([a-f0-9]{64})$/.exec(view.data.url);
      assert.ok(match, view.data.url);
      const expires = Date.parse(view.data.expiresAt);
      assert.ok(expires >= started + 59_000 && expires <= Date.now() + 60_000);

      // Jedes Oeffnen ein neues Ticket; eingeloest wird jedes genau einmal.
      const second = await send('POST', route, { app: 'bettergym' });
      assert.notEqual(second.data.url, view.data.url);
      assert.deepEqual(viewTickets.redeem(match[1]), { accountId: 'acc_anna', app: 'bettergym' });
      assert.equal(viewTickets.redeem(match[1]), null);

      const recorded = (await activityLines()).at(-1);
      assert.deepEqual([recorded.accountId, recorded.kind, recorded.detail], ['acc_anna', 'admin.viewed', { app: 'bettergym' }]);
      const raw = await fs.readFile(path.join(DATA_DIR, 'activity.jsonl'), 'utf8');
      assert.equal(raw.includes(match[1]), false, 'das Ticket steht nie im Verlauf');
    });

    test('unknown routes and methods', async () => {
      assert.equal((await get('/api/nichts')).status, 404);
      assert.equal((await send('DELETE', '/api/accounts', {})).status, 404);
      assert.equal((await send('PUT', '/api/accounts/acc_anna', {})).status, 404);
    });
  });

  describe('deleting', () => {
    const UPLOAD = 'upl_0123456789abcdef01234567';
    const KEPT_UPLOAD = 'upl_abcdefabcdefabcdefabcdef';
    const uploadFile = (id) => path.join(DATA_DIR, 'uploads', `${id}.png`);
    const backupDir = path.join(DATA_DIR, 'deleted-accounts');

    before(async () => {
      const db = await load();
      const salt = 'salz-acc_dora';
      db.tables.accounts = [
        ...db.tables.accounts,
        {
          id: 'acc_dora',
          email: 'dora@test.ch',
          username: 'dora',
          firstName: 'Dora',
          householdId: 'h1',
          backdrop: `upload:${UPLOAD}`,
          passwordSalt: salt,
          passwordHash: await hashPassword(PASSWORD, salt),
          createdAt: ago(DAY),
        },
      ];
      db.tables.households = [{ id: 'h1', name: 'Zuhause', createdBy: 'acc_dora' }];
      db.tables.householdMembers = [
        { id: 'hm_dora', householdId: 'h1', accountId: 'acc_dora', role: 'admin', status: 'accepted', joinedAt: ago(4 * DAY) },
        { id: 'hm_anna', householdId: 'h1', accountId: 'acc_anna', role: 'member', status: 'accepted', joinedAt: ago(3 * DAY) },
      ];
      db.tables.shoppingItems = [
        { id: 's_shared', accountId: 'acc_dora', householdId: 'h1', name: 'Milch' },
        { id: 's_private', accountId: 'acc_dora', householdId: null, name: 'Kaffee' },
      ];
      db.tables.tasks = [
        ...db.tables.tasks,
        { id: 't_dora', accountId: 'acc_dora', householdId: null, title: 'Steuern', attachmentIds: [KEPT_UPLOAD] },
        { id: 't_anna_file', accountId: 'acc_anna', householdId: null, title: 'Foto', attachmentIds: [KEPT_UPLOAD] },
      ];
      db.tables.calendars = [{ id: 'cal_dora', ownerId: 'acc_dora', name: 'Sport' }];
      db.tables.calendarMembers = [
        { id: 'cm_dora', calendarId: 'cal_dora', accountId: 'acc_dora', role: 'owner', status: 'accepted' },
      ];
      db.tables.events = [
        ...db.tables.events,
        { id: 'e_dora', accountId: 'acc_dora', calendar: 'custom', calendarId: 'cal_dora', householdId: null, title: 'Lauf' },
      ];
      db.tables.mailAccounts = [{ id: 'mac_dora', accountId: 'acc_dora', email: 'dora@mail.test' }];
      db.tables.mailMessages = [{ id: 'mm_dora', accountId: 'acc_dora', mailAccountId: 'mac_dora', subject: 'Hallo' }];
      db.tables.notifications = [{ id: 'no_dora', accountId: 'acc_dora', kind: 'system', ref: {} }];
      await fs.writeFile(uploadFile(UPLOAD), Buffer.alloc(4));
      await fs.writeFile(uploadFile(KEPT_UPLOAD), Buffer.alloc(4));
    });

    test('DELETE /api/accounts/:id needs our Origin, JSON and the matching e-mail', async () => {
      for (const headers of [
        { 'Content-Type': 'application/json' },
        { Origin: 'http://evil.example', 'Content-Type': 'application/json' },
        { Origin: `http://127.0.0.1:${port}`, 'Content-Type': 'text/plain' },
      ]) {
        const refused = await request('DELETE', '/api/accounts/acc_dora', { body: { confirm: 'dora@test.ch' }, headers });
        assert.deepEqual([refused.status, refused.data], [403, { error: 'forbidden' }], JSON.stringify(headers));
      }
      for (const body of [{}, { confirm: 'anna@test.ch' }, { confirm: 42 }, { confirm: 'dora' }, { confirm: '' }]) {
        const mismatch = await send('DELETE', '/api/accounts/acc_dora', body);
        assert.deepEqual([mismatch.status, mismatch.data], [400, { error: 'confirm_mismatch' }], JSON.stringify(body));
      }
      const missing = await send('DELETE', '/api/accounts/acc_fehlt', { confirm: 'dora@test.ch' });
      assert.deepEqual([missing.status, missing.data], [404, { error: 'not_found' }]);
      const notObject = await send('DELETE', '/api/accounts/acc_dora', '[1]');
      assert.deepEqual([notObject.status, notObject.data], [400, { error: 'bad_request' }]);

      assert.ok((await load()).tables.accounts.some((row) => row.id === 'acc_dora'));
      await assert.rejects(fs.access(backupDir));
      assert.deepEqual(removedMailboxes, []);
    });

    test('DELETE /api/accounts/:id removes the account, writes a backup and records it', async () => {
      const revision = (await load()).revision;
      const done = await send('DELETE', '/api/accounts/acc_dora', { confirm: '  Dora@Test.CH ' });
      assert.equal(done.status, 200);
      assert.deepEqual(done.data, {
        ok: true,
        removed: {
          accounts: 1,
          householdMembers: 1,
          calendars: 1,
          calendarMembers: 1,
          events: 1,
          tasks: 1,
          shoppingItems: 1,
          mailAccounts: 1,
          mailMessages: 1,
          notifications: 1,
        },
      });

      const db = await load();
      assert.ok(db.revision > revision);
      // Ohne Zeile keine Anmeldung: die Adresse fuehrt zu keinem Konto mehr.
      assert.equal(db.tables.accounts.some((row) => row.id === 'acc_dora' || row.email === 'dora@test.ch'), false);
      assert.deepEqual(db.tables.shoppingItems.map((row) => row.id), ['s_shared']);
      assert.deepEqual(
        db.tables.householdMembers.map((row) => [row.id, row.role]),
        [['hm_anna', 'admin']],
      );
      assert.deepEqual(db.tables.households.map((row) => row.id), ['h1']);
      assert.equal(db.tables.tasks.some((row) => row.id === 't_dora'), false);
      assert.equal(db.tables.events.some((row) => row.id === 'e_dora'), false);
      assert.deepEqual(
        [db.tables.calendars, db.tables.calendarMembers, db.tables.mailAccounts, db.tables.mailMessages, db.tables.notifications],
        [[], [], [], [], []],
      );
      assert.deepEqual(removedMailboxes, ['mac_dora']);

      await assert.rejects(fs.access(uploadFile(UPLOAD)));
      await fs.access(uploadFile(KEPT_UPLOAD));

      const files = await fs.readdir(backupDir);
      assert.equal(files.length, 1);
      assert.match(files[0], /^acc_dora-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/);
      const raw = await fs.readFile(path.join(backupDir, files[0]), 'utf8');
      assert.equal(raw.includes('password'), false);
      const backup = JSON.parse(raw);
      assert.equal(backup.accountId, 'acc_dora');
      assert.equal(backup.removed.accounts[0].email, 'dora@test.ch');
      assert.deepEqual(backup.removed.shoppingItems.map((row) => row.id), ['s_private']);
      assert.deepEqual(backup.removed.mailMessages.map((row) => row.id), ['mm_dora']);
      assert.deepEqual(backup.updatedBefore.householdMembers.map((row) => row.role), ['member']);
      assert.deepEqual(backup.uploadIds, [UPLOAD]);

      // Eine App mit altem Stand bringt nichts davon per PUT zurueck — Geteiltes bleibt.
      const stale = [{ id: 's_shared' }, { id: 's_private' }, { id: 's_neu' }];
      assert.deepEqual(withoutDeleted(db, 'shoppingItems', stale).map((row) => row.id), ['s_shared', 's_neu']);
      assert.deepEqual(withoutDeleted(db, 'accounts', [{ id: 'acc_dora' }, { id: 'acc_anna' }]), [{ id: 'acc_anna' }]);
      // Wer sich mit derselben Adresse neu registriert, bekommt dieselbe Id — dann gilt das Alte nicht mehr.
      forgetDeleted(db, 'acc_dora');
      assert.deepEqual(withoutDeleted(db, 'accounts', [{ id: 'acc_dora' }]), [{ id: 'acc_dora' }]);

      const recorded = (await activityLines()).at(-1);
      assert.deepEqual(
        [recorded.accountId, recorded.kind, recorded.detail],
        ['acc_dora', 'admin.deleted', { username: 'dora' }],
      );
      assert.equal(JSON.stringify(recorded).includes('dora@test.ch'), false);

      const again = await send('DELETE', '/api/accounts/acc_dora', { confirm: 'dora@test.ch' });
      assert.deepEqual([again.status, again.data], [404, { error: 'not_found' }]);
      assert.equal((await get('/api/accounts/acc_dora')).status, 404);
    });
  });
});
