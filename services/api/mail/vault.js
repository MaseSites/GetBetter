/**
 * Der Tresor fuer Mail-Passwoerter.
 *
 * AES-256-GCM, der Schluessel sind 32 Zufallsbytes in `<datenordner>/mail.key`
 * (beim ersten Gebrauch erzeugt), die verschluesselten Eintraege stehen in
 * `<datenordner>/mail-vault.json`. Die Id des Mail-Kontos geht als
 * Zusatzdaten mit ein — ein Eintrag laesst sich nicht einem anderen Konto
 * unterschieben.
 *
 * Ein Passwort steht nie in db.json, nie in einer Antwort und nie im Log.
 */
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const { createQueue, readJson, writeJsonAtomic } = require('../files.js');

const KEY_BYTES = 32;
const IV_BYTES = 12;

class VaultError extends Error {
  constructor(code) {
    super(code);
    this.name = 'VaultError';
    this.code = code;
  }
}

function encrypt(key, id, secret) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(String(id), 'utf8'));
  const data = Buffer.concat([cipher.update(String(secret), 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  };
}

function decrypt(key, id, entry) {
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(entry.iv, 'base64'));
    decipher.setAAD(Buffer.from(String(id), 'utf8'));
    decipher.setAuthTag(Buffer.from(entry.tag, 'base64'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(entry.data, 'base64')),
      decipher.final(),
    ]);
    return plain.toString('utf8');
  } catch {
    // Falscher Schluessel oder veraenderter Eintrag — ohne Einzelheiten.
    throw new VaultError('vault_unreadable');
  }
}

async function loadKey(file) {
  try {
    const key = await fs.readFile(file);
    if (key.length !== KEY_BYTES) throw new VaultError('vault_key_invalid');
    return key;
  } catch (error) {
    if (!error || error.code !== 'ENOENT') throw error;
  }
  await fs.mkdir(path.dirname(file), { recursive: true });
  const key = crypto.randomBytes(KEY_BYTES);
  try {
    // `wx`: gibt es die Datei schon (zweiter Aufruf gleichzeitig), wird nichts ueberschrieben.
    await fs.writeFile(file, key, { flag: 'wx', mode: 0o600 });
    return key;
  } catch (error) {
    if (error && error.code === 'EEXIST') return loadKey(file);
    throw error;
  }
}

/**
 * @param {string} dir Datenordner; darin `mail.key` und `mail-vault.json`
 */
function createVault(dir) {
  const keyFile = path.join(dir, 'mail.key');
  const vaultFile = path.join(dir, 'mail-vault.json');
  const enqueue = createQueue();
  let keyPromise = null;

  const key = () => {
    keyPromise = keyPromise ?? loadKey(keyFile);
    return keyPromise.catch((error) => {
      keyPromise = null;
      throw error;
    });
  };

  const entries = async () => {
    const stored = await readJson(vaultFile, { version: 1, entries: {} });
    return stored && typeof stored.entries === 'object' && stored.entries !== null
      ? stored.entries
      : {};
  };

  return {
    put(id, secret) {
      return enqueue(async () => {
        const entry = encrypt(await key(), id, secret);
        const next = { ...(await entries()), [id]: entry };
        await writeJsonAtomic(vaultFile, { version: 1, entries: next });
      });
    },

    /** Das Geheimnis oder `null`, wenn keins hinterlegt ist. Wirft bei falschem Schluessel. */
    async get(id) {
      const entry = (await entries())[id];
      if (!entry) return null;
      return decrypt(await key(), id, entry);
    },

    remove(id) {
      return enqueue(async () => {
        const current = await entries();
        if (!(id in current)) return;
        const rest = Object.fromEntries(Object.entries(current).filter(([name]) => name !== id));
        await writeJsonAtomic(vaultFile, { version: 1, entries: rest });
      });
    },
  };
}

module.exports = { createVault, encrypt, decrypt, VaultError };
