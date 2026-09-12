/**
 * Ein kleiner IMAP4rev1-Client (RFC 3501) — gerade so viel, wie der Abgleich braucht.
 *
 * Getaggte Befehle nacheinander, Literale `{n}` in beide Richtungen,
 * LOGIN, CAPABILITY, SELECT, UID SEARCH, FETCH, UID STORE, LIST (mit
 * Special-Use), UID MOVE oder COPY + \Deleted + EXPUNGE, APPEND und LOGOUT.
 * Jede Antwort muss innerhalb des Zeitlimits eintreffen.
 */
const { allowsPlain } = require('../config.js');
const { MailError, TIMEOUT_MS, openSocket, toMailError, upgradeToTls } = require('./connection.js');

const MAX_LINE = 1_000_000;
// Abgerufen werden hoechstens 200 KB je Mail; mehr schickt nur ein kaputter Server.
const MAX_LITERAL = 4_000_000;
// Was ein einzelner Befehl an Antworten sammeln darf, bevor die Verbindung faellt.
const MAX_COMMAND_BYTES = 64_000_000;
const OPEN = Symbol('open');
const CLOSE = Symbol('close');

// ------------------------------------------------------------------ Antworten lesen

/**
 * Ein wachsender Puffer. Anhaengen kostet amortisiert linear, auch wenn ein
 * Server seine Antwort in winzigen Stuecken schickt — mit `Buffer.concat` je
 * Stueck waere das quadratisch und legte den ganzen Dienst lahm.
 */
class ByteQueue {
  constructor() {
    this.store = Buffer.alloc(0);
    this.start = 0;
    this.end = 0;
    this.scanned = 0;
  }

  get length() {
    return this.end - this.start;
  }

  push(chunk) {
    if (this.end + chunk.length > this.store.length) {
      const live = this.length;
      const next = Buffer.allocUnsafe(Math.max(64 * 1024, (live + chunk.length) * 2));
      this.store.copy(next, 0, this.start, this.end);
      this.store = next;
      this.start = 0;
      this.end = live;
    }
    chunk.copy(this.store, this.end);
    this.end += chunk.length;
  }

  /** Abstand bis zum naechsten CRLF oder -1; schon gepruefte Bytes kommen nicht nochmal dran. */
  lineEnd() {
    const index = this.store.subarray(0, this.end).indexOf('\r\n', this.start + this.scanned);
    if (index !== -1) return index - this.start;
    this.scanned = Math.max(0, this.length - 1);
    return -1;
  }

  take(bytes) {
    const out = Buffer.from(this.store.subarray(this.start, this.start + bytes));
    this.skip(bytes);
    return out;
  }

  skip(bytes) {
    this.start += bytes;
    this.scanned = 0;
    if (this.start === this.end) {
      this.start = 0;
      this.end = 0;
    }
  }
}

/** Zerlegt eine Antwort (Textstuecke und Literale) in Atome, Strings, Listen und NIL. */
function tokenize(pieces) {
  const tokens = [];
  for (const piece of pieces) {
    if (Buffer.isBuffer(piece)) {
      tokens.push({ literal: piece });
      continue;
    }
    let i = 0;
    while (i < piece.length) {
      const ch = piece[i];
      if (ch === ' ') {
        i += 1;
      } else if (ch === '(' || ch === ')') {
        tokens.push(ch === '(' ? OPEN : CLOSE);
        i += 1;
      } else if (ch === '"') {
        let value = '';
        i += 1;
        while (i < piece.length && piece[i] !== '"') {
          if (piece[i] === '\\' && i + 1 < piece.length) i += 1;
          value += piece[i];
          i += 1;
        }
        tokens.push({ string: value });
        i += 1;
      } else {
        const start = i;
        while (i < piece.length && piece[i] !== ' ' && piece[i] !== '(' && piece[i] !== ')') {
          // `BODY[HEADER.FIELDS (DATE)]<0>` ist ein Atom, Klammern im [] inklusive.
          const close = piece[i] === '[' ? piece.indexOf(']', i) : -1;
          i = piece[i] === '[' ? (close === -1 ? piece.length : close + 1) : i + 1;
        }
        tokens.push({ atom: piece.slice(start, i) });
      }
    }
  }
  return tokens;
}

function buildValues(tokens) {
  const root = [];
  const stack = [root];
  for (const token of tokens) {
    const top = stack[stack.length - 1];
    if (token === OPEN) {
      const list = [];
      top.push(list);
      stack.push(list);
    } else if (token === CLOSE) {
      if (stack.length > 1) stack.pop();
    } else if (token.literal) {
      top.push(token.literal);
    } else if (token.string !== undefined) {
      top.push(token.string);
    } else {
      top.push(token.atom.toUpperCase() === 'NIL' ? null : token.atom);
    }
  }
  return root;
}

function parseValues(pieces) {
  return buildValues(tokenize(pieces));
}

function asText(value) {
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  return value === null || value === undefined ? '' : String(value);
}

const STATUS = /^(OK|NO|BAD|BYE|PREAUTH)\b ?(?:\[([^\]]*)\])? ?(.*)$/i;

// ------------------------------------------------------------------ Befehle schreiben

/** Ein astring: gequotet, wenn druckbares ASCII, sonst als Literal. */
function astring(value) {
  const text = String(value ?? '');
  if (/^[\x20-\x7e]*$/.test(text)) return `"${text.replace(/[\\"]/g, '\\$&')}"`;
  return Buffer.from(text, 'utf8');
}

/** `[1,2,3,7]` -> `1:3,7` */
function sequenceSet(numbers) {
  const sorted = [...new Set(numbers.filter((n) => Number.isInteger(n) && n > 0))].sort(
    (a, b) => a - b,
  );
  const ranges = [];
  for (const n of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && n === last[1] + 1) ranges[ranges.length - 1] = [last[0], n];
    else ranges.push([n, n]);
  }
  return ranges.map(([from, to]) => (from === to ? `${from}` : `${from}:${to}`)).join(',');
}

/** Modifiziertes UTF-7 (RFC 3501 5.1.3): `Gel&APY-scht` -> `Geloescht` mit oe. */
function decodeMailboxName(name) {
  return String(name).replace(/&([^-]*)-/g, (whole, encoded) => {
    if (encoded === '') return '&';
    const bytes = Buffer.from(encoded.replace(/,/g, '/'), 'base64');
    let out = '';
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    }
    return out;
  });
}

// ------------------------------------------------------------------ Verbindung

class ImapConnection {
  constructor(socket, { timeoutMs = TIMEOUT_MS } = {}) {
    this.socket = socket;
    this.timeoutMs = timeoutMs;
    this.queue = new ByteQueue();
    this.received = 0;
    this.pieces = [];
    this.literalBytes = -1;
    this.counter = 0;
    this.current = null;
    this.waitingGreeting = null;
    this.failure = null;
    this.timer = null;
    this.loggingOut = false;
    this.capabilities = new Set();
    this.tail = Promise.resolve();

    this.onData = (chunk) => this.receive(chunk);
    this.onError = (error) => this.fail(toMailError(error));
    this.onClose = () => this.fail(new MailError('unreachable'));
    socket.on('data', this.onData);
    socket.on('error', this.onError);
    socket.on('close', this.onClose);
  }

  arm() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.fail(new MailError('timeout')), this.timeoutMs);
  }

  receive(chunk) {
    if (this.failure) return;
    if (this.current || this.waitingGreeting) this.arm();
    this.received += chunk.length;
    try {
      // Ein Server, der ohne Ende sendet, haelt das Zeitlimit sonst ewig wach.
      if (this.received > MAX_COMMAND_BYTES) throw new MailError('protocol');
      this.queue.push(chunk);
      this.drain();
    } catch (error) {
      this.fail(toMailError(error, 'protocol'));
    }
  }

  drain() {
    while (!this.failure) {
      if (this.literalBytes >= 0) {
        if (this.queue.length < this.literalBytes) return;
        this.pieces.push(this.queue.take(this.literalBytes));
        this.literalBytes = -1;
        continue;
      }
      const end = this.queue.lineEnd();
      if (end === -1) {
        if (this.queue.length > MAX_LINE) throw new MailError('protocol');
        return;
      }
      const line = this.queue.take(end).toString('utf8');
      this.queue.skip(2);
      const literal = /\{(\d{1,9})\+?\}$/.exec(line);
      if (literal) {
        this.literalBytes = Number(literal[1]);
        if (this.literalBytes > MAX_LITERAL) throw new MailError('protocol');
        this.pieces.push(line.slice(0, literal.index));
        continue;
      }
      const pieces = [...this.pieces, line];
      this.pieces = [];
      this.handle(pieces);
    }
  }

  handle(pieces) {
    const first = pieces[0];
    if (first === '+' || first.startsWith('+ ')) {
      const proceed = this.current?.onContinue;
      if (proceed) proceed();
      return;
    }
    if (first.startsWith('* ')) {
      this.handleUntagged(pieces, first.slice(2));
      return;
    }
    const space = first.indexOf(' ');
    const current = this.current;
    if (!current || space === -1 || first.slice(0, space) !== current.tag) return;
    const status = STATUS.exec(first.slice(space + 1));
    if (!status) return;
    this.current = null;
    clearTimeout(this.timer);
    const result = {
      status: status[1].toUpperCase(),
      code: status[2] ?? '',
      text: status[3] ?? '',
      untagged: current.untagged,
    };
    this.noteCapabilities(result.code);
    if (result.status === 'OK') current.resolve(result);
    else current.reject(Object.assign(new MailError('protocol'), { status: result.status }));
  }

  handleUntagged(pieces, rest) {
    const status = STATUS.exec(rest);
    if (status) {
      const entry = { type: status[1].toUpperCase(), code: status[2] ?? '', text: status[3] ?? '' };
      this.noteCapabilities(entry.code);
      if (this.waitingGreeting) {
        const waiting = this.waitingGreeting;
        this.waitingGreeting = null;
        clearTimeout(this.timer);
        if (entry.type === 'BYE') waiting.reject(new MailError('unreachable'));
        else waiting.resolve(entry);
        return;
      }
      if (entry.type === 'BYE' && !this.loggingOut) {
        this.fail(new MailError('unreachable'));
        return;
      }
      if (this.current) this.current.untagged.push(entry);
      return;
    }
    const values = parseValues([rest, ...pieces.slice(1)]);
    const numbered = /^\d+$/.test(String(values[0]));
    const entry = {
      type: String(numbered ? values[1] : values[0]).toUpperCase(),
      number: numbered ? Number(values[0]) : null,
      values: values.slice(numbered ? 2 : 1),
    };
    if (entry.type === 'CAPABILITY') this.setCapabilities(entry.values);
    if (this.current) this.current.untagged.push(entry);
  }

  noteCapabilities(code) {
    if (/^CAPABILITY /i.test(code)) this.setCapabilities(code.split(' ').slice(1));
  }

  setCapabilities(values) {
    this.capabilities = new Set(values.map((value) => asText(value).toUpperCase()));
  }

  fail(error) {
    if (this.failure) return;
    this.failure = error;
    clearTimeout(this.timer);
    const pending = [this.current, this.waitingGreeting].filter(Boolean);
    this.current = null;
    this.waitingGreeting = null;
    for (const entry of pending) entry.reject(error);
    this.socket.destroy();
  }

  greeting() {
    return new Promise((resolve, reject) => {
      if (this.failure) return reject(this.failure);
      this.waitingGreeting = { resolve, reject };
      this.arm();
    });
  }

  /**
   * Schickt einen Befehl. `parts` sind Textstuecke und Buffer; ein Buffer geht als
   * Literal hinaus, nach dem `+` des Servers.
   */
  run(parts) {
    const task = () =>
      new Promise((resolve, reject) => {
        if (this.failure) return reject(this.failure);
        this.counter += 1;
        this.received = 0;
        const tag = `B${this.counter}`;
        this.current = { tag, resolve, reject, untagged: [], onContinue: null };
        const writeFrom = (index, prefix) => {
          let text = prefix;
          for (let i = index; i < parts.length; i += 1) {
            const part = parts[i];
            if (Buffer.isBuffer(part)) {
              this.socket.write(`${text}{${part.length}}\r\n`);
              this.current.onContinue = () => {
                this.current.onContinue = null;
                this.socket.write(part);
                writeFrom(i + 1, '');
              };
              return;
            }
            text += part;
          }
          this.socket.write(`${text}\r\n`);
        };
        this.arm();
        writeFrom(0, `${tag} `);
      });
    const next = this.tail.catch(() => {}).then(task);
    this.tail = next;
    return next;
  }

  /** Gibt den Socket frei, z.B. fuer STARTTLS. Was noch im Puffer lag, faellt weg. */
  detach() {
    clearTimeout(this.timer);
    this.socket.removeListener('data', this.onData);
    this.socket.removeListener('error', this.onError);
    this.socket.removeListener('close', this.onClose);
    this.failure = new MailError('protocol');
    return this.socket;
  }

  // ---------------------------------------------------------------- Befehle

  async capability() {
    await this.run(['CAPABILITY']);
    return this.capabilities;
  }

  async login(username, password) {
    try {
      const result = await this.run(['LOGIN ', astring(username), ' ', astring(password)]);
      if (!/^CAPABILITY /i.test(result.code)) await this.capability();
    } catch (error) {
      if (error instanceof MailError && error.code === 'protocol' && error.status) {
        throw new MailError('auth_failed');
      }
      throw error;
    }
  }

  async select(mailbox) {
    const result = await this.run(['SELECT ', astring(mailbox)]);
    const info = { exists: 0, uidValidity: null, uidNext: null };
    for (const entry of result.untagged) {
      if (entry.type === 'EXISTS') info.exists = entry.number ?? 0;
      const code = /^(UIDVALIDITY|UIDNEXT) (\d+)/i.exec(entry.code ?? '');
      if (code && code[1].toUpperCase() === 'UIDVALIDITY') info.uidValidity = Number(code[2]);
      if (code && code[1].toUpperCase() === 'UIDNEXT') info.uidNext = Number(code[2]);
    }
    return info;
  }

  async uidSearch(criteria) {
    const result = await this.run([`UID SEARCH ${criteria}`]);
    return result.untagged
      .filter((entry) => entry.type === 'SEARCH')
      .flatMap((entry) => entry.values.map((value) => Number(asText(value))))
      .filter((uid) => Number.isInteger(uid) && uid > 0);
  }

  /** FETCH ueber Nummern oder (mit `uid: true`) ueber UIDs. */
  async fetch(set, items, { uid = false } = {}) {
    const result = await this.run([`${uid ? 'UID ' : ''}FETCH ${set} ${items}`]);
    return result.untagged
      .filter((entry) => entry.type === 'FETCH' && Array.isArray(entry.values[0]))
      .map((entry) => {
        const list = entry.values[0];
        const attributes = {};
        for (let i = 0; i + 1 < list.length; i += 2) {
          attributes[asText(list[i]).toUpperCase()] = list[i + 1];
        }
        const bodyKey = Object.keys(attributes).find((key) => key.startsWith('BODY['));
        const body = bodyKey ? attributes[bodyKey] : null;
        return {
          seq: entry.number,
          uid: Number(asText(attributes.UID)) || null,
          flags: Array.isArray(attributes.FLAGS) ? attributes.FLAGS.map(asText) : null,
          internalDate: attributes.INTERNALDATE ? asText(attributes.INTERNALDATE) : null,
          body: body === null ? null : Buffer.isBuffer(body) ? body : Buffer.from(asText(body)),
        };
      });
  }

  uidStore(set, action, flags) {
    return this.run([`UID STORE ${set} ${action} (${flags.join(' ')})`]);
  }

  async list() {
    const result = await this.run(['LIST "" "*"']);
    return result.untagged
      .filter((entry) => entry.type === 'LIST')
      .map((entry) => ({
        flags: Array.isArray(entry.values[0]) ? entry.values[0].map(asText) : [],
        delimiter: entry.values[1] === null ? '' : asText(entry.values[1]),
        name: asText(entry.values[2]),
      }));
  }

  /** Verschiebt per MOVE, sonst per COPY, \Deleted und EXPUNGE (UID EXPUNGE mit UIDPLUS). */
  async uidMove(set, mailbox) {
    if (this.capabilities.has('MOVE')) {
      await this.run([`UID MOVE ${set} `, astring(mailbox)]);
      return;
    }
    await this.run([`UID COPY ${set} `, astring(mailbox)]);
    await this.expungeUids(set);
  }

  async expungeUids(set) {
    await this.uidStore(set, '+FLAGS.SILENT', ['\\Deleted']);
    await this.run([this.capabilities.has('UIDPLUS') ? `UID EXPUNGE ${set}` : 'EXPUNGE']);
  }

  append(mailbox, flags, message) {
    return this.run(['APPEND ', astring(mailbox), ` (${flags.join(' ')}) `, message]);
  }

  async logout() {
    if (this.failure) return;
    this.loggingOut = true;
    try {
      await this.run(['LOGOUT']);
    } catch {
      // Beim Abmelden zaehlt nur, dass die Verbindung zu ist.
    } finally {
      this.detach();
      this.socket.destroy();
    }
  }
}

// ------------------------------------------------------------------ Ordner

const TRASH_NAMES = [
  'trash',
  'papierkorb',
  'gelöscht',
  'gelöschte elemente',
  'gelöschte objekte',
  'gelöschte nachrichten',
  'deleted',
  'deleted items',
  'deleted messages',
  'bin',
];

const SENT_NAMES = [
  'sent',
  'gesendet',
  'gesendete elemente',
  'gesendete objekte',
  'gesendete nachrichten',
  'sent items',
  'sent messages',
  'sent mail',
];

/** Erst nach Special-Use (`\Trash`, `\Sent`), dann nach bekannten Namen. */
function findFolder(folders, use, names) {
  const selectable = folders.filter(
    (folder) => !folder.flags.some((flag) => /^\\(noselect|nonexistent)$/i.test(flag)),
  );
  const byUse = selectable.find((folder) =>
    folder.flags.some((flag) => flag.toLowerCase() === use.toLowerCase()),
  );
  if (byUse) return byUse.name;
  const byName = selectable.find((folder) => {
    const decoded = decodeMailboxName(folder.name);
    const segments = folder.delimiter ? decoded.split(folder.delimiter) : [decoded];
    return names.includes(
      String(segments[segments.length - 1])
        .trim()
        .toLowerCase(),
    );
  });
  return byName ? byName.name : null;
}

const findTrash = (folders) => findFolder(folders, '\\Trash', TRASH_NAMES);
const findSent = (folders) => findFolder(folders, '\\Sent', SENT_NAMES);

// ------------------------------------------------------------------ Einstieg

/**
 * Oeffnet eine angemeldete Verbindung.
 * `secure`: direkt TLS (993). Sonst STARTTLS — ausser im Test gegen 127.0.0.1.
 */
async function connectImap({ host, port, secure, username, password, timeoutMs = TIMEOUT_MS }) {
  let client = null;
  try {
    const socket = await openSocket({ host, port, secure, timeoutMs });
    client = new ImapConnection(socket, { timeoutMs });
    await client.greeting();
    if (client.capabilities.size === 0) await client.capability();
    if (!secure && !allowsPlain(host)) {
      if (!client.capabilities.has('STARTTLS')) throw new MailError('tls_failed');
      await client.run(['STARTTLS']);
      const secured = await upgradeToTls(client.detach(), host, timeoutMs);
      client = new ImapConnection(secured, { timeoutMs });
      await client.capability();
    }
    await client.login(username, password);
    return client;
  } catch (error) {
    if (client && !client.failure) client.detach().destroy();
    throw toMailError(error);
  }
}

/** Verbinden, `task` ausfuehren, abmelden — auch wenn `task` wirft. */
async function withImap(options, task) {
  const client = await connectImap(options);
  try {
    return await task(client);
  } catch (error) {
    throw toMailError(error, 'protocol');
  } finally {
    await client.logout();
  }
}

module.exports = {
  ImapConnection,
  connectImap,
  withImap,
  astring,
  sequenceSet,
  parseValues,
  decodeMailboxName,
  findTrash,
  findSent,
};
