'use strict';

/**
 * Sitzungen: beim Anmelden bekommt ein Konto ein Geheimnis (48 Hex-Zeichen
 * aus 24 Zufallsbytes), das die App bei jeder Anfrage mitschickt. Der Dienst
 * merkt sich nur den SHA-256 davon — wer die Datei liest, kann sich damit
 * nicht anmelden. Mit `BETTER_DATA_KEY` liegt die Datei verschluesselt.
 *
 * Eine Sitzung aus dem Admin („App ansehen“) traegt `view: true` und darf nie
 * schreiben — auch ohne die Kopfzeile `X-Better-View`.
 */
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const { forDisk, unseal } = require('./crypt.js');

const TOKEN_BYTES = 24;
const TOKEN_PATTERN = /^[0-9a-f]{48}$/u;
/** Wer sich ein halbes Jahr nicht meldet, muss sich neu anmelden. */
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

const hashOf = (token) => crypto.createHash('sha256').update(token).digest('hex');

function createSessions({ dataDir, key = null, now = () => Date.now() }) {
  const file = path.join(dataDir, 'sessions.json');
  let entries = null;
  let writing = Promise.resolve();

  async function load() {
    if (entries) return entries;
    entries = new Map();
    try {
      const parsed = JSON.parse(unseal(key, await fs.readFile(file, 'utf8')));
      const cutoff = now() - MAX_AGE_MS;
      for (const [hash, entry] of Object.entries(parsed?.sessions ?? {})) {
        if (typeof entry?.accountId !== 'string') continue;
        if (Date.parse(entry.lastSeenAt ?? entry.createdAt ?? '') < cutoff) continue;
        entries.set(hash, entry);
      }
    } catch (error) {
      // Nichts da: leer anfangen. Alles andere (falscher Schluessel) soll man sehen.
      if (error?.code !== 'ENOENT') throw error;
    }
    return entries;
  }

  function persist() {
    const text = JSON.stringify({ sessions: Object.fromEntries(entries ?? []) });
    writing = writing
      .catch(() => {})
      .then(async () => {
        await fs.mkdir(dataDir, { recursive: true });
        const temp = `${file}.${crypto.randomBytes(4).toString('hex')}.tmp`;
        await fs.writeFile(temp, forDisk(key, text), { encoding: 'utf8', mode: 0o600 });
        await fs.rename(temp, file);
      });
    return writing;
  }

  return {
    /** Eine neue Sitzung — gibt das Geheimnis zurueck, das nur die App kennt. */
    async issue(accountId, { view = false } = {}) {
      const map = await load();
      const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
      const at = new Date(now()).toISOString();
      map.set(hashOf(token), {
        accountId,
        createdAt: at,
        lastSeenAt: at,
        ...(view ? { view } : {}),
      });
      await persist();
      return token;
    },

    /** Zu wem gehoert dieses Geheimnis? `null`, wenn unbekannt oder abgelaufen. */
    async lookup(token) {
      if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) return null;
      const map = await load();
      const entry = map.get(hashOf(token));
      if (!entry) return null;
      if (Date.parse(entry.lastSeenAt ?? entry.createdAt) < now() - MAX_AGE_MS) {
        map.delete(hashOf(token));
        return null;
      }
      // Zuletzt gesehen nur im Speicher — die Platte bekommt es beim naechsten Schreiben.
      entry.lastSeenAt = new Date(now()).toISOString();
      return { accountId: entry.accountId, view: entry.view === true, createdAt: entry.createdAt };
    },

    /** Abmelden. */
    async revoke(token) {
      if (typeof token !== 'string') return false;
      const map = await load();
      const removed = map.delete(hashOf(token));
      if (removed) await persist();
      return removed;
    },

    /** Alle Sitzungen eines Kontos — nach Passwortwechsel oder Loeschen. */
    async revokeAccount(accountId) {
      const map = await load();
      let count = 0;
      for (const [hash, entry] of map) {
        if (entry.accountId === accountId) {
          map.delete(hash);
          count += 1;
        }
      }
      if (count > 0) await persist();
      return count;
    },
  };
}

module.exports = { createSessions, TOKEN_PATTERN, MAX_AGE_MS };
