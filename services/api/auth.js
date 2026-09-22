/**
 * Passwoerter und Benutzernamen — dieselben Regeln fuer die Routen der Apps
 * und fuer den Admin. Salt und Hash verlassen den Dienst nie.
 */
const crypto = require('node:crypto');

const { load } = require('./store.js');

/** Dieselbe Regel wie in den Apps (`packages/core/src/auth/accounts.ts`). */
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,23}$/;
const MIN_PASSWORD_LENGTH = 8;
/**
 * Den Benutzernamen gibt es einmal im Monat neu — so bleibt man fuer andere
 * auffindbar. Dieselbe Zahl in `packages/core/src/features/profile/usernameCooldown.ts`.
 */
const USERNAME_COOLDOWN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function hashPassword(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key.toString('hex'));
    });
  });
}

function matches(a, b) {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function normaliseEmail(email) {
  return String(email ?? '')
    .trim()
    .toLowerCase();
}

function normaliseUsername(input) {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/^@/, '');
}

/**
 * Ab wann der Benutzername wieder geaendert werden darf, als ISO-Zeitpunkt —
 * null heisst: jetzt schon. Beim Anlegen zaehlt nichts; erst eine Aenderung
 * setzt `usernameChangedAt`.
 */
function usernameFreeAt(row, now = new Date()) {
  const changed = Date.parse(row?.usernameChangedAt ?? '');
  if (Number.isNaN(changed)) return null;
  const free = changed + USERNAME_COOLDOWN_DAYS * DAY_MS;
  return free > now.getTime() ? new Date(free).toISOString() : null;
}

async function usernameFor(email) {
  const db = await load();
  const base = (normaliseEmail(email).split('@')[0] ?? 'nutzer').replace(/[^a-z0-9._-]/g, '');
  const stem = base.length > 0 ? base : 'nutzer';
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix === 0 ? stem : `${stem}${suffix}`;
    if (!db.tables.accounts.some((row) => row.username === candidate)) return candidate;
  }
  return `nutzer${Date.now()}`;
}

module.exports = {
  MIN_PASSWORD_LENGTH,
  USERNAME_COOLDOWN_DAYS,
  USERNAME_PATTERN,
  hashPassword,
  matches,
  normaliseEmail,
  normaliseUsername,
  usernameFor,
  usernameFreeAt,
};
