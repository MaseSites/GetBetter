/**
 * Mails verschicken (RFC 5321) und die Nachricht dafuer bauen (RFC 5322).
 *
 * 465 direkt verschluesselt, 587 mit STARTTLS; Anmeldung per AUTH PLAIN oder
 * LOGIN. Die Nachricht ist reines ASCII: Header nach RFC 2047, der Text
 * quoted-printable in UTF-8. Zeilenumbrueche in Headerwerten werden entfernt,
 * damit niemand ueber Betreff oder Namen eigene Header einschleust.
 */
const crypto = require('node:crypto');
const net = require('node:net');

const { allowsPlain } = require('../config.js');
const { MailError, TIMEOUT_MS, openSocket, toMailError, upgradeToTls } = require('./connection.js');

const SAFE_ADDRESS = /^[^\s<>@",;()]+@[^\s<>@",;()]+$/;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ------------------------------------------------------------------ Nachricht bauen

function assertAddress(address) {
  if (!SAFE_ADDRESS.test(String(address ?? ''))) throw new MailError('bad_request');
  return String(address);
}

/** Kein CR, LF oder NUL in einem Headerwert. */
function headerSafe(value) {
  return String(value ?? '')
    .replace(/[\r\n\0]+/g, ' ')
    .trim();
}

const isPrintableAscii = (text) => /^[\x20-\x7e]*$/.test(text);

/** Wie viele Bytes in ein kodiertes Wort passen, wenn davor `used` Zeichen stehen. */
function wordBudget(used) {
  // 76 Zeichen je Zeile, `=?UTF-8?B?` und `?=` kosten 12, base64 braucht Vierergruppen.
  const base64Chars = Math.floor((76 - used - 12) / 4) * 4;
  return Math.max(3, (base64Chars / 4) * 3);
}

/**
 * Nicht-ASCII als `=?UTF-8?B?…?=`, ohne ein Zeichen zu zerteilen. Die erste
 * Zeile teilt sich den Platz mit dem Headernamen (`prefixLength`).
 */
function encodeWords(text, prefixLength = 0) {
  const words = [];
  let chunk = '';
  for (const char of text) {
    const budget = wordBudget(words.length === 0 ? prefixLength : 1);
    if (chunk.length > 0 && Buffer.byteLength(chunk + char, 'utf8') > budget) {
      words.push(chunk);
      chunk = '';
    }
    chunk += char;
  }
  if (chunk.length > 0) words.push(chunk);
  return words
    .map((word) => `=?UTF-8?B?${Buffer.from(word, 'utf8').toString('base64')}?=`)
    .join('\r\n ');
}

/** Adresslisten nach dem Komma falten, sobald eine Zeile zu lang wuerde. */
function foldList(items, prefixLength) {
  const lines = [];
  let line = '';
  let limit = 78 - prefixLength;
  for (const item of items) {
    const candidate = line.length === 0 ? item : `${line}, ${item}`;
    if (line.length > 0 && candidate.length + 1 > limit) {
      lines.push(`${line},`);
      line = item;
      limit = 77;
    } else {
      line = candidate;
    }
  }
  lines.push(line);
  return lines.join('\r\n ');
}

/** Lange ASCII-Zeilen an Leerzeichen falten, damit keine Zeile ueber 78 Zeichen kommt. */
function foldAscii(text, prefixLength) {
  const lines = [];
  let line = null;
  let limit = 78 - prefixLength;
  for (const word of text.split(' ')) {
    if (line === null) {
      line = word;
    } else if (line.length > 0 && line.length + 1 + word.length > limit) {
      lines.push(line);
      line = word;
      limit = 77;
    } else {
      line = `${line} ${word}`;
    }
  }
  lines.push(line ?? '');
  return lines.join('\r\n ');
}

function encodeHeaderText(value, prefixLength) {
  const text = headerSafe(value);
  return isPrintableAscii(text) ? foldAscii(text, prefixLength) : encodeWords(text, prefixLength);
}

function formatAddress(name, address, prefixLength = 0) {
  const safeAddress = assertAddress(address);
  const display = headerSafe(name);
  if (display.length === 0) return safeAddress;
  if (!isPrintableAscii(display)) {
    const encoded = encodeWords(display, prefixLength);
    const lines = encoded.split('\r\n');
    const used = (lines.length === 1 ? prefixLength : 0) + String(lines[lines.length - 1]).length;
    const joiner = used + safeAddress.length + 3 > 78 ? '\r\n ' : ' ';
    return `${encoded}${joiner}<${safeAddress}>`;
  }
  if (/[()<>[\]:;@\\,."]/.test(display)) {
    return `"${display.replace(/[\\"]/g, '\\$&')}" <${safeAddress}>`;
  }
  return `${display} <${safeAddress}>`;
}

function formatDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${DAYS[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ` +
    `${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:` +
    `${pad(date.getUTCSeconds())} +0000`
  );
}

function encodeQuotedPrintableLine(line) {
  const bytes = Buffer.from(line, 'utf8');
  let out = '';
  let current = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i];
    const last = i === bytes.length - 1;
    const plain =
      (byte >= 33 && byte <= 126 && byte !== 61) || ((byte === 32 || byte === 9) && !last);
    const token = plain
      ? String.fromCharCode(byte)
      : `=${byte.toString(16).toUpperCase().padStart(2, '0')}`;
    if (current.length + token.length > 75) {
      out += `${current}=\r\n`;
      current = '';
    }
    current += token;
  }
  return out + current;
}

function encodeQuotedPrintable(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(encodeQuotedPrintableLine)
    .join('\r\n');
}

function messageIdFor(address) {
  const domain = String(address).split('@')[1] ?? '';
  const safe = /^[A-Za-z0-9.-]+$/.test(domain) ? domain : 'better.local';
  return `<${crypto.randomUUID()}@${safe}>`;
}

function safeMessageId(value) {
  const match = /^<[^<>\s]{1,900}>$/.exec(headerSafe(value));
  return match ? match[0] : null;
}

/**
 * Baut die Nachricht. `inReplyTo` ist die Message-ID der beantworteten Mail
 * (mit spitzen Klammern); sie geht in In-Reply-To und References.
 */
function buildMessage({ from, to, cc = [], subject, text, inReplyTo = null, date = new Date() }) {
  const messageId = messageIdFor(from.address);
  const parent = inReplyTo ? safeMessageId(inReplyTo) : null;
  const headers = [
    `From: ${formatAddress(from.name, from.address, 'From: '.length)}`,
    `To: ${foldList(to.map(assertAddress), 'To: '.length)}`,
    ...(cc.length > 0 ? [`Cc: ${foldList(cc.map(assertAddress), 'Cc: '.length)}`] : []),
    `Subject: ${encodeHeaderText(subject, 'Subject: '.length)}`,
    `Date: ${formatDate(date)}`,
    `Message-ID: ${messageId}`,
    ...(parent ? [`In-Reply-To: ${parent}`, `References: ${parent}`] : []),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: quoted-printable',
  ];
  const raw = `${headers.join('\r\n')}\r\n\r\n${encodeQuotedPrintable(text)}\r\n`;
  return { messageId, raw: Buffer.from(raw, 'utf8') };
}

/** Punkt am Zeilenanfang verdoppeln (RFC 5321 4.5.2) und mit `.` abschliessen. */
function dotStuff(raw) {
  const text = raw.toString('latin1');
  const body = text.endsWith('\r\n') ? text : `${text}\r\n`;
  const stuffed = `\r\n${body}`.replace(/\r\n\./g, '\r\n..').slice(2);
  return Buffer.from(`${stuffed}.\r\n`, 'latin1');
}

// ------------------------------------------------------------------ Verbindung

class SmtpConnection {
  constructor(socket, timeoutMs) {
    this.socket = socket;
    this.timeoutMs = timeoutMs;
    this.buffer = '';
    this.lines = [];
    this.replies = [];
    this.waiter = null;
    this.failure = null;
    this.timer = null;
    this.onData = (chunk) => this.receive(chunk);
    this.onError = (error) => this.fail(toMailError(error));
    this.onClose = () => this.fail(new MailError('unreachable'));
    socket.on('data', this.onData);
    socket.on('error', this.onError);
    socket.on('close', this.onClose);
  }

  receive(chunk) {
    this.buffer += chunk.toString('latin1');
    let end = this.buffer.indexOf('\n');
    while (end !== -1) {
      const line = this.buffer.slice(0, end).replace(/\r$/, '');
      this.buffer = this.buffer.slice(end + 1);
      this.lines.push(line);
      if (/^\d{3}(?: |$)/.test(line)) {
        this.replies.push({
          code: Number(line.slice(0, 3)),
          lines: this.lines.map((l) => l.slice(4)),
        });
        this.lines = [];
      }
      end = this.buffer.indexOf('\n');
    }
    if (this.buffer.length > 100_000) this.fail(new MailError('protocol'));
    this.deliver();
  }

  deliver() {
    if (!this.waiter || this.replies.length === 0) return;
    const waiter = this.waiter;
    this.waiter = null;
    clearTimeout(this.timer);
    waiter.resolve(this.replies.shift());
  }

  fail(error) {
    if (this.failure) return;
    this.failure = error;
    clearTimeout(this.timer);
    if (this.waiter) this.waiter.reject(error);
    this.waiter = null;
    this.socket.destroy();
  }

  read() {
    return new Promise((resolve, reject) => {
      if (this.replies.length > 0) return resolve(this.replies.shift());
      if (this.failure) return reject(this.failure);
      this.waiter = { resolve, reject };
      this.timer = setTimeout(() => this.fail(new MailError('timeout')), this.timeoutMs);
    });
  }

  command(line) {
    if (this.failure) return Promise.reject(this.failure);
    this.socket.write(`${line}\r\n`);
    return this.read();
  }

  data(raw) {
    if (this.failure) return Promise.reject(this.failure);
    this.socket.write(dotStuff(raw));
    return this.read();
  }

  async ehlo() {
    let reply = await this.command(`EHLO ${ehloName(this.socket)}`);
    if (reply.code !== 250) reply = await this.command(`HELO ${ehloName(this.socket)}`);
    expect(reply, [250], 'unreachable');
    const keywords = new Set();
    const auth = new Set();
    for (const line of reply.lines.slice(1)) {
      const [keyword = '', ...args] = line.trim().toUpperCase().split(/[ =]+/);
      keywords.add(keyword);
      if (keyword === 'AUTH') for (const mechanism of args) auth.add(mechanism);
    }
    return { keywords, auth };
  }

  async authenticate(username, password, features) {
    const base64 = (text) => Buffer.from(text, 'utf8').toString('base64');
    if (features.auth.has('PLAIN') || !features.auth.has('LOGIN')) {
      const token = base64(`\0${username}\0${password}`);
      let reply = await this.command(`AUTH PLAIN ${token}`);
      if (reply.code === 334) reply = await this.command(token);
      expect(reply, [235], 'auth_failed');
      return;
    }
    let reply = await this.command('AUTH LOGIN');
    if (reply.code === 334) reply = await this.command(base64(username));
    if (reply.code === 334) reply = await this.command(base64(password));
    expect(reply, [235], 'auth_failed');
  }

  detach() {
    clearTimeout(this.timer);
    this.socket.removeListener('data', this.onData);
    this.socket.removeListener('error', this.onError);
    this.socket.removeListener('close', this.onClose);
    this.failure = new MailError('protocol');
    return this.socket;
  }

  async quit() {
    try {
      await this.command('QUIT');
    } catch {
      // Die Mail ist schon angenommen; ein holpriges QUIT aendert daran nichts.
    } finally {
      this.detach().destroy();
    }
  }
}

function expect(reply, codes, errorCode) {
  if (!codes.includes(reply.code)) throw new MailError(errorCode);
  return reply;
}

function ehloName(socket) {
  const address = String(socket.localAddress ?? '');
  const mapped = address.startsWith('::ffff:') ? address.slice(7) : address;
  if (net.isIPv4(mapped)) return `[${mapped}]`;
  if (net.isIPv6(address)) return `[IPv6:${address}]`;
  return 'localhost';
}

/**
 * Verschickt `raw` an alle `recipients`. Wirft `MailError` mit
 * `unreachable`, `tls_failed`, `timeout`, `auth_failed` oder `send_failed`.
 */
async function sendMail({
  host,
  port,
  secure,
  username,
  password,
  from,
  recipients,
  raw,
  timeoutMs = TIMEOUT_MS,
}) {
  const sender = assertAddress(from);
  const targets = [...new Set(recipients.map((address) => assertAddress(address)))];
  let connection = null;
  let stage = 'connect';
  try {
    connection = new SmtpConnection(await openSocket({ host, port, secure, timeoutMs }), timeoutMs);
    expect(await connection.read(), [220], 'unreachable');
    let features = await connection.ehlo();
    if (!secure && !allowsPlain(host)) {
      if (!features.keywords.has('STARTTLS')) throw new MailError('tls_failed');
      expect(await connection.command('STARTTLS'), [220], 'tls_failed');
      const secured = await upgradeToTls(connection.detach(), host, timeoutMs);
      connection = new SmtpConnection(secured, timeoutMs);
      features = await connection.ehlo();
    }
    stage = 'auth';
    await connection.authenticate(username, password, features);
    stage = 'send';
    expect(await connection.command(`MAIL FROM:<${sender}>`), [250], 'send_failed');
    for (const target of targets) {
      expect(await connection.command(`RCPT TO:<${target}>`), [250, 251], 'send_failed');
    }
    expect(await connection.command('DATA'), [354], 'send_failed');
    expect(await connection.data(raw), [250], 'send_failed');
    await connection.quit();
  } catch (error) {
    if (connection && !connection.failure) connection.detach().destroy();
    const mapped = toMailError(error, stage === 'connect' ? 'unreachable' : 'send_failed');
    if (mapped.code === 'auth_failed' || mapped.code === 'bad_request') throw mapped;
    if (stage === 'send') throw new MailError('send_failed');
    throw mapped.code === 'protocol' ? new MailError('unreachable') : mapped;
  }
}

module.exports = {
  buildMessage,
  sendMail,
  dotStuff,
  encodeWords,
  encodeQuotedPrintable,
  formatAddress,
  formatDate,
};
