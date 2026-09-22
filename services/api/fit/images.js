/**
 * Bilder fuer die Mahlzeitenanalyse: Typ an den echten Bytes erkennen, Groesse
 * begrenzen und alle Metadaten entfernen (EXIF mit Ort und Geraet, XMP, IPTC,
 * Kommentare) — bevor ein Bild irgendwohin geht oder kurz liegen bleibt.
 *
 * Kein Umkodieren: die Pixel bleiben, nur die Beipackzettel fallen weg.
 */

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Der Typ nach den ersten Bytes — was die Anfrage behauptet, zaehlt nicht. */
function sniff(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/**
 * JPEG: APP1 (EXIF, XMP), APP2 ausser ICC, APP12, APP13 (IPTC), APP14 bleibt
 * (Farbraum), COM weg. Ab dem Bildbeginn (SOS) wird unveraendert kopiert.
 */
function stripJpeg(bytes) {
  const parts = [bytes.subarray(0, 2)];
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    // Fuellbytes
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    // Ohne Laenge: RST, SOI, EOI
    if ((marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) {
      parts.push(bytes.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) return null;
    const segment = bytes.subarray(offset, offset + 2 + length);
    if (marker === 0xda) {
      // Ab hier Bilddaten bis zum Ende.
      parts.push(bytes.subarray(offset));
      return Buffer.concat(parts);
    }
    const isIcc = marker === 0xe2 && segment.toString('ascii', 4, 15) === 'ICC_PROFILE';
    const drop = marker === 0xfe || marker === 0xe1 || marker === 0xed || marker === 0xec || (marker === 0xe2 && !isIcc) || (marker >= 0xe3 && marker <= 0xeb) || marker === 0xef;
    if (!drop) parts.push(segment);
    offset += 2 + length;
  }
  return null;
}

/** PNG: Text-, Zeit- und EXIF-Chunks weg; alles, was das Bild braucht, bleibt. */
function stripPng(bytes) {
  const DROP = new Set(['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME']);
  const parts = [bytes.subarray(0, 8)];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > bytes.length) return null;
    if (!DROP.has(type)) parts.push(bytes.subarray(offset, end));
    offset = end;
    if (type === 'IEND') return Buffer.concat(parts);
  }
  return null;
}

/** WebP: EXIF- und XMP-Chunks weg, dazu die Merker im VP8X-Kopf. */
function stripWebp(bytes) {
  const chunks = [];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const end = offset + 8 + size + (size % 2);
    if (offset + 8 + size > bytes.length) return null;
    if (type !== 'EXIF' && type !== 'XMP ') {
      const chunk = Buffer.from(bytes.subarray(offset, Math.min(end, bytes.length)));
      // VP8X: Bit 3 = EXIF, Bit 2 = XMP.
      if (type === 'VP8X' && chunk.length > 8) chunk[8] &= ~0b1100;
      chunks.push(chunk);
    }
    offset = end;
  }
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8, 'ascii');
  return Buffer.concat([header, body]);
}

/**
 * Aus base64 ein sauberes Bild: `{ ok, mime, bytes }` oder `{ ok: false, error }`.
 * Fehler: `image_missing`, `image_too_large`, `image_type`, `image_broken`.
 */
function cleanImage(base64, { maxBytes = MAX_IMAGE_BYTES } = {}) {
  if (typeof base64 !== 'string' || base64.length === 0) return { ok: false, error: 'image_missing' };
  const raw = base64.includes(',') && base64.startsWith('data:') ? base64.slice(base64.indexOf(',') + 1) : base64;
  if ((raw.length * 3) / 4 > maxBytes + 3) return { ok: false, error: 'image_too_large' };
  const bytes = Buffer.from(raw, 'base64');
  if (bytes.length > maxBytes) return { ok: false, error: 'image_too_large' };
  const mime = sniff(bytes);
  if (!mime) return { ok: false, error: 'image_type' };
  const stripped = mime === 'image/jpeg' ? stripJpeg(bytes) : mime === 'image/png' ? stripPng(bytes) : stripWebp(bytes);
  if (!stripped) return { ok: false, error: 'image_broken' };
  return { ok: true, mime, bytes: stripped };
}

module.exports = { MAX_IMAGE_BYTES, cleanImage, sniff, stripJpeg, stripPng, stripWebp };
