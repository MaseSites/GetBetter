/**
 * Die reinen Teile von Paket A: Tagesart, Mengen-Umrechnung, Wertebereiche,
 * Obergrenzen, Tageszaehlung in Zuerich, kaputte Ablage und `once`.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, describe, test } = require('node:test');

const { dayKindOf } = require('./dayKind.js');
const { activeMinutesOf, clampNumber, gramRange, validPieceGrams } = require('./limits.js');
const { toGrams } = require('./recipes.js');
const { applyRetention, capPerOwner } = require('./retention.js');
const { createFitService, IDEMPOTENCY_TTL_MS } = require('./service.js');
const { createFitStore, ownerView } = require('./store.js');
const { callsOn, dayIn } = require('./usage.js');

const DAY = 24 * 60 * 60 * 1000;

/** Eine Sicht wie `forOwner` auf festen Tabellen. */
const viewOf = (tables) => ownerView({ profiles: [], scheduledWorkouts: [], mealAnalyses: [], ...tables }, 'acc_a', false);

describe('dayKindOf', () => {
  test('geplante Einheiten zaehlen, ausgelassene nicht', () => {
    const own = viewOf({
      scheduledWorkouts: [
        { id: 'w1', ownerId: 'acc_a', day: '2026-09-21', status: 'planned' },
        { id: 'w2', ownerId: 'acc_a', day: '2026-09-22', status: 'skipped' },
      ],
    });
    assert.equal(dayKindOf(own, '2026-09-21'), 'training');
    assert.equal(dayKindOf(own, '2026-09-22'), 'rest');
    assert.equal(dayKindOf(own, '2026-09-23'), 'rest');
  });

  test('ohne Plan das Muster aus dem Profil (3 Tage: Mo, Mi, Fr)', () => {
    const own = viewOf({ profiles: [{ id: 'p', ownerId: 'acc_a', profile: { trainingDaysPerWeek: 3 } }] });
    assert.equal(dayKindOf(own, '2026-09-21'), 'training'); // Montag
    assert.equal(dayKindOf(own, '2026-09-22'), 'rest'); // Dienstag
    assert.equal(dayKindOf(own, '2026-09-25'), 'training'); // Freitag
    assert.equal(dayKindOf(viewOf({}), '2026-09-21'), 'rest');
  });
});

describe('toGrams', () => {
  test('Einheiten', () => {
    assert.equal(toGrams(200, 'g'), 200);
    assert.equal(toGrams(1.5, 'kg'), 1500);
    assert.equal(toGrams(2, 'pinch'), 1);
    assert.equal(toGrams(2, 'piece', { gramsPerPiece: 120 }), 240);
    assert.equal(toGrams(2, 'piece', {}), null);
    assert.equal(toGrams(100, 'ml'), 100);
    assert.equal(toGrams(100, 'ml', { gramsPerMl: 0.92 }), 92);
  });
  test('Unsinn gibt null', () => {
    assert.equal(toGrams(0, 'g'), null);
    assert.equal(toGrams(-1, 'g'), null);
    assert.equal(toGrams('x', 'g'), null);
    assert.equal(toGrams(1, 'fass'), null);
  });
});

describe('limits', () => {
  test('clampNumber', () => {
    assert.equal(clampNumber(5000, { min: 0, max: 3000 }), 3000);
    assert.equal(clampNumber('12', { min: 0, max: 30 }), 12);
    assert.equal(clampNumber('x', { min: 0, max: 30 }, 7), 7);
  });
  test('gramRange: in 0–3000, nie verkehrt, fehlend faellt weg', () => {
    assert.deepEqual(gramRange(100, 80, 120), { minGrams: 80, maxGrams: 120 });
    assert.deepEqual(gramRange(100, 150, 9e9), { minGrams: 100, maxGrams: 3000 });
    assert.deepEqual(gramRange(100, -5, 50), { minGrams: 0, maxGrams: 100 });
    assert.deepEqual(gramRange(100, undefined, 'x'), {});
    assert.deepEqual(gramRange(Number.NaN, 5000, 10), { minGrams: 10, maxGrams: 10 });
  });
  test('validPieceGrams: 1–2000', () => {
    assert.equal(validPieceGrams(120), 120);
    assert.equal(validPieceGrams(0), null);
    assert.equal(validPieceGrams(2001), null);
    assert.equal(validPieceGrams('120'), null);
  });
  test('activeMinutesOf: 0–600, sonst die Kochzeit', () => {
    assert.equal(activeMinutesOf(20, 45), 20);
    assert.equal(activeMinutesOf(99999, 45), 600);
    assert.equal(activeMinutesOf(undefined, 45), 45);
    assert.equal(activeMinutesOf('x', 9999), 600);
    assert.equal(activeMinutesOf(null, undefined), 0);
  });
});

describe('retention', () => {
  const now = Date.parse('2026-09-22T12:00:00Z');
  const iso = (ms) => new Date(ms).toISOString();

  test('capPerOwner behaelt die neuesten je Konto', () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({ ownerId: 'a', createdAt: iso(now + index) }));
    const kept = capPerOwner([...rows, { ownerId: 'b', createdAt: iso(now) }], 3, 'createdAt');
    assert.equal(kept.filter((row) => row.ownerId === 'a').length, 3);
    assert.equal(kept.filter((row) => row.ownerId === 'b').length, 1);
    assert.equal(kept[0].createdAt, iso(now + 2));
  });

  test('offene Vorschlaege bleiben, alte Rohdaten und Ledger fallen, abgelaufener Zwischenspeicher weg', () => {
    const tables = {
      coachMessages: Array.from({ length: 205 }, (_, index) => ({ ownerId: 'a', createdAt: iso(now + index) })),
      coachActions: [
        ...Array.from({ length: 3 }, (_, index) => ({ ownerId: 'a', status: 'proposed', createdAt: iso(now - DAY + index) })),
        ...Array.from({ length: 200 }, (_, index) => ({ ownerId: 'a', status: 'confirmed', createdAt: iso(now + index) })),
      ],
      mealAnalyses: [
        { ownerId: 'a', createdAt: iso(now - 40 * DAY), vision: { foods: [] }, costChf: 0.01 },
        { ownerId: 'a', createdAt: iso(now - DAY), vision: { foods: [] } },
      ],
      usageLedger: [
        { ownerId: 'a', at: iso(now - 500 * DAY), costChf: 1 },
        { ownerId: 'a', at: iso(now - 10 * DAY), costChf: 1 },
      ],
      foodCache: [
        { key: 'off:1', food: null, expiresAt: now - 1 },
        { key: 'off:2', food: {}, expiresAt: now + DAY },
      ],
    };
    applyRetention(tables, now);
    assert.equal(tables.coachMessages.length, 200);
    assert.equal(tables.coachActions.length, 200);
    assert.equal(tables.coachActions.filter((row) => row.status === 'proposed').length, 3);
    assert.equal(tables.mealAnalyses[0].vision, undefined);
    assert.equal(tables.mealAnalyses[0].costChf, 0.01);
    assert.ok(tables.mealAnalyses[1].vision);
    assert.equal(tables.usageLedger.length, 1);
    assert.deepEqual(tables.foodCache.map((row) => row.key), ['off:2']);
  });
});

describe('Tageszaehlung in Zuerich', () => {
  test('dayIn: kurz vor Mitternacht UTC ist in Zuerich schon morgen', () => {
    assert.equal(dayIn('2026-09-21T22:30:00Z'), '2026-09-22');
    assert.equal(dayIn('2026-09-21T21:30:00Z'), '2026-09-21');
    assert.equal(dayIn('kaputt'), null);
  });
  test('callsOn zaehlt jeden Aufruf nach seinem Tag, nicht nach dem Mahlzeit-Tag', () => {
    const own = viewOf({
      mealAnalyses: [
        { id: 'a1', ownerId: 'acc_a', day: '2026-01-01', calls: ['2026-09-22T08:00:00Z', '2026-09-22T08:05:00Z'] },
        { id: 'a2', ownerId: 'acc_a', day: '2026-09-22', createdAt: '2026-09-21T10:00:00Z' },
        { id: 'a3', ownerId: 'acc_a', day: '2026-09-21', createdAt: '2026-09-21T22:30:00Z' },
      ],
    });
    assert.equal(callsOn(own, '2026-09-22'), 3);
    assert.equal(callsOn(own, '2026-09-21'), 1);
  });
});

describe('Ablage und once', () => {
  let root;
  before(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'better-fit-safety-'));
  });
  after(() => fs.rm(root, { recursive: true, force: true }));

  test('kaputte fit.json: Abschrift beiseite, lesen leer, schreiben verweigert', async () => {
    const dataDir = await fs.mkdtemp(path.join(root, 'kaputt-'));
    await fs.writeFile(path.join(dataDir, 'fit.json'), '{"version":1,"tables":{"meals":[{"id"');
    const store = createFitStore({ dataDir });
    assert.deepEqual(await store.read((tx) => tx.forOwner('acc_a').list('meals')), []);
    await assert.rejects(
      store.transact((tx) => tx.forOwner('acc_a').insert('meals', { day: '2026-09-22' })),
      (error) => error.code === 'store_unavailable',
    );
    assert.equal(store.isBroken(), true);
    const names = await fs.readdir(dataDir);
    assert.ok(names.some((name) => name.startsWith('fit.json.corrupt-')));
    // Das Original bleibt, wie es war.
    assert.ok((await fs.readFile(path.join(dataDir, 'fit.json'), 'utf8')).startsWith('{"version":1'));
  });

  test('once: gemerkt 24 h, danach neu; Fehler werden nicht gemerkt', async () => {
    const dataDir = await fs.mkdtemp(path.join(root, 'once-'));
    let clock = Date.parse('2026-09-22T08:00:00Z');
    const service = createFitService({ dataDir, env: {}, now: () => new Date(clock) });
    const { once } = service.context;
    let runs = 0;
    const work = async () => ({ status: 201, body: { run: ++runs } });

    assert.deepEqual((await once('acc_a', 'schluessel-1', work)).body, { run: 1 });
    assert.deepEqual((await once('acc_a', 'schluessel-1', work)).body, { run: 1 });
    // Ein anderes Konto mit demselben Schluessel ist eine andere Anfrage.
    assert.deepEqual((await once('acc_b', 'schluessel-1', work)).body, { run: 2 });
    clock += IDEMPOTENCY_TTL_MS + 1;
    assert.deepEqual((await once('acc_a', 'schluessel-1', work)).body, { run: 3 });

    const failing = async () => ({ status: 400, body: { error: 'nope', run: ++runs } });
    assert.equal((await once('acc_a', 'schluessel-2', failing)).status, 400);
    assert.deepEqual((await once('acc_a', 'schluessel-2', work)).body, { run: 5 });

    // Wirft die Arbeit, ist der Schluessel wieder frei.
    await assert.rejects(once('acc_a', 'schluessel-3', async () => { throw new Error('boom'); }));
    assert.deepEqual((await once('acc_a', 'schluessel-3', work)).body, { run: 6 });

    assert.equal((await once('acc_a', 'x', work)).status, 400);
    assert.deepEqual((await once('acc_a', null, work)).body, { run: 7 });
  });

  test('once: gleichzeitig mit demselben Schluessel laeuft die Arbeit einmal', async () => {
    const dataDir = await fs.mkdtemp(path.join(root, 'once-parallel-'));
    const service = createFitService({ dataDir, env: {} });
    let runs = 0;
    const slow = async () => {
      runs += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { status: 201, body: { run: runs } };
    };
    const results = await Promise.all(Array.from({ length: 5 }, () => service.context.once('acc_a', 'gleichzeitig-1', slow)));
    assert.equal(runs, 1);
    for (const result of results) assert.deepEqual(result.body, { run: 1 });
  });
});
