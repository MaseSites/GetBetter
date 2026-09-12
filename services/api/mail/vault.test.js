const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const { VaultError, createVault, decrypt, encrypt } = require('./vault.js');

const dirs = [];
async function tempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'better-vault-'));
  dirs.push(dir);
  return dir;
}

after(async () => {
  for (const dir of dirs) await fs.rm(dir, { recursive: true, force: true });
});

test('encrypts and decrypts with the same key and id', () => {
  const key = crypto.randomBytes(32);
  const entry = encrypt(key, 'mac_1', 'Passwört "mit" Zeichen');
  assert.equal(decrypt(key, 'mac_1', entry), 'Passwört "mit" Zeichen');
  assert.notEqual(encrypt(key, 'mac_1', 'x').iv, encrypt(key, 'mac_1', 'x').iv);
});

test('fails with a wrong key or a foreign id', () => {
  const key = crypto.randomBytes(32);
  const entry = encrypt(key, 'mac_1', 'geheim');
  assert.throws(() => decrypt(crypto.randomBytes(32), 'mac_1', entry), VaultError);
  assert.throws(() => decrypt(key, 'mac_2', entry), VaultError);
  const tampered = { ...entry, data: Buffer.from('anders').toString('base64') };
  assert.throws(() => decrypt(key, 'mac_1', tampered), VaultError);
});

test('stores secrets encrypted on disk, creates the key once and removes entries', async () => {
  const dir = await tempDir();
  const vault = createVault(dir);
  await vault.put('mac_a', 'erstes-Passwort');
  await vault.put('mac_b', 'zweites-Passwort');

  const key = await fs.readFile(path.join(dir, 'mail.key'));
  assert.equal(key.length, 32);
  const stored = await fs.readFile(path.join(dir, 'mail-vault.json'), 'utf8');
  assert.ok(!stored.includes('Passwort'));
  assert.deepEqual(Object.keys(JSON.parse(stored).entries).sort(), ['mac_a', 'mac_b']);

  // Eine neue Instanz liest denselben Schluessel.
  const again = createVault(dir);
  assert.equal(await again.get('mac_a'), 'erstes-Passwort');
  assert.equal(await again.get('unbekannt'), null);
  assert.deepEqual(await fs.readFile(path.join(dir, 'mail.key')), key);

  await again.remove('mac_a');
  assert.equal(await again.get('mac_a'), null);
  assert.equal(await again.get('mac_b'), 'zweites-Passwort');
});

test('a replaced key file makes the secrets unreadable', async () => {
  const dir = await tempDir();
  await createVault(dir).put('mac_a', 'geheim');
  await fs.writeFile(path.join(dir, 'mail.key'), crypto.randomBytes(32));
  await assert.rejects(createVault(dir).get('mac_a'), VaultError);
});

test('refuses a key file of the wrong length', async () => {
  const dir = await tempDir();
  await fs.writeFile(path.join(dir, 'mail.key'), crypto.randomBytes(16));
  await assert.rejects(createVault(dir).put('mac_a', 'geheim'), VaultError);
});
