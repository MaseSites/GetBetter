/**
 * Nachgebaute Mail-Server fuer die Tests: IMAP und SMTP auf 127.0.0.1, ohne
 * TLS. Sie koennen gerade so viel, wie der Dienst benutzt, und schreiben mit,
 * was bei ihnen ankommt. Nie gegen echte Server testen.
 */
const net = require('node:net');

const { parseValues } = require('../mail/imap.js');

// ------------------------------------------------------------------ IMAP

function formatInternalDate(date) {
  const months = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${pad(date.getUTCDate())}-${months[date.getUTCMonth()]}-${date.getUTCFullYear()} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} +0000`
  );
}

function inSet(set, value, highest) {
  return String(set)
    .split(',')
    .some((range) => {
      const [from, to = from] = range.split(':');
      const low = from === '*' ? highest : Number(from);
      const high = to === '*' ? highest : Number(to);
      return value >= Math.min(low, high) && value <= Math.max(low, high);
    });
}

const text = (value) => (Buffer.isBuffer(value) ? value.toString('utf8') : String(value ?? ''));

/** Eine schlichte Textmail — so sieht ihre BODYSTRUCTURE aus. */
const PLAIN_STRUCTURE = '("TEXT" "PLAIN" ("CHARSET" "utf-8") NIL NIL "7BIT" 120 4)';

/** Kopf und Rumpf einer Nachricht oder eines Teils (die Tests schreiben CRLF). */
function splitEntity(buffer) {
  // Ein Teil ohne eigene Kopfzeilen beginnt gleich mit der Leerzeile.
  if (buffer.subarray(0, 2).toString('latin1') === '\r\n') {
    return { head: '', body: buffer.subarray(2) };
  }
  const index = buffer.indexOf('\r\n\r\n');
  if (index === -1) return { head: buffer.toString('latin1'), body: Buffer.alloc(0) };
  return { head: buffer.subarray(0, index).toString('latin1'), body: buffer.subarray(index + 4) };
}

/** Die Teile eines multipart — oder `null`, wenn es keiner ist. */
function childrenOf(entity) {
  const { head, body } = splitEntity(entity);
  if (!/^content-type:\s*multipart\//im.test(head)) return null;
  const boundary = /boundary="?([^";\r\n]+)"?/i.exec(head)?.[1];
  if (!boundary) return null;
  const parts = [];
  for (const piece of body.toString('latin1').split(`--${boundary}`).slice(1)) {
    if (piece.startsWith('--')) break;
    parts.push(Buffer.from(piece.replace(/^\r\n/, '').replace(/\r\n$/, ''), 'latin1'));
  }
  return parts;
}

/** Die Kopfzeilen mit diesen Namen, samt Faltung, wie `HEADER.FIELDS` sie liefert. */
function headerLines(raw, names) {
  const kept = [];
  let keeping = false;
  for (const line of splitEntity(raw).head.split('\r\n')) {
    if (/^[ \t]/.test(line)) {
      if (keeping) kept.push(line);
      continue;
    }
    const colon = line.indexOf(':');
    keeping = colon > 0 && names.includes(line.slice(0, colon).trim().toLowerCase());
    if (keeping) kept.push(line);
  }
  return Buffer.from(`${kept.map((line) => `${line}\r\n`).join('')}\r\n`, 'latin1');
}

/** Was `BODY[section]` meint: alles, bestimmte Kopfzeilen oder ein Teil ohne seine MIME-Kopfzeilen. */
function sectionOf(raw, section) {
  if (section === '') return raw;
  const fields = /^HEADER\.FIELDS \(([^)]*)\)$/i.exec(section);
  if (fields) return headerLines(raw, fields[1].toLowerCase().split(/\s+/).filter(Boolean));
  let entity = raw;
  for (const number of section.split('.').map(Number)) {
    const children = childrenOf(entity);
    if (children) {
      entity = children[number - 1];
      if (!entity) return null;
    } else if (number !== 1) {
      return null;
    }
  }
  return splitEntity(entity).body;
}

/** Die Ordner, die jedes nachgebaute Postfach fuehrt — mit Special-Use wie echte Server. */
const FAKE_FOLDERS = [
  { name: 'INBOX', flags: ['\\HasNoChildren'] },
  { name: 'Trash', flags: ['\\HasNoChildren', '\\Trash'] },
  { name: 'Sent', flags: ['\\HasNoChildren', '\\Sent'] },
  { name: 'Junk', flags: ['\\HasNoChildren', '\\Junk'] },
  { name: 'Drafts', flags: ['\\HasNoChildren', '\\Drafts'] },
  { name: 'Archive', flags: ['\\HasNoChildren', '\\Archive'] },
];

function emptyBoxes(value) {
  return Object.fromEntries(FAKE_FOLDERS.map((folder) => [folder.name, value]));
}

function createFakeImap({
  username = 'user@example.ch',
  password = 'secret',
  capabilities = ['IMAP4rev1', 'UIDPLUS'],
  uidValidity = 42,
  greet = true,
} = {}) {
  const state = {
    uidValidity,
    folders: FAKE_FOLDERS,
    boxes: emptyBoxes([]),
    uidNext: emptyBoxes(1),
    lines: [],
    logins: 0,
  };
  const sockets = new Set();

  function addMessage(
    folder,
    raw,
    { flags = [], date = new Date(), structure = PLAIN_STRUCTURE } = {},
  ) {
    const uid = state.uidNext[folder];
    state.uidNext = { ...state.uidNext, [folder]: uid + 1 };
    const message = {
      uid,
      flags: [...flags],
      internalDate: date,
      structure,
      body: Buffer.from(raw),
    };
    state.boxes = { ...state.boxes, [folder]: [...state.boxes[folder], message] };
    return uid;
  }

  function fetchResponse(message, seq, items, byUid) {
    const list = (Array.isArray(items) ? items : [items]).map(text);
    const has = (name) => list.some((item) => item.toUpperCase() === name);
    const head = [];
    if (byUid || has('UID')) head.push(`UID ${message.uid}`);
    if (has('FLAGS')) head.push(`FLAGS (${message.flags.join(' ')})`);
    if (has('INTERNALDATE')) {
      head.push(`INTERNALDATE "${formatInternalDate(message.internalDate)}"`);
    }
    if (has('BODYSTRUCTURE')) head.push(`BODYSTRUCTURE ${message.structure ?? PLAIN_STRUCTURE}`);
    const chunks = [Buffer.from(`* ${seq} FETCH (${head.join(' ')}`)];
    let separator = head.length > 0 ? ' ' : '';
    for (const item of list) {
      const match = /^BODY(?:\.PEEK)?\[([^\]]*)\](?:<(\d+)\.(\d+)>)?$/i.exec(item);
      if (!match) continue;
      const origin = match[2] === undefined ? null : Number(match[2]);
      const key = `${separator}BODY[${match[1]}]${origin === null ? '' : `<${origin}>`}`;
      separator = ' ';
      const whole = sectionOf(message.body, match[1]);
      if (whole === null) {
        chunks.push(Buffer.from(`${key} NIL`));
        continue;
      }
      const bytes = origin === null ? whole : whole.subarray(origin, origin + Number(match[3]));
      chunks.push(Buffer.from(`${key} {${bytes.length}}\r\n`), bytes);
    }
    chunks.push(Buffer.from(')\r\n'));
    return Buffer.concat(chunks);
  }

  function execute(socket, session, parts) {
    const values = parseValues(parts);
    const tag = text(values[0]);
    const byUid = text(values[1]).toUpperCase() === 'UID';
    const command = text(values[byUid ? 2 : 1]).toUpperCase();
    const args = values.slice(byUid ? 3 : 2);
    const write = (line) => socket.write(line);
    const okay = (rest = 'done') => write(`${tag} OK ${rest}\r\n`);
    const box = () => state.boxes[session.selected] ?? [];
    const highest = () => box().reduce((max, m) => Math.max(max, m.uid), 0);

    if (command === 'CAPABILITY') {
      write(`* CAPABILITY ${capabilities.join(' ')}\r\n`);
      return okay();
    }
    if (command === 'LOGIN') {
      if (text(args[0]) !== username || text(args[1]) !== password) {
        return write(`${tag} NO [AUTHENTICATIONFAILED] Invalid credentials\r\n`);
      }
      state.logins += 1;
      return okay(`[CAPABILITY ${capabilities.join(' ')}] Logged in`);
    }
    if (command === 'SELECT') {
      session.selected = text(args[0]);
      write(`* FLAGS (\\Seen \\Deleted)\r\n* ${box().length} EXISTS\r\n`);
      write(`* OK [UIDVALIDITY ${state.uidValidity}] ok\r\n`);
      write(`* OK [UIDNEXT ${state.uidNext[session.selected] ?? 1}] ok\r\n`);
      return okay('[READ-WRITE] selected');
    }
    if (command === 'SEARCH') {
      const byHeader = text(args[0]).toUpperCase() === 'HEADER';
      const needle = text(args[2]).toLowerCase();
      const field = text(args[1]).toLowerCase();
      const found = box().filter((m) =>
        byHeader
          ? headerLines(m.body, [field]).toString('latin1').toLowerCase().includes(needle)
          : inSet(text(args[1]), m.uid, highest()),
      );
      write(`* SEARCH ${found.map((m) => m.uid).join(' ')}\r\n`.replace(' \r\n', '\r\n'));
      return okay();
    }
    if (command === 'FETCH') {
      const set = text(args[0]);
      box().forEach((message, index) => {
        const key = byUid ? message.uid : index + 1;
        if (inSet(set, key, byUid ? highest() : box().length)) {
          write(fetchResponse(message, index + 1, args[1], byUid));
        }
      });
      return okay();
    }
    if (command === 'STORE') {
      const [set, action, flagList] = [text(args[0]), text(args[1]).toUpperCase(), args[2]];
      const flags = flagList.map(text);
      state.boxes[session.selected] = box().map((m) => {
        if (!inSet(set, m.uid, highest())) return m;
        const next = action.startsWith('+')
          ? [...new Set([...m.flags, ...flags])]
          : m.flags.filter((flag) => !flags.includes(flag));
        return { ...m, flags: next };
      });
      return okay();
    }
    if (command === 'LIST') {
      for (const folder of state.folders) {
        write(`* LIST (${folder.flags.join(' ')}) "/" "${folder.name}"\r\n`);
      }
      return okay();
    }
    if (command === 'COPY' || command === 'MOVE') {
      const [set, target] = [text(args[0]), text(args[1])];
      const chosen = box().filter((m) => inSet(set, m.uid, highest()));
      for (const m of chosen) {
        addMessage(target, m.body, {
          flags: m.flags,
          date: m.internalDate,
          structure: m.structure,
        });
      }
      if (command === 'MOVE') {
        state.boxes[session.selected] = box().filter((m) => !chosen.includes(m));
      }
      return okay();
    }
    if (command === 'EXPUNGE') {
      const set = byUid ? text(args[0]) : null;
      state.boxes[session.selected] = box().filter(
        (m) => !(m.flags.includes('\\Deleted') && (set === null || inSet(set, m.uid, highest()))),
      );
      return okay();
    }
    if (command === 'APPEND') {
      const [folder, flags, body] = [text(args[0]), args[1], args[2]];
      const uid = addMessage(folder, body, { flags: flags.map(text) });
      // Nur wer UIDPLUS kann, sagt, unter welcher UID die Nachricht liegt.
      return okay(
        capabilities.includes('UIDPLUS')
          ? `[APPENDUID ${state.uidValidity} ${uid}] appended`
          : 'appended',
      );
    }
    if (command === 'LOGOUT') {
      write(`* BYE bye\r\n${tag} OK logged out\r\n`);
      return socket.end();
    }
    return write(`${tag} BAD unknown\r\n`);
  }

  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    const session = { selected: null };
    let buffer = Buffer.alloc(0);
    let pending = null;
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      for (;;) {
        if (pending && pending.need > 0) {
          if (buffer.length < pending.need) return;
          pending.parts.push(Buffer.from(buffer.subarray(0, pending.need)));
          buffer = buffer.subarray(pending.need);
          pending.need = 0;
          continue;
        }
        const end = buffer.indexOf('\r\n');
        if (end === -1) return;
        const line = buffer.subarray(0, end).toString('utf8');
        buffer = buffer.subarray(end + 2);
        state.lines.push(line);
        const parts = pending ? pending.parts : [];
        const literal = /\{(\d+)\}$/.exec(line);
        if (literal) {
          parts.push(line.slice(0, literal.index));
          pending = { parts, need: Number(literal[1]) };
          socket.write('+ Ready for literal\r\n');
          continue;
        }
        parts.push(line);
        pending = null;
        execute(socket, session, parts);
      }
    });
    if (greet) socket.write(`* OK [CAPABILITY ${capabilities.join(' ')}] Fake IMAP ready\r\n`);
  });

  return {
    state,
    addMessage,
    listen: () =>
      new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port))),
    close: () =>
      new Promise((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}

// ------------------------------------------------------------------ SMTP

function createFakeSmtp({
  username = 'user@example.ch',
  password = 'secret',
  auth = ['PLAIN', 'LOGIN'],
  rejectRecipients = [],
} = {}) {
  const state = { messages: [], lines: [] };
  const sockets = new Set();

  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    const session = { from: null, recipients: [], data: null, login: null };
    let buffer = '';
    const write = (line) => socket.write(`${line}\r\n`);

    const handleLine = (line) => {
      if (session.data !== null) {
        if (line === '.') {
          const stuffed = session.data.join('\r\n');
          const message = session.data
            .map((l) => (l.startsWith('.') ? l.slice(1) : l))
            .join('\r\n');
          state.messages.push({
            from: session.from,
            recipients: session.recipients,
            stuffed,
            message,
          });
          session.data = null;
          return write('250 2.0.0 queued');
        }
        session.data.push(line);
        return undefined;
      }
      state.lines.push(line);
      if (session.login === 'user') {
        session.login = Buffer.from(line, 'base64').toString('utf8');
        return write('334 UGFzc3dvcmQ6');
      }
      if (typeof session.login === 'string' && session.login !== 'done') {
        const given = Buffer.from(line, 'base64').toString('utf8');
        const accepted = session.login === username && given === password;
        session.login = 'done';
        return write(accepted ? '235 2.7.0 ok' : '535 5.7.8 bad credentials');
      }
      const upper = line.toUpperCase();
      if (upper.startsWith('EHLO')) {
        return write(`250-fake.local\r\n250-AUTH ${auth.join(' ')}\r\n250 8BITMIME`);
      }
      if (upper.startsWith('AUTH PLAIN ')) {
        const [, user, pass] = Buffer.from(line.slice(11), 'base64').toString('utf8').split('\0');
        return write(user === username && pass === password ? '235 2.7.0 ok' : '535 5.7.8 bad');
      }
      if (upper === 'AUTH LOGIN') {
        session.login = 'user';
        return write('334 VXNlcm5hbWU6');
      }
      if (upper.startsWith('MAIL FROM:')) {
        session.from = line.slice(10).replace(/[<>]/g, '');
        return write('250 2.1.0 ok');
      }
      if (upper.startsWith('RCPT TO:')) {
        const address = line.slice(8).replace(/[<>]/g, '');
        if (rejectRecipients.includes(address)) return write('550 5.1.1 no such user');
        session.recipients = [...session.recipients, address];
        return write('250 2.1.5 ok');
      }
      if (upper === 'DATA') {
        session.data = [];
        return write('354 go ahead');
      }
      if (upper === 'QUIT') {
        write('221 2.0.0 bye');
        return socket.end();
      }
      return write('502 5.5.2 unknown');
    };

    socket.on('data', (chunk) => {
      buffer += chunk.toString('latin1');
      let end = buffer.indexOf('\r\n');
      while (end !== -1) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        handleLine(line);
        end = buffer.indexOf('\r\n');
      }
    });
    write('220 fake.local ESMTP');
  });

  return {
    state,
    listen: () =>
      new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port))),
    close: () =>
      new Promise((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}

module.exports = { createFakeImap, createFakeSmtp, sectionOf };
