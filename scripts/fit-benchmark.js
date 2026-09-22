/**
 * Genauigkeits-Benchmark der Foto-Mahlzeitenanalyse von Better Fit gegen
 * Nutrition5k (Google Research, CC BY 4.0) — ueber die echte Pipeline:
 * ein eigener Dienst im Temp-Ordner (live, Gemini, Schweizer Katalog),
 * Konto, Profil, dann je Gericht `POST /v1/fit/meal-analysis/start` wie die App.
 *
 *   npx -y node@24 scripts/fit-benchmark.js --n 40 --split test --seed 1 \
 *     --label baseline2 --max-chf 1.0 --concurrency 1
 *     [--variant <name>] [--language en|de] [--pause-ms 2000] [--retries 3]
 *     [--vision-model <name>] [--allow-fallback] [--out <datei.json>]
 *   npx -y node@24 scripts/fit-benchmark.js --compare a.json b.json
 *
 * Schreibt services/api/data/fit-reference/benchmarks/<datum>-<label>.json und
 * .md daneben und gibt die Zusammenfassung aus. Laeuft es nochmal mit
 * demselben `--label`, wird dieselbe Datei fortgeschrieben: fertige Gerichte
 * bleiben, nur die offenen und die gescheiterten werden geholt.
 * Der Schluessel kommt aus services/api/.env.local und wird nie ausgegeben.
 *
 * Standard ist **sequenziell**: parallele Anfragen laufen bei Gemini reihenweise
 * in 429 (`provider_busy`), und der Dienst weicht dann still auf sein
 * Ersatzmodell aus — gemessen waere das falsche Modell. Darum ist das
 * Ersatzmodell hier abgeschaltet (`--allow-fallback` erlaubt es wieder) und
 * jedes Gericht wird bei einem Anbieterfehler selbst nochmal versucht.
 */
const fs = require('node:fs');
const path = require('node:path');

const { fitConfig } = require('../services/api/fit/config.js');
const { startFitServer } = require('../services/api/test/fitHarness.js');
const { loadDishes, loadSplit, imagePath, imageReady, shuffle, dominantOf } = require('./benchmark/nutrition5k.js');
const { scoreDish, summarize } = require('./benchmark/metrics.js');
const { markdown } = require('./benchmark/report.js');
const { compare } = require('./benchmark/compare.js');
const { preflight } = require('./benchmark/preflight.js');

const API = path.join(__dirname, '..', 'services', 'api');
const DATA = path.join(API, 'data');
const N5K = path.join(DATA, 'fit-reference', 'nutrition5k');
const OUT_DIR = path.join(DATA, 'fit-reference', 'benchmarks');

/** Wartezeit vor dem 2., 3. und 4. Versuch — lang genug, dass ein 429-Fenster vorbei ist. */
const BACKOFF_MS = [5_000, 15_000, 40_000];

const PROFILE = { birthDate: '1990-03-14', heightCm: 172, weightKg: 68, sex: 'female', activity: 'moderate', trainingDaysPerWeek: 3, goal: 'maintain', diet: 'omnivore', allergies: [], maxCookMinutes: 45, equipment: ['stove', 'oven', 'blender'] };

function parseArgs(argv) {
  const args = { n: 40, split: 'test', seed: 1, label: 'run', concurrency: 1, language: 'en', maxChf: 1.5, out: null, minKcal: 20, variant: null, pauseMs: 2000, retries: 3, visionModel: null, allowFallback: false, compare: null };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i].replace(/^--/, '');
    const value = argv[i + 1];
    if (key === 'compare') {
      args.compare = [path.resolve(argv[i + 1]), path.resolve(argv[i + 2])];
      i += 2;
      continue;
    }
    if (key === 'allow-fallback') {
      args.allowFallback = true;
      continue;
    }
    i += 1;
    if (key === 'n') args.n = Number(value);
    else if (key === 'split') args.split = value;
    else if (key === 'seed') args.seed = Number(value);
    else if (key === 'label') args.label = value.replace(/[^a-zA-Z0-9_-]/g, '-');
    else if (key === 'concurrency') args.concurrency = Math.max(1, Number(value));
    else if (key === 'language') args.language = value;
    else if (key === 'max-chf') args.maxChf = Number(value);
    else if (key === 'out') args.out = path.resolve(value);
    else if (key === 'min-kcal') args.minKcal = Number(value);
    else if (key === 'variant') args.variant = String(value);
    else if (key === 'pause-ms') args.pauseMs = Math.max(0, Number(value));
    else if (key === 'retries') args.retries = Math.max(0, Number(value));
    else if (key === 'vision-model') args.visionModel = String(value);
    else throw new Error(`Unbekannte Option --${key}`);
  }
  if (args.compare) return args;
  if (!['train', 'test'].includes(args.split)) throw new Error('--split train|test');
  if (!Number.isInteger(args.n) || args.n < 1) throw new Error('--n muss eine ganze Zahl sein');
  return args;
}

/** `.env.local` selbst lesen — nur Werte, nie ausgeben. */
function readEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match || line.trim().startsWith('#')) continue;
    env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2').trim();
  }
  return env;
}

const lastError = (stderr, secret) => {
  const lines = String(stderr).trim().split(/\r?\n/).slice(-6).join(' | ');
  return secret ? lines.split(secret).join('<key>') : lines;
};

const zurichDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Kosten, Dauer und Modell stehen nur an der Analyse im Dienst — nicht in der Antwort. */
function analysisRow(dir, id) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(dir, 'fit.json'), 'utf8'));
    return (parsed?.tables?.mealAnalyses ?? []).find((row) => row.id === id) ?? null;
  } catch {
    return null;
  }
}

/** Was auch fehlgeschlagene Aufrufe gekostet haben, steht im Kassenbuch des Dienstes. */
function totalServiceCost(dir) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(dir, 'fit.json'), 'utf8'));
    return (parsed?.tables?.mealAnalyses ?? []).reduce((sum, row) => sum + (row.costChf ?? 0), 0);
  } catch {
    return null;
  }
}

/**
 * Lohnt ein neuer Versuch? Nur bei Aerger auf dem Weg — nie bei einer echten
 * Antwort (`no_food` 422), einem falschen Schluessel oder einem Limit (429).
 */
function transient(status, error) {
  if (status === 0 || status === 503 || status === 500) return true;
  if (status !== 502) return false;
  return error !== 'provider_auth' && error !== 'not_configured';
}

function truthOf(dish) {
  return { kcal: dish.kcal, massG: dish.massG, proteinG: dish.proteinG, carbsG: dish.carbsG, fatG: dish.fatG, dominant: dominantOf(dish), ingredients: dish.ingredients.map(({ name, grams, kcal }) => ({ name, grams: Math.round(grams * 10) / 10, kcal: Math.round(kcal) })) };
}

function predictedOf(analysis) {
  const items = (analysis.items ?? []).map((item) => ({
    term: item.term,
    foodName: item.food?.name ?? null,
    foodId: item.food?.id ?? null,
    preparation: item.preparation ?? null,
    grams: Number(item.grams) || 0,
    confidence: item.confidence ?? null,
    matchUncertain: item.matchUncertain ?? null,
    stateMismatch: item.stateMismatch ?? null,
    kcal: item.nutrients?.kcal ?? null,
  }));
  const total = analysis.total ?? {};
  return {
    mealName: analysis.mealName ?? null,
    mealClass: analysis.mealClass ?? null,
    level: analysis.level ?? null,
    overallConfidence: analysis.overallConfidence ?? null,
    reviewRequired: analysis.reviewRequired ?? null,
    questions: (analysis.questions ?? []).map((question) => ({ id: question.id, kind: question.kind })),
    warnings: analysis.warnings ?? [],
    kcal: total.kcal ?? 0,
    proteinG: total.proteinG ?? 0,
    carbsG: total.carbsG ?? 0,
    fatG: total.fatG ?? 0,
    kcalRange: analysis.range ? [analysis.range.kcalMin, analysis.range.kcalMax] : null,
    massG: items.reduce((sum, item) => sum + item.grams, 0),
    unmatched: items.filter((item) => !item.foodId).length,
    items,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.compare) {
    console.log(compare(args.compare[0], args.compare[1]));
    return;
  }
  const date = zurichDay();
  const outFile = args.out ?? path.join(OUT_DIR, `${date}-${args.label}.json`);
  const mdFile = outFile.replace(/\.json$/, '.md');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  const env = readEnvFile(path.join(API, '.env.local'));
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY fehlt in services/api/.env.local');
  // Das Hauptmodell kommt aus derselben Stelle wie im Dienst — nie doppelt geschrieben.
  const mainModel = fitConfig({ ...(args.visionModel ? { GEMINI_VISION_MODEL: args.visionModel } : {}) }).visionModel;

  // Stichprobe: Split nach Seed mischen, dann die ersten n mit Metadaten, Bild und genug kcal.
  const dishes = loadDishes(N5K);
  const order = shuffle(loadSplit(N5K, args.split), args.seed);
  const sample = [];
  let waiting = 0;
  for (const id of order) {
    if (sample.length >= args.n) break;
    const dish = dishes.get(id);
    if (!dish || !(dish.kcal >= args.minKcal) || !(dish.massG > 0)) continue;
    if (!imageReady(N5K, id)) {
      waiting += 1;
      continue;
    }
    sample.push(dish);
  }
  if (waiting) console.warn(`Hinweis: ${waiting} Gerichte der Reihenfolge ohne Bild übersprungen (Download läuft?). Die Stichprobe ist erst mit allen Bildern stabil.`);

  // Fortsetzen: alles Bekannte bleibt stehen, damit auch die Fehler im Bericht
  // bleiben — geholt werden aber nur die, die noch nicht geklappt haben.
  const previous = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : null;
  const records = new Map((previous?.records ?? []).map((record) => [record.dishId, record]));
  const todo = sample.filter((dish) => records.get(dish.id)?.status !== 'ok');
  const priorCost = [...records.values()].reduce((sum, record) => sum + (record.costChf ?? 0), 0);
  const doneCount = [...records.values()].filter((record) => record.status === 'ok').length;
  console.log(`${sample.length} Gerichte, ${doneCount} schon fertig, ${todo.length} offen. Kostendeckel CHF ${args.maxChf}, Modell ${mainModel}${args.allowFallback ? '' : ' (kein Ersatzmodell)'}.`);

  const meta = { label: args.label, variant: args.variant, date, split: args.split, seed: args.seed, n: args.n, language: args.language, concurrency: args.concurrency, pauseMs: args.pauseMs, retries: args.retries, minKcal: args.minKcal, mainModel, allowFallback: args.allowFallback, sample: sample.map((dish) => dish.id), models: [], startedAt: previous?.meta?.startedAt ?? new Date().toISOString() };
  const save = () => {
    const list = sample.map((dish) => records.get(dish.id)).filter(Boolean);
    meta.models = [...new Set(list.map((record) => record.model).filter(Boolean))];
    meta.updatedAt = new Date().toISOString();
    const summary = summarize(list, mainModel);
    fs.writeFileSync(outFile, JSON.stringify({ meta, summary, records: list }, null, 2));
    const md = markdown(meta, summary, list);
    fs.writeFileSync(mdFile, md);
    return md;
  };

  if (todo.length === 0) {
    console.log(save());
    return;
  }

  // Erst fragen, dann eine halbe Stunde laufen: ist das Tageskontingent des
  // Modells aufgebraucht, bringt kein Warten etwas — dann lieber gleich sagen,
  // was zu tun ist. Der Lauf laesst sich spaeter mit demselben --label fortsetzen.
  const ready = await preflight(mainModel, env.GEMINI_API_KEY);
  if (!ready.ok) {
    console.warn(`Vorabfrage an ${mainModel}: ${ready.message}`);
    if (ready.daily || ready.status === 401 || ready.status === 403 || ready.status === 404) {
      console.warn('');
      console.warn('Nichts geholt — die bisherigen Ergebnisse bleiben stehen.');
      console.warn(`Fortsetzen geht jederzeit mit demselben Aufruf (--label ${args.label}): fertige Gerichte werden übersprungen.`);
      if (ready.daily) console.warn(`Alternativen: Abrechnung bei Google einschalten, oder ein Modell mit freiem Kontingent messen (--vision-model <name> --variant <name>).`);
      console.log(save());
      return;
    }
  }

  const serverEnv = {
    ...env,
    MEAL_ANALYSIS_MODE: 'live',
    MONTHLY_AI_BUDGET_CHF: String(Math.max(50, args.maxChf * 10)),
    MAX_MEAL_ANALYSES_PER_USER_PER_DAY: '500',
    FIT_RATE_LIMIT_PER_MINUTE: '1000',
  };
  // Leer heisst: kein Ersatzmodell. So antwortet entweder das Hauptmodell oder gar nichts.
  if (!args.allowFallback) serverEnv.GEMINI_FALLBACK_MODEL = '';
  if (args.visionModel) serverEnv.GEMINI_VISION_MODEL = args.visionModel;

  const server = await startFitServer(serverEnv);
  try {
    // Der Katalog wird erst bei der ersten Anfrage gelesen: jetzt noch hineinlegen.
    fs.copyFileSync(path.join(DATA, 'fit-catalog-swiss.json'), path.join(server.dir, 'fit-catalog-swiss.json'));
    const reference = path.join(DATA, 'fit-reference', 'reference.json');
    if (fs.existsSync(reference)) {
      fs.mkdirSync(path.join(server.dir, 'fit-reference'), { recursive: true });
      fs.copyFileSync(reference, path.join(server.dir, 'fit-reference', 'reference.json'));
      console.log('Referenzdaten (fit-reference/reference.json) mitgenommen.');
    }
    const user = await server.signUp('benchmark');
    const profile = await server.call('PUT', '/v1/fit/profile', { token: user.token, body: PROFILE });
    if (profile.status !== 200) throw new Error(`Profil: ${profile.status}`);
    const day = zurichDay();

    let stopped = false;
    let index = 0;
    /** Reisst das Kontingent mitten im Lauf, scheitert alles Weitere auch — dann Schluss. */
    let busyInARow = 0;
    const GIVE_UP_AFTER = 3;
    /** Wie viel vom Deckel noch uebrig ist — inklusive der Fehlversuche im Dienst. */
    const spentSoFar = () => priorCost + (totalServiceCost(server.dir) ?? 0);

    const analyse = async (dish) => {
      const image = fs.readFileSync(imagePath(N5K, dish.id)).toString('base64');
      let attempt = 0;
      for (;;) {
        attempt += 1;
        const started = Date.now();
        let response;
        try {
          response = await server.call('POST', '/v1/fit/meal-analysis/start', {
            token: user.token,
            body: { image: `data:image/jpeg;base64,${image}`, day, slot: 'lunch', language: args.language },
          });
        } catch (error) {
          response = { status: 0, body: { error: `network: ${error.message}` } };
        }
        const latencyS = (Date.now() - started) / 1000;
        if (response.status === 201) {
          const analysis = response.body.analysis;
          const row = analysisRow(server.dir, analysis.id);
          const predicted = predictedOf(analysis);
          const truth = truthOf(dish);
          return { dishId: dish.id, status: 'ok', attempts: attempt, latencyS, costChf: row?.costChf ?? 0, model: row?.model ?? null, serviceDurationMs: row?.durationMs ?? null, analysisId: analysis.id, truth, predicted, score: scoreDish(truth, predicted) };
        }
        const code = response.body?.error ?? '';
        // Wiederholt wird nur, was vorbeigehen kann — und nur, solange der Deckel es traegt.
        const more = attempt <= args.retries && transient(response.status, code);
        const room = spentSoFar() < args.maxChf;
        if (!more || !room) {
          if (more && !room) console.warn(`  ${dish.id}: kein Versuch mehr, Kostendeckel erreicht.`);
          // Ein 500 ist ein Fehler im Dienst: die letzte Zeile aus stderr hilft beim Suchen (Schluessel geschwaerzt).
          const detail = response.status >= 500 && response.status !== 502 ? lastError(server.stderr(), env.GEMINI_API_KEY) : null;
          return { dishId: dish.id, status: 'failed', attempts: attempt, latencyS, error: `${response.status} ${code}`.trim(), ...(detail ? { detail } : {}), costChf: 0, model: null, truth: truthOf(dish) };
        }
        const pause = BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
        console.log(`  ${dish.id}: ${response.status} ${code} — nochmal in ${pause / 1000} s (Versuch ${attempt + 1}/${args.retries + 1})`);
        await wait(pause);
      }
    };

    const worker = async () => {
      while (!stopped && index < todo.length) {
        if (spentSoFar() >= args.maxChf) {
          if (!stopped) console.warn(`Kostendeckel CHF ${args.maxChf} erreicht — Schluss.`);
          stopped = true;
          break;
        }
        const dish = todo[index];
        index += 1;
        const record = await analyse(dish);
        records.set(dish.id, record);
        save();
        const line = record.status === 'ok'
          ? `${record.score.kcalSignedPct >= 0 ? '+' : ''}${record.score.kcalSignedPct.toFixed(0)} % kcal (${record.predicted.kcal}/${Math.round(record.truth.kcal)}), ${record.latencyS.toFixed(1)} s, ${record.model ?? '—'}`
          : `FEHLER ${record.error} nach ${record.attempts} Versuchen`;
        console.log(`[${records.size}/${sample.length}] ${dish.id}: ${line}`);

        busyInARow = record.status === 'ok' ? 0 : busyInARow + 1;
        if (busyInARow >= GIVE_UP_AFTER) {
          const why = await preflight(mainModel, env.GEMINI_API_KEY);
          if (why.daily) {
            console.warn('');
            console.warn(`${GIVE_UP_AFTER} Gerichte hintereinander gescheitert — ${why.message}`);
            console.warn(`Schluss für heute. Fortsetzen mit demselben --label ${args.label}, fertige Gerichte bleiben.`);
            stopped = true;
            break;
          }
          busyInARow = 0;
        }
        // Kleine Pause, damit das Minutenkontingent von Gemini nicht reisst.
        if (args.pauseMs && index < todo.length) await wait(args.pauseMs);
      }
    };
    await Promise.all(Array.from({ length: Math.min(args.concurrency, todo.length) }, worker));
    const serviceCost = totalServiceCost(server.dir);
    if (serviceCost !== null) console.log(`Kosten dieses Laufs laut Dienst (inkl. Fehlversuche): CHF ${serviceCost.toFixed(4)}`);
  } finally {
    await server.stop();
  }
  console.log('');
  console.log(save());
  console.log(`Geschrieben: ${outFile}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
