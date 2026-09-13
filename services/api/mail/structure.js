/**
 * Liest die BODYSTRUCTURE einer Mail: welche Teile sie hat, wo sie liegen und
 * welche davon Anhaenge sind.
 *
 * Der Abgleich holt hoechstens 200 KB je Mail — ein grosser Anhang waere darin
 * abgeschnitten, seine Groesse also erfunden. Die BODYSTRUCTURE kommt dagegen
 * vom Server und nennt Typ, Namen und Laenge, ohne dass ein Byte des Anhangs
 * ueber die Leitung geht.
 *
 * Aufgebaut nach RFC 3501 7.4.2: ein Teil ist eine Liste; beginnt sie mit einer
 * Liste, ist es ein multipart mit seinen Teilen davor. Die Nummer eines Teils
 * (`1`, `1.2`, …) ist die, mit der man ihn per `BODY.PEEK[1.2]` holt; eine Mail
 * ohne multipart hat genau den Teil `1`.
 */
const { decodeBytes, decodeWords } = require('./mime.js');

const MAX_ATTACHMENTS = 20;
const MAX_LEAVES = 100;
const MAX_DEPTH = 8;
const MAX_FILENAME = 200;
const MAX_CONTENT_ID = 250;
const BASE64_RATIO = 3 / 4;
const DISPOSITIONS = new Set(['attachment', 'inline']);
/** Die Pflichtfelder eines einfachen Teils enden beim sechsten; danach kommt Beiwerk. */
const EXTENSION_FROM = 7;

const text = (value) => {
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  return value === null || value === undefined ? '' : String(value);
};

/** `('CHARSET' 'utf-8' 'NAME' 'x.pdf')` -> `{ charset: 'utf-8', name: 'x.pdf' }` */
function paramsOf(list) {
  const params = {};
  if (!Array.isArray(list)) return params;
  for (let index = 0; index + 1 < list.length; index += 2) {
    const name = text(list[index]).toLowerCase();
    if (name.length > 0 && !(name in params)) params[name] = text(list[index + 1]);
  }
  return params;
}

function percentBytes(value) {
  const out = Buffer.alloc(value.length);
  let length = 0;
  for (let index = 0; index < value.length; index += 1) {
    const hex = value.slice(index + 1, index + 3);
    if (value[index] === '%' && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      out[length] = parseInt(hex, 16);
      index += 2;
    } else {
      out[length] = value.charCodeAt(index) & 0xff;
    }
    length += 1;
  }
  return out.subarray(0, length);
}

/** RFC 2231: `utf-8''Rechnung%20M%C3%A4rz.pdf` — sonst RFC 2047 (`=?utf-8?B?…?=`). */
function decodeFilename(raw) {
  const value = String(raw ?? '');
  const extended = /^([^']*)'[^']*'([\s\S]*)$/.exec(value);
  if (!extended) return decodeWords(value);
  return decodeBytes(percentBytes(extended[2]), extended[1]);
}

/** Erst der ausgeschriebene Name, dann der einfache — je einmal fuer Ablage und Typ. */
function nameOf(dispositionParams, typeParams) {
  const candidates = [
    dispositionParams['filename*'],
    dispositionParams.filename,
    typeParams['name*'],
    typeParams.name,
  ];
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === '') continue;
    const name = decodeFilename(candidate)
      .replace(/[\r\n\t]+/g, ' ')
      .trim();
    if (name.length > 0) return name.slice(0, MAX_FILENAME);
  }
  return '';
}

/**
 * Die Ablage (`attachment`, `inline`) steht hinter den Pflichtfeldern, aber je
 * nach Typ an anderer Stelle. Deshalb wird gesucht statt gezaehlt: genommen
 * wird die erste Liste, die mit einem der beiden Woerter beginnt.
 */
function dispositionOf(part) {
  for (let index = EXTENSION_FROM; index < part.length; index += 1) {
    const entry = part[index];
    if (!Array.isArray(entry) || entry.length === 0) continue;
    const value = text(entry[0]).toLowerCase();
    if (!DISPOSITIONS.has(value)) continue;
    return { value, params: paramsOf(entry[1]) };
  }
  return { value: '', params: {} };
}

/** Die Zahl auf der Leitung; base64 traegt ein Drittel Luft mit sich. */
function sizeOf(part, encoding) {
  const raw = Number(text(part[6]));
  if (!Number.isFinite(raw) || raw < 0) return 0;
  return encoding === 'base64' ? Math.floor(raw * BASE64_RATIO) : Math.round(raw);
}

/** `<logo@x>` -> `logo@x`; so steht es auch hinter `cid:` im HTML. */
function contentIdOf(value) {
  const inner = text(value)
    .trim()
    .replace(/^<([\s\S]*)>$/, '$1')
    .trim();
  const valid = inner.length > 0 && inner.length <= MAX_CONTENT_ID && !/[\s<>"]/.test(inner);
  return valid ? inner : null;
}

function leafOf(part, section) {
  const typeParams = paramsOf(part[2]);
  const encoding = text(part[5]).toLowerCase();
  const disposition = dispositionOf(part);
  return {
    section,
    mime: `${text(part[0]).toLowerCase()}/${text(part[1]).toLowerCase()}`,
    charset: typeParams.charset ?? '',
    encoding,
    disposition: disposition.value,
    filename: nameOf(disposition.params, typeParams),
    contentId: contentIdOf(part[3]),
    size: sizeOf(part, encoding),
  };
}

function walk(part, found, depth, section) {
  if (!Array.isArray(part) || found.length >= MAX_LEAVES || depth > MAX_DEPTH) return;
  if (Array.isArray(part[0])) {
    let number = 0;
    for (const child of part) {
      if (!Array.isArray(child)) break;
      number += 1;
      walk(child, found, depth + 1, section === '' ? `${number}` : `${section}.${number}`);
    }
    return;
  }
  found.push(leafOf(part, section === '' ? '1' : section));
}

/** Alle einfachen Teile einer Mail, in der Reihenfolge der BODYSTRUCTURE. */
function partsOf(structure) {
  const found = [];
  walk(structure, found, 0, '');
  return found;
}

/**
 * Ein Anhang ist, was der Server so nennt — oder was einen Dateinamen traegt
 * und kein Text ist, oder ein Bild mit Content-ID: so tauchen auch eingebettete
 * Bilder auf, auf die das HTML mit `cid:` zeigt.
 */
function isAttachment(leaf) {
  return (
    leaf.disposition === 'attachment' ||
    (leaf.filename.length > 0 && !leaf.mime.startsWith('text/')) ||
    (leaf.contentId !== null && leaf.mime.startsWith('image/'))
  );
}

/** Die Teile, die Anhaenge sind — mit Kodierung, fuer das Ausliefern. */
function attachmentLeavesOf(structure) {
  return partsOf(structure).filter(isAttachment).slice(0, MAX_ATTACHMENTS);
}

/**
 * Die Anhaenge, wie sie an einer `mailMessages`-Zeile stehen. `part` ist die
 * IMAP-Nummer des Teils, `contentId` die Content-ID ohne spitze Klammern.
 */
function attachmentsOf(structure) {
  return attachmentLeavesOf(structure).map((leaf) => ({
    filename: leaf.filename,
    mime: leaf.mime,
    size: leaf.size,
    part: leaf.section,
    contentId: leaf.contentId,
  }));
}

/** Der erste Text- und der erste HTML-Teil, die kein Anhang sind. */
function bodyPartsOf(structure) {
  const bodies = partsOf(structure).filter(
    (leaf) => leaf.disposition !== 'attachment' && leaf.filename.length === 0,
  );
  return {
    plain: bodies.find((leaf) => leaf.mime === 'text/plain') ?? null,
    html: bodies.find((leaf) => leaf.mime === 'text/html') ?? null,
  };
}

module.exports = {
  MAX_ATTACHMENTS,
  attachmentLeavesOf,
  attachmentsOf,
  bodyPartsOf,
  decodeFilename,
  partsOf,
};
