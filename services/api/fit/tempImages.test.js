/** Wartende und behaltene Fotos: Ablauf, Aufbewahrungsfrist, Loeschen je Konto, Ids. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, describe, test } = require('node:test');

const { ID_PATTERN, MAX_AGE_MS, createTempImages } = require('./tempImages.js');

const DAY = 24 * 60 * 60 * 1000;
const IMAGE = { mime: 'image/png', bytes: Buffer.from('bild') };

describe('tempImages', () => {
  let root;
  before(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'better-fit-img-'));
  });
  after(() => fs.rm(root, { recursive: true, force: true }));

  const setup = async (keptDays = 30) => {
    const dataDir = await fs.mkdtemp(path.join(root, 'd-'));
    let clock = Date.now();
    const images = createTempImages({ dataDir, now: () => clock, keptDays });
    return { dataDir, images, advance: (ms) => (clock += ms) };
  };

  test('ID_PATTERN: nur 32 Hex-Zeichen, kein Pfad', () => {
    assert.ok(ID_PATTERN.test('a'.repeat(32)));
    assert.equal(ID_PATTERN.test('A'.repeat(32)), false);
    assert.equal(ID_PATTERN.test('../../etc/passwd'), false);
    assert.equal(ID_PATTERN.test('a'.repeat(31)), false);
  });

  test('save und load; fremde Ids und Typen laden nichts', async () => {
    const { images } = await setup();
    const ref = await images.save(IMAGE);
    assert.ok(ID_PATTERN.test(ref.id));
    assert.equal(String((await images.load(ref)).bytes), 'bild');
    assert.equal(await images.load({ id: '../x', mime: 'image/png' }), null);
    assert.equal(await images.load({ id: ref.id, mime: 'image/gif' }), null);
    await images.remove([ref, { id: 'kaputt', mime: 'image/png' }]);
    assert.equal(await images.load(ref), null);
  });

  test('sweep: wartende Fotos nach einer Stunde weg, behaltene nach ihrer Frist', async () => {
    const { dataDir, images, advance } = await setup(30);
    const ref = await images.save(IMAGE);
    await images.keep('acc_anna', IMAGE);
    // Die Datei ist gerade eben geschrieben; die Uhr laeuft vor.
    advance(MAX_AGE_MS - 60_000);
    assert.deepEqual(await images.sweep(), { temp: 0, kept: 0 });
    advance(120_000);
    assert.deepEqual(await images.sweep(), { temp: 1, kept: 0 });
    assert.equal(await images.load(ref), null);
    advance(30 * DAY);
    assert.deepEqual(await images.sweep(), { temp: 0, kept: 1 });
    assert.deepEqual(await fs.readdir(path.join(dataDir, 'fit-images')), []);
  });

  test('removeKept loescht nur die Fotos dieses Kontos', async () => {
    const { dataDir, images } = await setup();
    await images.keep('acc_anna', IMAGE);
    await images.keep('acc_anna', IMAGE);
    await images.keep('acc_ben', IMAGE);
    await images.removeKept('acc_anna');
    assert.equal((await fs.readdir(path.join(dataDir, 'fit-images'))).length, 1);
    // Ohne Ordner kein Fehler.
    const empty = await setup();
    await empty.images.removeKept('acc_anna');
    assert.deepEqual(await empty.images.sweep(), { temp: 0, kept: 0 });
  });
});
