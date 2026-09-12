/**
 * Liest E-Mails (RFC 5322 / MIME) so weit, wie die Apps sie brauchen:
 * Absender, Empfaenger, Betreff, Datum, Message-ID und den Text.
 *
 * Ohne Fremdbibliothek. Zeichensaetze gehen ueber `TextDecoder`, alles andere
 * — Header entfalten, RFC 2047, multipart, base64, quoted-printable, HTML zu
 * Text — steht hier. Jede Schleife laeuft linear, damit eine boesartige Mail
 * den Dienst nicht aufhaelt.
 */

const MAX_TEXT = 20_000;
const MAX_SNIPPET = 160;
const MAX_DEPTH = 8;
const MAX_PARTS = 100;
const MAX_HEADERS = 500;
const MAX_ADDRESS_HEADER = 10_000;

// ------------------------------------------------------------------ Zeichensaetze

function decoderFor(label, fatal) {
  try {
    return new TextDecoder(label, { fatal });
  } catch {
    return null;
  }
}

/** UTF-8 streng versuchen, sonst Windows-1252 — so kommen auch falsch deklarierte Mails an. */
function decodeLoose(bytes) {
  const strict = decoderFor('utf-8', true);
  try {
    // `stream` verzeiht ein am Ende abgeschnittenes Zeichen (Abruf auf 200 KB begrenzt).
    return strict.decode(bytes, { stream: true });
  } catch {
    return decoderFor('windows-1252', false).decode(bytes);
  }
}

function decodeBytes(bytes, charset) {
  const label = String(charset ?? '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .toLowerCase();
  if (label === '' || label === 'utf-8' || label === 'utf8') return decodeLoose(bytes);
  const decoder = decoderFor(label, false);
  return decoder ? decoder.decode(bytes) : decodeLoose(bytes);
}

// ------------------------------------------------------------------ RFC 2047

function wordBytes(encoding, text) {
  if (encoding.toUpperCase() === 'B') return Buffer.from(text, 'base64');
  const out = Buffer.alloc(text.length);
  let length = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const hex = text.slice(i + 1, i + 3);
    if (ch === '=' && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      out[length] = parseInt(hex, 16);
      i += 2;
    } else {
      out[length] = ch === '_' ? 0x20 : text.charCodeAt(i) & 0xff;
    }
    length += 1;
  }
  return out.subarray(0, length);
}

/** `=?utf-8?B?…?=` und `=?iso-8859-1?Q?…?=`; benachbarte Woerter ohne Leerraum dazwischen. */
function decodeWords(input) {
  const text = String(input ?? '');
  if (!text.includes('=?')) return text;
  const pattern = /=\?([^?\s]+)\?([BbQq])\?([^?\s]*)\?=/g;
  const out = [];
  let pending = null;
  let last = 0;
  const flush = () => {
    if (pending) out.push(decodeBytes(Buffer.concat(pending.chunks), pending.charset));
    pending = null;
  };
  for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
    const between = text.slice(last, match.index);
    // RFC 2231: `utf-8*de` traegt eine Sprache mit.
    const charset = match[1].split('*')[0].toLowerCase();
    const bytes = wordBytes(match[2], match[3]);
    if (pending && /^\s*$/.test(between) && pending.charset === charset) {
      pending = { charset, chunks: [...pending.chunks, bytes] };
    } else {
      const glued = pending !== null && /^\s*$/.test(between);
      flush();
      if (!glued) out.push(between);
      pending = { charset, chunks: [bytes] };
    }
    last = pattern.lastIndex;
  }
  flush();
  out.push(text.slice(last));
  return out.join('');
}

// ------------------------------------------------------------------ Header

function splitHeaderBody(buffer) {
  if (buffer.length === 0) return { head: buffer, body: buffer };
  if (buffer[0] === 0x0a) return { head: buffer.subarray(0, 0), body: buffer.subarray(1) };
  if (buffer[0] === 0x0d && buffer[1] === 0x0a) {
    return { head: buffer.subarray(0, 0), body: buffer.subarray(2) };
  }
  const crlf = buffer.indexOf('\r\n\r\n');
  const lf = buffer.indexOf('\n\n');
  if (crlf === -1 && lf === -1) return { head: buffer, body: buffer.subarray(buffer.length) };
  if (lf !== -1 && (crlf === -1 || lf < crlf)) {
    return { head: buffer.subarray(0, lf), body: buffer.subarray(lf + 2) };
  }
  return { head: buffer.subarray(0, crlf), body: buffer.subarray(crlf + 4) };
}

/** Entfaltet die Header zu `[name, wert]`, Namen klein geschrieben. */
function parseHeaders(text) {
  const headers = [];
  for (const line of String(text).split(/\r?\n/)) {
    const previous = headers[headers.length - 1];
    if (/^[ \t]/.test(line) && previous) {
      headers[headers.length - 1] = [previous[0], `${previous[1]}${line}`];
    } else if (headers.length < MAX_HEADERS) {
      const colon = line.indexOf(':');
      if (colon > 0)
        headers.push([line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1)]);
    }
  }
  return headers.map(([name, value]) => [name, value.trim()]);
}

function headerValue(headers, name) {
  const found = headers.find((entry) => entry[0] === name);
  return found ? found[1] : '';
}

/** `text/plain; charset="utf-8"` -> `{ value: 'text/plain', params: { charset: 'utf-8' } }` */
function parseParams(input) {
  const text = String(input ?? '');
  const params = {};
  let index = text.indexOf(';');
  const value = (index === -1 ? text : text.slice(0, index)).trim().toLowerCase();
  while (index !== -1 && index < text.length) {
    const equals = text.indexOf('=', index + 1);
    if (equals === -1) break;
    const name = text
      .slice(index + 1, equals)
      .trim()
      .toLowerCase();
    let cursor = equals + 1;
    while (text[cursor] === ' ' || text[cursor] === '\t') cursor += 1;
    let raw = '';
    if (text[cursor] === '"') {
      cursor += 1;
      while (cursor < text.length && text[cursor] !== '"') {
        if (text[cursor] === '\\' && cursor + 1 < text.length) cursor += 1;
        raw += text[cursor];
        cursor += 1;
      }
      index = text.indexOf(';', cursor);
    } else {
      const end = text.indexOf(';', cursor);
      raw = (end === -1 ? text.slice(cursor) : text.slice(cursor, end)).trim();
      index = end;
    }
    if (name.length > 0 && !(name in params)) params[name] = raw;
  }
  return { value, params };
}

// ------------------------------------------------------------------ Koerper

function decodeQuotedPrintable(buffer) {
  const text = buffer.toString('latin1').replace(/=[ \t]*\r?\n/g, '');
  const out = Buffer.alloc(text.length);
  let length = 0;
  for (let i = 0; i < text.length; i += 1) {
    const hex = text.slice(i + 1, i + 3);
    if (text[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      out[length] = parseInt(hex, 16);
      i += 2;
    } else {
      out[length] = text.charCodeAt(i) & 0xff;
    }
    length += 1;
  }
  return out.subarray(0, length);
}

function decodeTransfer(buffer, encoding) {
  if (encoding === 'base64') {
    return Buffer.from(buffer.toString('latin1').replace(/[^A-Za-z0-9+/=]/g, ''), 'base64');
  }
  if (encoding === 'quoted-printable') return decodeQuotedPrintable(buffer);
  return buffer;
}

/** Sucht `--grenze` am Zeilenanfang, gefolgt von Zeilenende, Leerraum oder `--`. */
function findDelimiter(text, delimiter, from) {
  let index = text.indexOf(delimiter, from);
  while (index !== -1) {
    const atLineStart = index === 0 || text[index - 1] === '\n';
    const after = text[index + delimiter.length];
    if (atLineStart && (after === undefined || /[-\r\n \t]/.test(after))) return index;
    index = text.indexOf(delimiter, index + 1);
  }
  return -1;
}

function splitMultipart(body, boundary) {
  const text = body.toString('latin1');
  const delimiter = `--${boundary}`;
  const parts = [];
  let index = findDelimiter(text, delimiter, 0);
  while (index !== -1 && parts.length < MAX_PARTS) {
    const cursor = index + delimiter.length;
    if (text.startsWith('--', cursor)) break;
    const lineEnd = text.indexOf('\n', cursor);
    if (lineEnd === -1) break;
    const start = lineEnd + 1;
    const next = findDelimiter(text, delimiter, start);
    // Abgeschnittene Mail: der letzte Teil reicht bis zum Ende.
    let end = next === -1 ? text.length : next;
    if (next !== -1 && text[end - 1] === '\n') end -= 1;
    if (next !== -1 && text[end - 1] === '\r') end -= 1;
    parts.push(body.subarray(start, Math.max(start, end)));
    index = next;
  }
  return parts;
}

function parseEntity(buffer, depth = 0) {
  const { head, body } = splitHeaderBody(buffer);
  const headers = parseHeaders(decodeLoose(head));
  const type = parseParams(headerValue(headers, 'content-type') || 'text/plain');
  const disposition = parseParams(headerValue(headers, 'content-disposition'));
  const mime = type.value || 'text/plain';
  const boundary = type.params.boundary;
  const parts =
    mime.startsWith('multipart/') && boundary && depth < MAX_DEPTH
      ? splitMultipart(body, boundary).map((part) => parseEntity(part, depth + 1))
      : [];
  return {
    headers,
    mime,
    charset: type.params.charset ?? '',
    attachment:
      disposition.value === 'attachment' ||
      'filename' in disposition.params ||
      'filename*' in disposition.params,
    encoding: headerValue(headers, 'content-transfer-encoding').toLowerCase(),
    body,
    parts,
  };
}

function findPart(entity, mime) {
  if (entity.parts.length > 0) {
    for (const part of entity.parts) {
      const found = findPart(part, mime);
      if (found) return found;
    }
    return null;
  }
  return entity.mime === mime && !entity.attachment ? entity : null;
}

function entityText(entity) {
  return decodeBytes(decodeTransfer(entity.body, entity.encoding), entity.charset);
}

// ------------------------------------------------------------------ HTML zu Text

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  shy: '',
  zwnj: '',
  zwj: '',
  auml: 'ä',
  ouml: 'ö',
  uuml: 'ü',
  Auml: 'Ä',
  Ouml: 'Ö',
  Uuml: 'Ü',
  szlig: 'ß',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  agrave: 'à',
  aacute: 'á',
  acirc: 'â',
  ccedil: 'ç',
  iacute: 'í',
  oacute: 'ó',
  ograve: 'ò',
  ocirc: 'ô',
  uacute: 'ú',
  ugrave: 'ù',
  ntilde: 'ñ',
  euro: '€',
  pound: '£',
  copy: '©',
  reg: '®',
  trade: '™',
  deg: '°',
  times: '×',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  laquo: '«',
  raquo: '»',
  lsquo: '‘',
  rsquo: '’',
  sbquo: '‚',
  ldquo: '“',
  rdquo: '”',
  bdquo: '„',
  bull: '•',
  middot: '·',
};

function decodeEntities(text) {
  return text.replace(
    /&(#[xX][0-9a-fA-F]{1,6}|#[0-9]{1,7}|[A-Za-z][A-Za-z0-9]{1,31});/g,
    (whole, name) => {
      if (name[0] !== '#') return Object.hasOwn(ENTITIES, name) ? ENTITIES[name] : whole;
      const hex = name[1] === 'x' || name[1] === 'X';
      const code = hex ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      const valid = code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff);
      return valid ? String.fromCodePoint(code) : '';
    },
  );
}

/** Entfernt `<style>…</style>` und Verwandte; ein offenes Ende schneidet den Rest ab. */
function stripBlocks(html, tag) {
  const open = new RegExp(`<${tag}\\b`, 'gi');
  const close = new RegExp(`</${tag}\\s*>`, 'gi');
  let out = '';
  let cursor = 0;
  for (let match = open.exec(html); match !== null; match = open.exec(html)) {
    out += html.slice(cursor, match.index);
    close.lastIndex = open.lastIndex;
    if (!close.exec(html)) return out;
    cursor = close.lastIndex;
    open.lastIndex = cursor;
  }
  return out + html.slice(cursor);
}

function stripComments(html) {
  let out = '';
  let cursor = 0;
  for (let start = html.indexOf('<!--'); start !== -1; start = html.indexOf('<!--', cursor)) {
    out += html.slice(cursor, start);
    const end = html.indexOf('-->', start + 4);
    if (end === -1) return out;
    cursor = end + 3;
  }
  return out + html.slice(cursor);
}

const BLOCK_TAGS = new Set([
  'p',
  'div',
  'tr',
  'table',
  'ul',
  'ol',
  'blockquote',
  'section',
  'article',
  'header',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
]);

function tagReplacement(inner) {
  const match = /^(\/?)([A-Za-z][A-Za-z0-9]*)/.exec(inner);
  if (!match) return '';
  const name = match[2].toLowerCase();
  if (name === 'br') return '\n';
  if (name === 'li') return match[1] ? '' : '\n- ';
  return BLOCK_TAGS.has(name) ? '\n' : '';
}

function stripTags(html) {
  let out = '';
  let cursor = 0;
  let open = html.indexOf('<');
  while (open !== -1) {
    if (!/[A-Za-z/!]/.test(html[open + 1] ?? '')) {
      open = html.indexOf('<', open + 1);
      continue;
    }
    const close = html.indexOf('>', open + 1);
    if (close === -1) break;
    out += html.slice(cursor, open) + tagReplacement(html.slice(open + 1, close));
    cursor = close + 1;
    open = html.indexOf('<', cursor);
  }
  return out + html.slice(cursor);
}

function htmlToText(html) {
  let text = stripComments(String(html ?? ''));
  for (const tag of ['head', 'style', 'script', 'title']) text = stripBlocks(text, tag);
  return decodeEntities(stripTags(text));
}

// ------------------------------------------------------------------ Text kuerzen

function cut(text, max) {
  if (text.length <= max) return text;
  const code = text.charCodeAt(max - 1);
  return text.slice(0, code >= 0xd800 && code <= 0xdbff ? max - 1 : max);
}

function normaliseText(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function snippetOf(text) {
  const flat = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (flat.length <= MAX_SNIPPET) return flat;
  const head = cut(flat, MAX_SNIPPET);
  const space = head.lastIndexOf(' ');
  return (space > MAX_SNIPPET - 40 ? head.slice(0, space) : head).trim();
}

// ------------------------------------------------------------------ Adressen

function splitAddressItems(text) {
  const items = [];
  let current = '';
  let quoted = false;
  let comment = 0;
  let angle = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if ((quoted || comment > 0) && ch === '\\' && i + 1 < text.length) {
      current += ch + text[i + 1];
      i += 1;
      continue;
    }
    if (quoted) {
      quoted = ch !== '"';
    } else if (comment > 0) {
      if (ch === '(') comment += 1;
      if (ch === ')') comment -= 1;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === '(') {
      comment = 1;
    } else if (ch === '<') {
      angle = true;
    } else if (ch === '>') {
      angle = false;
    } else if (!angle && (ch === ',' || ch === ';')) {
      items.push(current);
      current = '';
      continue;
    } else if (!angle && ch === ':') {
      // Gruppe: `Team: a@b.ch, c@d.ch;` — der Gruppenname faellt weg.
      current = '';
      continue;
    }
    current += ch;
  }
  items.push(current);
  return items;
}

function cleanName(raw) {
  let name = raw.trim();
  if (name.length >= 2 && name.startsWith('"') && name.endsWith('"')) {
    name = name.slice(1, -1).replace(/\\(.)/g, '$1');
  }
  return decodeWords(name).replace(/\s+/g, ' ').trim();
}

function parseAddressItem(raw) {
  const item = raw.trim();
  if (item.length === 0) return null;
  const lt = item.lastIndexOf('<');
  if (lt !== -1) {
    const gt = item.indexOf('>', lt);
    const address = item.slice(lt + 1, gt === -1 ? item.length : gt).replace(/\s+/g, '');
    return address.length > 0 ? { name: cleanName(item.slice(0, lt)), address } : null;
  }
  const comments = [];
  const address = item
    .replace(/\(([^()]*)\)/g, (whole, inner) => {
      comments.push(inner);
      return '';
    })
    .replace(/\s+/g, '');
  return address.length > 0 ? { name: cleanName(comments.join(' ')), address } : null;
}

function parseAddressList(input) {
  const text = cut(String(input ?? ''), MAX_ADDRESS_HEADER);
  return splitAddressItems(text)
    .map(parseAddressItem)
    .filter((entry) => entry !== null);
}

// ------------------------------------------------------------------ Nachricht

function parseDate(...candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const date = new Date(String(candidate).trim());
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}

function parseMessageId(value) {
  const match = /<[^<>\s]{1,900}>/.exec(String(value ?? ''));
  if (match) return match[0];
  const bare = String(value ?? '').trim();
  return bare.length > 0 && bare.length < 900 && !/\s/.test(bare) ? `<${bare}>` : null;
}

/**
 * Macht aus den rohen Bytes einer Mail, was in einer `mailMessages`-Zeile steht.
 * `internalDate` (vom IMAP-Server) springt ein, wenn der Date-Header fehlt.
 */
function parseMessage(buffer, options = {}) {
  const root = parseEntity(Buffer.isBuffer(buffer) ? buffer : Buffer.from(String(buffer)));
  const plain = findPart(root, 'text/plain');
  const html = plain ? null : findPart(root, 'text/html');
  const raw = plain ? entityText(plain) : html ? htmlToText(entityText(html)) : '';
  const text = cut(normaliseText(raw), MAX_TEXT);
  const from = parseAddressList(headerValue(root.headers, 'from'))[0] ?? { name: '', address: '' };
  return {
    messageId: parseMessageId(headerValue(root.headers, 'message-id')),
    from,
    to: parseAddressList(headerValue(root.headers, 'to')),
    cc: parseAddressList(headerValue(root.headers, 'cc')),
    subject: cut(
      decodeWords(headerValue(root.headers, 'subject')).replace(/\s+/g, ' ').trim(),
      1000,
    ),
    date: parseDate(headerValue(root.headers, 'date'), options.internalDate),
    text,
    snippet: snippetOf(text),
  };
}

module.exports = {
  MAX_TEXT,
  MAX_SNIPPET,
  decodeBytes,
  decodeWords,
  decodeQuotedPrintable,
  parseHeaders,
  parseParams,
  parseAddressList,
  htmlToText,
  parseMessage,
};
