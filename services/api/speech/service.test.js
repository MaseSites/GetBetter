/**
 * Die Stimmen gegen einen nachgebauten ElevenLabs-Dienst — nie gegen das
 * echte Konto. Der Datenordner liegt im Temp-Verzeichnis.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { after, before, describe, test } = require('node:test');

const { USAGE_FILE } = require('../ai/usage.js');
const { resetsOnOf, zurichMonthOf } = require('../billing/month.js');
const { createBilling } = require('../billing/service.js');
const { CACHE_DIR, INDEX_FILE, SAMPLES_DIR } = require('./cache.js');
const { SAMPLE_TEXT, createSpeechService, upstreamError } = require('./service.js');
const { SPEECH_USAGE_FILE, readSpeechUsage } = require('./usage.js');

const KEY = 'test-key-123';
const VOICE = 'VoiceGerman001';

/** Wer ein Abo hat, bekommt Stimmen von ElevenLabs — alle anderen den Browser. */
const ACCOUNTS = {
  acc_paid: { id: 'acc_paid', paidApps: ['getbetter'] },
  acc_anna: { id: 'acc_anna', paidApps: ['getbetter'] },
  acc_ben: { id: 'acc_ben', paidApps: ['betterfamily'] },
  acc_cleo: { id: 'acc_cleo', paidApps: ['getbetter'] },
  acc_trial: { id: 'acc_trial' },
};
const findAccount = (id) => ACCOUNTS[id] ?? null;
const PAID = { accountId: 'acc_paid', app: 'getbetter' };

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
  });
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wartet, bis `check` etwas liefert — Protokoll und Index schreibt der Dienst nach dem Audio. */
async function eventually(check, timeoutMs = 3000) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) throw new Error('eventually: timeout');
    await pause(25);
  }
}

function createFakeElevenLabs() {
  const calls = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    calls.push({
      method: req.method,
      url: req.url,
      key: req.headers['xi-api-key'],
      body: raw ? JSON.parse(raw) : null,
    });
    const json = (status, value) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(value));
    };

    if (req.headers['xi-api-key'] !== KEY) {
      return json(401, { detail: { code: 'invalid_api_key', message: 'Invalid API key' } });
    }
    if (req.method === 'GET' && req.url.startsWith('/v2/voices')) {
      return json(200, {
        voices: [
          {
            voice_id: 'VoiceEnglish01',
            name: 'Zoe',
            labels: { gender: 'female', accent: 'british' },
            verified_languages: [{ language: 'en' }],
          },
          {
            voice_id: VOICE,
            name: 'Mila',
            labels: { gender: 'female' },
            verified_languages: [{ language: 'de' }, { language: 'de' }],
          },
          { voice_id: 'kaputt!', name: 'Kaputt' },
        ],
        has_more: false,
      });
    }
    const match = /^\/v1\/text-to-speech\/([^/?]+)\/stream\?output_format=mp3_44100_128$/.exec(
      req.url,
    );
    if (req.method === 'POST' && match) {
      if (match[1] === 'QuotaVoice001') {
        return json(402, { detail: { code: 'insufficient_credits', message: 'no credits' } });
      }
      if (match[1] === 'BusyVoice0001') {
        return json(429, { detail: { code: 'rate_limit_exceeded' } });
      }
      res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
      res.write(Buffer.from('ID3'));
      setTimeout(() => res.end(Buffer.from('-fake-mp3')), 10);
      return undefined;
    }
    return json(404, { detail: { code: 'not_found' } });
  });
  return { server, calls };
}

describe('Stimmen ueber ElevenLabs', () => {
  const fake = createFakeElevenLabs();
  let base;
  let root;
  let dataDir;
  let player;
  let playerUrl;
  let current;
  let counter = 0;

  const freshDir = async () => {
    counter += 1;
    const dir = path.join(root, `run-${counter}`);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  };

  before(async () => {
    base = await listen(fake.server);
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'better-speech-'));
    dataDir = await freshDir();
    // Ein kleiner Server davor, damit `serve` in eine echte Antwort schreibt.
    player = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      void current.serve(res, url.pathname.slice(1), url.searchParams.get('play'));
    });
    playerUrl = await listen(player);
  });

  after(async () => {
    fake.server.close();
    player.close();
    await fs.rm(root, { recursive: true, force: true });
  });

  /** Die Tests rechnen mit den Vorgaben — Preise aus der Umgebung des Rechners gelten hier nicht. */
  const service = (options = {}) =>
    createSpeechService({
      dataDir,
      baseUrl: base,
      readKey: () => KEY,
      findAccount,
      billing: createBilling({ dataDir: options.dataDir ?? dataDir, findAccount, env: {} }),
      ...options,
    });

  /** `/v1/speech/<id>.mp3?play=<ticket>` ueber den kleinen Server davor holen. */
  const play = (prepared) =>
    fetch(`${playerUrl}/${prepared.body.url.slice('/v1/speech/'.length).replace('.mp3', '')}`);
  const playAll = async (prepared) => Buffer.from(await (await play(prepared)).arrayBuffer()).toString();
  const indexOf = async (dir) => {
    try {
      return JSON.parse(await fs.readFile(path.join(dir, CACHE_DIR, INDEX_FILE), 'utf8'));
    } catch {
      return null;
    }
  };
  const exists = (file) => fs.access(file).then(
    () => true,
    () => false,
  );

  test('ohne Schluessel sagt der Dienst ehrlich nein', async () => {
    const speech = service({ readKey: () => null });
    assert.deepEqual((await speech.status(PAID)).body, {
      provider: 'elevenlabs',
      configured: false,
      lastError: null,
      allowed: false,
      plan: 'paid',
      reason: null,
    });
    assert.deepEqual(await speech.voices('de'), { status: 503, body: { error: 'not_configured' } });
    const prepared = await speech.prepare({ text: 'Hallo', voice: VOICE, language: 'de' });
    assert.equal(prepared.status, 503);
    assert.equal((await speech.prepareSample({ voice: VOICE, language: 'de' })).status, 503);
  });

  test('Stimmen: wer Deutsch spricht zuerst, kaputte fallen weg, der Schluessel bleibt drin', async () => {
    const speech = service();
    const result = await speech.voices('de');
    assert.equal(result.status, 200);
    assert.deepEqual(
      result.body.voices.map((voice) => voice.id),
      [VOICE, 'VoiceEnglish01'],
    );
    assert.deepEqual(result.body.voices[0], {
      id: VOICE,
      name: 'Mila',
      gender: 'female',
      accent: null,
      languages: ['de'],
    });
    assert.equal(fake.calls.at(-1).key, KEY);
    assert.equal(JSON.stringify(result).includes(KEY), false);
  });

  test('prueft Text, Stimme und Sprache', async () => {
    const speech = service();
    for (const input of [
      { text: '', voice: VOICE, language: 'de' },
      { text: 'x'.repeat(1001), voice: VOICE, language: 'de' },
      { text: 'Hallo', voice: '../etc', language: 'de' },
      { text: 'Hallo', voice: VOICE, language: 'es' },
      null,
    ]) {
      assert.deepEqual(await speech.prepare(input), {
        status: 400,
        body: { error: 'bad_request' },
      });
    }
  });

  test('spricht einmal, danach kommt derselbe Satz aus dem Zwischenspeicher', async () => {
    current = service();
    const prepared = await current.prepare({
      text: '  Hallo,\n  ich bin da. ',
      voice: VOICE,
      language: 'de',
      ...PAID,
    });
    assert.equal(prepared.status, 201);
    assert.match(prepared.body.url, /^\/v1\/speech\/[a-f0-9]{32}\.mp3\?play=[a-f0-9]{24}$/);
    assert.equal(prepared.body.url.startsWith(`/v1/speech/${prepared.body.id}.mp3?play=`), true);

    const before = fake.calls.length;
    const first = await play(prepared);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('content-type'), 'audio/mpeg');
    assert.equal(Buffer.from(await first.arrayBuffer()).toString(), 'ID3-fake-mp3');

    const sent = fake.calls.at(-1);
    assert.equal(sent.body.text, 'Hallo, ich bin da.');
    assert.equal(sent.body.model_id, 'eleven_multilingual_v2');
    assert.equal('language_code' in sent.body, false);

    const again = await current.prepare({ text: 'Hallo, ich bin da.', voice: VOICE, language: 'de', ...PAID });
    assert.equal(again.body.id, prepared.body.id);
    assert.notEqual(again.body.url, prepared.body.url);
    assert.equal(await playAll(again), 'ID3-fake-mp3');
    assert.equal(fake.calls.length, before + 1);
  });

  test('jede Wiedergabe kommt ohne Text ins Protokoll: Konto, App, Zeichen, Credits — aus dem Speicher 0', async () => {
    const dir = await freshDir();
    current = service({ dataDir: dir });
    const input = {
      text: 'Drei Bananen sind auf der Liste.',
      voice: VOICE,
      language: 'de',
      accountId: 'acc_anna',
      app: 'getbetter',
    };
    const first = await current.prepare(input);
    assert.equal(JSON.stringify(first.body).includes('Bananen'), false);
    assert.equal(await playAll(first), 'ID3-fake-mp3');

    const second = await current.prepare({ ...input, accountId: 'acc_ben', app: 'betterfamily' });
    assert.equal(await playAll(second), 'ID3-fake-mp3');
    // Dasselbe Ticket ein zweites Mal: Audio ja, aber keine neue Zeile und kein Hit.
    assert.equal(await playAll(second), 'ID3-fake-mp3');
    // Ein unbekanntes Konto und eine fremde App bekommen keine Stimme — auch nicht aus dem Speicher.
    const stranger = await current.prepare({ ...input, accountId: 'x'.repeat(101), app: 'fremd' });
    assert.deepEqual([stranger.status, stranger.body.error], [403, 'plan_required']);

    const lines = await eventually(async () => {
      const rows = await readSpeechUsage(dir);
      return rows.length >= 2 ? rows : null;
    });
    await pause(50);
    assert.equal((await readSpeechUsage(dir)).length, 2);
    const strip = ({ at, ...rest }) => {
      assert.match(at, /^\d{4}-\d{2}-\d{2}T/);
      return rest;
    };
    const common = { purpose: 'speech', model: 'eleven_multilingual_v2', voiceId: VOICE, characters: 32, ok: true, error: null };
    // Die Zeilen kommen nach dem Audio; ihre Reihenfolge ist nicht fest.
    const order = (row) => `${row.cached}:${row.accountId}`;
    assert.deepEqual(
      lines.map(strip).sort((a, b) => order(a).localeCompare(order(b))),
      [
        { accountId: 'acc_anna', app: 'getbetter', ...common, credits: 32, cached: false },
        { accountId: 'acc_ben', app: 'betterfamily', ...common, credits: 0, cached: true },
      ],
    );

    const raw = await fs.readFile(path.join(dir, SPEECH_USAGE_FILE), 'utf8');
    assert.equal(raw.includes('Bananen'), false);
    const index = await eventually(async () => {
      const value = await indexOf(dir);
      return value?.entries[first.body.id]?.hits === 1 ? value : null;
    });
    assert.equal(JSON.stringify(index).includes('Bananen'), false);
  });

  test('derselbe Satz mit anderem Leerraum oder anderen Anfuehrungszeichen: eine Datei, ein Aufruf bei ElevenLabs', async () => {
    current = service({ dataDir: await freshDir() });
    const before = fake.calls.length;
    const say = (text) => current.prepare({ text, voice: VOICE, language: 'de', ...PAID });

    const bananas = await say('3 Bananen hinzugefügt.');
    assert.equal(await playAll(bananas), 'ID3-fake-mp3');
    const spaced = await say('3 Bananen hinzugefügt. ');
    assert.equal(spaced.body.id, bananas.body.id);
    assert.equal(await playAll(spaced), 'ID3-fake-mp3');
    assert.equal(fake.calls.length, before + 1);

    const typographic = await say('Ist’s „fertig“ – ja.');
    assert.equal(await playAll(typographic), 'ID3-fake-mp3');
    // Gesprochen wird, was ankam — nur der Schluessel ist vereinheitlicht.
    assert.equal(fake.calls.at(-1).body.text, 'Ist’s „fertig“ – ja.');
    const plain = await say('  Ist\'s "fertig" - ja.');
    assert.equal(plain.body.id, typographic.body.id);
    assert.equal(await playAll(plain), 'ID3-fake-mp3');
    assert.equal(fake.calls.length, before + 2);

    assert.notEqual((await say('3 bananen hinzugefügt.')).body.id, bananas.body.id);
    assert.notEqual((await say('3 Bananen hinzugefügt!')).body.id, bananas.body.id);
  });

  test('Proben: fester Satz des Dienstes, einmal erzeugt, danach fuer jedes Konto gratis', async () => {
    const dir = await freshDir();
    current = service({ dataDir: dir });
    const before = fake.calls.length;

    const anna = await current.prepareSample({
      voice: VOICE,
      language: 'de',
      accountId: 'acc_anna',
      app: 'getbetter',
      text: 'Sag stattdessen etwas ganz anderes',
    });
    assert.equal(anna.status, 201);
    assert.equal(await playAll(anna), 'ID3-fake-mp3');
    assert.equal(fake.calls.at(-1).body.text, SAMPLE_TEXT.de);
    // Die Datei wird nach dem Strom geschrieben — kurz darauf warten statt raten.
    await eventually(() => exists(path.join(dir, CACHE_DIR, SAMPLES_DIR, `${anna.body.id}.mp3`)));

    const ben = await current.prepareSample({ voice: VOICE, language: 'de', accountId: 'acc_ben', app: 'betterfamily' });
    assert.equal(ben.body.id, anna.body.id);
    assert.equal(await playAll(ben), 'ID3-fake-mp3');
    assert.equal(fake.calls.length, before + 1);

    // Auch nach einem Neustart des Dienstes kommt die Probe aus dem Speicher.
    current = service({ dataDir: dir });
    const cleo = await current.prepareSample({ voice: VOICE, language: 'de', accountId: 'acc_cleo', app: 'getbetter' });
    assert.equal(await playAll(cleo), 'ID3-fake-mp3');
    assert.equal(fake.calls.length, before + 1);

    // Derselbe Wortlaut als gewoehnlicher Satz ist eine andere Datei.
    const normal = await current.prepare({ text: SAMPLE_TEXT.de, voice: VOICE, language: 'de', ...PAID });
    assert.notEqual(normal.body.id, anna.body.id);

    const lines = await eventually(async () => {
      const rows = await readSpeechUsage(dir);
      return rows.length >= 3 ? rows : null;
    });
    assert.ok(lines.every((row) => row.purpose === 'sample' && row.characters === 21));
    const byAccount = Object.fromEntries(lines.map((row) => [row.accountId, [row.cached, row.credits]]));
    assert.deepEqual(byAccount, { acc_anna: [false, 21], acc_ben: [true, 0], acc_cleo: [true, 0] });
  });

  test('Proben: kein eigener Text, unbekannte Sprache wird Deutsch, krumme Stimme ist 400', async () => {
    current = service({ dataDir: await freshDir() });
    const odd = await current.prepareSample({ voice: VOICE, language: 'es', text: 'Beliebiger Text', ...PAID });
    assert.equal(odd.status, 201);
    const german = await current.prepareSample({ voice: VOICE, language: 'de', ...PAID });
    assert.equal(odd.body.id, german.body.id);
    const ids = new Set();
    for (const language of ['de', 'en', 'fr', 'it']) {
      ids.add((await current.prepareSample({ voice: VOICE, language, ...PAID })).body.id);
    }
    assert.equal(ids.size, 4);

    assert.equal(await playAll(odd), 'ID3-fake-mp3');
    assert.equal(fake.calls.at(-1).body.text, SAMPLE_TEXT.de);
    for (const input of [{ voice: '../etc', language: 'de' }, { language: 'de', text: 'Hallo' }, null]) {
      assert.deepEqual(await current.prepareSample(input), { status: 400, body: { error: 'bad_request' } });
    }
  });

  test('Aufraeumen behaelt Proben und oft gespielte Saetze, der einmalige faellt', async () => {
    const dir = await freshDir();
    current = service({ dataDir: dir, cacheFiles: 2 });
    const say = (text) => current.prepare({ text, voice: VOICE, language: 'de', ...PAID });
    const cacheDir = path.join(dir, CACHE_DIR);
    const hitsOf = async (id) => (await indexOf(dir))?.entries[id]?.hits;

    const sample = await current.prepareSample({ voice: VOICE, language: 'de', ...PAID });
    await playAll(sample);
    const often = await say('Erledigt.');
    await playAll(often);
    await playAll(await say('Erledigt.'));
    await playAll(await say('Erledigt.'));
    await eventually(async () => (await hitsOf(often.body.id)) === 2);
    const once = await say('Einmal gesagt und nie wieder.');
    await playAll(once);
    await eventually(async () => (await indexOf(dir))?.entries[once.body.id]);
    const newest = await say('Noch ein neuer Satz.');
    await playAll(newest);
    await eventually(async () => !(await exists(path.join(cacheDir, `${once.body.id}.mp3`))));

    assert.equal(await exists(path.join(cacheDir, `${often.body.id}.mp3`)), true);
    assert.equal(await exists(path.join(cacheDir, `${newest.body.id}.mp3`)), true);
    assert.equal(await exists(path.join(cacheDir, SAMPLES_DIR, `${sample.body.id}.mp3`)), true);
  });

  test('schnelle Modelle bekommen die Sprache mit und kosten halb', async () => {
    const dir = await freshDir();
    current = service({ dataDir: dir, model: 'eleven_flash_v2_5' });
    const prepared = await current.prepare({
      text: 'Bonjour',
      voice: VOICE,
      language: 'fr',
      ...PAID,
    });
    await playAll(prepared);
    assert.equal(fake.calls.at(-1).body.language_code, 'fr');
    assert.equal(fake.calls.at(-1).body.model_id, 'eleven_flash_v2_5');
    const [line] = await eventually(async () => {
      const rows = await readSpeechUsage(dir);
      return rows.length > 0 ? rows : null;
    });
    assert.deepEqual([line.model, line.characters, line.credits], ['eleven_flash_v2_5', 7, 3.5]);
  });

  test('leeres Guthaben und Andrang werden zu eigenen Fehlern, stehen im Status und kosten nichts', async () => {
    const dir = await freshDir();
    current = service({ dataDir: dir });
    const quota = await current.prepare({ text: 'Hallo', voice: 'QuotaVoice001', language: 'de', ...PAID });
    const failed = await play(quota);
    assert.equal(failed.status, 502);
    assert.deepEqual(await failed.json(), { error: 'quota_exceeded' });
    assert.equal((await current.status()).body.lastError, 'quota_exceeded');

    const busy = await current.prepare({ text: 'Hallo', voice: 'BusyVoice0001', language: 'de', ...PAID });
    const limited = await play(busy);
    assert.deepEqual(await limited.json(), { error: 'rate_limited' });

    const lines = await eventually(async () => {
      const rows = await readSpeechUsage(dir);
      return rows.length >= 2 ? rows : null;
    });
    assert.deepEqual(
      lines.map((row) => [row.ok, row.credits, row.cached]),
      [
        [false, 0, false],
        [false, 0, false],
      ],
    );
    assert.deepEqual(new Set(lines.map((row) => row.error)), new Set(['quota_exceeded', 'rate_limited']));
  });

  test('ein falscher Schluessel heisst auth_failed', async () => {
    const speech = service({ readKey: () => 'falsch' });
    assert.deepEqual(await speech.voices('de'), { status: 502, body: { error: 'auth_failed' } });
  });

  test('unbekannte oder krumme Ids gibt es nicht', async () => {
    current = service();
    const unknown = await fetch(`${playerUrl}/${'a'.repeat(32)}`);
    assert.equal(unknown.status, 404);
    const crooked = await fetch(`${playerUrl}/..%2Fdb.json`);
    assert.equal(crooked.status, 404);
  });

  test('ohne Abo: plan_required, ohne ElevenLabs zu fragen — auch vor dem Anmelden', async () => {
    current = service({ dataDir: await freshDir() });
    const before = fake.calls.length;
    const trial = { accountId: 'acc_trial', app: 'getbetter' };
    const refusals = [
      await current.prepare({ text: 'Hallo', voice: VOICE, language: 'de', ...trial }),
      await current.prepareSample({ voice: VOICE, language: 'de', ...trial }),
      await current.prepare({ text: 'Hallo', voice: VOICE, language: 'de' }),
      // Ein Abo gilt nur fuer seine App.
      await current.prepare({ text: 'Hallo', voice: VOICE, language: 'de', accountId: 'acc_paid', app: 'bettergym' }),
      await current.prepare({ text: 'Hallo', voice: VOICE, language: 'de', accountId: 'acc_unbekannt', app: 'getbetter' }),
    ];
    for (const refused of refusals) {
      assert.deepEqual([refused.status, refused.body.error, refused.body.plan], [403, 'plan_required', 'trial']);
    }
    assert.equal(fake.calls.length, before);

    const status = async (query) => {
      const { allowed, plan, reason } = (await current.status(query)).body;
      return [allowed, plan, reason];
    };
    assert.deepEqual(await status(trial), [false, 'trial', 'plan_required']);
    assert.deepEqual(await status({}), [false, 'trial', 'plan_required']);
    assert.deepEqual(await status(PAID), [true, 'paid', null]);
    assert.equal((await current.status(trial)).body.configured, true);
  });

  test('Abo ueber dem Budget: 402 ohne ElevenLabs — ein Satz aus dem Speicher geht trotzdem', async () => {
    const dir = await freshDir();
    // GetBetter kostet 1.– — das Budget sind knapp 0.59 CHF, schon verbraucht.
    const spent = { at: new Date().toISOString(), accountId: 'acc_paid', app: 'getbetter', costChf: 0.59 };
    await fs.writeFile(path.join(dir, USAGE_FILE), `${JSON.stringify(spent)}\n`);
    current = service({ dataDir: dir });

    const warm = await current.prepare({ text: 'Schon gesagt.', voice: VOICE, language: 'de', accountId: 'acc_anna', app: 'getbetter' });
    assert.equal(await playAll(warm), 'ID3-fake-mp3');
    // Erst wenn der Satz im Zwischenspeicher steht, zaehlt er als schon gesagt.
    await eventually(async () => (await indexOf(dir))?.entries[warm.body.id]);
    const before = fake.calls.length;

    const fresh = await current.prepare({ text: 'Ganz neu.', voice: VOICE, language: 'de', ...PAID });
    assert.deepEqual(fresh, {
      status: 402,
      body: { error: 'budget_exhausted', plan: 'paid', resetsOn: resetsOnOf(zurichMonthOf(Date.now())), priceChf: 1 },
    });
    const cached = await current.prepare({ text: 'Schon gesagt.', voice: VOICE, language: 'de', ...PAID });
    assert.equal(cached.status, 201);
    assert.equal(await playAll(cached), 'ID3-fake-mp3');
    assert.equal(fake.calls.length, before);

    const { allowed, reason } = (await current.status(PAID)).body;
    assert.deepEqual([allowed, reason], [false, 'budget_exhausted']);
  });

  test('erzeugt wird nur mit gueltigem Ticket', async () => {
    const dir = await freshDir();
    current = service({ dataDir: dir });
    const prepared = await current.prepare({ text: 'Ohne Ticket nie.', voice: VOICE, language: 'de', ...PAID });
    const before = fake.calls.length;
    const bare = await fetch(`${playerUrl}/${prepared.body.id}`);
    assert.equal(bare.status, 404);
    assert.equal(fake.calls.length, before);
    assert.equal(await playAll(prepared), 'ID3-fake-mp3');
    // Der Index wird nach dem Audio geschrieben — erst danach darf aufgeraeumt werden.
    await eventually(async () => (await indexOf(dir))?.entries[prepared.body.id]);
  });

  test('Fehlerschluessel aus den Antworten von ElevenLabs', () => {
    assert.equal(upstreamError(400, { status: 'quota_exceeded' }), 'quota_exceeded');
    assert.equal(upstreamError(403, { code: 'voice_access_denied' }), 'not_allowed');
    assert.equal(upstreamError(400, { code: 'text_too_long' }), 'too_long');
    assert.equal(upstreamError(500, null), 'speech_failed');
  });
});
