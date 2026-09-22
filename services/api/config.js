/**
 * Die Stellschrauben des Dienstes, alle ueber Umgebungsvariablen.
 *
 * - `BETTER_DATA_DIR`         wohin Datenbank, Bilder und Mail-Geheimnisse gehen
 *                             (Standard: services/api/data)
 * - `BETTER_MAIL_SYNC_MS`     Takt des Mail-Abgleichs in ms (Standard 10000, 0 = aus)
 * - `BETTER_MAIL_ALLOW_PLAIN` nur fuer Tests: `1` erlaubt unverschluesselte
 *                             Verbindungen zu 127.0.0.1
 * - `BETTER_ADMIN_PORT`       Port des Admins auf 127.0.0.1 (Standard 8091, 0 = aus)
 */
const path = require('node:path');

/** Neue E-Mails sollen nach hoechstens zehn Sekunden da sein. */
const DEFAULT_SYNC_MS = 10_000;
const DEFAULT_ADMIN_PORT = 8091;
const MAX_PORT = 65_535;

function dataDir() {
  const configured = process.env.BETTER_DATA_DIR;
  if (typeof configured === 'string' && configured.trim().length > 0) {
    return path.resolve(configured.trim());
  }
  return path.join(__dirname, 'data');
}

function mailSyncMs() {
  const raw = process.env.BETTER_MAIL_SYNC_MS;
  if (raw === undefined || raw.trim() === '') return DEFAULT_SYNC_MS;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : DEFAULT_SYNC_MS;
}

/** Der Port des Admins, oder null, wenn er aus ist. */
function adminPort() {
  const raw = process.env.BETTER_ADMIN_PORT;
  if (raw === undefined || raw.trim() === '') return DEFAULT_ADMIN_PORT;
  const value = Number(raw);
  if (value === 0) return null;
  return Number.isInteger(value) && value > 0 && value <= MAX_PORT ? value : DEFAULT_ADMIN_PORT;
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

/** Klartext nur, wenn der Test es will und das Gegenueber der eigene Rechner ist. */
function allowsPlain(host) {
  return process.env.BETTER_MAIL_ALLOW_PLAIN === '1' && LOOPBACK_HOSTS.has(String(host));
}

module.exports = { adminPort, dataDir, mailSyncMs, allowsPlain };
