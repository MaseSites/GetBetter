'use strict';

/**
 * Verschluesselung auf der Platte: Datenbank und Sitzungen liegen mit
 * `BETTER_DATA_KEY` als AES-256-GCM da, sonst im Klartext (Entwicklung).
 * Der Schluessel sind 32 Zufallsbytes als 64 Hex-Zeichen — `openssl rand -hex 32`.
 *
 * Eine verschluesselte Datei beginnt mit `{"sealed":1` und traegt Nonce,
 * Pruefwert und Inhalt als Base64. Wer sie ohne Schluessel liest, bekommt
 * einen klaren Fehler statt Datensalat; wer sie mit dem Schluessel liest,
 * schreibt sie beim naechsten Speichern wieder verschluesselt.
 */
const crypto = require('node:crypto');

const KEY_PATTERN = /^[0-9a-f]{64}$/iu;
const ALGORITHM = 'aes-256-gcm';
const NONCE_BYTES = 12;
/** Bindet den Inhalt an seinen Zweck — eine Sitzungsdatei ist keine Datenbank. */
const CONTEXT = 'better-data-v1';
const SEALED_PREFIX = '{"sealed":1';

/** Der Schluessel aus der Umgebung — `null` heisst Klartext. Krummes ist ein Fehler. */
function dataKey(env = process.env) {
  const raw = env.BETTER_DATA_KEY;
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const hex = raw.trim();
  if (!KEY_PATTERN.test(hex)) {
    throw new Error('BETTER_DATA_KEY muss 64 Hex-Zeichen sein (32 Bytes): openssl rand -hex 32');
  }
  return Buffer.from(hex, 'hex');
}

function seal(key, text) {
  const iv = crypto.randomBytes(NONCE_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(CONTEXT));
  const data = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return JSON.stringify({
    sealed: 1,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  });
}

function open(key, text) {
  const parsed = JSON.parse(text);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(parsed.iv, 'base64'));
  decipher.setAAD(Buffer.from(CONTEXT));
  decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(parsed.data, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function isSealed(text) {
  return typeof text === 'string' && text.startsWith(SEALED_PREFIX);
}

/** Liest Klartext oder Verschluesseltes — Letzteres nur mit Schluessel. */
function unseal(key, text) {
  if (!isSealed(text)) return text;
  if (!key) throw new Error('Die Datei ist verschluesselt, aber BETTER_DATA_KEY fehlt.');
  return open(key, text);
}

/** Was auf die Platte geht: mit Schluessel versiegelt, sonst wie es ist. */
function forDisk(key, text) {
  return key ? seal(key, text) : text;
}

module.exports = { dataKey, seal, open, isSealed, unseal, forDisk, KEY_PATTERN };
