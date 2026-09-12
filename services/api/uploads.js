/**
 * Eigene Bilder (z.B. der Hintergrund): als data-URL herein, als Datei in
 * `<datenordner>/uploads/<id>.<endung>` abgelegt, per GET wieder heraus.
 *
 * Nur JPEG, PNG und WebP, hoechstens 5 MB. Die ersten Bytes muessen zum
 * angegebenen Typ passen — sonst koennte man beliebige Dateien als Bild ausliefern.
 */
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const { dataDir } = require('./config.js');
const { load, rowsOf } = require('./store.js');

const MAX_BYTES = 5 * 1024 * 1024;
const UPLOAD_ID = /^upl_[a-f0-9]{24}$/;

const TYPES = {
  'image/jpeg': {
    extension: 'jpg',
    matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  'image/png': {
    extension: 'png',
    matches: (b) =>
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  'image/webp': {
    extension: 'webp',
    matches: (b) => b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP',
  },
};

const uploadsDir = () => path.join(dataDir(), 'uploads');

/** `data:image/png;base64,…` -> `{ type, bytes }` oder ein Fehlerschluessel. */
function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return { error: 'bad_request' };
  const comma = dataUrl.indexOf(',');
  const header = /^data:(image\/[a-z0-9.+-]+);base64$/i.exec(
    comma === -1 ? '' : dataUrl.slice(0, comma),
  );
  if (!header) return { error: 'bad_request' };
  const declared = header[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : header[1].toLowerCase();
  const type = TYPES[declared];
  if (!type) return { error: 'unsupported_type' };
  const encoded = dataUrl.slice(comma + 1).replace(/\s+/g, '');
  // Grob vorab: base64 ist ein Drittel groesser als die Bytes.
  if (encoded.length > Math.ceil((MAX_BYTES * 4) / 3) + 4) return { error: 'too_large' };
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return { error: 'bad_request' };
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length === 0) return { error: 'bad_request' };
  if (bytes.length > MAX_BYTES) return { error: 'too_large' };
  if (!type.matches(bytes)) return { error: 'unsupported_type' };
  return { type: declared, extension: type.extension, bytes };
}

async function saveUpload(input) {
  const accountId = input && typeof input === 'object' ? input.accountId : undefined;
  if (typeof accountId !== 'string' || accountId.length === 0) {
    return { status: 400, body: { error: 'bad_request' } };
  }
  const parsed = parseDataUrl(input.dataUrl);
  if (parsed.error) {
    return { status: parsed.error === 'too_large' ? 413 : 400, body: { error: parsed.error } };
  }
  const db = await load();
  if (!rowsOf(db, 'accounts').some((row) => row.id === accountId)) {
    return { status: 404, body: { error: 'not_found' } };
  }
  const id = `upl_${crypto.randomBytes(12).toString('hex')}`;
  await fs.mkdir(uploadsDir(), { recursive: true });
  await fs.writeFile(path.join(uploadsDir(), `${id}.${parsed.extension}`), parsed.bytes, {
    flag: 'wx',
  });
  return { status: 201, body: { id, url: `/v1/uploads/${id}` } };
}

/** Sucht die Datei zu einer Id; die Endung verraet den Typ. */
async function findUpload(id) {
  if (!UPLOAD_ID.test(String(id))) return null;
  for (const [type, { extension }] of Object.entries(TYPES)) {
    const file = path.join(uploadsDir(), `${id}.${extension}`);
    try {
      await fs.access(file);
      return { file, type };
    } catch {
      // Naechste Endung versuchen.
    }
  }
  return null;
}

async function readUpload(id) {
  const found = await findUpload(id);
  if (!found) return null;
  return { type: found.type, bytes: await fs.readFile(found.file) };
}

async function deleteUpload(id) {
  const found = await findUpload(id);
  if (!found) return { status: 404, body: { error: 'not_found' } };
  await fs.rm(found.file, { force: true });
  return { status: 200, body: { ok: true } };
}

module.exports = { MAX_BYTES, parseDataUrl, saveUpload, readUpload, deleteUpload };
