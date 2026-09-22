/**
 * Sitzungs-Tokens fuer die Routen mit persoenlichen Daten (Better Fit).
 *
 * Anmelden und Registrieren geben ein Token zurueck: 32 Zufallsbytes, in der
 * App gespeichert, im Dienst nur als SHA-256. Wer das Token kennt, ist dieses
 * Konto — deshalb leiten die Fit-Routen das Konto nur hieraus ab, nie aus dem
 * Koerper einer Anfrage.
 *
 * Abgelegt in `<datenordner>/sessions.json`; ein Neustart meldet niemanden ab.
 */
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const TOKEN_BYTES = 32;
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Mehr offene Sitzungen je Konto braucht niemand; die aeltesten fallen weg. */
const MAX_PER_ACCOUNT = 20;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const hashOf = (token) => crypto.createHash('sha256').update(token).digest('hex');

function createSessions({ dataDir, ttlMs = DEFAULT_TTL_MS, now = () => Date.now() }) {
  const file = path.join(dataDir, 'sessions.json');
  let rows = null;
  let writing = Promise.resolve();

  async function load() {
    if (rows) return rows;
    try {
      const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
      rows = Array.isArray(parsed) ? parsed.filter((row) => typeof row?.hash === 'string') : [];
    } catch {
      rows = [];
    }
    return rows;
  }

  function persist() {
    const snapshot = JSON.stringify(rows);
    writing = writing
      .catch(() => {})
      .then(async () => {
        await fs.mkdir(dataDir, { recursive: true });
        // Erst in eine Temp-Datei, dann umbenennen: ein Absturz mittendrin laesst
        // die alte Datei ganz, nie eine halbe.
        const temp = `${file}.${process.pid}.tmp`;
        await fs.writeFile(temp, snapshot, { encoding: 'utf8', mode: 0o600 });
        await fs.rename(temp, file);
      });
    return writing;
  }

  const alive = (row) => row.expiresAt > now();

  /** Ein neues Token fuer ein Konto. `readOnly` gilt fuer „App ansehen“ im Admin. */
  async function issue(accountId, { readOnly = false } = {}) {
    if (typeof accountId !== 'string' || accountId.length === 0) throw new Error('accountId');
    await load();
    const token = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
    const row = {
      hash: hashOf(token),
      accountId,
      readOnly: readOnly === true,
      createdAt: now(),
      expiresAt: now() + ttlMs,
    };
    const own = rows.filter((entry) => entry.accountId === accountId && alive(entry));
    const dropped = new Set(
      own
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(0, Math.max(0, own.length - (MAX_PER_ACCOUNT - 1)))
        .map((entry) => entry.hash),
    );
    rows = [...rows.filter((entry) => alive(entry) && !dropped.has(entry.hash)), row];
    await persist();
    return token;
  }

  /** Das Konto hinter einem Token, oder null — abgelaufen, falsch oder leer. */
  async function resolve(token) {
    if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) return null;
    await load();
    const wanted = hashOf(token);
    const row = rows.find((entry) => entry.hash === wanted);
    if (!row || !alive(row)) return null;
    return { accountId: row.accountId, readOnly: row.readOnly === true };
  }

  async function revoke(token) {
    if (typeof token !== 'string') return false;
    await load();
    const wanted = hashOf(token);
    const before = rows.length;
    rows = rows.filter((entry) => entry.hash !== wanted);
    if (rows.length !== before) await persist();
    return rows.length !== before;
  }

  /** Alle Sitzungen eines Kontos beenden — beim Sperren oder Loeschen. */
  async function revokeAccount(accountId) {
    await load();
    const before = rows.length;
    rows = rows.filter((entry) => entry.accountId !== accountId);
    if (rows.length !== before) await persist();
  }

  return { issue, resolve, revoke, revokeAccount };
}

/** `Authorization: Bearer <token>` -> Token, sonst null. */
function bearerOf(req) {
  const header = req.headers?.authorization;
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

module.exports = { createSessions, bearerOf, TOKEN_PATTERN, MAX_PER_ACCOUNT };
