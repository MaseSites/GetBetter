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

const { createSpeechService, upstreamError } = require('./service.js');

const KEY = 'test-key-123';

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
  });
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
            voice_id: 'VoiceGerman001',
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
  let dataDir;
  let player;
  let playerUrl;
  let current;

  before(async () => {
    base = await listen(fake.server);
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'better-speech-'));
    // Ein kleiner Server davor, damit `serve` in eine echte Antwort schreibt.
    player = http.createServer((req, res) => void current.serve(res, req.url.slice(1)));
    playerUrl = await listen(player);
  });

  after(async () => {
    fake.server.close();
    player.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  const service = (options = {}) =>
    createSpeechService({ dataDir, baseUrl: base, readKey: () => KEY, ...options });

  test('ohne Schluessel sagt der Dienst ehrlich nein', async () => {
    const speech = service({ readKey: () => null });
    assert.deepEqual((await speech.status()).body, {
      provider: 'elevenlabs',
      configured: false,
      lastError: null,
    });
    assert.deepEqual(await speech.voices('de'), { status: 503, body: { error: 'not_configured' } });
    const prepared = await speech.prepare({
      text: 'Hallo',
      voice: 'VoiceGerman001',
      language: 'de',
    });
    assert.equal(prepared.status, 503);
  });

  test('Stimmen: wer Deutsch spricht zuerst, kaputte fallen weg, der Schluessel bleibt drin', async () => {
    const speech = service();
    const result = await speech.voices('de');
    assert.equal(result.status, 200);
    assert.deepEqual(
      result.body.voices.map((voice) => voice.id),
      ['VoiceGerman001', 'VoiceEnglish01'],
    );
    assert.deepEqual(result.body.voices[0], {
      id: 'VoiceGerman001',
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
      { text: '', voice: 'VoiceGerman001', language: 'de' },
      { text: 'x'.repeat(1001), voice: 'VoiceGerman001', language: 'de' },
      { text: 'Hallo', voice: '../etc', language: 'de' },
      { text: 'Hallo', voice: 'VoiceGerman001', language: 'es' },
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
      voice: 'VoiceGerman001',
      language: 'de',
    });
    assert.equal(prepared.status, 201);
    assert.equal(prepared.body.url, `/v1/speech/${prepared.body.id}.mp3`);

    const before = fake.calls.length;
    const first = await fetch(`${playerUrl}/${prepared.body.id}`);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('content-type'), 'audio/mpeg');
    assert.equal(Buffer.from(await first.arrayBuffer()).toString(), 'ID3-fake-mp3');

    const sent = fake.calls.at(-1);
    assert.equal(sent.body.text, 'Hallo, ich bin da.');
    assert.equal(sent.body.model_id, 'eleven_multilingual_v2');
    assert.equal('language_code' in sent.body, false);

    // Die Datei schreibt der Dienst, sobald der Strom zu Ende ist.
    await new Promise((resolve) => setTimeout(resolve, 50));
    const second = await fetch(`${playerUrl}/${prepared.body.id}`);
    assert.equal(Buffer.from(await second.arrayBuffer()).toString(), 'ID3-fake-mp3');
    assert.equal(fake.calls.length, before + 1);
  });

  test('schnelle Modelle bekommen die Sprache mit', async () => {
    current = service({ model: 'eleven_flash_v2_5' });
    const prepared = await current.prepare({
      text: 'Bonjour',
      voice: 'VoiceGerman001',
      language: 'fr',
    });
    const response = await fetch(`${playerUrl}/${prepared.body.id}`);
    await response.arrayBuffer();
    assert.equal(fake.calls.at(-1).body.language_code, 'fr');
    assert.equal(fake.calls.at(-1).body.model_id, 'eleven_flash_v2_5');
  });

  test('leeres Guthaben und Andrang werden zu eigenen Fehlern und stehen im Status', async () => {
    current = service();
    const quota = await current.prepare({ text: 'Hallo', voice: 'QuotaVoice001', language: 'de' });
    const failed = await fetch(`${playerUrl}/${quota.body.id}`);
    assert.equal(failed.status, 502);
    assert.deepEqual(await failed.json(), { error: 'quota_exceeded' });
    assert.equal((await current.status()).body.lastError, 'quota_exceeded');

    const busy = await current.prepare({ text: 'Hallo', voice: 'BusyVoice0001', language: 'de' });
    const limited = await fetch(`${playerUrl}/${busy.body.id}`);
    assert.deepEqual(await limited.json(), { error: 'rate_limited' });
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

  test('Fehlerschluessel aus den Antworten von ElevenLabs', () => {
    assert.equal(upstreamError(400, { status: 'quota_exceeded' }), 'quota_exceeded');
    assert.equal(upstreamError(403, { code: 'voice_access_denied' }), 'not_allowed');
    assert.equal(upstreamError(400, { code: 'text_too_long' }), 'too_long');
    assert.equal(upstreamError(500, null), 'speech_failed');
  });
});
