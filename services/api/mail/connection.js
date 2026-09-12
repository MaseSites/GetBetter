/**
 * Was IMAP und SMTP teilen: Verbindung aufbauen (TLS, STARTTLS oder — nur im
 * Test — Klartext), Zeitlimit und die Uebersetzung von Netzwerkfehlern in die
 * Schluessel, die die Apps kennen.
 */
const net = require('node:net');
const tls = require('node:tls');

const TIMEOUT_MS = 20_000;

/**
 * Ein Fehler mit einem der Schluessel `auth_failed`, `unreachable`,
 * `tls_failed`, `timeout`, `protocol` oder `send_failed`. Die Nachricht ist
 * nur der Schluessel — Serverantworten koennen Kontodaten enthalten.
 */
class MailError extends Error {
  constructor(code) {
    super(code);
    this.name = 'MailError';
    this.code = code;
  }
}

const NETWORK_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ECONNABORTED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EAI_FAIL',
  'EHOSTUNREACH',
  'EHOSTDOWN',
  'ENETUNREACH',
  'ENETDOWN',
  'EADDRNOTAVAIL',
  'EPIPE',
]);

const TLS_CODE = /^(ERR_TLS_|ERR_SSL_|ERR_OSSL_|CERT_|UNABLE_TO_|DEPTH_ZERO_|SELF_SIGNED_)/;

function toMailError(error, fallback = 'unreachable') {
  if (error instanceof MailError) return error;
  const code = String(error?.code ?? '');
  if (code === 'ETIMEDOUT') return new MailError('timeout');
  if (TLS_CODE.test(code) || code === 'EPROTO' || code === 'HOSTNAME_MISMATCH') {
    return new MailError('tls_failed');
  }
  if (NETWORK_CODES.has(code)) return new MailError('unreachable');
  return new MailError(fallback);
}

/** SNI nur mit Namen — eine IP als Servername verbietet RFC 6066. */
function tlsTarget(host) {
  return net.isIP(host) ? { host } : { host, servername: host };
}

function awaitSocket(socket, readyEvent, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new MailError('timeout'));
    }, timeoutMs);
    const onError = (error) => {
      clearTimeout(timer);
      socket.destroy();
      reject(toMailError(error));
    };
    socket.once('error', onError);
    socket.once(readyEvent, () => {
      clearTimeout(timer);
      socket.removeListener('error', onError);
      resolve(socket);
    });
  });
}

/** Direkt verschluesselt (993, 465) oder erst im Klartext, um danach STARTTLS zu sprechen. */
function openSocket({ host, port, secure, timeoutMs = TIMEOUT_MS }) {
  if (secure) {
    // Zertifikatspruefung bleibt an: `rejectUnauthorized` ist in Node der Standard.
    const socket = tls.connect({ ...tlsTarget(host), port });
    return awaitSocket(socket, 'secureConnect', timeoutMs);
  }
  return awaitSocket(net.connect({ host, port }), 'connect', timeoutMs);
}

function upgradeToTls(socket, host, timeoutMs = TIMEOUT_MS) {
  const secured = tls.connect({ ...tlsTarget(host), socket });
  return awaitSocket(secured, 'secureConnect', timeoutMs);
}

module.exports = { TIMEOUT_MS, MailError, toMailError, openSocket, upgradeToTls };
