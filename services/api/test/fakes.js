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

function createFakeImap({
  username = 'user@example.ch',
  password = 'secret',
  capabilities = ['IMAP4rev1', 'UIDPLUS'],
  uidValidity = 42,
  greet = true,
} = {}) {
  const state = {
    uidValidity,
    folders: [
      { name: 'INBOX', flags: ['\\HasNoChildren'] },
      { name: 'Trash', flags: ['\\HasNoChildren', '\\Trash'] },
      { name: 'Sent', flags: ['\\HasNoChildren', '\\Sent'] },
    ],
    boxes: { INBOX: [], Trash: [], Sent: [] },
    uidNext: { INBOX: 1, Trash: 1, Sent: 1 },
    lines: [],
    logins: 0,
  };
  const sockets = new Set();

  function addMessage(folder, raw, { flags = [], date = new Date() } = {}) {
    const uid = state.uidNext[folder];
    state.uidNext = { ...state.uidNext, [folder]: uid + 1 };
    const message = { uid, flags: [...flags], internalDate: date, body: Buffer.from(raw) };
    state.boxes = { ...state.boxes, [folder]: [...state.boxes[folder], message] };
    return uid;
  }

  function fetchResponse(message, seq, items, byUid) {
    const wanted = JSON.stringify(items).toUpperCase();
    const head = [];
    if (byUid || wanted.includes('"UID"')) head.push(`UID ${message.uid}`);
    if (wanted.includes('FLAGS')) head.push(`FLAGS (${message.flags.join(' ')})`);
    if (wanted.includes('INTERNALDATE')) {
      head.push(`INTERNALDATE "${formatInternalDate(message.internalDate)}"`);
    }
    if (!wanted.includes('BODY.PEEK[]'))
      return Buffer.from(`* ${seq} FETCH (${head.join(' ')})\r\n`);
    const body = message.body.subarray(0, 200000);
    return Buffer.concat([
      Buffer.from(`* ${seq} FETCH (${head.join(' ')} BODY[]<0> {${body.length}}\r\n`),
      body,
      Buffer.from(')\r\n'),
    ]);
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
      const set = text(args[1]);
      const found = box().filter((m) => inSet(set, m.uid, highest()));
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
      for (const m of chosen) addMessage(target, m.body, { flags: m.flags, date: m.internalDate });
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
      addMessage(folder, body, { flags: flags.map(text) });
      return okay('[APPENDUID 1 1] appended');
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

module.exports = { createFakeImap, createFakeSmtp };
