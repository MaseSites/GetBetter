const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { cleanImage, sniff } = require('./images.js');

const segment = (marker, payload) => {
  const head = Buffer.alloc(4);
  head[0] = 0xff;
  head[1] = marker;
  head.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([head, payload]);
};

/** Ein JPEG-Geruest mit EXIF (Ort!), Kommentar, JFIF und ICC — die Bilddaten sind egal. */
function jpegWithExif() {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    segment(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'binary')),
    segment(0xe1, Buffer.from('Exif\0\0GPS 47.3769N 8.5417E iPhone', 'binary')),
    segment(0xe2, Buffer.from('ICC_PROFILE\0\x01\x01farbe', 'binary')),
    segment(0xfe, Buffer.from('Kommentar mit Namen', 'binary')),
    segment(0xdb, Buffer.alloc(65, 1)),
    segment(0xda, Buffer.from([0, 1, 2, 3])),
    Buffer.from([0x11, 0x22, 0x33, 0xff, 0xd9]),
  ]);
}

function pngChunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  return Buffer.concat([head, data, Buffer.alloc(4)]);
}

function pngWithText() {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', Buffer.alloc(13)),
    pngChunk('tEXt', Buffer.from('Author\0Anna Muster')),
    pngChunk('eXIf', Buffer.from('GPS')),
    pngChunk('IDAT', Buffer.alloc(10, 7)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function webpWithExif() {
  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.write(type, 0, 'ascii');
    head.writeUInt32LE(data.length, 4);
    return Buffer.concat([head, data, data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
  };
  const vp8x = Buffer.alloc(10);
  vp8x[0] = 0b1100;
  const body = Buffer.concat([chunk('VP8X', vp8x), chunk('VP8 ', Buffer.alloc(12, 5)), chunk('EXIF', Buffer.from('GPS 47N')), chunk('XMP ', Buffer.from('<x/>'))]);
  const head = Buffer.alloc(12);
  head.write('RIFF', 0, 'ascii');
  head.writeUInt32LE(body.length + 4, 4);
  head.write('WEBP', 8, 'ascii');
  return Buffer.concat([head, body]);
}

describe('Bilder', () => {
  test('Typ an den Bytes, nicht an der Behauptung', () => {
    assert.equal(sniff(jpegWithExif()), 'image/jpeg');
    assert.equal(sniff(pngWithText()), 'image/png');
    assert.equal(sniff(webpWithExif()), 'image/webp');
    assert.equal(sniff(Buffer.from('<svg><script>alert(1)</script></svg>')), null);
    assert.equal(cleanImage(Buffer.from('GIF89a-------').toString('base64')).error, 'image_type');
  });

  test('JPEG verliert EXIF und Kommentar, behaelt JFIF, ICC und Bilddaten', () => {
    const result = cleanImage(`data:image/jpeg;base64,${jpegWithExif().toString('base64')}`);
    assert.equal(result.ok, true);
    const text = result.bytes.toString('binary');
    assert.equal(text.includes('GPS'), false);
    assert.equal(text.includes('Kommentar'), false);
    assert.equal(text.includes('JFIF'), true);
    assert.equal(text.includes('ICC_PROFILE'), true);
    assert.deepEqual([...result.bytes.subarray(-5)], [0x11, 0x22, 0x33, 0xff, 0xd9]);
  });

  test('PNG verliert Text und EXIF', () => {
    const result = cleanImage(pngWithText().toString('base64'));
    assert.equal(result.ok, true);
    assert.equal(result.bytes.includes(Buffer.from('Anna')), false);
    assert.equal(result.bytes.includes(Buffer.from('GPS')), false);
    assert.equal(result.bytes.includes(Buffer.from('IDAT')), true);
  });

  test('WebP verliert EXIF und XMP samt Merkern', () => {
    const result = cleanImage(webpWithExif().toString('base64'));
    assert.equal(result.ok, true);
    assert.equal(result.bytes.includes(Buffer.from('GPS')), false);
    assert.equal(result.bytes.includes(Buffer.from('XMP ')), false);
    assert.equal(result.bytes.readUInt32LE(4), result.bytes.length - 8);
    assert.equal(result.bytes[20] & 0b1100, 0);
  });

  test('zu gross und kaputt', () => {
    assert.equal(cleanImage(jpegWithExif().toString('base64'), { maxBytes: 20 }).error, 'image_too_large');
    const broken = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]), Buffer.alloc(8)]);
    assert.equal(cleanImage(broken.toString('base64')).error, 'image_broken');
  });
});
