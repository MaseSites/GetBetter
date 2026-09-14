/**
 * Echt klingende Stimmen: der Dienst spricht mit ElevenLabs, die Apps nie.
 *
 * Der Schluessel liegt nur hier — in `ELEVENLABS_API_KEY` oder in der Datei
 * `<datenordner>/elevenlabs.key` — und geht nie in eine Antwort, ins Log oder
 * in eine App. Er wird bei jeder Anfrage neu gelesen: wer ihn eintraegt oder
 * tauscht, muss den Dienst dafuer nicht neu starten.
 *
 * Ablauf: `POST /v1/speech` merkt sich Text, Stimme und Sprache und gibt eine
 * Adresse mit einem Einmal-Ticket zurueck (`/v1/speech/<id>.mp3?play=<ticket>`);
 * `GET` darauf holt das Audio bei ElevenLabs und reicht es weiter, waehrend es
 * noch ankommt — so beginnt der Lautsprecher, bevor der ganze Satz gerechnet
 * ist. Der Text steht dabei nie in einer Adresse. `POST /v1/speech/sample` ist
 * die Probe beim Aussuchen: den Satz waehlt der Dienst, je Sprache einen festen
 * ohne Namen — einmal erzeugt, danach fuer alle gratis.
 *
 * Fertiges Audio kommt in den Zwischenspeicher (`cache.js`): derselbe Satz mit
 * derselben Stimme kostet nur einmal Guthaben, oft gesagte bleiben am
 * laengsten, Proben immer. Jede Wiedergabe mit Ticket und jede Erzeugung wird
 * eine Zeile in `speech-usage.jsonl` (`usage.js`) — ohne Text.
 *
 * Abo und Kontingent (`billing/`): ohne Abo fuer diese App gibt es keine
 * Stimmen von ElevenLabs (`403 plan_required`), auch nicht aus dem
 * Zwischenspeicher — dann spricht der Browser. Mit Abo kostet ein Satz aus dem
 * Speicher nichts und geht immer; ein neuer nur, solange er ins Budget passt
 * (`402 budget_exhausted`). Der Betrag wird beim Ticket reserviert und nach
 * der Wiedergabe mit der echten Zeile verrechnet.
 */
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const { speechChfOf } = require('../billing/costs.js');
const { accountInStore, createBilling } = require('../billing/service.js');
const { cacheIdOf, createSpeechCache } = require('./cache.js');
const { creditsPerCharacter, recordSpeechUsage } = require('./usage.js');

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
const APPS = new Set(['getbetter', 'betterfamily', 'bettergym', 'betterai', 'bettermoney']);
const VOICE_ID = /^[A-Za-z0-9]{8,64}$/;
const SPEECH_ID = /^[a-f0-9]{32}$/;
const PLAY_BYTES = 12;
const PLAY_ID = /^[a-f0-9]{24}$/;
const MAX_TEXT = 1000;
const MAX_ACCOUNT_ID = 100;
const TIMEOUT_MS = 60_000;
const VOICES_TTL_MS = 10 * 60_000;
const MAX_VOICE_PAGES = 3;
const JOB_TTL_MS = 5 * 60_000;
/** So lange haelt ein Ticket seinen Betrag fest: bis es verfaellt, plus eine ganze Erzeugung. */
const HOLD_MS = JOB_TTL_MS + TIMEOUT_MS;
const MAX_JOBS = 500;
const LABEL_LENGTH = 60;

/**
 * Die Probe beim Aussuchen: ein fester Satz je Sprache, nie mit Namen. Dieselben
 * Saetze stehen in `assistant.voice.sampleAnon` fuer die Stimme des Browsers.
 */
const SAMPLE_TEXT = Object.freeze({
  de: 'Hallo, so klinge ich.',
  en: 'Hi, this is how I sound.',
  fr: 'Salut, voici ma voix.',
  it: 'Ciao, ecco come suono.',
});

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

const charactersOf = (text) => Array.from(text).length;

/** Wer spricht: ein Konto (eine Angabe, keine Anmeldung) und eine der fuenf Apps — sonst null. */
function speakerOf(input) {
  const accountId = input?.accountId;
  return {
    accountId:
      typeof accountId === 'string' && accountId.length > 0 && accountId.length <= MAX_ACCOUNT_ID
        ? accountId
        : null,
    app: APPS.has(input?.app) ? input.app : null,
  };
}

/** Hoechstens `MAX_JOBS` Eintraege; abgelaufene fallen zuerst weg. */
function remember(map, key, value) {
  const now = Date.now();
  for (const [known, entry] of map) if (entry.expires < now) map.delete(known);
  if (map.size >= MAX_JOBS) map.delete(map.keys().next().value);
  map.set(key, { ...value, expires: now + JOB_TTL_MS });
}

/** Protokoll und Index duerfen scheitern — das Audio laeuft trotzdem. */
async function quietly(what, task) {
  try {
    await task();
  } catch (error) {
    process.stderr.write(`[speech] ${what}: ${error?.code ?? error?.name ?? 'Error'}\n`);
  }
}

/**
 * `record` (ein Eintrag -> Promise), `cacheBytes`, `findAccount` und `billing`
 * nur fuer Tests; `cacheFiles` und `cacheMb` kommen aus
 * `BETTER_SPEECH_CACHE_FILES|MB`. `billing` teilt der Dienst mit der KI.
 */
function createSpeechService({
  dataDir,
  cors = {},
  baseUrl,
  model,
  readKey,
  record,
  cacheFiles,
  cacheMb,
  cacheBytes,
  findAccount = accountInStore,
  billing = createBilling({ dataDir, findAccount }),
} = {}) {
  const base = typeof baseUrl === 'string' && TEST_BASE.test(baseUrl) ? baseUrl : PRODUCTION_BASE;
  const modelId = typeof model === 'string' && MODEL_PATTERN.test(model) ? model : DEFAULT_MODEL;
  const cache = createSpeechCache({ dataDir, maxFiles: cacheFiles, maxMb: cacheMb, maxBytes: cacheBytes });
  const keyFile = path.join(dataDir, 'elevenlabs.key');
  const write = record ?? ((entry) => recordSpeechUsage(dataDir, entry));
  const jobs = new Map();
  const plays = new Map();
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

  /** Eine Zeile ins Protokoll und ins Kassenbuch — auch wenn das Schreiben scheitert. */
  async function log(entry) {
    const full = { model: modelId, ...entry };
    let line = null;
    await quietly('Verbrauch', async () => {
      line = await write(full);
    });
    const billed = !full.cached && (full.billed ?? full.ok) === true;
    const fallback = { ...full, credits: billed ? full.characters * creditsPerCharacter(modelId) : 0 };
    billing.ledger.addSpeech(line && typeof line === 'object' ? line : fallback);
  }

  /** Was ein neuer Satz bei ElevenLabs hoechstens kostet, in CHF. */
  const sentenceChf = (text) => speechChfOf(charactersOf(text) * creditsPerCharacter(modelId), billing.speech());

  /**
   * Darf dieses Konto diesen Satz hoeren? -> `{ holdId }` (null aus dem
   * Speicher) oder `{ refused }` mit fertiger Antwort. Ohne Abo nie; mit Abo aus
   * dem Speicher immer, neu nur, solange er ins Budget passt.
   */
  async function admit(input, id, text) {
    const { accountId, app } = speakerOf(input);
    const account = accountId !== null && app !== null ? await findAccount(accountId) : null;
    const cached = await cache.has(id);
    await billing.ledger.ready();
    // Ab hier ohne await: pruefen und reservieren in einem Zug.
    const standing = billing.standingOf(account, app);
    if (!account || standing.plan !== 'paid') {
      return { refused: reply(403, billing.refusalOf('plan_required', standing)) };
    }
    if (cached) return { holdId: null };
    const chf = sentenceChf(text);
    if (chf > standing.remainingChf) {
      return { refused: reply(402, billing.refusalOf('budget_exhausted', standing)) };
    }
    return { holdId: billing.ledger.hold(account.id, app, chf, HOLD_MS) };
  }

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

  /**
   * `allowed`: ob dieses Konto in dieser App Stimmen von ElevenLabs bekommt.
   * `reason` sagt warum nicht (`plan_required`, `budget_exhausted`) — ohne
   * Konto (vor dem Anmelden) gilt Gratis, also der Browser.
   */
  async function status(query = {}) {
    const configured = (await key()) !== null;
    const { accountId, app } = speakerOf(query);
    const account = accountId !== null && app !== null ? await findAccount(accountId) : null;
    await billing.ledger.ready();
    const standing = billing.standingOf(account, app);
    const paid = Boolean(account) && standing.plan === 'paid';
    const reason = !paid ? 'plan_required' : standing.remainingChf > 0 ? null : 'budget_exhausted';
    return reply(200, {
      provider: 'elevenlabs',
      configured,
      lastError: configured ? lastError : null,
      allowed: configured && reason === null,
      plan: standing.plan,
      reason,
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

  /**
   * Prueft das Kontingent, merkt sich den Auftrag und gibt die Adresse mit
   * einem frischen Einmal-Ticket zurueck. Das Ticket haelt die Reservierung.
   */
  async function ticketFor(id, job, input) {
    const admitted = await admit(input, id, job.text);
    if (admitted.refused) return admitted.refused;
    remember(jobs, id, job);
    const ticket = crypto.randomBytes(PLAY_BYTES).toString('hex');
    remember(plays, ticket, {
      id,
      purpose: job.purpose,
      voiceId: job.voice,
      characters: charactersOf(job.text),
      holdId: admitted.holdId,
      ...speakerOf(input),
    });
    return reply(201, { id, url: `/v1/speech/${id}.mp3?play=${ticket}` });
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

    const id = cacheIdOf({ model: modelId, voice, language, text });
    return ticketFor(id, { text, voice, language, purpose: 'speech' }, input);
  }

  /** Die Probe: den Satz waehlt der Dienst — ein mitgeschickter Text zaehlt nicht. */
  async function prepareSample(input) {
    const voice = input?.voice;
    if (typeof voice !== 'string' || !VOICE_ID.test(voice)) return reply(400, { error: 'bad_request' });
    const language = LANGUAGES.has(input?.language) ? input.language : 'de';
    if ((await key()) === null) return reply(503, { error: 'not_configured' });

    const text = SAMPLE_TEXT[language];
    const id = cacheIdOf({ model: modelId, voice, language, text, purpose: 'sample' });
    return ticketFor(id, { text, voice, language, purpose: 'sample' }, input);
  }

  /** Ein Ticket gilt einmal und nur fuer seinen Satz. */
  function takePlay(ticket, id) {
    if (typeof ticket !== 'string' || !PLAY_ID.test(ticket)) return null;
    const play = plays.get(ticket);
    plays.delete(ticket);
    return play && play.id === id && play.expires >= Date.now() ? play : null;
  }

  /** `{ ok, billed, error }` — `billed`, sobald ElevenLabs Audio geliefert hat. */
  async function synthesize(res, apiKey, id, job) {
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
      sendJson(res, 502, { error: 'unreachable' });
      return { ok: false, billed: false, error: 'unreachable' };
    }
    if (!response.ok || !response.body) {
      const error = upstreamError(response.status, await detailOf(response));
      lastError = error;
      sendJson(res, 502, { error });
      return { ok: false, billed: false, error };
    }
    lastError = null;

    res.writeHead(200, audioHeaders());
    const file = cache.fileOf(id, job.purpose);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const partial = `${file}.${crypto.randomBytes(4).toString('hex')}.part`;
    const handle = await fs.open(partial, 'w');
    let bytes = 0;
    let complete = false;
    try {
      for await (const chunk of response.body) {
        const data = Buffer.from(chunk);
        await handle.write(data);
        bytes += data.length;
        // Wer nicht mehr zuhoert, bekommt nichts — gespeichert wird trotzdem.
        if (!res.destroyed) res.write(data);
      }
      complete = true;
    } catch {
      // Abgebrochen: angefangenes Audio kommt nicht in den Zwischenspeicher.
    } finally {
      await handle.close();
    }
    res.end();
    if (!complete) {
      await fs.rm(partial, { force: true });
      return { ok: false, billed: true, error: 'interrupted' };
    }
    await fs.rename(partial, file);
    await quietly('Zwischenspeicher', () =>
      cache.store(id, { purpose: job.purpose, characters: charactersOf(job.text), bytes }),
    );
    return { ok: true, billed: true, error: null };
  }

  /**
   * Liefert das Audio. Nur eine Wiedergabe mit gueltigem Ticket zaehlt als Hit
   * und kommt ins Protokoll — ein zweites Holen desselben Audios nicht. Erzeugt
   * wird nur mit gueltigem Ticket: nur das hat das Kontingent geprueft.
   */
  async function serve(res, id, ticket) {
    if (!SPEECH_ID.test(String(id))) return sendJson(res, 404, { error: 'not_found' });
    const play = takePlay(ticket, id);
    try {
      return await deliver(res, id, play);
    } finally {
      // Gebucht ist jetzt die echte Zeile — die Reservierung faellt weg.
      if (play?.holdId) billing.ledger.release(play.holdId);
    }
  }

  async function deliver(res, id, play) {
    // Laeuft derselbe Satz schon, wird er danach aus dem Speicher geholt.
    const running = inflight.get(id);
    if (running) await running.catch(() => undefined);

    const cached = await cache.read(id);
    if (cached) {
      res.writeHead(200, audioHeaders({ 'Content-Length': cached.bytes.length }));
      res.end(cached.bytes);
      if (play) {
        await quietly('Zwischenspeicher', () => cache.hit(id, { characters: play.characters }));
        await log({
          accountId: play.accountId,
          app: play.app,
          purpose: play.purpose,
          voiceId: play.voiceId,
          characters: play.characters,
          cached: true,
          ok: true,
        });
      }
      return undefined;
    }

    const job = jobs.get(id);
    if (!play || !job || job.expires < Date.now()) return sendJson(res, 404, { error: 'not_found' });
    const apiKey = await key();
    if (!apiKey) return sendJson(res, 503, { error: 'not_configured' });

    const done = synthesize(res, apiKey, id, job);
    inflight.set(id, done);
    let outcome;
    try {
      outcome = await done;
    } finally {
      inflight.delete(id);
    }
    await log({
      accountId: play.accountId,
      app: play.app,
      purpose: job.purpose,
      voiceId: job.voice,
      characters: charactersOf(job.text),
      cached: false,
      ok: outcome.ok,
      billed: outcome.billed,
      error: outcome.error,
    });
    return undefined;
  }

  return { status, voices, prepare, prepareSample, serve };
}

module.exports = { MAX_TEXT, SAMPLE_TEXT, createSpeechService, upstreamError };
