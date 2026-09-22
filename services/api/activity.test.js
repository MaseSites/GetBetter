/**
 * Das Aktivitaetsprotokoll: Schreiben, Drehen der Datei, Filter beim Lesen
 * und was nicht mehr zaehlt. Der Datenordner liegt im Temp-Verzeichnis.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, describe, test } = require('node:test');

const {
  ACTIVITY_FILE,
  IGNORED_KINDS,
  ROTATED_FILE,
  kindMatches,
  readActivity,
  recordActivity,
} = require('./activity.js');

describe('kindMatches', () => {
  test('matches kinds exactly or by their prefix', () => {
    assert.equal(kindMatches('session.created', 'session'), true);
    assert.equal(kindMatches('session.created', 'session.created'), true);
    assert.equal(kindMatches('sessions.created', 'session'), false);
    assert.equal(kindMatches('session.created', 'session.c'), false);
  });
});

describe('recordActivity and readActivity', () => {
  let root;
  let counter = 0;
  const freshDir = async () => {
    counter += 1;
    const dir = path.join(root, `run-${counter}`);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  };

  before(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'better-activity-'));
  });

  after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  test('writes one JSON line with a timestamp and only the known fields', async () => {
    const dir = await freshDir();
    const line = await recordActivity(dir, {
      accountId: 'acc_a',
      kind: 'admin.updated',
      detail: { fields: ['firstName'] },
      password: 'geheim',
    });
    assert.match(line.at, /^\d{4}-\d{2}-\d{2}T/);
    const raw = await fs.readFile(path.join(dir, ACTIVITY_FILE), 'utf8');
    assert.deepEqual(JSON.parse(raw), line);
    assert.deepEqual(Object.keys(line), ['at', 'accountId', 'kind', 'detail']);
    assert.equal(raw.includes('geheim'), false);
  });

  test('refuses a missing kind and shrinks an oversized detail', async () => {
    const dir = await freshDir();
    assert.equal(await recordActivity(dir, { accountId: 'acc_a' }), null);
    assert.equal(await recordActivity(dir, { kind: 'Nicht Gueltig' }), null);
    const big = await recordActivity(dir, { kind: 'x.y', detail: { text: 'a'.repeat(5000) } });
    assert.deepEqual(big.detail, { truncated: true });
    assert.equal(big.accountId, null);
  });

  test('rotates above the size limit and reads both files, newest first', async () => {
    const dir = await freshDir();
    const at = (second) => `2026-09-14T08:00:0${second}.000Z`;
    for (let second = 0; second < 4; second += 1) {
      await recordActivity(
        dir,
        { at: at(second), accountId: 'acc_a', kind: 'session.created', detail: {} },
        // Eine Zeile hat knapp 90 Bytes: so dreht jedes weitere Schreiben.
        { maxBytes: 100 },
      );
    }
    await fs.access(path.join(dir, ROTATED_FILE));
    // Die vorige gedrehte Fassung faellt weg: uebrig sind die letzten zwei, neueste zuerst.
    const entries = await readActivity(dir);
    assert.deepEqual(
      entries.map((entry) => entry.at),
      [at(3), at(2)],
    );
  });

  test('filters by account, kind, before and limit and skips broken lines', async () => {
    const dir = await freshDir();
    const lines = [
      { at: '2026-09-14T08:00:00.000Z', accountId: 'acc_a', kind: 'session.created', detail: {} },
      { at: '2026-09-14T08:00:01.000Z', accountId: 'acc_b', kind: 'session.failed', detail: {} },
      { at: '2026-09-14T08:00:02.000Z', accountId: 'acc_a', kind: 'plan.requested', detail: {} },
      { at: '2026-09-14T08:00:03.000Z', accountId: null, kind: 'admin.updated', detail: {} },
    ];
    const text = [
      JSON.stringify(lines[0]),
      '{kaputt',
      JSON.stringify({ kind: 'ohne.zeit' }),
      JSON.stringify(lines[1]),
      JSON.stringify({ at: 'gestern', kind: 'x.y' }),
      JSON.stringify(lines[2]),
      JSON.stringify(lines[3]),
      '',
    ].join('\n');
    await fs.writeFile(path.join(dir, ACTIVITY_FILE), text);

    const at = (entries) => entries.map((entry) => entry.at.slice(17, 19));
    assert.deepEqual(at(await readActivity(dir)), ['03', '02', '01', '00']);
    assert.deepEqual(at(await readActivity(dir, { accountId: 'acc_a' })), ['02', '00']);
    assert.deepEqual(at(await readActivity(dir, { kind: 'session' })), ['01', '00']);
    assert.deepEqual(at(await readActivity(dir, { kind: 'session.failed' })), ['01']);
    assert.deepEqual(at(await readActivity(dir, { before: '2026-09-14T08:00:02.000Z' })), ['01', '00']);
    assert.deepEqual(at(await readActivity(dir, { limit: 2 })), ['03', '02']);
    assert.deepEqual(await readActivity(path.join(dir, 'fehlt')), []);
  });

  test('no longer writes changes of collections, profiles or AI replies and skips old ones', async () => {
    const dir = await freshDir();
    assert.deepEqual([...IGNORED_KINDS].sort(), ['ai.reply', 'collection.changed', 'profile.updated']);
    for (const kind of IGNORED_KINDS) {
      assert.equal(await recordActivity(dir, { accountId: 'acc_a', kind, detail: {} }), null, kind);
    }
    await assert.rejects(fs.access(path.join(dir, ACTIVITY_FILE)));

    // Zeilen aus der Zeit, als sie noch geschrieben wurden, stehen nie im Verlauf.
    const old = (second, kind) =>
      JSON.stringify({ at: `2026-09-14T08:00:0${second}.000Z`, accountId: 'acc_a', kind, detail: {} });
    await fs.writeFile(
      path.join(dir, ROTATED_FILE),
      `${[old(0, 'account.created'), old(1, 'collection.changed')].join('\n')}\n`,
    );
    await fs.writeFile(
      path.join(dir, ACTIVITY_FILE),
      `${[old(2, 'profile.updated'), old(3, 'session.created'), old(4, 'ai.reply')].join('\n')}\n`,
    );
    const kinds = async (query) => (await readActivity(dir, query)).map((entry) => entry.kind);
    assert.deepEqual(await kinds(), ['session.created', 'account.created']);
    assert.deepEqual(await kinds({ kind: 'collection' }), []);
    assert.deepEqual(await kinds({ kind: 'profile.updated' }), []);
    assert.deepEqual(await kinds({ limit: 1 }), ['session.created']);
  });
});
