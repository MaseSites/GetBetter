/**
 * Der Zwischenspeicher der Stimmen: Schluessel, Aufraeumen nach Hits und
 * Groesse, Proben, kaputter Index. Der Datenordner liegt im Temp-Verzeichnis.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, describe, test } = require('node:test');

const {
  CACHE_DIR,
  INDEX_FILE,
  SAMPLES_DIR,
  cacheIdOf,
  createSpeechCache,
  keyTextOf,
  limitsOf,
  readCacheStats,
} = require('./cache.js');

const MB = 1024 * 1024;
const idOf = (n) => n.toString(16).padStart(32, '0');
const exists = (file) => fs.access(file).then(
  () => true,
  () => false,
);

describe('Zwischenspeicher der Stimmen', () => {
  let root;
  let counter = 0;
  const freshDir = async () => {
    counter += 1;
    const dir = path.join(root, `run-${counter}`);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  };
  const folderOf = (dir, purpose) =>
    purpose === 'sample' ? path.join(dir, CACHE_DIR, SAMPLES_DIR) : path.join(dir, CACHE_DIR);
  const put = async (dir, id, purpose, bytes = 10) => {
    await fs.mkdir(folderOf(dir, purpose), { recursive: true });
    await fs.writeFile(path.join(folderOf(dir, purpose), `${id}.mp3`), Buffer.alloc(bytes));
  };

  before(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'better-speech-cache-'));
  });

  after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  test('Schluessel: Leerraum, Anfuehrungszeichen, Apostrophe und Striche gleich — Gross/klein und Satzzeichen nicht', () => {
    assert.equal(keyTextOf('  3 Bananen hinzugefügt. '), '3 Bananen hinzugefügt.');
    assert.equal(keyTextOf('„Brot“ – ist’s «da»?'), '"Brot" - ist\'s "da"?');
    const base = { model: 'eleven_multilingual_v2', voice: 'VoiceGerman001', language: 'de' };
    const id = cacheIdOf({ ...base, text: '3 Bananen hinzugefügt.' });
    assert.match(id, /^[a-f0-9]{32}$/);
    assert.equal(cacheIdOf({ ...base, text: '3 Bananen hinzugefügt. ' }), id);
    assert.equal(cacheIdOf({ ...base, text: '3  Bananen\nhinzugefügt.' }), id);
    assert.notEqual(cacheIdOf({ ...base, text: '3 bananen hinzugefügt.' }), id);
    assert.notEqual(cacheIdOf({ ...base, text: '3 Bananen hinzugefügt!' }), id);
    assert.notEqual(cacheIdOf({ ...base, voice: 'VoiceEnglish01', text: '3 Bananen hinzugefügt.' }), id);
    assert.notEqual(cacheIdOf({ ...base, text: '3 Bananen hinzugefügt.', purpose: 'sample' }), id);
  });

  test('Grenzen: Anzahl und Megabytes, auch als Text aus der Umgebung', () => {
    assert.deepEqual(limitsOf({}), { maxFiles: 2000, maxBytes: 200 * MB });
    assert.deepEqual(limitsOf({ maxFiles: '50', maxMb: '3' }), { maxFiles: 50, maxBytes: 3 * MB });
    assert.deepEqual(limitsOf({ maxFiles: 'viel', maxMb: '-1' }), { maxFiles: 2000, maxBytes: 200 * MB });
  });

  test('beim Aufraeumen bleibt der oft gespielte Satz, der einmalige faellt, Proben bleiben immer', async () => {
    const dir = await freshDir();
    let clock = Date.parse('2026-09-14T08:00:00.000Z');
    const cache = createSpeechCache({ dataDir: dir, maxFiles: 2, now: () => clock });
    const [frequent, oneOff, newest, sample] = [idOf(1), idOf(2), idOf(3), idOf(4)];

    await put(dir, sample, 'sample');
    await cache.store(sample, { purpose: 'sample', characters: 21, bytes: 10 });
    await put(dir, frequent, 'speech');
    await cache.store(frequent, { purpose: 'speech', characters: 22, bytes: 10 });
    clock += 1000;
    await put(dir, oneOff, 'speech');
    await cache.store(oneOff, { purpose: 'speech', characters: 80, bytes: 10 });
    for (let round = 0; round < 3; round += 1) {
      clock += 1000;
      await cache.hit(frequent);
    }
    clock += 1000;
    // Der dritte Satz sprengt die Grenze von zwei: der einmalige muss gehen, nicht der neue.
    await put(dir, newest, 'speech');
    await cache.store(newest, { purpose: 'speech', characters: 40, bytes: 10 });

    const folder = folderOf(dir, 'speech');
    assert.equal(await exists(path.join(folder, `${frequent}.mp3`)), true);
    assert.equal(await exists(path.join(folder, `${newest}.mp3`)), true);
    assert.equal(await exists(path.join(folder, `${oneOff}.mp3`)), false);
    assert.equal(await exists(path.join(folderOf(dir, 'sample'), `${sample}.mp3`)), true);

    const index = JSON.parse(await fs.readFile(path.join(folder, INDEX_FILE), 'utf8'));
    assert.deepEqual(Object.keys(index.entries).sort(), [frequent, newest, sample].sort());
    assert.deepEqual(index.entries[frequent], {
      hits: 3,
      lastPlayedAt: '2026-09-14T08:00:04.000Z',
      characters: 22,
      bytes: 10,
      purpose: 'speech',
    });
    assert.equal(index.entries[sample].purpose, 'sample');

    // Auch wenn nur noch Proben und oft gespielte da sind: Proben fallen nie.
    const tight = createSpeechCache({ dataDir: dir, maxFiles: 1, maxBytes: 1, now: () => clock });
    await put(dir, idOf(5), 'speech');
    await tight.store(idOf(5), { purpose: 'speech', characters: 10, bytes: 10 });
    assert.equal(await exists(path.join(folderOf(dir, 'sample'), `${sample}.mp3`)), true);
    assert.equal(await exists(path.join(folder, `${idOf(5)}.mp3`)), true);
  });

  test('auch die Groesse zaehlt', async () => {
    const dir = await freshDir();
    const cache = createSpeechCache({ dataDir: dir, maxFiles: 100, maxBytes: 25 });
    for (const n of [1, 2, 3]) {
      await put(dir, idOf(n), 'speech', 10);
      await cache.store(idOf(n), { purpose: 'speech', characters: 5, bytes: 10 });
    }
    const stats = await readCacheStats(dir);
    assert.deepEqual([stats.entries, stats.bytes], [2, 20]);
    assert.equal(await exists(path.join(folderOf(dir, 'speech'), `${idOf(3)}.mp3`)), true);
  });

  test('ein kaputter oder fehlender Index entsteht neu aus den Dateien', async () => {
    const dir = await freshDir();
    const folder = folderOf(dir, 'speech');
    await put(dir, idOf(7), 'speech', 12);
    await put(dir, idOf(8), 'sample', 9);
    await fs.writeFile(path.join(folder, INDEX_FILE), '{kaputt');
    const sampleStat = await fs.stat(path.join(folderOf(dir, 'sample'), `${idOf(8)}.mp3`));

    const stats = await readCacheStats(dir);
    assert.deepEqual([stats.entries, stats.samples, stats.bytes, stats.replays], [2, 1, 21, 0]);

    const cache = createSpeechCache({ dataDir: dir });
    await cache.hit(idOf(7), { characters: 30 });
    const index = JSON.parse(await fs.readFile(path.join(folder, INDEX_FILE), 'utf8'));
    assert.equal(index.version, 1);
    assert.deepEqual(index.entries[idOf(8)], {
      hits: 0,
      lastPlayedAt: new Date(sampleStat.mtimeMs).toISOString(),
      characters: null,
      bytes: 9,
      purpose: 'sample',
    });
    assert.deepEqual([index.entries[idOf(7)].hits, index.entries[idOf(7)].characters], [1, 30]);

    await fs.writeFile(path.join(folder, INDEX_FILE), JSON.stringify({ version: 1, entries: [] }));
    assert.equal((await readCacheStats(dir)).entries, 2);
    await fs.rm(path.join(folder, INDEX_FILE));
    assert.equal((await readCacheStats(dir)).entries, 2);
  });

  test('gleichzeitige Hits gehen nicht verloren, und die Liste zeigt nie eine Id', async () => {
    const dir = await freshDir();
    await put(dir, idOf(9), 'speech');
    const cache = createSpeechCache({ dataDir: dir });
    await Promise.all(Array.from({ length: 20 }, () => cache.hit(idOf(9), { characters: 12 })));
    const stats = await readCacheStats(dir);
    assert.equal(stats.replays, 20);
    assert.equal(stats.top.length, 1);
    assert.deepEqual(Object.keys(stats.top[0]).sort(), ['bytes', 'characters', 'hits', 'lastPlayedAt', 'purpose']);
    assert.deepEqual([stats.top[0].hits, stats.top[0].characters], [20, 12]);
    assert.equal(JSON.stringify(stats).includes(idOf(9)), false);
  });
});
