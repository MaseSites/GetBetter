/**
 * Echt klingende Stimmen: der Dienst spricht mit ElevenLabs, die Apps nie.
 *
 * Der Schluessel liegt nur hier — in `ELEVENLABS_API_KEY` oder in der Datei
 * `<datenordner>/elevenlabs.key` — und geht nie in eine Antwort, ins Log oder
 * in eine App. Er wird bei jeder Anfrage neu gelesen: wer ihn eintraegt oder
 * tauscht, muss den Dienst dafuer nicht neu starten.
 *
 * Ablauf: `POST /v1/speech` merkt sich Text, Stimme und Sprache und gibt eine
 * Adresse zurueck; `GET /v1/speech/<id>.mp3` holt das Audio bei ElevenLabs und
 * reicht es weiter, waehrend es noch ankommt — so beginnt der Lautsprecher,
 * bevor der ganze Satz gerechnet ist. Der Text steht dabei nie in einer Adresse.
 *
 * Fertiges Audio liegt in `<datenordner>/speech-cache/`: derselbe Satz mit
 * derselben Stimme kostet nur einmal Guthaben.
 */
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const PRODUCTION_BASE = 'https://api.elevenlabs.io';
/** Nur fuer Tests: ein nachgebauter Dienst auf dem eigenen Rechner. */
const TEST_BASE = /^http:\/\/127\.0\.0\.1:\d{1,5}$/;
/** Klingt am natuerlichsten bei kurzen Saetzen; mit `BETTER_SPEECH_MODEL` tauschbar. */
const DEFAULT_MODEL = 'eleven_multilingual_v2';
/** Nur diese Modelle nehmen `language_code` an; die anderen erkennen die Sprache am Text. */
const LANGUAGE_CODE_MODELS = /^(eleven_flash_v2_5|eleven_turbo_v2_5|eleven_v3)/;
const MODEL_PATTERN = /^[a-z0-9_]{3,64}$/;
const OUTPUT_FORMAT = 'mp3_44100_128';
const LANGUAGES = new Set(['de', 'fr', 'it', 'en']);
const VOICE_ID = /^[A-Za-z0-9]{8,64}$/;
const SPEECH_ID = /^[a-f0-9]{32}$/;
const MAX_TEXT = 1000;
const TIMEOUT_MS = 60_000;
const VOICES_TTL_MS = 10 * 60_000;
const MAX_VOICE_PAGES = 3;
const JOB_TTL_MS = 5 * 60_000;
const MAX_JOBS = 500;
const MAX_CACHED_FILES = 400;
const LABEL_LENGTH = 60;

const reply = (status, body) => ({ status, body });

/** Was ElevenLabs meldet, als eigener Schluessel — nie der Text der Antwort. */
function upstreamError(status, detail) {
  const code = String(detail?.code ?? detail?.status ?? '').toLowerCase();
  if (status === 401 || code.includes('api_key')) return 'auth_failed';
  if (status === 402 || code === 'quota_exceeded' || code === 'insufficient_credits') {
    return 'quota_exceeded';
  }
  if (status === 429) return 'rate_limited';
  if (code === 'voice_not_found' || code === 'invalid_voice_id' || status === 404) {
    return 'voice_not_found';
  }
  if (status === 403) return 'not_allowed';
  if (code === 'text_too_long') return 'too_long';
  return 'speech_failed';
}

async function detailOf(response) {
  try {
    const data = await response.json();
    return data && typeof data.detail === 'object' ? data.detail : null;
  } catch {
    return null;
  }
}

const label = (value) =>
  typeof value === 'string' && value.length > 0 ? value.slice(0, LABEL_LENGTH) : null;

/** Eine Stimme, wie die Apps sie brauchen. Was nicht passt, faellt weg. */
function voiceOf(raw) {
  if (!raw || typeof raw.voice_id !== 'string' || !VOICE_ID.test(raw.voice_id)) return null;
  const labels = raw.labels && typeof raw.labels === 'object' ? raw.labels : {};
  const languages = Array.isArray(raw.verified_languages)
    ? [...new Set(raw.verified_languages.map((entry) => label(entry?.language)).filter(Boolean))]
    : [];
  return {
    id: raw.voice_id,
    name: label(raw.name) ?? raw.voice_id,
    gender: label(labels.gender),
    accent: label(labels.accent),
    languages,
  };
}

/** Wer die Sprache nachweislich spricht, steht oben; danach nach Namen. */
function sortFor(voices, language) {
  return [...voices].sort((a, b) => {
    const speaks = Number(b.languages.includes(language)) - Number(a.languages.includes(language));
    return speaks !== 0 ? speaks : a.name.localeCompare(b.name);
  });
}

function createSpeechService({ dataDir, cors = {}, baseUrl, model, readKey } = {}) {
  const base = typeof baseUrl === 'string' && TEST_BASE.test(baseUrl) ? baseUrl : PRODUCTION_BASE;
  const modelId = typeof model === 'string' && MODEL_PATTERN.test(model) ? model : DEFAULT_MODEL;
  const cacheDir = path.join(dataDir, 'speech-cache');
  const keyFile = path.join(dataDir, 'elevenlabs.key');
  const jobs = new Map();
  const inflight = new Map();
  let voiceCache = null;
  let lastError = null;

  const key =
    readKey ??
    (async () => {
      const fromEnv = process.env.ELEVENLABS_API_KEY?.trim();
      if (fromEnv) return fromEnv;
      try {
        const stored = (await fs.readFile(keyFile, 'utf8')).trim();
        return stored.length > 0 ? stored : null;
      } catch {
        return null;
      }
    });

  const fingerprintOf = (apiKey) =>
    crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 16);

  function sendJson(res, status, body) {
    const text = JSON.stringify(body);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(text),
      ...cors,
    });
    res.end(text);
  }

  const audioHeaders = (extra = {}) => ({
    'Content-Type': 'audio/mpeg',
    'Cache-Control': 'private, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    ...cors,
    ...extra,
  });

  async function status() {
    const configured = (await key()) !== null;
    return reply(200, {
      provider: 'elevenlabs',
      configured,
      lastError: configured ? lastError : null,
    });
  }

  async function fetchVoices(apiKey) {
    const all = [];
    let token = null;
    for (let page = 0; page < MAX_VOICE_PAGES; page += 1) {
      const url = new URL('/v2/voices', base);
      url.searchParams.set('page_size', '100');
      if (token) url.searchParams.set('next_page_token', token);
      let response;
      try {
        response = await fetch(url, {
          headers: { 'xi-api-key': apiKey },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch {
        return { error: 'unreachable' };
      }
      if (!response.ok) return { error: upstreamError(response.status, await detailOf(response)) };
      const data = await response.json().catch(() => null);
      if (!data || !Array.isArray(data.voices)) return { error: 'speech_failed' };
      all.push(...data.voices.map(voiceOf).filter(Boolean));
      if (!data.has_more || typeof data.next_page_token !== 'string') break;
      token = data.next_page_token;
    }
    return { voices: all };
  }

  async function voices(language) {
    const apiKey = await key();
    if (!apiKey) return reply(503, { error: 'not_configured' });
    const wanted = LANGUAGES.has(language) ? language : 'de';
    const fingerprint = fingerprintOf(apiKey);
    const fresh =
      voiceCache !== null &&
      voiceCache.fingerprint === fingerprint &&
      Date.now() - voiceCache.at < VOICES_TTL_MS;
    if (!fresh) {
      const fetched = await fetchVoices(apiKey);
      if (fetched.error) {
        lastError = fetched.error;
        return reply(502, { error: fetched.error });
      }
      voiceCache = { fingerprint, at: Date.now(), voices: fetched.voices };
      lastError = null;
    }
    return reply(200, { voices: sortFor(voiceCache.voices, wanted) });
  }

  function remember(id, job) {
    const now = Date.now();
    for (const [known, entry] of jobs) if (entry.expires < now) jobs.delete(known);
    if (jobs.size >= MAX_JOBS) jobs.delete(jobs.keys().next().value);
    jobs.set(id, { ...job, expires: now + JOB_TTL_MS });
  }

  async function prepare(input) {
    const text = typeof input?.text === 'string' ? input.text.replace(/\s+/g, ' ').trim() : '';
    const voice = input?.voice;
    const language = input?.language;
    const valid =
      text.length > 0 &&
      text.length <= MAX_TEXT &&
      typeof voice === 'string' &&
      VOICE_ID.test(voice) &&
      LANGUAGES.has(language);
    if (!valid) return reply(400, { error: 'bad_request' });
    if ((await key()) === null) return reply(503, { error: 'not_configured' });

    const id = crypto
      .createHash('sha256')
      .update([modelId, voice, language, text].join(' '))
      .digest('hex')
      .slice(0, 32);
    remember(id, { text, voice, language });
    return reply(201, { id, url: `/v1/speech/${id}.mp3` });
  }

  async function sendCached(res, file) {
    let bytes;
    try {
      bytes = await fs.readFile(file);
    } catch {
      return false;
    }
    res.writeHead(200, audioHeaders({ 'Content-Length': bytes.length }));
    res.end(bytes);
    return true;
  }

  async function prune() {
    const names = (await fs.readdir(cacheDir)).filter((name) => name.endsWith('.mp3'));
    if (names.length <= MAX_CACHED_FILES) return;
    const dated = await Promise.all(
      names.map(async (name) => ({
        name,
        at: (await fs.stat(path.join(cacheDir, name))).mtimeMs,
      })),
    );
    dated.sort((a, b) => a.at - b.at);
    await Promise.all(
      dated
        .slice(0, names.length - MAX_CACHED_FILES)
        .map(({ name }) => fs.rm(path.join(cacheDir, name), { force: true })),
    );
  }

  async function synthesize(res, apiKey, job, file) {
    const url = new URL(`/v1/text-to-speech/${job.voice}/stream`, base);
    url.searchParams.set('output_format', OUTPUT_FORMAT);
    const body = {
      text: job.text,
      model_id: modelId,
      ...(LANGUAGE_CODE_MODELS.test(modelId) ? { language_code: job.language } : {}),
    };

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      lastError = 'unreachable';
      return sendJson(res, 502, { error: 'unreachable' });
    }
    if (!response.ok || !response.body) {
      const error = upstreamError(response.status, await detailOf(response));
      lastError = error;
      return sendJson(res, 502, { error });
    }
    lastError = null;

    res.writeHead(200, audioHeaders());
    await fs.mkdir(cacheDir, { recursive: true });
    const partial = `${file}.${crypto.randomBytes(4).toString('hex')}.part`;
    const handle = await fs.open(partial, 'w');
    let complete = false;
    try {
      for await (const chunk of response.body) {
        const bytes = Buffer.from(chunk);
        await handle.write(bytes);
        // Wer nicht mehr zuhoert, bekommt nichts — gespeichert wird trotzdem.
        if (!res.destroyed) res.write(bytes);
      }
      complete = true;
    } catch {
      // Abgebrochen: angefangenes Audio kommt nicht in den Zwischenspeicher.
    } finally {
      await handle.close();
    }
    res.end();
    if (complete) {
      await fs.rename(partial, file);
      await prune();
    } else {
      await fs.rm(partial, { force: true });
    }
  }

  async function serve(res, id) {
    if (!SPEECH_ID.test(String(id))) return sendJson(res, 404, { error: 'not_found' });
    const file = path.join(cacheDir, `${id}.mp3`);
    // Laeuft derselbe Satz schon, wird er danach aus dem Speicher geholt.
    const running = inflight.get(id);
    if (running) await running.catch(() => undefined);
    if (await sendCached(res, file)) return undefined;

    const job = jobs.get(id);
    if (!job || job.expires < Date.now()) return sendJson(res, 404, { error: 'not_found' });
    const apiKey = await key();
    if (!apiKey) return sendJson(res, 503, { error: 'not_configured' });

    const done = synthesize(res, apiKey, job, file);
    inflight.set(id, done);
    try {
      await done;
    } finally {
      inflight.delete(id);
    }
    return undefined;
  }

  return { status, voices, prepare, serve };
}

module.exports = { MAX_TEXT, createSpeechService, upstreamError };
